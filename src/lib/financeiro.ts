/**
 * A junção do faturamento com o gasto, e os extremos da série.
 *
 * ═══ POR QUE ISTO É PURO, SEPARADO DA CONSULTA ═══════════════════════════════════════════════
 *
 * Pedido pelo dono em 17/09/2026: *"venda total, custo com meta, consequentemente lucro total, dia
 * após dia, para fazer essa gestão financeira"*.
 *
 * Aqui moram três coisas que erram em silêncio: dia com venda e sem gasto registrado, dia com
 * gasto e sem venda nenhuma, e a busca do maior lucro numa lista que pode estar vazia. Nenhuma
 * delas precisa de banco para ser testada, e uma tela financeira que ninguém conferiu é pior que
 * nenhuma tela.
 *
 * ─── A DISTINÇÃO QUE O DONO FEZ, E QUE ESTE ARQUIVO PRESERVA ─────────────────────────────────
 *
 * Esta visão NÃO serve para julgar o Meta, e é por isso que ela pode somar receita de todas as
 * origens contra o gasto de um canal só:
 *
 * > *"as outras vendas que vêm, por exemplo, através de indicação minha em grupos, isso não tem
 * > que balizar o tanto que o Meta está funcionando"* — o dono, 17/09
 *
 * A série de decisão sobre o Meta é outra, vive em `docs/OPERACAO_DA_CAMPANHA.md` §4 e usa fluxo
 * Meta nas duas pontas. Misturar as duas leituras é o erro que as duas telas existem para evitar.
 */

export type DiaFinanceiro = {
  /** `AAAA-MM-DD` no fuso de Brasília — o mesmo dia que o Gerenciador de Anúncios reporta. */
  readonly dia: string;
  readonly pedidos: number;
  readonly faturamentoCentavos: number;
  /** `null` = gasto ainda não informado para este dia. Diferente de zero, que é "não gastei". */
  readonly gastoCentavos: number | null;
  /** `null` quando o gasto é desconhecido — lucro com gasto faltando seria otimista e falso. */
  readonly lucroCentavos: number | null;
  /** `null` sem pedido no dia: dividir por zero devolveria Infinity e a tela imprimiria "∞". */
  readonly ticketMedioCentavos: number | null;
};

export type ResumoFinanceiro = {
  readonly dias: readonly DiaFinanceiro[];
  readonly faturamentoCentavos: number;
  readonly gastoCentavos: number;
  readonly lucroCentavos: number;
  readonly pedidos: number;
  /**
   * Ticket médio do período INTEIRO, e não a média dos tickets diários.
   *
   * São números diferentes, e a diferença não é sutil: a média das médias dá o mesmo peso a um dia
   * de 20 pedidos e a um dia de 1, e um único dia magro de produto barato puxaria o total para
   * baixo como se valesse tanto quanto um domingo cheio. Faturamento total ÷ pedidos totais
   * responde "quanto vale uma compra desta operação", que é a pergunta.
   */
  readonly ticketMedioCentavos: number | null;
  /** Quantos dias da lista ainda estão sem gasto informado. */
  readonly diasSemGasto: number;
  readonly melhorFaturamento: DiaFinanceiro | null;
  readonly melhorLucro: DiaFinanceiro | null;
  readonly piorLucro: DiaFinanceiro | null;
};

/**
 * Todos os dias de calendário entre dois `AAAA-MM-DD`, inclusive as duas pontas.
 *
 * Usa `Date.UTC` pelo mesmo motivo de `diaDaSemana`: as datas aqui já SÃO dias de Brasília, e
 * qualquer aritmética no fuso local do servidor deslocaria a série inteira em um dia.
 */
export function enumerarDias(de: string, ate: string): string[] {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const parse = (s: string) => {
    const [a, m, d] = s.split('-').map(Number);
    return Date.UTC(a ?? 1970, (m ?? 1) - 1, d ?? 1);
  };

  const fim = parse(ate);
  const out: string[] = [];
  for (let t = parse(de); t <= fim; t += 86_400_000) {
    out.push(iso(new Date(t)));
    if (out.length > 3650) break; // trava de sanidade: dez anos é erro de entrada, não série
  }
  return out;
}

export function montarFinanceiro(
  faturamento: readonly { readonly dia: string; readonly pedidos: number; readonly centavos: number }[],
  gastos: ReadonlyMap<string, number>,
  /** Último dia da série, em `AAAA-MM-DD` de Brasília. Sem ele, para no último dia com movimento. */
  hoje?: string,
): ResumoFinanceiro {
  /*
    A união das duas fontes, e não só os dias com venda.

    Um dia em que se gastou e não se vendeu é o dia mais importante da série financeira — é
    prejuízo puro. Se a lista viesse só de `orders`, ele desapareceria da tela, e o total de gasto
    não fecharia com a fatura do Meta. O sintoma seria um lucro alto demais, que é o pior jeito de
    estar errado.
  */
  const comAlgo = [...faturamento.map((f) => f.dia), ...gastos.keys()].sort();
  const porDia = new Map(faturamento.map((f) => [f.dia, f]));

  /*
    ═══ O CALENDÁRIO É PREENCHIDO, E NÃO SÓ OS DIAS COM MOVIMENTO ═════════════════════════════

    Pedido do dono em 18/09/2026: *"no dia 06 não teve venda, por isso ele nem aparece no
    relatório. Quero que ele apareça como zerado"*.

    Ele está certo, e o motivo é estatístico, não cosmético: sem os dias zerados, o "faturamento
    médio por dia" divide o total por uma contagem MENOR do que os dias que de fato passaram. Uma
    operação que vendeu R$ 900 em dois dias e nada em outros cinco tem média de R$ 128 por dia, não
    de R$ 450 — e a segunda leitura é a que faz alguém projetar receita que não existe.

    O mesmo vale para a média por dia da semana: um domingo sem venda que some da série faz a média
    de domingo subir, e a ordem do gráfico passa a premiar o dia da semana que mais FALTA em vez do
    que mais fatura.
  */
  const primeiro = comAlgo[0];
  const todosOsDias =
    primeiro === undefined ? [] : enumerarDias(primeiro, hoje ?? comAlgo[comAlgo.length - 1] ?? primeiro);

  const dias: DiaFinanceiro[] = [...todosOsDias]
    .sort()
    .reverse()
    .map((dia) => {
      const venda = porDia.get(dia);
      const faturamentoCentavos = venda?.centavos ?? 0;
      const pedidos = venda?.pedidos ?? 0;
      const gastoCentavos = gastos.get(dia) ?? null;
      return {
        dia,
        pedidos,
        faturamentoCentavos,
        gastoCentavos,
        lucroCentavos: gastoCentavos === null ? null : faturamentoCentavos - gastoCentavos,
        ticketMedioCentavos: pedidos > 0 ? Math.round(faturamentoCentavos / pedidos) : null,
      };
    });

  const comLucro = dias.filter((d): d is DiaFinanceiro & { lucroCentavos: number } => d.lucroCentavos !== null);

  const faturamentoTotal = dias.reduce((s, d) => s + d.faturamentoCentavos, 0);
  const pedidosTotal = dias.reduce((s, d) => s + d.pedidos, 0);

  return {
    dias,
    faturamentoCentavos: faturamentoTotal,
    gastoCentavos: dias.reduce((s, d) => s + (d.gastoCentavos ?? 0), 0),
    /*
      O total de lucro soma só os dias COM gasto informado.

      Somar faturamento inteiro menos gasto parcial devolveria um lucro inflado — e inflado de um
      jeito que não aparece, porque o número continua plausível. `diasSemGasto` na tela é o que
      permite ler o total sabendo o que falta nele.
    */
    lucroCentavos: comLucro.reduce((s, d) => s + d.lucroCentavos, 0),
    pedidos: pedidosTotal,
    ticketMedioCentavos: pedidosTotal > 0 ? Math.round(faturamentoTotal / pedidosTotal) : null,
    /*
      Só conta do primeiro dia COM gasto para cá.

      Com o calendário preenchido, os dias anteriores ao primeiro anúncio passam a existir na lista
      — e eles não estão "sem gasto informado", estão sem anúncio nenhum. Contá-los faria o aviso da
      tela pedir para preencher dias em que não havia o que preencher, e um aviso que pede o
      impossível é um aviso que se aprende a ignorar.
    */
    diasSemGasto: aPartirDoPrimeiroGastoPositivo(dias).filter((d) => d.gastoCentavos === null).length,
    melhorFaturamento: maiorPor(dias, (d) => d.faturamentoCentavos),
    melhorLucro: maiorPor(comLucro, (d) => d.lucroCentavos),
    piorLucro: maiorPor(comLucro, (d) => -d.lucroCentavos),
  };
}

/**
 * Corta os dias anteriores ao primeiro gasto POSITIVO — o dia em que a campanha de fato começou.
 *
 * ═══ POR QUE "POSITIVO", E NÃO "INFORMADO" ═══════════════════════════════════════════════════
 *
 * Pedido do dono em 18/09/2026: *"a média deve contar a partir do dia 09 incluso, pois antes não
 * investia"*. A primeira versão desta função pulava só os dias com gasto AUSENTE (`null`), e não
 * resolveu — porque os dias anteriores estavam gravados como **zero**, não como ausentes. A tela
 * mostrou média de R$ 67,02 sobre 15 dias quando o certo eram R$ 111,70 sobre 9.
 *
 * O erro foi meu e de raciocínio: eu tratei "zero" e "ausente" como coisas diferentes — e são —,
 * mas esqueci que **no COMEÇO da série as duas significam o mesmo**: não havia campanha.
 *
 * ─── O QUE CONTINUA CONTANDO, E POR QUÊ ──────────────────────────────────────────────────────
 *
 * O corte é só o prefixo. Um zero NO MEIO da série é campanha pausada — dia real da operação de
 * mídia, em que se decidiu não gastar — e pertence à média: tirá-lo faria o gasto médio parecer
 * maior do que foi. Um `null` no meio é dia por preencher: sai da média (não há valor) e continua
 * visível no gráfico como barra tracejada.
 *
 * ─── E POR QUE SÓ O GASTO USA ISTO ───────────────────────────────────────────────────────────
 *
 * > *"SÓ PARA O GASTO"* — o dono, 18/09
 *
 * Está certo. Um dia com faturamento e sem anúncio deu lucro de verdade, e pertence à média de
 * lucro. O que não existe antes do dia 09 é a operação de MÍDIA, não o negócio.
 */
function aPartirDoPrimeiroGastoPositivo(dias: readonly DiaFinanceiro[]): readonly DiaFinanceiro[] {
  const ordenados = [...dias].sort((a, b) => a.dia.localeCompare(b.dia));
  const inicio = ordenados.findIndex((d) => d.gastoCentavos !== null && d.gastoCentavos > 0);
  return inicio === -1 ? [] : ordenados.slice(inicio);
}

/** `reduce` sem valor inicial lança em lista vazia. Aqui devolve `null`, que a tela sabe tratar. */
function maiorPor<T>(itens: readonly T[], valor: (item: T) => number): T | null {
  let melhor: T | null = null;
  let melhorValor = -Infinity;
  for (const item of itens) {
    const v = valor(item);
    if (v > melhorValor) {
      melhorValor = v;
      melhor = item;
    }
  }
  return melhor;
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════════
   OS DOIS GRÁFICOS — pedidos pelo dono em 18/09/2026
   ═══════════════════════════════════════════════════════════════════════════════════════════════ */

export const INDICADORES = ['faturamento', 'gasto', 'lucro'] as const;
export type Indicador = (typeof INDICADORES)[number];

export function ehIndicador(v: string | undefined): v is Indicador {
  return v !== undefined && (INDICADORES as readonly string[]).includes(v);
}

export type Barra = {
  readonly rotulo: string;
  /** `null` = o dia não tem esse indicador informado. Barra ausente ≠ barra de valor zero. */
  readonly valor: number | null;
  /** Altura da barra, em % da área do gráfico. */
  readonly altura: number;
  /** Distância do fundo até a BASE da barra, em %. Diferente de zero só quando há negativo. */
  readonly base: number;
  readonly negativo: boolean;
};

export type Grafico = {
  readonly barras: readonly Barra[];
  readonly media: number | null;
  /** Posição da linha da média, em % a partir do fundo. `null` quando não há o que medir. */
  readonly mediaEmPorcento: number | null;
  /** Posição do zero, em %. Só é diferente de 0 quando existe valor negativo na série. */
  readonly zeroEmPorcento: number;
  /** Quantos dias entraram na média — a média de um dia só não é média. */
  readonly amostra: number;
};

/**
 * Monta as barras de um indicador ao longo dos dias.
 *
 * ═══ AS TRÊS COISAS QUE UM GRÁFICO DE BARRAS ERRA EM SILÊNCIO ════════════════════════════════
 *
 * **1. Valor ausente vira zero.** Um dia sem gasto informado tem lucro desconhecido, não lucro
 * zero. Desenhado como barra rente ao chão, ele conta a mentira mais convincente que existe: um
 * dia que parece ter dado nada. Aqui `valor: null` sai como barra ausente, e fica visualmente
 * diferente de um dia que realmente deu zero.
 *
 * **2. O eixo não começa no zero.** Escalar de `min` a `max` faz a menor barra sumir e a maior
 * encher a tela, o que exagera qualquer diferença. A base é sempre o zero — só desce abaixo dele
 * quando existe prejuízo de verdade na série.
 *
 * **3. A média inclui o que não devia.** A média do lucro só pode somar dias com gasto informado,
 * pelo mesmo motivo que o total da tabela só soma esses. `amostra` diz quantos dias entraram.
 */
export function montarGrafico(
  dias: readonly DiaFinanceiro[],
  indicador: Indicador,
): Grafico {
  const valorDe = (d: DiaFinanceiro): number | null =>
    indicador === 'faturamento'
      ? d.faturamentoCentavos
      : indicador === 'gasto'
        ? d.gastoCentavos
        : d.lucroCentavos;

  /*
    ─── A ORDEM É SEMPRE CRESCENTE, PARA TODOS OS INDICADORES ─────────────────────────────────

    A primeira versão só ordenava para gasto e lucro (efeito colateral do corte), e mantinha o
    faturamento na ordem que chegasse. As barras mudariam de sentido ao trocar o filtro — tempo
    andando para a direita num gráfico e para a esquerda no outro, sem nada na tela avisando. Os
    testes pegaram isso.

    Ordenar aqui também tira a obrigação do chamador de lembrar de inverter a lista da tabela.
  */
  const emOrdem = [...dias].sort((a, b) => a.dia.localeCompare(b.dia));

  /*
    SÓ o gasto começa no primeiro dia de campanha. Faturamento e lucro usam a série inteira.

    O gráfico de gasto existe para ler a evolução do investimento, e seis dias rentes ao chão antes
    do primeiro anúncio não são evolução — são ausência de campanha, e afundam a média.

    Lucro fica de fora deste corte de propósito: dia com faturamento e sem anúncio deu lucro de
    verdade. O que não existia antes do primeiro anúncio é a operação de mídia, não o negócio.
  */
  const escopo = indicador === 'gasto' ? aPartirDoPrimeiroGastoPositivo(emOrdem) : emOrdem;
  const crus = escopo.map((d) => ({ rotulo: d.dia, valor: valorDe(d) }));
  const presentes = crus.map((c) => c.valor).filter((v): v is number => v !== null);

  if (presentes.length === 0) {
    return {
      barras: crus.map((c) => ({ ...c, altura: 0, base: 0, negativo: false })),
      media: null,
      mediaEmPorcento: null,
      zeroEmPorcento: 0,
      amostra: 0,
    };
  }

  const topo = Math.max(0, ...presentes);
  const fundo = Math.min(0, ...presentes);
  /*
    `|| 1` protege a série em que todos os valores são zero: topo e fundo iguais fariam divisão por
    zero e toda barra viraria NaN% — que o navegador ignora, deixando um gráfico vazio sem erro.
  */
  const amplitude = topo - fundo || 1;
  const emPorcento = (v: number) => ((v - fundo) / amplitude) * 100;
  const zeroEmPorcento = emPorcento(0);

  const media = presentes.reduce((s, v) => s + v, 0) / presentes.length;

  return {
    barras: crus.map((c) => {
      if (c.valor === null) return { ...c, altura: 0, base: 0, negativo: false };
      const pos = emPorcento(c.valor);
      const negativo = c.valor < 0;
      return {
        ...c,
        altura: Math.abs(pos - zeroEmPorcento),
        base: negativo ? pos : zeroEmPorcento,
        negativo,
      };
    }),
    media,
    mediaEmPorcento: emPorcento(media),
    zeroEmPorcento,
    amostra: presentes.length,
  };
}

const NOMES_DA_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/**
 * O dia da semana de uma data `AAAA-MM-DD`, sem passar perto de fuso.
 *
 * ⚠️ `new Date('2026-09-13').getDay()` é uma armadilha: a string sem hora é interpretada como
 * meia-noite UTC, e `getDay()` devolve o dia LOCAL de quem está rodando. Em Brasília (UTC−3) isso
 * é 21h do dia anterior — todo domingo viraria sábado no gráfico, e o gráfico continuaria
 * parecendo certo.
 *
 * `Date.UTC` + `getUTCDay()` fecha as duas pontas no mesmo fuso e o resultado independe de onde o
 * servidor está.
 */
export function diaDaSemana(iso: string): number {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Date(Date.UTC(ano ?? 1970, (mes ?? 1) - 1, dia ?? 1)).getUTCDay();
}

export type MediaDaSemana = {
  readonly indice: number;
  readonly nome: string;
  readonly mediaCentavos: number;
  /** Quantos dias desse dia da semana existem na série. Média de 1 dia não é média. */
  readonly dias: number;
  readonly altura: number;
};

/**
 * Faturamento médio por dia da semana, do que mais fatura para o que menos fatura.
 *
 * ─── POR QUE `dias` APARECE NO RESULTADO ─────────────────────────────────────────────────────
 *
 * Com nove dias de série, alguns dias da semana têm duas amostras e outros têm uma. "Quinta é o
 * melhor dia" apoiado numa única quinta é ruído com cara de descoberta — e é exatamente o tipo de
 * conclusão que faz alguém concentrar orçamento no dia errado. O número de amostras vai junto para
 * a tela poder mostrá-lo ao lado da barra.
 *
 * Dias da semana sem nenhuma ocorrência ficam FORA: uma barra zerada diria "essa terça faturou
 * nada", quando o certo é "não houve terça ainda".
 */
export function mediaPorDiaDaSemana(dias: readonly DiaFinanceiro[]): MediaDaSemana[] {
  const soma = new Map<number, { total: number; n: number }>();

  for (const d of dias) {
    const idx = diaDaSemana(d.dia);
    const atual = soma.get(idx) ?? { total: 0, n: 0 };
    soma.set(idx, { total: atual.total + d.faturamentoCentavos, n: atual.n + 1 });
  }

  const linhas = [...soma.entries()].map(([indice, { total, n }]) => ({
    indice,
    nome: NOMES_DA_SEMANA[indice] ?? '?',
    mediaCentavos: Math.round(total / n),
    dias: n,
  }));

  const maior = Math.max(1, ...linhas.map((l) => l.mediaCentavos));

  return linhas
    .sort((a, b) => b.mediaCentavos - a.mediaCentavos)
    .map((l) => ({ ...l, altura: (l.mediaCentavos / maior) * 100 }));
}
