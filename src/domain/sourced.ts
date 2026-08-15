/**
 * Procedência de dados — ver docs/DATA_SOURCING.md.
 *
 * Nenhum número técnico existe solto no Tennis Engineer. Este módulo define o vocabulário que torna
 * "de onde veio esse valor?" uma pergunta sempre respondível.
 */

/** Hierarquia de fontes. Menor `tier` = fonte melhor (docs/DATA_SOURCING.md §2). */
export type SourceTier =
  | 'manufacturer'
  | 'official_distributor'
  | 'lab'
  | 'major_retailer'
  | 'br_retailer'
  | 'technical_review'
  | 'unverified';

export const SOURCE_TIER_RANK: Record<SourceTier, number> = {
  manufacturer: 1,
  official_distributor: 2,
  lab: 3,
  major_retailer: 4,
  br_retailer: 5,
  technical_review: 6,
  unverified: 99,
};

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type VerificationState = 'draft' | 'pending_verification' | 'verified' | 'disputed';

export type AvailabilityStatus =
  | 'widely_available'
  | 'available'
  | 'limited'
  | 'not_found'
  | 'unknown';

/** Status recomendáveis no Brasil. `limited` entra apenas com mérito técnico + aviso ao usuário. */
export const RECOMMENDABLE_AVAILABILITY: readonly AvailabilityStatus[] = [
  'widely_available',
  'available',
];

export type ProductStatus = 'current' | 'previous_generation' | 'discontinued';

/** Procedência de um único campo. */
export type FieldProvenance = {
  readonly source: SourceTier;
  readonly source_url: string | null;
  readonly verified_at: string | null;
  readonly confidence: ConfidenceLevel;
  readonly notes?: string;
};

export type ProvenanceMap = Readonly<Record<string, FieldProvenance>>;

/**
 * Decide qual de duas fontes prevalece para um campo. Usado pelo painel de verificação e pelos
 * testes de divergência.
 *
 * Na v1 existia aqui uma exceção: para `swingweight`, `twistweight`, `stiffness_ra` e
 * `strung_weight_g`, o tier `lab` superava o `manufacturer`, porque o fabricante não publica esses
 * valores. A exceção morreu com a metodologia v2 — esses campos não existem mais no modelo, e todos
 * os campos restantes são publicados pelo fabricante. Tier 1 vence sempre.
 */
export function preferredSource(_field: string, a: SourceTier, b: SourceTier): SourceTier {
  return SOURCE_TIER_RANK[a] <= SOURCE_TIER_RANK[b] ? a : b;
}

/**
 * Uma variante só é comercialmente recomendável se foi verificada por um humano, não está
 * descontinuada e é encontrável no Brasil.
 *
 * `mode: 'permissive'` existe apenas para desenvolvimento; produção força `strict`
 * (docs/DATA_SOURCING.md §3).
 */
export function isRecommendable(
  input: {
    verification_state: VerificationState;
    status: ProductStatus;
    brazil_availability_status: AvailabilityStatus;
  },
  mode: 'strict' | 'permissive' = 'strict',
): boolean {
  if (input.status === 'discontinued') return false;
  if (input.brazil_availability_status === 'not_found') return false;

  if (mode === 'strict') {
    if (input.verification_state !== 'verified') return false;
    if (!RECOMMENDABLE_AVAILABILITY.includes(input.brazil_availability_status)) {
      // 'limited' é tratado por regra específica no motor (penalização + aviso), não aqui.
      return input.brazil_availability_status === 'limited';
    }
    return true;
  }

  // Permissivo: aceita pending_verification e disponibilidade desconhecida, para poder trabalhar
  // no motor antes de o catálogo estar curado. Nunca vale em produção.
  return input.verification_state !== 'disputed';
}

export function datasetMode(): 'strict' | 'permissive' {
  const env = typeof process !== 'undefined' ? process.env : undefined;
  // Saída explícita para ambiente de testes — ver scripts/dataset-gate.ts.
  if (env?.ALLOW_UNVERIFIED_DATASET === 'true') return 'permissive';
  if (env?.NODE_ENV === 'production') return 'strict';
  return env?.DATASET_MODE === 'strict' ? 'strict' : 'permissive';
}

/** true quando o site está no ar com catálogo não conferido. Exibe aviso permanente ao visitante. */
export function isTestMode(): boolean {
  const env = typeof process !== 'undefined' ? process.env : undefined;
  return env?.ALLOW_UNVERIFIED_DATASET === 'true';
}
