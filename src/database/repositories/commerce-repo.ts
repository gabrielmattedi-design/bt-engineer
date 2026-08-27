import { and, eq, sql } from 'drizzle-orm';
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
 * A cópia é deliberadamente redundante: se amanhã o preço do relatório subir, o histórico de quem
 * pagou R$ 19,99 continua dizendo R$ 19,99. Ler o preço de `products` na hora de emitir a nota
 * reescreveria o passado.
 */
export async function createOrder(input: {
  sessionId: string;
  publicId: string;
  sku: string;
  /** Quem comprou, quando o e-mail foi informado. Nulo não impede a compra — ver `identify()`. */
  userId?: string | null;
}): Promise<{ orderId: string; product: Product } | null> {
  const product = await productBySku(input.sku);
  if (!product) return null;

  const conn = db();
  const rec = await conn
    .select({ id: recommendationSessions.id })
    .from(recommendationSessions)
    .where(eq(recommendationSessions.publicId, input.publicId))
    .limit(1);

  if (!rec[0]) return null;

  const inserted = await conn
    .insert(orders)
    .values({
      sessionId: input.sessionId,
      recommendationSessionId: rec[0].id,
      userId: input.userId ?? null,
      productSku: product.sku,
      amountCents: product.priceCents,
      currency: product.currency,
      status: 'pending',
    })
    .returning({ id: orders.id });

  return { orderId: inserted[0]!.id, product };
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
      // `left join`: pedido sem e-mail é normal e não pode sumir da consulta que concede o acesso.
      email: users.email,
      publicId: recommendationSessions.publicId,
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

  await markFunnelBySessionId(order.sessionId, 'paid');

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
