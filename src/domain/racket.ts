/**
 * Modelo de domínio de raquetes — docs/DATA_MODEL.md §3.
 *
 * A unidade recomendável é a VARIANTE (modelo + variante de peso + geração), nunca o modelo.
 * Uma raquete de 305 g e uma de 285 g não são o mesmo produto (§5).
 */

import type {
  AvailabilityStatus,
  ProductStatus,
  ProvenanceMap,
  VerificationState,
} from './sourced';
import type { Score } from './scores';

export type RacketBrand = 'HEAD' | 'Wilson' | 'Babolat' | 'Yonex';

export const RACKET_BRANDS: readonly RacketBrand[] = ['HEAD', 'Wilson', 'Babolat', 'Yonex'];

/**
 * Especificações. `null` significa "não sabemos" — jamais um default.
 * Campos marcados (obrigatório) impedem a variante de ser recomendável quando ausentes.
 */
export type RacketSpecs = {
  readonly head_size_sq_in: number | null; // obrigatório
  readonly length_in: number | null;
  readonly unstrung_weight_g: number | null; // obrigatório
  readonly strung_weight_g: number | null;
  readonly balance_mm: number | null;
  readonly swingweight: number | null;
  readonly stiffness_ra: number | null;
  readonly twistweight: number | null;
  readonly beam_width_mm: string | null; // '23/26/23'
  readonly beam_width_avg_mm: number | null;
  readonly string_pattern_mains: number | null; // obrigatório
  readonly string_pattern_crosses: number | null; // obrigatório
  readonly recommended_tension_min_lbs: number | null;
  readonly recommended_tension_max_lbs: number | null;
  readonly grip_sizes_available: readonly number[];
};

export type RacketVariant = {
  readonly id: string;
  readonly brand: RacketBrand;
  readonly family: string;
  readonly model: string;
  readonly variant: string;
  readonly generation: string;
  readonly year: number | null;
  /** Nome comercial completo, exibível ao usuário. */
  readonly product_name: string;
  readonly slug: string;
  readonly status: ProductStatus;
  readonly specs: RacketSpecs;
  readonly provenance: ProvenanceMap;
  readonly verification_state: VerificationState;
  readonly global_availability: AvailabilityStatus;
  readonly brazil_availability_status: AvailabilityStatus;
  readonly data_version: string;
  readonly last_verified_at: string | null;
  readonly image_url: string | null;
  /** Só exibimos a imagem se ela foi confirmada como sendo desta variante e geração (§54). */
  readonly image_verified: boolean;
};

/** Camada 2 — atributos derivados (docs/RECOMMENDATION_ENGINE.md §2). Nunca digitados à mão. */
export type RacketAttributes = {
  readonly power_score: Score;
  readonly control_score: Score;
  readonly spin_score: Score;
  readonly comfort_score: Score;
  readonly stability_score: Score;
  readonly maneuverability_score: Score;
  readonly forgiveness_score: Score;
  readonly precision_score: Score;
  readonly feel_score: Score;
  readonly launch_angle_score: Score;
  readonly arm_friendliness_score: Score;
  /** Quanto de técnica o frame cobra do jogador. */
  readonly demand_index: Score;
  /** 0–1. Fração dos dados necessários que estava presente. */
  readonly data_completeness: number;
  readonly missing_fields: readonly string[];
  /** true quando strung_weight foi derivado de unstrung + STRING_SET_MASS_G. */
  readonly strung_weight_is_estimated: boolean;
  readonly methodology_version: string;
};

export const RACKET_ATTRIBUTE_KEYS = [
  'power_score',
  'control_score',
  'spin_score',
  'comfort_score',
  'stability_score',
  'maneuverability_score',
  'forgiveness_score',
  'precision_score',
  'feel_score',
  'launch_angle_score',
  'arm_friendliness_score',
] as const;

export type RacketAttributeKey = (typeof RACKET_ATTRIBUTE_KEYS)[number];

export type PlayStyle =
  | 'baseline'
  | 'aggressive_baseliner'
  | 'counterpuncher'
  | 'heavy_spin'
  | 'flat_hitter'
  | 'all_court'
  | 'serve_and_volley'
  | 'net_player';

export const PLAY_STYLES: readonly PlayStyle[] = [
  'baseline',
  'aggressive_baseliner',
  'counterpuncher',
  'heavy_spin',
  'flat_hitter',
  'all_court',
  'serve_and_volley',
  'net_player',
];

export type SkillTier = 'beginner' | 'intermediate' | 'advanced' | 'competitive';

/** Adequações como gradiente (0–100), não booleanos — adequação nunca é binária (§6). */
export type RacketFitProfile = {
  readonly beginner_fit: Score;
  readonly intermediate_fit: Score;
  readonly advanced_fit: Score;
  readonly competitive_fit: Score;
  readonly styles: Readonly<Record<PlayStyle, Score>>;
  readonly methodology_version: string;
};

/** Uma variante com tudo que o motor precisa. Produzido por `normalize/racket-attributes.ts`. */
export type ScoredRacket = {
  readonly variant: RacketVariant;
  readonly attributes: RacketAttributes;
  readonly fitProfile: RacketFitProfile;
};

/** Campos sem os quais a variante não pode ser recomendada de forma alguma. */
export function hasRequiredSpecs(specs: RacketSpecs): boolean {
  return (
    specs.head_size_sq_in !== null &&
    specs.unstrung_weight_g !== null &&
    specs.string_pattern_mains !== null &&
    specs.string_pattern_crosses !== null
  );
}
