import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { db } from '@/database/client';
import {
  entitlements,
  orders,
  paymentEvents,
  payments,
  products,
  recommendationSessions,
  users,
} from '@/database/schema';
import { PRODUCT_SEED } from '@/database/setup';
import { canTransition, type PaymentEvent, type PaymentStatus } from '@/payments/provider';
import { markFunnelBySessionId } from './funnel-repo';
import { PRODUCT_ENTITLEMENTS } from '@/payments/entitlements';
import { comDesconto, consumirCupomDoPedido, descontoDaAnalise } from './coupon-repo';

export type Product = {
  readonly sku: string;
  readonly name: string;
  readonly description: string | null;
  readonly priceCents: number;
  readonly currency: string;
  readonly grantsEntitlements: readonly string[];
};

/** Preços vêm SEMPRE do banco (§34). Nenhum valor em reais existe hardcoded no código. */
export async function activeProducts(): Promise<Product[]> {
  const rows = await db()
    .select()
    .from(products)
    .where(eq(products.active, true))
    .orderBy(products.priceCents);

  return rows.map((r) => ({
    sku: r.sku,
    name: r.name,
    description: r.description,
    priceCents: r.priceCents,
    currency: r.currency,
    grantsEntitlements: r.grantsEntitlements,
  }));
}

/**
 * Grava a tabela de preços inteira, numa transação só.
 *
 * ═══ POR QUE TRANSAÇÃO ═══════════════════════════════════════════════════════════════════════
 *
 * Cinco `UPDATE` soltos têm quatro instantes entre eles em que a escada está meio velha e meio
 * nova — e é justamente nesses instantes que ela pode estar incoerente: a raquete já a R$ 29,99 e o
 * pacote ainda a R$ 24,99, por exemplo. Uma visita que caia ali vê, e pode comprar, uma combinação
 * que ninguém aprovou.
 *
 * A janela é de milissegundos, o que a torna rara e não a torna aceitável: o produto inteiro é
 * escrito em torno de nunca cobrar mais por menos, e "quase nunca" é outra coisa.
 *
 * O preço COBRADO de quem já comprou não muda — `orders.amount_cents` guarda a cópia do instante da
 * compra. Isto reprecifica a vitrine, não o passado.
 */
export async function atualizarPrecos(precos: Readonly<Record<string, number>>): Promise<void> {
  await db().transaction(async (tx) => {
    for (const [sku, priceCents] of Object.entries(precos)) {
      await tx
        .update(products)
        .set({ priceCents, updatedAt: new Date() })
        .where(eq(products.sku, sku));
    }
  });
}

export async function productBySku(sku: string): Promise<Product | null> {
  const rows = await db()
    .select()
    .from(products)
    .where(and(eq(products.sku, sku), eq(products.active, true)))
    .limit(1);

  const r = rows[0];
  if (!r) return null;
  return {
    sku: r.sku,
    name: r.name,
    description: r.description,
    priceCents: r.priceCents,
    currency: r.currency,
    grantsEntitlements: r.grantsEntitlements,
  };
}

/**
 * Cria o pedido com o preço COPIADO do catálogo no instante da compra.
 *
 * A cópia é deliberadamente redundante: quando o preço do relatório sobe, o histórico de quem pagou
 * o valor antigo continua dizendo o valor antigo. Ler o preço de `products` na hora de emitir a nota
 * reescreveria o passado.
 *
 * Deixou de ser hipótese em set/2026: a raquete avulsa foi de R$ 19,99 para R$ 29,99. Os pedidos
 * anteriores continuam registrando R$ 19,99 porque o valor foi copiado no instante da compra — é
 * exatamente para isso que esta coluna existe.
 */
export async function createOrder(input: {
  sessionId: string;
  publicId: string;
  sku: string;
  /** Quem comprou, quando o e-mail foi informado. Nulo não impede a compra — ver `identify()`. */
  userId?: string | null;
}): Promise<{ orderId: string; product: Product; amountCents: number } | null> {
  const product = await productBySku(input.sku);
  if (!product) return null;

  const conn = db();
  const rec = await conn
    .select({ id: recommendationSessions.id })
    .from(recommendationSessions)
    .where(eq(recommendationSessions.publicId, input.publicId))
    .limit(1);

  if (!rec[0]) return null;

  /*
    ═══ O DESCONTO É RESOLVIDO AQUI, NO SERVIDOR, NO INSTANTE DA COMPRA ═══════════════════════

    A tela de planos já mostrou um valor com desconto, e ele NÃO é reaproveitado: nada que passou
    pelo navegador decide quanto alguém paga. O cupom é relido do banco agora, com as mesmas
    conferências — ativo, dentro do limite —, e um cupom que morreu no meio do caminho
    simplesmente não vale.

    O sentido do erro é o certo: a divergência possível é o cliente ver um preço com desconto e
    pagar o cheio, nunca o contrário. Quando isso acontece, ele vê o valor real na tela do gateway
    antes de confirmar.
  */
  const desconto = await descontoDaAnalise(input.publicId);
  const amountCents = desconto
    ? comDesconto(product.priceCents, desconto.percent)
    : product.priceCents;

  const inserted = await conn
    .insert(orders)
    .values({
      sessionId: input.sessionId,
      recommendationSessionId: rec[0].id,
      userId: input.userId ?? null,
      productSku: product.sku,
      amountCents,
      couponCode: desconto?.code ?? null,
      discountPercent: desconto?.percent ?? null,
      currency: product.currency,
      status: 'pending',
    })
    .returning({ id: orders.id });

  return { orderId: inserted[0]!.id, product, amountCents };
}

export async function attachPayment(input: {
  orderId: string;
  provider: string;
  providerPaymentId: string;
  amountCents: number;
}): Promise<void> {
  await db()
    .insert(payments)
    .values({
      orderId: input.orderId,
      provider: input.provider,
      providerPaymentId: input.providerPaymentId,
      status: 'pending',
      amountCents: input.amountCents,
    })
    .onConflictDoNothing();
}

/**
 * Dados para o recibo, quando há pagamento confirmado e alguém identificado para recebê-lo.
 *
 * Sai daqui, e não de uma segunda consulta na rota, porque o webhook já leu essas linhas para
 * conceder o acesso. Buscar de novo custaria três consultas para reconstruir o que estava em mãos.
 */
export type Receipt = {
  readonly email: string;
  readonly publicId: string;
  readonly productName: string;
  readonly amountCents: number;
};

export type WebhookOutcome =
  | { kind: 'duplicate' }
  | { kind: 'unknown_order' }
  | { kind: 'illegal_transition'; from: PaymentStatus; to: PaymentStatus }
  | { kind: 'processed'; granted: readonly string[]; receipt?: Receipt };

/**
 * Processa um evento de pagamento — docs/MONETIZATION.md §5.
 *
 * ─── IDEMPOTÊNCIA ────────────────────────────────────────────────────────────────────────────
 *
 * Gateways garantem entrega AT-LEAST-ONCE: se não recebem 200 a tempo, reenviam. Sem proteção, um
 * reenvio concederia o entitlement duas vezes e poluiria o histórico.
 *
 * A proteção é o índice único em (provider, provider_event_id) com `ON CONFLICT DO NOTHING
 * RETURNING id`: a segunda entrega não devolve linha e o processamento para imediatamente. É o
 * BANCO garantindo, não um `if` no código — dois webhooks simultâneos, em duas invocações
 * serverless diferentes, passariam pelo `if` ao mesmo tempo, mas só um vence a constraint.
 *
 * A concessão do entitlement tem a mesma proteção em segundo nível, pelo índice único de
 * (session_id, recommendation_session_id, entitlement).
 */
export async function processPaymentEvent(
  provider: string,
  event: PaymentEvent,
): Promise<WebhookOutcome> {
  const conn = db();

  const claimed = await conn
    .insert(paymentEvents)
    .values({
      provider,
      providerEventId: event.providerEventId,
      eventType: event.eventType,
      payload: event.raw as object,
    })
    .onConflictDoNothing()
    .returning({ id: paymentEvents.id });

  if (!claimed[0]) return { kind: 'duplicate' };

  const orderRows = await conn
    .select({
      id: orders.id,
      status: orders.status,
      sessionId: orders.sessionId,
      recommendationSessionId: orders.recommendationSessionId,
      sku: orders.productSku,
      amountCents: orders.amountCents,
      couponCode: orders.couponCode,
      // `left join`: pedido sem e-mail é normal e não pode sumir da consulta que concede o acesso.
      email: users.email,
      publicId: recommendationSessions.publicId,
      /** A sessão que criou a ANÁLISE — a identidade do funil. Ver o marco `paid` abaixo. */
      donoDaAnalise: recommendationSessions.sessionId,
    })
    .from(orders)
    .leftJoin(users, eq(users.id, orders.userId))
    .leftJoin(
      recommendationSessions,
      eq(recommendationSessions.id, orders.recommendationSessionId),
    )
    .where(eq(orders.id, event.orderId))
    .limit(1);

  const order = orderRows[0];
  if (!order) return { kind: 'unknown_order' };

  const from = order.status as PaymentStatus;
  if (!canTransition(from, event.status)) {
    return { kind: 'illegal_transition', from, to: event.status };
  }

  await conn
    .update(orders)
    .set({
      status: event.status,
      paidAt: event.status === 'paid' ? new Date() : null,
    })
    .where(eq(orders.id, order.id));

  await conn
    .update(payments)
    .set({ status: event.status, method: event.method, raw: event.raw as object })
    .where(eq(payments.providerPaymentId, event.providerPaymentId));

  // Só pagamento CONFIRMADO concede acesso (§33). `pending` de PIX não libera nada.
  if (event.status !== 'paid') {
    await conn
      .update(paymentEvents)
      .set({ processedAt: new Date() })
      .where(eq(paymentEvents.id, claimed[0].id));
    return { kind: 'processed', granted: [] };
  }

  /*
    ═══ O MARCO É DA ANÁLISE, NÃO DO PEDIDO ═══════════════════════════════════════════════════

    Aqui ia `order.sessionId` — a sessão anônima do navegador que fez ESTE pedido. Um comprador é
    contado uma vez enquanto compra tudo no mesmo aparelho, porque `unique(visitor_hash, marker)`
    absorve o segundo marco. Ele vira dois no dia em que compra o pacote simples no computador e o
    upgrade pelo celular: dois cookies, duas sessões, dois hashes, dois "Pagou".

    O comprador é a pessoa, e a pessoa aqui é quem respondeu o questionário — uma só, por análise,
    em qualquer aparelho. `donoDaAnalise` é essa sessão.

    O `??` cobre o pedido sem `recommendation_session_id`, que o esquema permite. Nesse caso a
    sessão do pedido é a melhor identidade que existe, e é melhor contar por ela do que perder o
    marco: um `paid` faltando esconderia uma venda no painel, que é pior que contar uma a mais.
  */
  await markFunnelBySessionId(order.donoDaAnalise ?? order.sessionId, 'paid');

  /*
    ═══ O CUPOM DE DESCONTO É CONSUMIDO AQUI, E EM NENHUM OUTRO LUGAR ═════════════════════════

    "Este cupom foi usado" só vira verdade quando o dinheiro entra. Consumir quando a pessoa digita
    faria um checkout abandonado gastar o uso de outra — e abandonar checkout é o comportamento mais
    comum de todos.

    Falhar aqui não pode doer: `consumirCupomDoPedido` nunca lança e nunca revoga nada. Se o último
    uso tiver sido levado por outra pessoa entre o checkout e a confirmação, quem pagou já pagou o
    valor com desconto — e cobrar a diferença por causa de uma corrida de milissegundos seria punir
    o cliente por um problema nosso. O pedido guarda o código e o percentual, então o caso fica
    registrado.

    Vem ANTES da concessão de propósito: a concessão é o que a pessoa comprou, e nada relacionado a
    contabilidade de cupom pode se interpor entre o pagamento e o acesso.
  */
  if (order.couponCode && order.recommendationSessionId) {
    await consumirCupomDoPedido({
      code: order.couponCode,
      sessionId: order.sessionId,
      recommendationSessionId: order.recommendationSessionId,
    });
  }

  const grants = PRODUCT_ENTITLEMENTS[order.sku] ?? [];
  if (grants.length > 0) {
    await conn
      .insert(entitlements)
      .values(
        grants.map((entitlement) => ({
          sessionId: order.sessionId,
          recommendationSessionId: order.recommendationSessionId,
          entitlement,
          grantedByOrderId: order.id,
        })),
      )
      .onConflictDoNothing();
  }

  await conn
    .update(paymentEvents)
    .set({ processedAt: new Date() })
    .where(eq(paymentEvents.id, claimed[0].id));

  /*
    O recibo só existe quando há e-mail E análise. Falta de e-mail é o caso normal de quem comprou
    antes de o cadastro existir, e não pode virar erro nem impedir a concessão — o acesso já foi
    dado acima, e é ele que a pessoa comprou.
  */
  const receipt: Receipt | undefined =
    order.email && order.publicId
      ? {
          email: order.email,
          publicId: order.publicId,
          productName: PRODUCT_SEED.find((p) => p.sku === order.sku)?.name ?? order.sku,
          amountCents: order.amountCents,
        }
      : undefined;

  return { kind: 'processed', granted: grants, receipt };
}

/** Revoga os entitlements de um pedido reembolsado (§7 do MONETIZATION). */
export async function revokeForOrder(orderId: string): Promise<void> {
  await db()
    .update(entitlements)
    .set({ revokedAt: new Date() })
    .where(and(eq(entitlements.grantedByOrderId, orderId), sql`${entitlements.revokedAt} IS NULL`));
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 * VENDAS — a lista que `/admin/vendas` mostra.
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * ═══ POR QUE ELA NÃO EXISTIA, E POR QUE PASSA A EXISTIR ══════════════════════════════════════
 *
 * `/admin/analises` recusa listar de propósito, e o comentário de lá explica: uma busca exata é
 * ferramenta de atendimento, uma lista é janela para folhear os dados de todos os clientes, e a
 * diferença entre as duas é uma linha de código. Aquela recusa continua valendo PARA AQUELA TELA.
 *
 * Esta função existe porque a pergunta é outra. "Quem perdeu o link?" é atendimento e se responde
 * com busca. "Como estão as vendas?" é gestão, não tem termo de busca possível, e o dono não pode
 * depender de abrir o Postgres para saber quanto vendeu.
 *
 * A separação em duas telas não é organização: é o que impede que a conveniência da gestão relaxe
 * a regra do atendimento sem ninguém decidir isso.
 */
export const LANCAMENTO = new Date('2026-09-03T18:00:00-03:00');

export type Venda = {
  readonly orderId: string;
  readonly paidAt: Date;
  readonly email: string | null;
  readonly sku: string;
  readonly amountCents: number;
  readonly couponCode: string | null;
  /** `null` no pedido sem análise ligada — o esquema permite. Sem ele não há relatório a abrir. */
  readonly publicId: string | null;
};

export type Vendas = {
  readonly desde: Date;
  readonly itens: readonly Venda[];
  /**
   * Quantos pedidos pagos ficaram DE FORA do corte.
   *
   * Uma lista filtrada que não diz o que escondeu mente por omissão: o dono somaria a coluna,
   * compararia com o extrato do Mercado Pago, veria a diferença e não teria como saber se falta
   * dinheiro ou se falta linha. Este número responde isso sem precisar de investigação.
   */
  readonly anterioresAoCorte: number;
};

/**
 * As vendas a partir de `desde`, da mais recente para a mais antiga.
 *
 * ─── POR QUE O CORTE, E POR QUE ELE É UMA DATA E NÃO UM "ÚLTIMOS N DIAS" ─────────────────────
 *
 * Tudo que foi pago antes do lançamento é o próprio dono testando — compras reais, com dinheiro
 * real, e nenhuma delas é cliente. Misturá-las à lista não infla só a contagem: infla a receita, e
 * uma receita inflada é o número que faz decidir errado sobre preço e sobre anúncio.
 *
 * "Últimos 30 dias" resolveria hoje e voltaria a errar em outubro, quando os testes saírem da
 * janela sozinhos. O lançamento é um instante fixo no passado, então a constante é a forma
 * honesta — e fica visível na tela, com a contagem do que ficou de fora ao lado.
 *
 * ─── STATUS `paid`, E NÃO "TEM ENTITLEMENT" ──────────────────────────────────────────────────
 *
 * Acesso concedido por cupom não é venda. Se esta lista contasse entitlement, o cupom MAITE
 * apareceria como receita de R$ 0,00 e o dono veria clientes onde tem convidados. O cupom tem
 * contador próprio em `/admin/codigos`.
 */
export async function vendasDesde(desde: Date = LANCAMENTO): Promise<Vendas> {
  const conn = db();

  const itens = await conn
    .select({
      orderId: orders.id,
      paidAt: orders.paidAt,
      email: users.email,
      sku: orders.productSku,
      amountCents: orders.amountCents,
      couponCode: orders.couponCode,
      publicId: recommendationSessions.publicId,
    })
    .from(orders)
    // `left join` nos dois: pedido sem e-mail e pedido sem análise são casos reais e não podem
    // sumir da lista — some justamente o pedido estranho, que é o que mais interessa ver.
    .leftJoin(users, eq(users.id, orders.userId))
    .leftJoin(recommendationSessions, eq(recommendationSessions.id, orders.recommendationSessionId))
    /*
      `gte`/`desc` e NÃO um template `sql` cru.

      As duas formas geram o mesmo SQL e mandam parâmetros diferentes: o operador tipado aplica o
      `mapToDriverValue` da coluna e envia a data como string ISO, que é o que o driver espera de
      um `timestamptz`; o template cru pula esse mapeamento e entrega um objeto `Date` solto.

      A primeira versão desta tela usava o template e quebrou em produção com "server-side
      exception" — sem sintoma nenhum no build, no typecheck ou nos testes, porque nada disso
      chega a executar a consulta. Todas as outras comparações de data do projeto
      (`funnel-repo`, `coupon-repo`) já usavam o operador tipado; esta era a única exceção, e foi
      a única que falhou.
    */
    .where(and(eq(orders.status, 'paid'), gte(orders.paidAt, desde)))
    .orderBy(desc(orders.paidAt));

  const fora = await conn
    .select({ n: sql<number>`count(*)::int` })
    .from(orders)
    .where(and(eq(orders.status, 'paid'), lt(orders.paidAt, desde)));

  return {
    desde,
    // `paidAt` é não-nulo por construção em pedido `paid` — o webhook grava os dois juntos —, mas o
    // TIPO permite nulo, e o filtro já garantiu a condição. O descarte mantém o tipo honesto.
    itens: itens.filter((v): v is Venda => v.paidAt !== null),
    anterioresAoCorte: fora[0]?.n ?? 0,
  };
}
