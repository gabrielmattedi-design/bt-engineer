import { boolean, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { anonymousSessions, recommendationSessions } from './sessions';

/**
 * Códigos de acesso — a via controlada para liberar relatórios sem cobrança.
 *
 * ─── POR QUE ISTO SUBSTITUI O MODO DEMONSTRAÇÃO ABERTO ───────────────────────────────────────
 *
 * O modo demonstração liberava o funil para TODO MUNDO e anunciava isso numa faixa no topo. É a
 * configuração certa para o dono percorrer o próprio site, e a errada para mandar o link a alguém:
 * quem recebe lê "nada é cobrado" e entende, corretamente, que o produto não está à venda.
 *
 * O código de acesso resolve o mesmo problema com o alcance certo. Quem tem o código entra; quem
 * não tem vê um site normal, com os preços reais, e não descobre que existe caminho gratuito.
 *
 * ─── O LIMITE É DO BANCO, NÃO DO CÓDIGO ──────────────────────────────────────────────────────
 *
 * `used_count` só avança dentro de um UPDATE que carrega a própria condição de limite no WHERE.
 * Dois resgates simultâneos do último uso disponível não podem ambos vencer: o segundo encontra a
 * linha já atualizada e não afeta nenhuma linha. Um `SELECT` seguido de `UPDATE` deixaria essa
 * janela aberta, e "20 usos" viraria "20 ou 21, dependendo da sorte".
 */
export const accessCoupons = pgTable('access_coupons', {
  /** Sempre em MAIÚSCULAS — a normalização acontece na escrita e na leitura. */
  code: text('code').primaryKey(),
  /** Entitlements concedidos no resgate. Mesmos nomes usados pelos produtos pagos. */
  grants: text('grants').array().notNull(),
  /** `null` = ilimitado. Qualquer número = quantos resgates ainda cabem no total. */
  maxUses: integer('max_uses'),
  usedCount: integer('used_count').notNull().default(0),
  active: boolean('active').notNull().default(true),
  /** Para o dono lembrar a quem ele mandou o código. */
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Histórico de resgates.
 *
 * Existe para responder "quem usou o DJOKOINSS?" meses depois, e para que desativar um código não
 * apague o rastro de quem já entrou por ele. Sem isso, `used_count` seria um número sem história.
 */
export const couponRedemptions = pgTable('coupon_redemptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => anonymousSessions.id),
  recommendationSessionId: uuid('recommendation_session_id')
    .notNull()
    .references(() => recommendationSessions.id),
  redeemedAt: timestamp('redeemed_at', { withTimezone: true }).notNull().defaultNow(),
});
