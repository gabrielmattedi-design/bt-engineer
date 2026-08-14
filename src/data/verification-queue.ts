/**
 * Fila de verificação priorizada por IMPACTO — docs/DATA_SOURCING.md §4 e §10.2.
 *
 * A curadoria custa 15–25 minutos por variante e o catálogo tem 46. Verificar em ordem alfabética
 * significaria 20–30 horas antes de o produto poder vender qualquer coisa.
 *
 * Verificar por impacto muda isso: as variantes que aparecem no Top 3 de mais personas são as que
 * mais usuários reais vão receber. Curando essas primeiro, as primeiras horas de trabalho já
 * liberam a maior parte dos casos concretos, e o resto da fila deixa de ser bloqueante.
 *
 * O impacto é medido rodando as personas contra o MESMO motor de produção — não há heurística nem
 * estimativa aqui.
 */

import { PERSONAS } from '@/data/personas';
import { buildPlayerProfile } from '@/recommendation/profile/build-profile';
import { recommend } from '@/recommendation';
import { loadRacketCatalog, loadStringCatalog, DATASET_VERSION } from '@/data/load';
import { scoreRackets } from '@/recommendation/normalize/racket-attributes';
import type { RacketVariant } from '@/domain/racket';

export type QueueEntry = {
  readonly variant: RacketVariant;
  /** Em quantas personas a variante apareceu no Top 3. */
  readonly top3_hits: number;
  /** Em quantas personas foi a 1ª colocada. */
  readonly top1_hits: number;
  /** Ordenação final: Top 1 pesa o triplo de uma aparição no Top 3. */
  readonly impact: number;
};

/**
 * Roda as 22 personas e conta aparições. Usa `mode: 'permissive'` DELIBERADAMENTE: em modo estrito
 * nada não-verificado entra no ranking, e a fila viria vazia — o clássico problema do ovo e da
 * galinha. Aqui queremos justamente saber o que SERIA recomendado depois de verificado.
 */
export function buildVerificationQueue(): QueueEntry[] {
  const rackets = scoreRackets(loadRacketCatalog());
  const strings = loadStringCatalog();

  const top3 = new Map<string, number>();
  const top1 = new Map<string, number>();

  for (const persona of PERSONAS) {
    const profile = buildPlayerProfile(persona.answers);
    const result = recommend({
      profile,
      rackets,
      strings,
      datasetVersion: DATASET_VERSION,
      mode: 'permissive',
      includeSetup: false,
    });

    result.full_ranking.slice(0, 3).forEach((ranked, index) => {
      const id = ranked.racket.variant.id;
      top3.set(id, (top3.get(id) ?? 0) + 1);
      if (index === 0) top1.set(id, (top1.get(id) ?? 0) + 1);
    });
  }

  return rackets
    .map(({ variant }): QueueEntry => {
      const hits3 = top3.get(variant.id) ?? 0;
      const hits1 = top1.get(variant.id) ?? 0;
      return { variant, top3_hits: hits3, top1_hits: hits1, impact: hits3 + hits1 * 2 };
    })
    .sort((a, b) => {
      // Verificadas vão para o fim: a fila mostra o que FALTA fazer.
      const doneA = a.variant.verification_state === 'verified' ? 1 : 0;
      const doneB = b.variant.verification_state === 'verified' ? 1 : 0;
      if (doneA !== doneB) return doneA - doneB;
      if (b.impact !== a.impact) return b.impact - a.impact;
      return a.variant.product_name.localeCompare(b.variant.product_name, 'pt-BR');
    });
}

/** Os campos que a conferência humana precisa bater um a um contra a ficha oficial. */
export const VERIFIABLE_SPEC_FIELDS = [
  { key: 'head_size_sq_in', label: 'Tamanho da cabeça', unit: 'sq in' },
  { key: 'length_in', label: 'Comprimento', unit: 'in' },
  { key: 'unstrung_weight_g', label: 'Peso (sem cordas)', unit: 'g' },
  { key: 'balance_mm', label: 'Balanço', unit: 'mm' },
  { key: 'beam_width_mm', label: 'Perfil do quadro', unit: 'mm' },
  { key: 'string_pattern_mains', label: 'Cordas longitudinais', unit: 'mains' },
  { key: 'string_pattern_crosses', label: 'Cordas transversais', unit: 'crosses' },
  { key: 'recommended_tension_min_lbs', label: 'Tensão mínima', unit: 'lbs' },
  { key: 'recommended_tension_max_lbs', label: 'Tensão máxima', unit: 'lbs' },
] as const;
