'use server';

/**
 * Server Action que fecha o ciclo questionário → motor → payload.
 *
 * A UI NÃO calcula nada (§44). Ela envia respostas; este módulo orquestra as camadas 3, 4 e 5 e
 * devolve view models já serializados por entitlement.
 *
 * ⚠️ PERSISTÊNCIA: o armazenamento abaixo é em memória, por processo. Ele existe para que o fluxo
 * seja demonstrável ponta a ponta; o schema real está definido em docs/DATA_MODEL.md e a troca é
 * localizada — `saveSession`/`loadSession` viram chamadas aos repositórios Drizzle. Nenhuma outra
 * parte do sistema conhece este detalhe.
 */

import { randomUUID } from 'node:crypto';
import { extractFreeText } from '@/ai/extract-free-text';
import { DATASET_VERSION, loadRacketCatalog, loadStringCatalog } from '@/data/load';
import { recommend } from '@/recommendation';
import { scoreRackets } from '@/recommendation/normalize/racket-attributes';
import { buildPlayerProfile } from '@/recommendation/profile/build-profile';
import type { QuestionnaireAnswers } from '@/recommendation/profile/answers';
import { datasetMode } from '@/domain/sourced';
import type { PlayerProfile } from '@/domain/player-profile';
import type { RecommendationResult } from '@/domain/recommendation';
import { loadSession, saveSession } from './session-store';
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

export type AnalysisResponse = {
  readonly sessionId: string;
  readonly teaser: TeaserPayload;
};

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
  saveSession(sessionId, { profile, result, createdAt: Date.now() });

  return { sessionId, teaser: serializeTeaser(result, strings.variants.length) };
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
  const stored = loadSession(sessionId);
  if (!stored) return null;
  return serializeRecommendation(stored.result, stored.profile, granted);
}

export async function getTeaser(sessionId: string): Promise<TeaserPayload | null> {
  const stored = loadSession(sessionId);
  if (!stored) return null;
  return serializeTeaser(stored.result, loadStringCatalog().variants.length);
}
