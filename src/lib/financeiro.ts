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

export function montarFinanceiro(
  faturamento: readonly { readonly dia: string; readonly pedidos: number; readonly centavos: number }[],
  gastos: ReadonlyMap<string, number>,
): ResumoFinanceiro {
  /*
    A união das duas fontes, e não só os dias com venda.

    Um dia em que se gastou e não se vendeu é o dia mais importante da série financeira — é
    prejuízo puro. Se a lista viesse só de `orders`, ele desapareceria da tela, e o total de gasto
    não fecharia com a fatura do Meta. O sintoma seria um lucro alto demais, que é o pior jeito de
    estar errado.
  */
  const todosOsDias = new Set<string>([...faturamento.map((f) => f.dia), ...gastos.keys()]);
  const porDia = new Map(faturamento.map((f) => [f.dia, f]));

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
    diasSemGasto: dias.filter((d) => d.gastoCentavos === null).length,
    melhorFaturamento: maiorPor(dias, (d) => d.faturamentoCentavos),
    melhorLucro: maiorPor(comLucro, (d) => d.lucroCentavos),
    piorLucro: maiorPor(comLucro, (d) => -d.lucroCentavos),
  };
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
