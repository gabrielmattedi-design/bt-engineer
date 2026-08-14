/**
 * Ponto de entrada do motor de recomendação.
 *
 * Função pura de alto nível: perfil + catálogo → resultado completo.
 * O simulador do admin (§47), os testes de persona (§49) e a rota de produção chamam EXATAMENTE
 * esta função — não há caminho alternativo, mock ou variação. É isso que faz o simulador ser uma
 * ferramenta de validação real e não um brinquedo.
 */

import { MIN_PODIUM_FIT } from '@/domain/reference-ranges';
import type { ScoredRacket } from '@/domain/racket';
import type { PlayerProfile } from '@/domain/player-profile';
import type { RecommendationResult } from '@/domain/recommendation';
import { METHODOLOGY_VERSION } from '@/domain/reference-ranges';
import { RECOMMENDATION_ENGINE_VERSION } from './config/version';
import { WEIGHTS_VERSION } from './config/weights.v1';
import { computeConfidence } from './confidence';
import { rankRackets, selectPodium, type RankOptions } from './engine/rank-rackets';
import { analyzeTransition } from './engine/transition';
import { selectStringVariant, type StringCatalog } from './strings/select-string';
import { computeTension } from './strings/tension';

export type RecommendInput = {
  readonly profile: PlayerProfile;
  readonly rackets: readonly ScoredRacket[];
  readonly strings?: StringCatalog | null;
  readonly datasetVersion: string;
  readonly mode?: RankOptions['mode'];
  /** Inclui corda + tensão. Corresponde ao entitlement `full_setup_access`. */
  readonly includeSetup?: boolean;
};

export function recommend(input: RecommendInput): RecommendationResult {
  const mode = input.mode ?? 'strict';

  // A raquete atual precisa ser resolvida ANTES do ranking: ela define a referência do
  // objective_fit e habilita transition_fit.
  const currentRacket =
    input.profile.current_racket?.variant_id != null
      ? (input.rackets.find((r) => r.variant.id === input.profile.current_racket?.variant_id) ?? null)
      : null;

  const ranked = rankRackets(input.profile, input.rackets, { mode, currentRacket });
  const podium = selectPodium(ranked.ranking, input.profile);
  const top = podium[0] ?? ranked.ranking[0] ?? null;

  const transition = top
    ? analyzeTransition(input.profile, top.racket, currentRacket)
    : { available: false, comparisons: [], expectations: [], attention_points: [] };

  let stringRecommendation = null;
  let tension = null;

  if (input.includeSetup && top && input.strings) {
    stringRecommendation = selectStringVariant(input.profile, top.racket, input.strings, mode);
    if (stringRecommendation) {
      tension = computeTension(top.racket, stringRecommendation.variant, input.profile);
    }
  }

  const confidence = computeConfidence(input.profile, ranked.ranking, {
    tensionBaseIsFallback: tension?.base_source === 'fallback',
  });

  // §30: o upsell do Top 3 só é ofertado se as três forem opções realmente boas.
  // Proibido criar opções artificiais para vender o upsell.
  const top3OfferAvailable =
    podium.length === 3 && (podium[2]?.fit_score ?? 0) >= MIN_PODIUM_FIT;

  return {
    engine_version: RECOMMENDATION_ENGINE_VERSION,
    weights_version: WEIGHTS_VERSION,
    dataset_version: input.datasetVersion,
    methodology_version: METHODOLOGY_VERSION,
    podium,
    full_ranking: ranked.ranking,
    excluded: ranked.excluded,
    candidates_evaluated: ranked.candidates_evaluated,
    transition,
    string_recommendation: stringRecommendation,
    tension,
    confidence,
    top3_offer_available: top3OfferAvailable,
  };
}

export { rankRackets, selectPodium } from './engine/rank-rackets';
export { buildPlayerProfile } from './profile/build-profile';
export { scoreRacket, scoreRackets } from './normalize/racket-attributes';
export { selectStringVariant } from './strings/select-string';
export { computeTension } from './strings/tension';
export { computeConfidence, CONFIDENCE_LABEL_PT } from './confidence';
export { RECOMMENDATION_ENGINE_VERSION } from './config/version';
export { WEIGHTS_VERSION } from './config/weights.v1';
export type { StringCatalog } from './strings/select-string';
