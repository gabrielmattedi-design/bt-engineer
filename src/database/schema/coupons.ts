import {
  boolean,
  foreignKey,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
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
export const couponRedemptions = pgTable(
  'coupon_redemptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => anonymousSessions.id),
    recommendationSessionId: uuid('recommendation_session_id').notNull(),
    redeemedAt: timestamp('redeemed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /**
     * O índice de que o `onConflictDoNothing()` do resgate DEPENDE.
     *
     * ─── ELE ESTAVA FALTANDO ───────────────────────────────────────────────────────────────────
     *
     * `redeemCoupon()` grava o resgate com `onConflictDoNothing()` e trata "não voltou linha" como
     * "já resgatado nesta análise" — é assim que resgatar duas vezes o mesmo código na mesma
     * análise não consome dois usos. Isso só funciona se existir uma restrição única para o insert
     * violar.
     *
     * A restrição vivia apenas como uma linha escrita À MÃO em `bootstrap-sql.ts`, sem contrapartida
     * aqui. Consequência: um banco criado pelo botão "Criar tabelas" tinha o índice; um banco criado
     * por `drizzle-kit migrate` NÃO tinha — e nele nenhum insert jamais conflitava, todo resgate
     * repetido passava, e cada F5 na tela de código queimava mais um uso do cupom. A próxima
     * regeneração do bootstrap apagaria a linha manual e levaria o furo também para o primeiro caso.
     *
     * Declarado aqui, ele passa a existir nos dois caminhos e o ORM finalmente sabe que ele existe.
     */
    uniqueIndex('coupon_redemptions_unique_idx').on(t.code, t.recommendationSessionId),

    /**
     * FK nomeada à mão — e aqui o nome automático não era só feio, era QUEBRADO.
     *
     * O Drizzle geraria `coupon_redemptions_recommendation_session_id_recommendation_sessions_id_fk`,
     * com 74 caracteres. O Postgres corta identificadores em 63 e grava o nome truncado. O bootstrap
     * idempotente pergunta `SELECT 1 FROM pg_constraint WHERE conname = '<nome de 74>'` — que nunca
     * encontra nada, porque o que está gravado tem 63. A guarda passa sempre, o `ADD CONSTRAINT` roda
     * de novo e a segunda execução morre com "constraint already exists".
     *
     * Ou seja: o botão "Criar tabelas" funcionava uma vez e quebrava na segunda, com um erro que não
     * explica nada para quem o aperta. É exatamente a armadilha já documentada em `racketRankings` e
     * `entitlements` — esta tabela simplesmente nasceu depois e não recebeu o mesmo cuidado.
     */
    foreignKey({
      columns: [t.recommendationSessionId],
      foreignColumns: [recommendationSessions.id],
      name: 'coupon_redemptions_rec_session_fk',
    }),
  ],
);
