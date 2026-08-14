import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  foreignKey,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { anonymousSessions, recommendationSessions } from './sessions';

/**
 * Comércio — docs/DATA_MODEL.md §6.
 *
 * Dinheiro é `integer` em CENTAVOS, nunca ponto flutuante. `0.1 + 0.2 !== 0.3` é engraçado num
 * console e é um problema contábil numa cobrança.
 */

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** `racket_report` | `full_setup` | `top3_unlock` */
  sku: text('sku').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  priceCents: integer('price_cents').notNull(),
  currency: text('currency').notNull().default('BRL'),
  /** Entitlements concedidos pela compra deste produto. */
  grantsEntitlements: text('grants_entitlements').array().notNull(),
  active: boolean('active').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => anonymousSessions.id),
  recommendationSessionId: uuid('recommendation_session_id').references(
    () => recommendationSessions.id,
  ),
  productSku: text('product_sku').notNull(),
  /**
   * SNAPSHOT do preço no momento da compra. Deliberadamente redundante com `products.price_cents`:
   * uma alteração futura de preço não pode reescrever o histórico do que alguém já pagou.
   */
  amountCents: integer('amount_cents').notNull(),
  currency: text('currency').notNull().default('BRL'),
  /** `pending` | `paid` | `failed` | `refunded` | `cancelled` */
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  paidAt: timestamp('paid_at', { withTimezone: true }),
});

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    providerPaymentId: text('provider_payment_id'),
    method: text('method'),
    status: text('status').notNull().default('pending'),
    amountCents: integer('amount_cents').notNull(),
    raw: jsonb('raw'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('payments_provider_id_idx').on(t.provider, t.providerPaymentId)],
);

/**
 * Idempotência do webhook (§33).
 *
 * O índice único em (provider, provider_event_id) é o mecanismo inteiro: provedores de pagamento
 * reenviam o mesmo evento quando não recebem 200 a tempo, e um reenvio NÃO pode conceder o
 * entitlement duas vezes nem cobrar de novo. A segunda inserção viola a constraint e o
 * processamento para ali — a idempotência é garantida pelo banco, não por um `if` que pode ser
 * pulado por uma corrida entre duas invocações simultâneas.
 */
export const paymentEvents = pgTable(
  'payment_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: text('provider').notNull(),
    providerEventId: text('provider_event_id').notNull(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('payment_events_provider_event_idx').on(t.provider, t.providerEventId)],
);

/**
 * Entitlements (§32).
 *
 * Esta tabela é a ÚNICA fonte de verdade sobre o que um usuário pode ver. Não existe caminho que
 * conceda acesso a partir de query param, cookie do cliente ou estado de UI: `granted_by_order_id`
 * aponta para um pedido pago, e só o webhook escreve aqui.
 */
export const entitlements = pgTable(
  'entitlements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => anonymousSessions.id, { onDelete: 'cascade' }),
    recommendationSessionId: uuid('recommendation_session_id'),
    /** `racket_report_access` | `full_setup_access` | `top3_access` */
    entitlement: text('entitlement').notNull(),
    grantedByOrderId: uuid('granted_by_order_id').references(() => orders.id),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('entitlements_unique_idx').on(
      t.sessionId,
      t.recommendationSessionId,
      t.entitlement,
    ),
    // Ver a nota em `racketRankings`: o nome gerado passaria de 63 caracteres e seria truncado.
    foreignKey({
      columns: [t.recommendationSessionId],
      foreignColumns: [recommendationSessions.id],
      name: 'entitlements_rec_session_fk',
    }),
  ],
);
