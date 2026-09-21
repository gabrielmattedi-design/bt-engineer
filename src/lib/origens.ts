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

/**
 * A linha "sem marcação" — o que falta para a tabela de origens FECHAR com o faturamento.
 *
 * ═══ O DEFEITO DE LEITURA QUE ISTO CONSERTA (21/09/2026) ═════════════════════════════════════
 *
 * A tabela de origens mostrava 9 pedidos num dia de 11 vendas, e **simplesmente omitia as outras
 * duas**. O subtítulo avisava ("só quem chegou por um link com utm_source"), e não adianta: a
 * coluna some com o número e quem lê conclui que o sistema perdeu venda.
 *
 * O dono passou uma tarde tentando conciliar quatro caixas que nunca foram feitas para bater, e
 * escreveu: *"tá muito confuso, muita informação que só está servindo para complicar"*. Ele estava
 * certo — o painel obrigava a fazer de cabeça uma subtração que ele nunca mostrava.
 *
 * Com esta linha, a coluna soma exatamente o faturamento do período. **Nada some em silêncio**, e
 * a pergunta "por que não bate" deixa de existir.
 *
 * ─── POR QUE É SUBTRAÇÃO, E NÃO UMA CONSULTA ───────────────────────────────────────────────
 *
 * Porque a ausência de origem não é um valor que dê para consultar: não existe linha em
 * `visitor_campaigns` para quem chegou sem `utm_source`. O que sobra do total é, por construção,
 * exatamente o que não foi atribuído — e uma subtração não tem como discordar da soma que a
 * originou.
 *
 * ⚠️ ─── E POR QUE O NEGATIVO PRECISA APARECER ────────────────────────────────────────────────
 *
 * `dinheiroPorOrigem` agrupa por (origem, campanha, criativo) e conta `distinct` DENTRO de cada
 * grupo. Uma pessoa que chegou pelo anúncio na segunda e pela bio na terça tem duas linhas de
 * campanha, e o pedido dela é contado nas DUAS — então a soma das origens pode passar do total.
 *
 * Nesse caso o resto dá negativo, e um `Math.max(0, …)` mudo transformaria um defeito de dupla
 * atribuição numa linha de zero, silenciosa e plausível. O valor é zerado (linha negativa não se
 * desenha) e `excede` fica ligado para a tela poder dizer o que aconteceu.
 */
export type SemMarcacao = {
  /** Pedidos sem origem conhecida. Zero quando toda venda foi atribuída. */
  readonly pedidos: number;
  readonly receitaCentavos: number;
  /** As origens somaram MAIS que o total — dupla atribuição, não resto. */
  readonly excede: boolean;
};

export function semMarcacao(
  totalDePedidos: number,
  totalDeReceitaCentavos: number,
  origens: Pick<TotalDeOrigens, 'pedidos' | 'receitaCentavos'>,
): SemMarcacao {
  const pedidos = totalDePedidos - origens.pedidos;
  const receitaCentavos = totalDeReceitaCentavos - origens.receitaCentavos;

  return {
    pedidos: Math.max(0, pedidos),
    receitaCentavos: Math.max(0, receitaCentavos),
    excede: pedidos < 0 || receitaCentavos < 0,
  };
}
