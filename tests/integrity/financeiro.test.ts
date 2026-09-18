import { describe, expect, it } from 'vitest';
import {
  diaDaSemana,
  enumerarDias,
  mediaPorDiaDaSemana,
  montarFinanceiro,
  montarGrafico,
} from '@/lib/financeiro';

/**
 * A tela financeira decide se o negócio está ganhando dinheiro. Os casos abaixo são os que
 * devolvem um número plausível e errado — que é o único tipo de erro que ninguém vai atrás.
 */

const dia = (d: string, pedidos: number, centavos: number) => ({ dia: d, pedidos, centavos });

describe('montarFinanceiro', () => {
  it('junta faturamento e gasto, e ordena do mais recente para o mais antigo', () => {
    const r = montarFinanceiro(
      [dia('2026-09-15', 9, 52989), dia('2026-09-16', 13, 64987)],
      new Map([
        ['2026-09-15', 11063],
        ['2026-09-16', 12617],
      ]),
    );

    expect(r.dias.map((d) => d.dia)).toEqual(['2026-09-16', '2026-09-15']);
    expect(r.dias[0]?.lucroCentavos).toBe(64987 - 12617);
    expect(r.faturamentoCentavos).toBe(52989 + 64987);
    expect(r.gastoCentavos).toBe(11063 + 12617);
    expect(r.lucroCentavos).toBe(52989 + 64987 - 11063 - 12617);
    expect(r.pedidos).toBe(22);
    expect(r.diasSemGasto).toBe(0);
  });

  it('⚠️ mostra o dia em que se gastou e NÃO se vendeu', () => {
    /*
      O dia de prejuízo puro é o mais importante da série, e é justamente o que desapareceria se a
      lista viesse só de `orders`. Sumindo da tela, o total de gasto pararia de fechar com a fatura
      do Meta e o lucro sairia alto demais.
    */
    const r = montarFinanceiro([dia('2026-09-16', 13, 64987)], new Map([
      ['2026-09-16', 12617],
      ['2026-09-11', 5791],
    ]));

    // O calendário agora é preenchido, então 11 a 16 aparecem todos. Endereçar por DATA e não por
    // índice: a posição muda sempre que a regra do calendário muda, e o que o teste afirma não.
    const vazio = r.dias.find((d) => d.dia === '2026-09-11');
    expect(vazio?.pedidos).toBe(0);
    expect(vazio?.faturamentoCentavos).toBe(0);
    expect(vazio?.lucroCentavos).toBe(-5791);
    expect(r.gastoCentavos).toBe(12617 + 5791);
  });

  it('gasto ausente não vira zero — o lucro do dia fica null', () => {
    const r = montarFinanceiro([dia('2026-09-17', 6, 29994)], new Map());

    expect(r.dias[0]?.gastoCentavos).toBeNull();
    expect(r.dias[0]?.lucroCentavos).toBeNull();
    /*
      Zero, e não 1: sem NENHUM gasto informado em lugar nenhum, não existe série de mídia começada,
      e portanto não existe dia "faltando". O aviso da tela só passa a fazer sentido depois do
      primeiro gasto digitado — antes disso ele pediria para preencher dias em que não havia campanha.
    */
    expect(r.diasSemGasto).toBe(0);
  });

  it('⚠️ o total de lucro NÃO soma dia sem gasto informado', () => {
    /*
      Se o total fosse "faturamento inteiro − gasto parcial", o lucro sairia inflado e continuaria
      plausível. `diasSemGasto` é o que deixa o total legível: dá para ver o que falta nele.
    */
    const r = montarFinanceiro(
      [dia('2026-09-16', 13, 64987), dia('2026-09-17', 6, 29994)],
      new Map([['2026-09-16', 12617]]),
    );

    expect(r.faturamentoCentavos).toBe(64987 + 29994);
    expect(r.lucroCentavos).toBe(64987 - 12617); // o dia 17 fica fora
    expect(r.diasSemGasto).toBe(1);
  });

  it('ticket médio do dia é faturamento ÷ pedidos', () => {
    const r = montarFinanceiro(
      [dia('2026-09-16', 13, 64987), dia('2026-09-13', 20, 91980)],
      new Map(),
    );

    const em = (d: string) => r.dias.find((x) => x.dia === d);
    // 13 pedidos de R$ 49,99 — o dia que vendeu só o produto caro
    expect(em('2026-09-16')?.ticketMedioCentavos).toBe(4999);
    // 16 × 49,99 + 4 × 29,99 = R$ 45,99 de média
    expect(em('2026-09-13')?.ticketMedioCentavos).toBe(4599);
    // e os dias 14 e 15, sem venda, não têm ticket
    expect(em('2026-09-14')?.ticketMedioCentavos).toBeNull();
  });

  it('⚠️ ticket médio do TOTAL é faturamento total ÷ pedidos totais, não média das médias', () => {
    /*
      A média das médias daria (49,99 + 29,99) / 2 = R$ 39,99 — dando ao dia de 1 pedido o mesmo
      peso do dia de 20. O certo pondera pelo volume: 20 compras caras e 1 barata valem R$ 49,04.
    */
    const r = montarFinanceiro(
      [dia('2026-09-13', 20, 99980), dia('2026-09-11', 1, 2999)],
      new Map(),
    );

    expect(r.pedidos).toBe(21);
    expect(r.ticketMedioCentavos).toBe(Math.round((99980 + 2999) / 21)); // 4904
    expect(r.ticketMedioCentavos).not.toBe(Math.round((4999 + 2999) / 2));
  });

  it('dia sem pedido tem ticket médio null, e não Infinity', () => {
    const r = montarFinanceiro([], new Map([['2026-09-11', 5791]]));

    expect(r.dias[0]?.pedidos).toBe(0);
    expect(r.dias[0]?.ticketMedioCentavos).toBeNull();
    expect(r.ticketMedioCentavos).toBeNull();
  });

  it('gasto ZERO é diferente de gasto ausente', () => {
    const r = montarFinanceiro([dia('2026-09-16', 13, 64987)], new Map([['2026-09-16', 0]]));

    expect(r.dias[0]?.gastoCentavos).toBe(0);
    expect(r.dias[0]?.lucroCentavos).toBe(64987);
    expect(r.diasSemGasto).toBe(0);
  });

  it('acha os extremos, e o pior lucro pode ser negativo', () => {
    const r = montarFinanceiro(
      [dia('2026-09-13', 20, 91980), dia('2026-09-11', 4, 19996), dia('2026-09-16', 13, 64987)],
      new Map([
        ['2026-09-13', 15682],
        ['2026-09-11', 25000],
        ['2026-09-16', 12617],
      ]),
    );

    expect(r.melhorFaturamento?.dia).toBe('2026-09-13');
    expect(r.melhorLucro?.dia).toBe('2026-09-13');
    expect(r.piorLucro?.dia).toBe('2026-09-11');
    expect(r.piorLucro?.lucroCentavos).toBe(19996 - 25000);
  });

  it('lista vazia não lança, e devolve null nos extremos', () => {
    const r = montarFinanceiro([], new Map());

    expect(r.dias).toEqual([]);
    expect(r.faturamentoCentavos).toBe(0);
    expect(r.lucroCentavos).toBe(0);
    expect(r.melhorFaturamento).toBeNull();
    expect(r.melhorLucro).toBeNull();
    expect(r.piorLucro).toBeNull();
  });

  it('só faturamento, sem gasto nenhum: extremos de lucro ficam null', () => {
    const r = montarFinanceiro([dia('2026-09-16', 13, 64987)], new Map());

    expect(r.melhorFaturamento?.dia).toBe('2026-09-16');
    expect(r.melhorLucro).toBeNull();
    expect(r.piorLucro).toBeNull();
  });
});

describe('montarGrafico', () => {
  const base = (dia: string, fat: number, gasto: number | null) => ({
    dia,
    pedidos: 1,
    faturamentoCentavos: fat,
    gastoCentavos: gasto,
    lucroCentavos: gasto === null ? null : fat - gasto,
    ticketMedioCentavos: fat,
  });

  it('escala a partir do ZERO, e não do menor valor', () => {
    /*
      Escalar de min a max faria a menor barra sumir e a maior encher a tela, exagerando qualquer
      diferença. Com base no zero, 500 é metade de 1000 — que é o que o olho precisa ler.
    */
    const g = montarGrafico([base('2026-09-16', 100000, 0), base('2026-09-15', 50000, 0)], 'faturamento');
    expect(g.zeroEmPorcento).toBe(0);
    // A ordem é sempre crescente, qualquer que seja a ordem de entrada e o indicador.
    expect(g.barras.map((b) => b.rotulo)).toEqual(['2026-09-15', '2026-09-16']);
    expect(g.barras[0]?.altura).toBe(50);
    expect(g.barras[1]?.altura).toBe(100);
  });

  it('⚠️ valor ausente NÃO vira barra zerada', () => {
    const g = montarGrafico([base('2026-09-17', 64987, null), base('2026-09-16', 64987, 12617)], 'lucro');
    expect(g.barras.map((b) => b.rotulo)).toEqual(['2026-09-16', '2026-09-17']);
    expect(g.barras[0]?.valor).toBe(64987 - 12617);
    expect(g.barras[1]?.valor).toBeNull(); // o buraco do meio/fim continua visível
    expect(g.amostra).toBe(1); // e fora da média
  });

  it('abre espaço abaixo do zero quando há prejuízo', () => {
    const g = montarGrafico([base('2026-09-16', 10000, 5000), base('2026-09-11', 0, 5000)], 'lucro');
    expect(g.zeroEmPorcento).toBeCloseTo(50, 5); // −5000 a +5000
    const prejuizo = g.barras.find((b) => b.rotulo === '2026-09-11');
    expect(prejuizo?.negativo).toBe(true);
    expect(prejuizo?.base).toBeCloseTo(0, 5);
    expect(g.media).toBe(0);
  });

  it('série toda zerada não vira NaN', () => {
    const g = montarGrafico([base('2026-09-16', 0, 0)], 'faturamento');
    expect(Number.isFinite(g.barras[0]?.altura ?? NaN)).toBe(true);
    expect(g.barras[0]?.altura).toBe(0);
  });

  it('sem nenhum valor informado, a média é null', () => {
    const g = montarGrafico([base('2026-09-17', 100, null)], 'gasto');
    expect(g.media).toBeNull();
    expect(g.mediaEmPorcento).toBeNull();
    expect(g.amostra).toBe(0);
  });
});

describe('mediaPorDiaDaSemana', () => {
  const dia = (d: string, fat: number) => ({
    dia: d,
    pedidos: 1,
    faturamentoCentavos: fat,
    gastoCentavos: null,
    lucroCentavos: null,
    ticketMedioCentavos: fat,
  });

  it('⚠️ o dia da semana não escorrega por fuso', () => {
    /*
      `new Date('2026-09-13').getDay()` devolve o dia LOCAL de uma meia-noite UTC. Em Brasília isso
      é 21h de sábado, e todo domingo viraria sábado no gráfico — sem erro visível.
    */
    expect(diaDaSemana('2026-09-13')).toBe(0); // domingo
    expect(diaDaSemana('2026-09-14')).toBe(1); // segunda
    expect(diaDaSemana('2026-09-19')).toBe(6); // sábado
  });

  it('ordena do que mais fatura para o que menos, e conta a amostra', () => {
    const r = mediaPorDiaDaSemana([
      dia('2026-09-13', 91980), // domingo
      dia('2026-09-14', 57988), // segunda
      dia('2026-09-16', 64987), // quarta
      dia('2026-09-09', 27994), // quarta também
    ]);

    expect(r.map((l) => l.nome)).toEqual(['Domingo', 'Segunda', 'Quarta']);
    expect(r[0]?.dias).toBe(1);
    expect(r[2]?.nome).toBe('Quarta');
    expect(r[2]?.mediaCentavos).toBe(Math.round((64987 + 27994) / 2));
    expect(r[2]?.dias).toBe(2);
    expect(r[0]?.altura).toBe(100);
  });

  it('dia da semana sem ocorrência fica FORA, em vez de virar barra zerada', () => {
    const r = mediaPorDiaDaSemana([dia('2026-09-13', 91980)]);
    expect(r).toHaveLength(1);
    expect(r[0]?.nome).toBe('Domingo');
  });

  it('lista vazia não lança', () => {
    expect(mediaPorDiaDaSemana([])).toEqual([]);
  });
});

describe('os dois ajustes pedidos em 18/09', () => {
  const venda = (d: string, pedidos: number, centavos: number) => ({ dia: d, pedidos, centavos });

  it('enumerarDias inclui as duas pontas e atravessa virada de mês', () => {
    expect(enumerarDias('2026-09-04', '2026-09-07')).toEqual([
      '2026-09-04',
      '2026-09-05',
      '2026-09-06',
      '2026-09-07',
    ]);
    expect(enumerarDias('2026-08-30', '2026-09-02')).toEqual([
      '2026-08-30',
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
    ]);
    expect(enumerarDias('2026-09-04', '2026-09-04')).toEqual(['2026-09-04']);
  });

  it('⚠️ o dia sem venda aparece zerado, e ENTRA na média do faturamento', () => {
    /*
      O pedido do dono: "no dia 06 não teve venda... quero que ele apareça como zerado". Sem ele, a
      média divide o total por menos dias do que de fato passaram — e a leitura infla a receita
      esperada por dia.
    */
    const r = montarFinanceiro(
      [venda('2026-09-05', 2, 10000), venda('2026-09-07', 2, 10000)],
      new Map(),
    );

    expect(r.dias.map((d) => d.dia)).toEqual(['2026-09-07', '2026-09-06', '2026-09-05']);
    const seis = r.dias[1];
    expect(seis?.faturamentoCentavos).toBe(0);
    expect(seis?.pedidos).toBe(0);

    const g = montarGrafico([...r.dias].reverse(), 'faturamento');
    expect(g.amostra).toBe(3);
    expect(g.media).toBeCloseTo(20000 / 3, 5); // e NÃO 10000, que seria ignorar o dia 06
  });

  it('a série vai até HOJE, mesmo sem movimento no último dia', () => {
    const r = montarFinanceiro([venda('2026-09-16', 1, 5000)], new Map(), '2026-09-18');
    expect(r.dias.map((d) => d.dia)).toEqual(['2026-09-18', '2026-09-17', '2026-09-16']);
    expect(r.dias[0]?.faturamentoCentavos).toBe(0);
  });

  it('⚠️ a média do GASTO começa no primeiro dia com gasto, não no primeiro dia da série', () => {
    /*
      O outro pedido: "a média deve contar a partir do dia 09 incluso, pois antes não investia".
      Zero é "campanha pausada"; ausente antes do primeiro anúncio é "não se aplica".
    */
    const r = montarFinanceiro(
      [venda('2026-09-05', 1, 5000), venda('2026-09-09', 1, 5000), venda('2026-09-10', 1, 5000)],
      new Map([
        ['2026-09-09', 2000],
        ['2026-09-10', 4000],
      ]),
    );

    const g = montarGrafico([...r.dias].reverse(), 'gasto');
    expect(g.barras.map((b) => b.rotulo)).toEqual(['2026-09-09', '2026-09-10']);
    expect(g.media).toBe(3000);
    expect(g.amostra).toBe(2);
  });

  it('o faturamento continua usando a série INTEIRA, inclusive antes do primeiro anúncio', () => {
    const r = montarFinanceiro(
      [venda('2026-09-05', 1, 5000), venda('2026-09-09', 1, 5000)],
      new Map([['2026-09-09', 2000]]),
    );

    const g = montarGrafico([...r.dias].reverse(), 'faturamento');
    expect(g.barras).toHaveLength(5); // 05, 06, 07, 08, 09
    expect(g.amostra).toBe(5);
  });

  it('dias anteriores ao primeiro anúncio não entram em "diasSemGasto"', () => {
    const r = montarFinanceiro(
      [venda('2026-09-05', 1, 5000), venda('2026-09-09', 1, 5000), venda('2026-09-10', 1, 5000)],
      new Map([['2026-09-09', 2000]]),
    );

    // 05, 06, 07 e 08 não têm anúncio nenhum; só o dia 10 está de fato por preencher.
    expect(r.diasSemGasto).toBe(1);
  });

  it('buraco NO MEIO da série continua visível e fora da média', () => {
    const r = montarFinanceiro(
      [venda('2026-09-09', 1, 5000), venda('2026-09-10', 1, 5000), venda('2026-09-11', 1, 5000)],
      new Map([
        ['2026-09-09', 2000],
        ['2026-09-11', 4000],
      ]),
    );

    const g = montarGrafico([...r.dias].reverse(), 'gasto');
    expect(g.barras).toHaveLength(3);
    expect(g.barras[1]?.valor).toBeNull(); // o dia 10 aparece tracejado
    expect(g.amostra).toBe(2);
    expect(g.media).toBe(3000);
    expect(r.diasSemGasto).toBe(1);
  });

  it('média por dia da semana passa a contar os dias zerados', () => {
    const r = montarFinanceiro(
      [venda('2026-09-13', 1, 90000), venda('2026-09-20', 1, 0)],
      new Map(),
      '2026-09-20',
    );

    const semana = mediaPorDiaDaSemana(r.dias);
    const domingo = semana.find((l) => l.nome === 'Domingo');
    expect(domingo?.dias).toBe(2);
    expect(domingo?.mediaCentavos).toBe(45000); // e não 90000
  });
});

describe('⚠️ o corte do gasto ignora ZERO no começo, não só ausente', () => {
  const venda = (d: string, centavos: number) => ({ dia: d, pedidos: 1, centavos });

  /*
    O defeito que o print do dono pegou em 18/09: os dias anteriores ao primeiro anúncio estavam
    gravados como ZERO, não como ausentes, e a primeira versão do corte só pulava ausentes. A tela
    mostrou "média de R$ 67,02 sobre 15 dias" quando o certo eram R$ 111,70 sobre 9.
  */
  const gastos = new Map([
    ['2026-09-03', 0],
    ['2026-09-04', 0],
    ['2026-09-05', 0],
    ['2026-09-06', 0],
    ['2026-09-07', 0],
    ['2026-09-08', 0],
    ['2026-09-09', 2341],
    ['2026-09-10', 8816],
  ]);
  const resumo = montarFinanceiro([venda('2026-09-03', 1000)], gastos, '2026-09-10');

  it('a média do gasto começa no primeiro dia com gasto POSITIVO', () => {
    const g = montarGrafico(resumo.dias, 'gasto');
    expect(g.barras.map((b) => b.rotulo)).toEqual(['2026-09-09', '2026-09-10']);
    expect(g.amostra).toBe(2);
    expect(g.media).toBe((2341 + 8816) / 2);
  });

  it('faturamento e lucro NÃO são cortados — "SÓ PARA O GASTO"', () => {
    /*
      Dia com faturamento e sem anúncio deu lucro de verdade. O que não existia antes do dia 09 é a
      operação de mídia, não o negócio.
    */
    for (const ind of ['faturamento', 'lucro'] as const) {
      const g = montarGrafico(resumo.dias, ind);
      expect(g.barras).toHaveLength(8); // 03 a 10
      expect(g.barras[0]?.rotulo).toBe('2026-09-03');
    }
  });

  it('zero NO MEIO continua contando — é campanha pausada, não ausência de campanha', () => {
    const r = montarFinanceiro(
      [venda('2026-09-09', 1000)],
      new Map([
        ['2026-09-09', 3000],
        ['2026-09-10', 0],
        ['2026-09-11', 3000],
      ]),
      '2026-09-11',
    );

    const g = montarGrafico(r.dias, 'gasto');
    expect(g.barras).toHaveLength(3);
    expect(g.amostra).toBe(3);
    expect(g.media).toBe(2000); // e não 3000, que seria fingir que o dia pausado não existiu
  });

  it('série com gasto zero em TODOS os dias não deixa o gráfico vazio por engano', () => {
    const r = montarFinanceiro(
      [venda('2026-09-09', 1000)],
      new Map([['2026-09-09', 0]]),
      '2026-09-09',
    );

    const g = montarGrafico(r.dias, 'gasto');
    expect(g.barras).toHaveLength(0);
    expect(g.media).toBeNull(); // a tela some com a linha da média em vez de imprimir NaN
  });
});
