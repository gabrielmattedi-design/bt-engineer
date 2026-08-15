'use server';

/**
 * Server Action que fecha o ciclo questionário → motor → payload.
 *
 * A UI NÃO calcula nada (§44). Ela envia respostas; este módulo orquestra as camadas 3, 4 e 5 e
 * devolve view models já serializados por entitlement.
 *
 * PERSISTÊNCIA: `src/database/repositories/session-repo.ts`. Com `DATABASE_URL` configurada grava
 * no Postgres; sem ela, em desenvolvimento, cai para arquivo. Em produção a ausência de banco LANÇA
 * — um relatório pago não pode viver em `/tmp`.
 */

import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { isMissingTable } from '@/database/setup';
import { extractFreeText } from '@/ai/extract-free-text';
import { DATASET_VERSION, loadRacketCatalog, loadStringCatalog } from '@/data/load';
import { recommend } from '@/recommendation';
import { scoreRackets } from '@/recommendation/normalize/racket-attributes';
import { buildPlayerProfile } from '@/recommendation/profile/build-profile';
import type { QuestionnaireAnswers } from '@/recommendation/profile/answers';
import { datasetMode } from '@/domain/sourced';
import type { PlayerProfile } from '@/domain/player-profile';
import type { RecommendationResult } from '@/domain/recommendation';
import {
  loadRecommendation,
  newSessionToken,
  saveRecommendation,
} from '@/database/repositories/session-repo';
import {
  serializeRecommendation,
  serializeTeaser,
  type Entitlement,
  type ReportPayload,
  type TeaserPayload,
} from '@/payments/entitlements';

/** Catálogo pontuado uma vez por processo — 41 itens, ranking é O(n) e sub-milissegundo. */
let scoredCatalog: ReturnType<typeof scoreRackets> | null = null;
function catalog() {
  if (!scoredCatalog) scoredCatalog = scoreRackets(loadRacketCatalog());
  return scoredCatalog;
}

/**
 * Resultado da análise como VALOR, não como exceção.
 *
 * Antes esta função podia lançar, e a tela de processamento ficava girando para sempre: as sete
 * mensagens terminavam, `ready` nunca virava true e o usuário encarava uma tela morta sem nenhuma
 * explicação. Um erro que vira silêncio é pior que um erro que aparece.
 */
export type AnalysisResponse =
  | { readonly ok: true; readonly sessionId: string; readonly teaser: TeaserPayload }
  | { readonly ok: false; readonly reason: 'not_ready' | 'failed'; readonly message: string };

/**
 * Roda a análise completa. Retorna apenas o TEASER — o resultado fica no servidor até haver
 * entitlement (§32). O nome da raquete nunca chega ao cliente nesta etapa (§27).
 */
export async function analyzeAnswers(
  answers: QuestionnaireAnswers,
): Promise<AnalysisResponse> {
  // Camada 5 (opcional): texto livre → sinais. Falha ou ausência de chave devolve [].
  const signals = answers.free_text
    ? await extractFreeText(answers.free_text, { answeredFields: [] })
    : [];

  // Camada 3: respostas + sinais → perfil. O merge nunca sobrescreve resposta objetiva (R-05).
  const profile = buildPlayerProfile(answers, signals);

  // Camadas 2 e 4: normalização + ranking determinístico.
  const strings = loadStringCatalog();
  const result = recommend({
    profile,
    rackets: catalog(),
    strings,
    datasetVersion: DATASET_VERSION,
    mode: datasetMode(),
    includeSetup: true,
  });

  const sessionId = randomUUID();

  try {
    await saveRecommendation({
      sessionToken: await visitorToken(),
      publicId: sessionId,
      profile,
      result,
    });
  } catch (error) {
    // Causa mais provável em um ambiente recém-publicado: o banco existe, mas as tabelas ainda
    // não foram criadas. Vale distinguir, porque a ação de conserto é completamente diferente
    // de uma falha transitória — e quem lê a mensagem costuma ser o dono do site.
    if (isMissingTable(error)) {
      return {
        ok: false,
        reason: 'not_ready',
        message:
          'O sistema ainda não foi preparado: as tabelas do banco não existem. O administrador ' +
          'precisa concluir a preparação em /admin/setup.',
      };
    }
    return {
      ok: false,
      reason: 'failed',
      message: 'Não conseguimos salvar sua análise. Tente novamente em alguns instantes.',
    };
  }

  return { ok: true, sessionId, teaser: serializeTeaser(result, strings.variants.length) };
}

/**
 * Busca o relatório para uma sessão, respeitando os entitlements.
 *
 * `serializeRecommendation` lança se `racket_report_access` não estiver presente — não existe
 * caminho que devolva dados premium sem compra.
 */
export async function getReport(
  sessionId: string,
  granted: readonly Entitlement[],
): Promise<ReportPayload | null> {
  const stored = await loadRecommendation(sessionId);
  if (!stored) return null;
  return serializeRecommendation(stored.result, stored.profile, granted);
}

export async function getTeaser(sessionId: string): Promise<TeaserPayload | null> {
  const stored = await loadRecommendation(sessionId);
  if (!stored) return null;
  return serializeTeaser(stored.result, loadStringCatalog().variants.length);
}

/**
 * Token anônimo do visitante — §57: nenhum cadastro é exigido antes do resultado.
 *
 * É um identificador opaco, sem nada sobre a pessoa. No banco guardamos apenas o SHA-256 dele, de
 * modo que um vazamento do banco não permita se passar por ninguém (LGPD, §51).
 */
const VISITOR_COOKIE = 'te_visitor';

async function visitorToken(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(VISITOR_COOKIE)?.value;
  if (existing) return existing;

  const token = newSessionToken();
  jar.set(VISITOR_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 180,
  });
  return token;
}
