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
 * ⚠️ CORREÇÃO (21/09): a primeira versão deste comentário dizia que o negativo vinha de dupla
 * atribuição — "quem chegou pelo anúncio na segunda e pela bio na terça tem duas linhas de
 * campanha". **Isso é impossível.** `visitor_campaigns` tem `unique(visitor_hash)`: primeiro toque
 * vence e o visitante tem UMA origem para sempre (ver o cabeçalho de `schema/campaigns.ts`). Eu
 * deduzi o mecanismo em vez de ler o esquema — o mesmo erro que a §1.5 de `OPERACAO_DA_CAMPANHA`
 * documenta sobre o gerenciador do Meta.
 *
 * Com o esquema de hoje, o negativo **não deveria acontecer**. Ele fica como canário: se aparecer,
 * ou a única caiu, ou o vínculo pedido → visitante passou a render mais de uma origem. Nos dois
 * casos é defeito, e um `Math.max(0, …)` mudo o esconderia atrás de uma linha de zero plausível.
 */
export type SemMarcacao = {
  /** Pedidos sem origem conhecida. Zero quando toda venda foi atribuída. */
  readonly pedidos: number;
  /**
   * Pessoas distintas por trás desses pedidos.
   *
   * Elas SOMAM entre as origens, e isso depende do esquema: `visitor_campaigns` tem
   * `unique(visitor_hash)`, então cada comprador pertence a exatamente uma origem. Se um dia a
   * única cair, esta soma passa a contar gente duas vezes — e `excede` é o que avisaria.
   */
  readonly clientes: number;
  readonly receitaCentavos: number;
  /** As origens somaram MAIS que o total — dupla atribuição, não resto. */
  readonly excede: boolean;
};

export function semMarcacao(
  totalDePedidos: number,
  totalDeClientes: number,
  totalDeReceitaCentavos: number,
  origens: Pick<TotalDeOrigens, 'pedidos' | 'clientes' | 'receitaCentavos'>,
): SemMarcacao {
  const pedidos = totalDePedidos - origens.pedidos;
  const clientes = totalDeClientes - origens.clientes;
  const receitaCentavos = totalDeReceitaCentavos - origens.receitaCentavos;

  return {
    pedidos: Math.max(0, pedidos),
    clientes: Math.max(0, clientes),
    receitaCentavos: Math.max(0, receitaCentavos),
    excede: pedidos < 0 || clientes < 0 || receitaCentavos < 0,
  };
}

export type CoorteSomavel = {
  readonly visitors: number;
  readonly finished: number;
  readonly paid: number;
};

export type SemMarcacaoNaCoorte = CoorteSomavel & {
  readonly conversion: number;
  /** As origens somaram MAIS que a coorte — ver o comentário. */
  readonly excede: boolean;
};

/**
 * O mesmo resto, para a tabela de CHEGADAS — e ele não sai da mesma fonte.
 *
 * ═══ POR QUE NÃO DÁ PARA REUSAR `semMarcacao` AQUI ═══════════════════════════════════════════
 *
 * A tabela do dinheiro fecha contra `orders`, que é o registro do caixa. Esta fecha contra a
 * COORTE de chegada — quem abriu o questionário na janela, marcado ou não —, que é outro conjunto
 * e vem de `coorteDeChegada`.
 *
 * ⚠️ A subtração tentadora seria usar o `Pagou` do funil. Ela está errada: o funil recorta pela
 * data do MARCO e a tabela de origens pela data de CHEGADA. Quem chegou hoje e paga amanhã entra
 * numa e não na outra, e o resto sairia plausível e falso. Ver `coorteDeChegada`.
 *
 * ⚠️ E o negativo é possível — mas NÃO pelo motivo que este comentário dizia antes (visitante
 * recorrente criando linha nova de campanha; `unique(visitor_hash)` impede isso).
 *
 * A causa real é outra e é mais útil: a linha de campanha e o marco `quiz:start` nascem na mesma
 * ação, e **`markFunnel` nunca lança** — medição não pode derrubar o produto, então uma falha de
 * banco descarta o marco em silêncio. Quando isso acontece, a pessoa entra na tabela de origens e
 * não na coorte, e a soma passa do total.
 *
 * Ou seja: `excede` aqui é o sintoma de MARCO PERDIDO, e o rastro está no mesmo log que a
 * reconciliação do funil já cita — `[funil] marco descartado`.
 */
export function semMarcacaoNaCoorte(
  coorte: CoorteSomavel,
  origens: CoorteSomavel,
): SemMarcacaoNaCoorte {
  const visitors = coorte.visitors - origens.visitors;
  const finished = coorte.finished - origens.finished;
  const paid = coorte.paid - origens.paid;

  const semTeto = { visitors, finished, paid };
  const resto = {
    visitors: Math.max(0, visitors),
    finished: Math.max(0, finished),
    paid: Math.max(0, paid),
  };

  return {
    ...resto,
    /* Mesma regra do total: `pagaram ÷ chegaram` do agregado, e 0 em vez de NaN sem visitante. */
    conversion: resto.visitors === 0 ? 0 : (resto.paid / resto.visitors) * 100,
    excede: Object.values(semTeto).some((n) => n < 0),
  };
}
