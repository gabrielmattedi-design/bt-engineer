/**
 * Ponto de entrada do motor de recomendação.
 *
 * Função pura de alto nível: perfil + catálogo → resultado completo.
 * O simulador do admin (§47), os testes de persona (§49) e a rota de produção chamam EXATAMENTE
 * esta função — não há caminho alternativo, mock ou variação. É isso que faz o simulador ser uma
 * ferramenta de validação real e não um brinquedo.
 */


import type { ScoredRacket } from '@/domain/racket';
import type { PlayerProfile } from '@/domain/player-profile';
import type { RecommendationResult } from '@/domain/recommendation';
import { METHODOLOGY_VERSION } from '@/domain/reference-ranges';
import { RECOMMENDATION_ENGINE_VERSION } from './config/version';
import { WEIGHTS_VERSION } from './config/weights.v1';
import { computeConfidence } from './confidence';
import { rankRackets, selectPodium, type RankOptions } from './engine/rank-rackets';
import { DISPLAYED_ATTRIBUTES, scaleBands } from './engine/catalog-scale';
import { analyzeTransition } from './engine/transition';
import { selectStringVariant, type StringCatalog } from './strings/select-string';
import { computeTension } from './strings/tension';
import {
  computeSwingIndex,
  parseBeamAverage,
} from './normalize/racket-attributes';

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

  /**
   * Enriquecimento do perfil com as specs REAIS da raquete atual.
   *
   * `buildPlayerProfile` não tem acesso ao catálogo (é função pura sobre respostas), então o
   * snapshot sai de lá com os campos nulos. Preenchê-lo aqui é o que faz `transition_fit` e as
   * penalizações P5/P5b enxergarem o equipamento atual — sem isto o componente devolvia sempre o
   * valor neutro, silenciosamente.
   */
  const profile: PlayerProfile = currentRacket
    ? {
        ...input.profile,
        current_racket: {
          variant_id: currentRacket.variant.id,
          unrecognized: false,
          weight_g: currentRacket.variant.specs.unstrung_weight_g,
          head_size_sq_in: currentRacket.variant.specs.head_size_sq_in,
          balance_mm: currentRacket.variant.specs.balance_mm,
          beam_width_avg_mm: parseBeamAverage(currentRacket.variant.specs),
          swing_index: computeSwingIndex(currentRacket.variant.specs),
        },
      }
    : input.profile;

  const ranked = rankRackets(profile, input.rackets, { mode, currentRacket });
  const podium = selectPodium(ranked.ranking, profile);
  const top = podium[0] ?? ranked.ranking[0] ?? null;

  const transition = top
    ? analyzeTransition(profile, top.racket, currentRacket)
    : { available: false, comparisons: [], expectations: [], attention_points: [] };

  let stringRecommendation = null;
  let tension = null;

  if (input.includeSetup && top && input.strings) {
    stringRecommendation = selectStringVariant(profile, top.racket, input.strings, mode);
    if (stringRecommendation) {
      tension = computeTension(top.racket, stringRecommendation.variant, profile);
    }
  }

  const confidence = computeConfidence(profile, ranked.ranking, {
    tensionBaseIsFallback: tension?.base_source === 'fallback',
  });

  /**
   * §30 — o upsell existe quando há alternativa REAL a desbloquear, não quando dá para inventar
   * uma. A oferta some se o pódio tem uma raquete só; e o fit de cada posição bloqueada é exibido
   * ANTES do pagamento, para que ninguém compre uma opção fraca sem saber que ela é fraca.
   */
  const top3OfferAvailable = podium.length >= 2;

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
    attribute_bands: scaleBands(ranked.scale, DISPLAYED_ATTRIBUTES),
    objective_reference: ranked.reference,
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
