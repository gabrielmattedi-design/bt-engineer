import { randomUUID, createHash } from 'node:crypto';
import { eq, and, isNull } from 'drizzle-orm';
import { db, isDatabaseConfigured } from '@/database/client';
import {
  anonymousSessions,
  playerProfiles,
  racketRankings,
  recommendationSessions,
  entitlements as entitlementsTable,
} from '@/database/schema';
import type { PlayerProfile } from '@/domain/player-profile';
import type { RecommendationResult } from '@/domain/recommendation';
import type { Entitlement } from '@/payments/entitlements';
import * as fileStore from '@/app/questionario/session-store';

/**
 * Persistência de sessões de recomendação.
 *
 * ─── SOBRE O FALLBACK EM ARQUIVO ─────────────────────────────────────────────────────────────
 *
 * Sem `DATABASE_URL`, este módulo cai para o armazenamento em arquivo do `session-store`. Isso
 * existe por uma razão concreta: permitir rodar o produto inteiro localmente — inclusive a
 * curadoria do catálogo, que é o gargalo do projeto — sem subir um Postgres.
 *
 * O fallback é PROIBIDO em produção, e `usingDatabase()` LANÇA quando `NODE_ENV=production` sem
 * `DATABASE_URL`. Não é um aviso no console que alguém vai ignorar: um deploy sem banco falha ao
 * servir a primeira análise, alto e claro, em vez de gravar relatórios pagos em `/tmp` e perdê-los
 * no próximo restart.
 */

export type StoredSession = {
  readonly profile: PlayerProfile;
  readonly result: RecommendationResult;
  readonly createdAt: number;
};

function usingDatabase(): boolean {
  if (isDatabaseConfigured()) return true;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'DATABASE_URL é obrigatória em produção. O armazenamento em arquivo é um recurso de ' +
        'desenvolvimento e perderia relatórios pagos a cada reinício do processo.',
    );
  }
  return false;
}

/** Token opaco entregue ao navegador; no banco guardamos apenas o hash. */
export function newSessionToken(): string {
  return randomUUID();
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Garante a `anonymous_session` do visitante e devolve seu id interno. */
export async function ensureAnonymousSession(token: string): Promise<string> {
  const hash = hashToken(token);
  const conn = db();

  const existing = await conn
    .select({ id: anonymousSessions.id })
    .from(anonymousSessions)
    .where(eq(anonymousSessions.cookieTokenHash, hash))
    .limit(1);

  if (existing[0]) return existing[0].id;

  const inserted = await conn
    .insert(anonymousSessions)
    .values({ cookieTokenHash: hash })
    .returning({ id: anonymousSessions.id });

  return inserted[0]!.id;
}

/**
 * Grava perfil, sessão de recomendação e o ranking completo.
 *
 * O ranking vai para `racket_rankings` linha a linha — inclusive os excluídos por filtro duro, com
 * o motivo. É o que permite ao admin responder "por que esta raquete NÃO apareceu?", pergunta tão
 * importante quanto a inversa (§48).
 */
export async function saveRecommendation(input: {
  sessionToken: string;
  publicId: string;
  profile: PlayerProfile;
  result: RecommendationResult;
}): Promise<void> {
  if (!usingDatabase()) {
    fileStore.saveSession(input.publicId, {
      profile: input.profile,
      result: input.result,
      createdAt: Date.now(),
    });
    return;
  }

  const conn = db();
  const anonId = await ensureAnonymousSession(input.sessionToken);
  const { profile, result } = input;

  const profileRow = await conn
    .insert(playerProfiles)
    .values({
      sessionId: anonId,
      profile,
      contradictions: profile.contradictions,
      unknownAnswerRatio: String(profile.unknown_answer_ratio),
      profileVersion: profile.profile_version,
    })
    .returning({ id: playerProfiles.id });

  const recRow = await conn
    .insert(recommendationSessions)
    .values({
      publicId: input.publicId,
      sessionId: anonId,
      playerProfileId: profileRow[0]!.id,
      engineVersion: result.engine_version,
      datasetVersion: result.dataset_version,
      weightsVersion: result.weights_version,
      methodologyVersion: result.methodology_version,
      confidenceLevel: result.confidence.level,
      confidenceScore: String(result.confidence.score),
      confidenceReasons: result.confidence.reasons,
      candidatesEvaluated: result.candidates_evaluated,
      result,
    })
    .returning({ id: recommendationSessions.id });

  const recId = recRow[0]!.id;

  type RankingRow = typeof racketRankings.$inferInsert;

  const rows: RankingRow[] = result.full_ranking.map((ranked, index) => ({
    recommendationSessionId: recId,
    racketVariantId: ranked.racket.variant.id,
    rank: index + 1,
    fitScore: String(ranked.fit_score),
    breakdown: ranked.breakdown,
    penalties: ranked.breakdown.penalties,
    excludedByFilter: null,
  }));

  // Excluídos entram com rank NEGATIVO. Assim cabem na mesma tabela e no mesmo índice único sem
  // competir com o ranking real, e a pergunta "por que esta raquete não apareceu?" continua
  // respondível meses depois, com o motivo legível que o usuário teria visto.
  result.excluded.forEach((ex, index) => {
    rows.push({
      recommendationSessionId: recId,
      racketVariantId: ex.variant_id,
      rank: -(index + 1),
      fitScore: '0',
      breakdown: {},
      penalties: [],
      excludedByFilter: `${ex.filter}: ${ex.reason}`,
    });
  });

  if (rows.length > 0) await conn.insert(racketRankings).values(rows);
}

export async function loadRecommendation(publicId: string): Promise<StoredSession | null> {
  if (!usingDatabase()) {
    const stored = fileStore.loadSession(publicId);
    return stored ?? null;
  }

  const conn = db();
  const rows = await conn
    .select({
      result: recommendationSessions.result,
      profile: playerProfiles.profile,
      createdAt: recommendationSessions.createdAt,
    })
    .from(recommendationSessions)
    .innerJoin(playerProfiles, eq(playerProfiles.id, recommendationSessions.playerProfileId))
    .where(eq(recommendationSessions.publicId, publicId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    profile: row.profile as PlayerProfile,
    result: row.result as RecommendationResult,
    createdAt: row.createdAt.getTime(),
  };
}

/**
 * Entitlements concedidos para uma sessão de recomendação.
 *
 * Sem banco, devolve SEMPRE lista vazia. Isso é deliberado: em desenvolvimento não existe compra
 * real, e inventar um entitlement aqui criaria um caminho que entrega dados premium sem pagamento —
 * exatamente o que o §32 proíbe. Para testar o relatório completo localmente, use o simulador.
 */
export async function grantedEntitlements(publicId: string): Promise<Entitlement[]> {
  if (!usingDatabase()) return [];

  const conn = db();
  const rows = await conn
    .select({ entitlement: entitlementsTable.entitlement })
    .from(entitlementsTable)
    .innerJoin(
      recommendationSessions,
      eq(recommendationSessions.id, entitlementsTable.recommendationSessionId),
    )
    .where(
      and(eq(recommendationSessions.publicId, publicId), isNull(entitlementsTable.revokedAt)),
    );

  return rows.map((r) => r.entitlement as Entitlement);
}
