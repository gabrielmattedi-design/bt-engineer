/**
 * Modelo de domínio de cordas — docs/DATA_MODEL.md §4.
 *
 * REGRA DE INTEGRIDADE (bloco final da especificação):
 * a unidade recomendável é a VARIANTE (marca + modelo + gauge), e ela só existe no catálogo se for
 * um produto real e comercialmente disponível. O motor nunca calcula uma espessura — ele ordena
 * variantes que existem. Ver docs/STRING_AND_TENSION_ENGINE.md §0.
 */

import type {
  AvailabilityStatus,
  ProductStatus,
  ProvenanceMap,
  SourceTier,
  VerificationState,
} from './sourced';
import type { Score } from './scores';

export type StringBrand =
  | 'Luxilon'
  | 'Solinco'
  | 'Babolat'
  | 'HEAD'
  | 'Yonex'
  | 'Wilson';

export const STRING_BRANDS: readonly StringBrand[] = [
  'Luxilon',
  'Solinco',
  'Babolat',
  'HEAD',
  'Yonex',
  'Wilson',
];

export type StringType =
  | 'polyester'
  | 'co_polyester'
  | 'multifilament'
  | 'synthetic_gut'
  | 'natural_gut'
  | 'hybrid';

/** Tipos que exigem swing desenvolvido para serem ativados com segurança. */
export const STIFF_STRING_TYPES: readonly StringType[] = ['polyester', 'co_polyester'];

export type StringShape = 'round' | 'pentagonal' | 'hexagonal' | 'textured' | 'square';

/** Faixa de preço praticada no varejo brasileiro, por set. */
export type PriceTier = 'budget' | 'mid' | 'premium' | 'ultra';

/** Características do MODELO. A variante ajusta estes valores pelo gauge (§3.1). */
export type StringBaseAttributes = {
  readonly power_score: Score;
  readonly control_score: Score;
  readonly spin_score: Score;
  readonly comfort_score: Score;
  readonly stiffness_score: Score;
  readonly durability_score: Score;
  readonly tension_maintenance_score: Score;
  readonly arm_friendliness_score: Score;
};

export type StringModel = {
  readonly id: string;
  readonly brand: StringBrand;
  readonly model: string;
  readonly slug: string;
  readonly string_type: StringType;
  readonly material: string | null;
  readonly shape: StringShape | null;
  readonly base_attributes: StringBaseAttributes;
  readonly recommended_player_type: readonly string[];
  /**
   * Faixa de preço no varejo brasileiro.
   *
   * Existe porque sem ela o modelo estava errado sobre um fato: a tripa natural DOMINA todos os
   * multifilamentos em conforto, potência, sensação e manutenção de tensão — e domina de verdade,
   * isso não é artefato. O que a tripa perde é preço e resistência à umidade, e nenhum dos dois
   * estava no modelo. O resultado era um motor que, levado a sério, mandaria todo mundo comprar
   * tripa, e cinco multifilamentos que nunca poderiam ser a resposta de ninguém.
   */
  readonly price_tier: PriceTier;
  readonly provenance: ProvenanceMap;
};

/**
 * Variante real de gauge. NÃO criar uma destas sem fonte confirmando que a espessura existe
 * comercialmente para ESTE modelo — nunca por analogia com outro modelo da mesma linha
 * (docs/DATA_SOURCING.md §7).
 */
export type StringVariant = {
  readonly id: string;
  readonly string_id: string;
  readonly gauge_mm: number;
  readonly gauge_us: string | null;
  readonly status: ProductStatus;
  readonly market: string;
  readonly global_availability: AvailabilityStatus;
  readonly brazil_availability_status: AvailabilityStatus;
  readonly commercial_availability_note: string | null;
  readonly verification_state: VerificationState;
  readonly source_tier: SourceTier;
  readonly source_url: string | null;
  readonly last_verified_at: string | null;
  readonly data_version: string;
};

/** Variante já resolvida com seu modelo e com os atributos ajustados pelo gauge. */
export type ScoredStringVariant = {
  readonly model: StringModel;
  readonly variant: StringVariant;
  readonly attributes: StringBaseAttributes;
  /** Aviso obrigatório quando a disponibilidade no Brasil é `limited`. */
  readonly availability_warning: string | null;
};

export function stringDisplayName(model: StringModel, variant: StringVariant): string {
  return `${model.brand} ${model.model} ${variant.gauge_mm.toFixed(2)} mm`;
}

/** Os gauges que ESTE modelo realmente possui. Usado na nota explicativa quando o ideal não existe. */
export function availableGauges(
  variants: readonly StringVariant[],
  stringId: string,
): readonly number[] {
  return variants
    .filter((v) => v.string_id === stringId)
    .map((v) => v.gauge_mm)
    .sort((a, b) => a - b);
}
