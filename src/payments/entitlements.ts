/**
 * Entitlements — §32.
 *
 * "Não confiar apenas em ocultar informações no frontend. A API não deve entregar dados premium
 * para usuário sem entitlement. Nunca mandar segundo e terceiro modelos escondidos apenas por CSS."
 *
 * A garantia aqui é estrutural: `serializeRecommendation` CONSTRÓI o payload a partir dos
 * entitlements. Ela não filtra um objeto completo — dados premium nunca chegam a existir na
 * resposta de quem não comprou.
 */

import type { PlayerProfile } from '@/domain/player-profile';
import type { RankedRacket, RecommendationResult } from '@/domain/recommendation';
import { CONFIDENCE_LABEL_PT } from '@/recommendation/confidence';
import {
  explainComfort,
  explainCombination,
  explainExpectations,
  explainHeadline,
  explainRacketFit,
  explainString,
  explainTension,
  explainTransition,
} from '@/recommendation/explain/deterministic';

export type Entitlement = 'racket_report_access' | 'full_setup_access' | 'top3_access';

export const ALL_ENTITLEMENTS: readonly Entitlement[] = [
  'racket_report_access',
  'full_setup_access',
  'top3_access',
];

/** Produtos e o que cada um concede (§25, §26, §30). Os PREÇOS vivem no banco (§34). */
export const PRODUCT_ENTITLEMENTS: Readonly<Record<string, readonly Entitlement[]>> = {
  racket_report: ['racket_report_access'],
  full_setup: ['racket_report_access', 'full_setup_access'],
  top3_unlock: ['top3_access'],
};

export function hasEntitlement(
  granted: readonly Entitlement[],
  required: Entitlement,
): boolean {
  return granted.includes(required);
}

/** Lança se o entitlement não estiver presente. Usado nos handlers antes de qualquer serialização. */
export function assertEntitlement(
  granted: readonly Entitlement[],
  required: Entitlement,
): void {
  if (!hasEntitlement(granted, required)) {
    throw new EntitlementError(required);
  }
}

export class EntitlementError extends Error {
  constructor(public readonly required: Entitlement) {
    super(`Acesso não liberado: ${required}`);
    this.name = 'EntitlementError';
  }
}

// ── Formas públicas ────────────────────────────────────────────────────────────────────────────

/** O que QUALQUER pessoa vê antes de pagar (§27). Zero identificação de produto. */
export type TeaserPayload = {
  readonly kind: 'teaser';
  readonly candidates_evaluated: number;
  readonly string_variants_evaluated: number;
  readonly matches_found: number;
  readonly confidence_level: string;
  readonly analysis_steps: readonly string[];
  readonly engine_version: string;
  readonly dataset_version: string;
};

/** Colocado bloqueado: score e posicionamento, SEM marca, modelo, foto ou specs. */
export type LockedPodiumEntry = {
  readonly rank: number;
  readonly fit_score: number;
  readonly teaser: string;
  readonly locked: true;
};

export type UnlockedPodiumEntry = {
  readonly rank: number;
  readonly fit_score: number;
  readonly locked: false;
  readonly brand: string;
  readonly product_name: string;
  readonly image_url: string | null;
  readonly technical_tie_with_previous: boolean;
  readonly specs: Readonly<Record<string, number | string | null>>;
  readonly indices: Readonly<Record<string, number>>;
  readonly tags: readonly string[];
  readonly why: readonly string[];
  readonly expectations: readonly string[];
  readonly attention: readonly string[];
};

export type PodiumEntry = LockedPodiumEntry | UnlockedPodiumEntry;

export type SetupPayload = {
  readonly string_brand: string;
  readonly string_model: string;
  readonly string_type: string;
  readonly gauge_mm: number;
  readonly tension_lbs: number;
  readonly tension_kg: number;
  readonly tension_range_lbs: readonly [number, number];
  readonly mains_lbs: number | null;
  readonly crosses_lbs: number | null;
  readonly why_string: readonly string[];
  readonly why_tension: readonly string[];
  readonly why_combination: string;
  readonly comfort: readonly string[];
  readonly availability_warning: string | null;
};

export type ReportPayload = {
  readonly kind: 'report';
  readonly headline: string;
  readonly podium: readonly PodiumEntry[];
  readonly transition: RecommendationResult['transition'];
  readonly confidence: {
    readonly level: string;
    readonly reasons: readonly { message: string; remedy: string | null }[];
  };
  readonly setup: SetupPayload | null;
  readonly top3_offer_available: boolean;
  readonly comparison: readonly UnlockedPodiumEntry[] | null;
  readonly engine_version: string;
  readonly dataset_version: string;
  readonly indices_disclaimer: string;
};

const INDICES_DISCLAIMER =
  'Índices Tennis Engineer (0–100). São métricas internas da nossa análise, não especificações do fabricante.';

function buildTags(ranked: RankedRacket): string[] {
  const a = ranked.racket.attributes;
  const tags: Array<[string, number]> = [
    ['CONTROLE', a.control_score],
    ['SPIN', a.spin_score],
    ['POTÊNCIA', a.power_score],
    ['ESTABILIDADE', a.stability_score],
    ['CONFORTO', a.comfort_score],
    ['MANOBRABILIDADE', a.maneuverability_score],
    ['PRECISÃO', a.precision_score],
  ];
  return tags
    .filter(([, score]) => score >= 60)
    .sort((x, y) => y[1] - x[1])
    .slice(0, 3)
    .map(([label]) => label);
}

/** Índices exibidos em passos de 5 — não sugerir precisão que o modelo não tem (R-04). */
function buildIndices(ranked: RankedRacket): Record<string, number> {
  const a = ranked.racket.attributes;
  const step = (v: number): number => Math.round(v / 5) * 5;
  return {
    potencia: step(a.power_score),
    controle: step(a.control_score),
    spin: step(a.spin_score),
    conforto: step(a.comfort_score),
    estabilidade: step(a.stability_score),
    manobrabilidade: step(a.maneuverability_score),
  };
}

function unlockedEntry(
  ranked: RankedRacket,
  profile: PlayerProfile,
): UnlockedPodiumEntry {
  const specs = ranked.racket.variant.specs;
  return {
    rank: ranked.rank,
    fit_score: Math.round(ranked.fit_score),
    locked: false,
    brand: ranked.racket.variant.brand,
    product_name: ranked.racket.variant.product_name,
    // §54: só exibimos foto confirmada como sendo desta variante e geração.
    image_url: ranked.racket.variant.image_verified ? ranked.racket.variant.image_url : null,
    technical_tie_with_previous: ranked.technical_tie_with_previous,
    specs: {
      cabeca_sq_in: specs.head_size_sq_in,
      peso_g: specs.unstrung_weight_g,
      balanco_mm: specs.balance_mm,
      swingweight: specs.swingweight,
      rigidez_ra: specs.stiffness_ra,
      padrao: specs.string_pattern_mains && specs.string_pattern_crosses
        ? `${specs.string_pattern_mains}×${specs.string_pattern_crosses}`
        : null,
    },
    indices: buildIndices(ranked),
    tags: buildTags(ranked),
    why: explainRacketFit(ranked, profile),
    expectations: explainExpectations(ranked),
    attention: ranked.breakdown.penalties.map((p) => p.reason),
  };
}

/** Frase de posicionamento do colocado bloqueado — informativa sem identificar o produto (§29). */
function teaserFor(ranked: RankedRacket, first: RankedRacket): string {
  const a = ranked.racket.attributes;
  const f = first.racket.attributes;
  const diffs: Array<[string, number]> = [
    ['um pouco mais de controle', a.control_score - f.control_score],
    ['mais potência e tolerância', a.power_score - f.power_score],
    ['mais spin', a.spin_score - f.spin_score],
    ['mais conforto', a.comfort_score - f.comfort_score],
    ['mais estabilidade', a.stability_score - f.stability_score],
    ['mais manobrabilidade', a.maneuverability_score - f.maneuverability_score],
  ];
  const best = diffs.sort((x, y) => y[1] - x[1])[0];
  if (!best || best[1] < 3) return 'Alternativa com equilíbrio semelhante, em outro frame.';
  return `Alternativa com ${best[0]}.`;
}

export function serializeTeaser(
  result: RecommendationResult,
  stringVariantsEvaluated: number,
): TeaserPayload {
  return {
    kind: 'teaser',
    candidates_evaluated: result.candidates_evaluated,
    string_variants_evaluated: stringVariantsEvaluated,
    matches_found: result.podium.length,
    confidence_level: CONFIDENCE_LABEL_PT[result.confidence.level],
    analysis_steps: [
      'Perfil físico analisado',
      'Nível técnico calibrado',
      'Swing analisado',
      'Estilo de jogo mapeado',
      'Equipamento atual comparado',
      'Objetivo interpretado',
    ],
    engine_version: result.engine_version,
    dataset_version: result.dataset_version,
  };
}

/**
 * Serializa o relatório POR ENTITLEMENT.
 *
 * Esta é a única função capaz de produzir o payload do resultado. Ela constrói cada colocado a
 * partir dos entitlements concedidos — sem `top3_access`, os colocados 2 e 3 são objetos
 * `{rank, fit_score, teaser, locked}` e não existe nenhum caminho que adicione marca ou modelo.
 */
export function serializeRecommendation(
  result: RecommendationResult,
  profile: PlayerProfile,
  granted: readonly Entitlement[],
): ReportPayload {
  assertEntitlement(granted, 'racket_report_access');

  const first = result.podium[0];
  if (!first) {
    throw new Error('Nenhuma raquete atingiu o mínimo de compatibilidade para o pódio.');
  }

  const canSeeTop3 = hasEntitlement(granted, 'top3_access');
  const canSeeSetup = hasEntitlement(granted, 'full_setup_access');

  const podium: PodiumEntry[] = result.podium.map((entry, index) => {
    if (index === 0 || canSeeTop3) return unlockedEntry(entry, profile);
    return {
      rank: entry.rank,
      fit_score: Math.round(entry.fit_score),
      teaser: teaserFor(entry, first),
      locked: true,
    };
  });

  let setup: SetupPayload | null = null;
  if (canSeeSetup && result.string_recommendation && result.tension) {
    const rec = result.string_recommendation;
    const t = result.tension;
    setup = {
      string_brand: rec.variant.model.brand,
      string_model: rec.variant.model.model,
      string_type: rec.variant.model.string_type,
      gauge_mm: rec.variant.variant.gauge_mm,
      tension_lbs: t.lbs,
      tension_kg: t.kg,
      tension_range_lbs: t.range_lbs,
      mains_lbs: t.mains_lbs,
      crosses_lbs: t.crosses_lbs,
      why_string: explainString(rec),
      why_tension: explainTension(t),
      why_combination: explainCombination(first, rec, t),
      comfort: explainComfort(first, profile, null),
      availability_warning: rec.variant.availability_warning,
    };
  }

  return {
    kind: 'report',
    headline: explainHeadline(first, result.podium[1]?.technical_tie_with_previous ?? false),
    podium,
    transition: {
      ...result.transition,
      expectations: explainTransition(result.transition),
    },
    confidence: {
      level: CONFIDENCE_LABEL_PT[result.confidence.level],
      reasons: result.confidence.reasons.map((r) => ({
        message: r.message,
        remedy: r.remedy,
      })),
    },
    setup,
    top3_offer_available: result.top3_offer_available && !canSeeTop3,
    comparison: canSeeTop3
      ? result.podium.map((entry) => unlockedEntry(entry, profile))
      : null,
    engine_version: result.engine_version,
    dataset_version: result.dataset_version,
    indices_disclaimer: INDICES_DISCLAIMER,
  };
}
