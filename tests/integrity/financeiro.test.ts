import { describe, expect, it } from 'vitest';
import {
  diaDaSemana,
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

    expect(r.dias.map((d) => d.dia)).toEqual(['2026-09-16', '2026-09-11']);
    const vazio = r.dias[1];
    expect(vazio?.pedidos).toBe(0);
    expect(vazio?.faturamentoCentavos).toBe(0);
    expect(vazio?.lucroCentavos).toBe(-5791);
    expect(r.gastoCentavos).toBe(12617 + 5791);
  });

  it('gasto ausente não vira zero — o lucro do dia fica null', () => {
    const r = montarFinanceiro([dia('2026-09-17', 6, 29994)], new Map());

    expect(r.dias[0]?.gastoCentavos).toBeNull();
    expect(r.dias[0]?.lucroCentavos).toBeNull();
    expect(r.diasSemGasto).toBe(1);
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

    // 13 pedidos de R$ 49,99 — o dia que vendeu só o produto caro
    expect(r.dias[0]?.ticketMedioCentavos).toBe(4999);
    // 16 × 49,99 + 4 × 29,99 = R$ 45,99 de média
    expect(r.dias[1]?.ticketMedioCentavos).toBe(4599);
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
    expect(g.barras[0]?.altura).toBe(100);
    expect(g.barras[1]?.altura).toBe(50);
  });

  it('⚠️ valor ausente NÃO vira barra zerada', () => {
    const g = montarGrafico([base('2026-09-17', 64987, null), base('2026-09-16', 64987, 12617)], 'lucro');
    expect(g.barras[0]?.valor).toBeNull();
    expect(g.barras[1]?.valor).toBe(64987 - 12617);
    expect(g.amostra).toBe(1); // o dia sem gasto ficou fora da média
  });

  it('abre espaço abaixo do zero quando há prejuízo', () => {
    const g = montarGrafico([base('2026-09-16', 10000, 5000), base('2026-09-11', 0, 5000)], 'lucro');
    expect(g.zeroEmPorcento).toBeCloseTo(50, 5); // −5000 a +5000
    expect(g.barras[1]?.negativo).toBe(true);
    expect(g.barras[1]?.base).toBeCloseTo(0, 5);
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
