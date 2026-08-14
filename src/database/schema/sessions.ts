import {
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  foreignKey,
  index,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Sessões e recomendações — docs/DATA_MODEL.md §5.
 *
 * ─── UMA DIVERGÊNCIA DELIBERADA EM RELAÇÃO AO DATA_MODEL ─────────────────────────────────────
 *
 * O documento declara `racket_rankings.racket_variant_id uuid REFERENCES racket_variants(id)`, ou
 * seja, o catálogo vivendo no banco. Aqui ele é `racket_variant_id text` — o slug do catálogo, sem
 * chave estrangeira.
 *
 * Motivo: o catálogo é DADO DE BUILD. Ele é importado dos JSON em `src/data/rackets/`, congelado no
 * bundle, e é isso que permite à trava de release (`npm run build` → `dataset:gate`) enxergá-lo e
 * bloquear o deploy de dados não verificados. Duplicá-lo no Postgres criaria duas fontes de verdade
 * que divergem no primeiro deploy em que alguém esquecer de rodar o seed — e a versão do banco não
 * passaria por nenhum portão.
 *
 * O banco guarda o que é do USUÁRIO: respostas, perfis, rankings calculados, pedidos, entitlements.
 * `dataset_version` em `recommendation_sessions` é o que amarra um relatório histórico à versão
 * exata do catálogo que o produziu (§61), cumprindo o mesmo papel da FK sem o custo dela.
 */

export const anonymousSessions = pgTable('anonymous_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  cookieTokenHash: text('cookie_token_hash').notNull().unique(),
  userAgentFamily: text('user_agent_family'),
  locale: text('locale'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
});

export const playerProfiles = pgTable('player_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => anonymousSessions.id, { onDelete: 'cascade' }),
  /** `PlayerProfile` serializado — a única representação do jogador que o motor conhece. */
  profile: jsonb('profile').notNull(),
  /** `ProfileSignal[]` extraídos do texto livre pela IA. Nunca especificações técnicas (R-03). */
  signals: jsonb('signals').notNull().default(sql`'[]'::jsonb`),
  contradictions: jsonb('contradictions').notNull().default(sql`'[]'::jsonb`),
  unknownAnswerRatio: numeric('unknown_answer_ratio', { precision: 4, scale: 3 }).notNull(),
  profileVersion: text('profile_version').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const recommendationSessions = pgTable(
  'recommendation_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Identificador exposto na URL. Separado do `id` para não vazar ordem de criação. */
    publicId: text('public_id').notNull().unique(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => anonymousSessions.id, { onDelete: 'cascade' }),
    playerProfileId: uuid('player_profile_id')
      .notNull()
      .references(() => playerProfiles.id),

    // §61: versões gravadas em TODA recomendação, para que qualquer relatório histórico possa ser
    // reproduzido exatamente como foi entregue.
    engineVersion: text('recommendation_engine_version').notNull(),
    datasetVersion: text('dataset_version').notNull(),
    weightsVersion: text('weights_version').notNull(),
    methodologyVersion: text('methodology_version').notNull(),

    confidenceLevel: text('confidence_level').notNull(),
    confidenceScore: numeric('confidence_score', { precision: 5, scale: 2 }).notNull(),
    confidenceReasons: jsonb('confidence_reasons').notNull().default(sql`'[]'::jsonb`),
    /** Número real de candidatos avaliados — é o que o teaser exibe. Nunca inflado (§27). */
    candidatesEvaluated: integer('candidates_evaluated').notNull(),

    /** Resultado completo, para servir o relatório sem recalcular. */
    result: jsonb('result').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('recommendation_sessions_session_idx').on(t.sessionId)],
);

export const racketRankings = pgTable(
  'racket_rankings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recommendationSessionId: uuid('recommendation_session_id').notNull(),
    /** Slug do catálogo (ex.: `wilson-blade-98-18x20-v9`). Ver a nota no topo do arquivo. */
    racketVariantId: text('racket_variant_id').notNull(),
    rank: integer('rank').notNull(),
    fitScore: numeric('fit_score', { precision: 5, scale: 2 }).notNull(),
    /** `ScoreBreakdown` completo (§48) — todo score exibido tem auditoria recuperável. */
    breakdown: jsonb('breakdown').notNull(),
    penalties: jsonb('penalties').notNull().default(sql`'[]'::jsonb`),
    /** Preenchido quando a variante foi excluída por filtro duro, com o motivo legível. */
    excludedByFilter: text('excluded_by_filter'),
  },
  (t) => [
    uniqueIndex('racket_rankings_session_rank_idx').on(t.recommendationSessionId, t.rank),
    /**
     * FK nomeada explicitamente. O nome que o Drizzle geraria
     * (`racket_rankings_recommendation_session_id_recommendation_sessions_id_fk`) tem 71 caracteres
     * e o Postgres trunca em 63, descartando justamente o sufixo `_fk`. Hoje não colide, mas o nome
     * passa a depender de onde o corte cai — e renomear constraint depois exige migração.
     */
    foreignKey({
      columns: [t.recommendationSessionId],
      foreignColumns: [recommendationSessions.id],
      name: 'racket_rankings_rec_session_fk',
    }).onDelete('cascade'),
  ],
);
