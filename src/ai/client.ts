/**
 * Cliente da camada de IA — docs/ARCHITECTURE.md §5.
 *
 * A IA é OPCIONAL em runtime. Sem `ANTHROPIC_API_KEY`, o produto funciona 100%: o texto livre
 * simplesmente não gera sinais, e as explicações vêm do gerador determinístico.
 *
 * Nenhuma chamada de IA está no caminho crítico do ranking (§4, §65).
 */

import Anthropic from '@anthropic-ai/sdk';

/** Modelo usado pela camada interpretativa. */
export const AI_MODEL = 'claude-opus-5';

/**
 * A IA nunca deve segurar o fluxo. 8 segundos e uma única tentativa extra: se não responder,
 * seguimos sem ela. O SDK TypeScript conta timeout em MILISSEGUNDOS.
 */
export const AI_TIMEOUT_MS = 8_000;
export const AI_MAX_RETRIES = 1;

let cached: Anthropic | null = null;

export function isAiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Retorna o cliente, ou `null` quando não há chave configurada. */
export function getAiClient(): Anthropic | null {
  if (!isAiEnabled()) return null;
  if (!cached) {
    cached = new Anthropic({
      timeout: AI_TIMEOUT_MS,
      maxRetries: AI_MAX_RETRIES,
    });
  }
  return cached;
}
