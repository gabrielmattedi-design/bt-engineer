/**
 * A soma da tabela "De onde vieram".
 *
 * ═══ POR QUE ISTO EXISTE, E POR QUE VIVE EM `lib/` ═══════════════════════════════════════════
 *
 * Em 18/09 a tabela tinha quatro origens e nenhuma linha de total. A leitura foi somar duas das
 * quatro de cabeça, chegar a 8, comparar com o 11 da caixa "O que o Meta recebeu" e concluir que
 * "nada bate". Os dois números já concordavam — 7+3+1+0 = 11 — e o que faltava era a adição.
 *
 * Somar à mão é a operação que um painel existe para eliminar, e é a que erra em silêncio: não dá
 * erro, não some da tela, e o resultado parece plausível o bastante para virar decisão.
 *
 * Mora em `lib/` porque é conta, e conta se testa.
 */

export type LinhaSomavel = {
  readonly visitors: number;
  readonly finished: number;
  readonly paid: number;
  readonly clientes: number;
  readonly pedidos: number;
  readonly receitaCentavos: number;
};

export type TotalDeOrigens = LinhaSomavel & { readonly conversion: number };

/**
 * ⚠️ A conversão do total NÃO é a média das conversões das linhas.
 *
 * É `pagaram ÷ chegaram` do agregado. A diferença não é acadêmica: no dia 18/09 a média simples
 * das quatro linhas dava 24,9% e a verdadeira era 11/47 = 23,4%. Média de percentuais trata uma
 * origem de 1 visitante como tendo o mesmo peso de uma com 36 — e é assim que uma origem
 * minúscula com 100% de conversão sequestra a leitura da tabela inteira.
 *
 * Sem visitante nenhum a conversão é 0, e não `NaN`: uma tabela que mostra "NaN%" faz quem lê
 * duvidar de todos os outros números dela, inclusive dos que estão certos.
 */
export function totalDasOrigens(linhas: readonly LinhaSomavel[]): TotalDeOrigens {
  const soma = linhas.reduce<LinhaSomavel>(
    (acc, l) => ({
      visitors: acc.visitors + l.visitors,
      finished: acc.finished + l.finished,
      paid: acc.paid + l.paid,
      clientes: acc.clientes + l.clientes,
      pedidos: acc.pedidos + l.pedidos,
      receitaCentavos: acc.receitaCentavos + l.receitaCentavos,
    }),
    { visitors: 0, finished: 0, paid: 0, clientes: 0, pedidos: 0, receitaCentavos: 0 },
  );

  return {
    ...soma,
    conversion: soma.visitors === 0 ? 0 : (soma.paid / soma.visitors) * 100,
  };
}
