/**
 * Camada 2 — normalização de raquetes.
 *
 * Converte especificações físicas em atributos comparáveis 0–100.
 * Implementa docs/RECOMMENDATION_ENGINE.md §2 literalmente. Se esta função e aquele documento
 * divergirem, tests/unit/methodology-parity.test.ts falha.
 *
 * Nenhum score é atribuído subjetivamente (§6): todos derivam das specs por funções documentadas.
 */

import {
  METHODOLOGY_VERSION,
  RANGES,
  STRING_SET_MASS_G,
} from '@/domain/reference-ranges';
import { clamp, clamp01, inv, norm, toScore, weighted, type WeightedTerm } from '@/domain/scores';
import type {
  PlayStyle,
  RacketAttributes,
  RacketFitProfile,
  RacketSpecs,
  RacketVariant,
  ScoredRacket,
  SkillTier,
} from '@/domain/racket';

/**
 * Abertura do padrão de cordas — docs/RECOMMENDATION_ENGINE.md §1.
 *
 * Mains pesam mais que crosses (0.60 vs 0.40) porque o espaçamento longitudinal domina o movimento do
 * encordoamento, que é o mecanismo do snap-back e portanto do spin.
 *
 * Referência: 18×20 → 0.00 · 16×20 → 0.375 · 16×19 → 0.50 · 16×18 → 0.625 · 14×18 → 1.00
 */
export function computeOpenness(mains: number | null, crosses: number | null): number | null {
  if (mains === null || crosses === null) return null;
  const densityRaw = 0.6 * norm(mains, 14, 18) + 0.4 * norm(crosses, 16, 20);
  return clamp01((1 - densityRaw) / 0.8);
}

/**
 * Peso encordoado. Se desconhecido, deriva de `unstrung + STRING_SET_MASS_G`.
 *
 * Isto é uma DERIVAÇÃO DECLARADA, não um dado inventado (R-01): é sinalizada por `is_estimated`,
 * nunca exibida como especificação do fabricante, e usada apenas para cálculo interno.
 */
export function resolveStrungWeight(specs: RacketSpecs): {
  value: number | null;
  is_estimated: boolean;
} {
  if (specs.strung_weight_g !== null) return { value: specs.strung_weight_g, is_estimated: false };
  if (specs.unstrung_weight_g !== null) {
    return { value: specs.unstrung_weight_g + STRING_SET_MASS_G, is_estimated: true };
  }
  return { value: null, is_estimated: false };
}

/** Perfil médio de viga a partir da string '23/26/23'. Não inventa: retorna null se não parseável. */
export function parseBeamAverage(specs: RacketSpecs): number | null {
  if (specs.beam_width_avg_mm !== null) return specs.beam_width_avg_mm;
  if (specs.beam_width_mm === null) return null;
  const parts = specs.beam_width_mm
    .split('/')
    .map((p) => Number.parseFloat(p.trim()))
    .filter((n) => Number.isFinite(n));
  if (parts.length === 0) return null;
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

type NormalizedSpecs = {
  h: number | null; // head size
  w: number | null; // strung weight
  b: number | null; // balance
  s: number | null; // swingweight
  r: number | null; // stiffness RA
  m: number | null; // beam width
  t: number | null; // twistweight
  o: number | null; // openness
  d: number | null; // density = 1 - openness
  strungEstimated: boolean;
};

function normalizeSpecs(specs: RacketSpecs): NormalizedSpecs {
  const strung = resolveStrungWeight(specs);
  const beam = parseBeamAverage(specs);
  const o = computeOpenness(specs.string_pattern_mains, specs.string_pattern_crosses);

  const n = (v: number | null, range: readonly [number, number]): number | null =>
    v === null ? null : norm(v, range[0], range[1]);

  return {
    h: n(specs.head_size_sq_in, RANGES.head_size_sq_in),
    w: n(strung.value, RANGES.strung_weight_g),
    b: n(specs.balance_mm, RANGES.balance_mm),
    s: n(specs.swingweight, RANGES.swingweight),
    r: n(specs.stiffness_ra, RANGES.stiffness_ra),
    m: n(beam, RANGES.beam_width_avg_mm),
    t: n(specs.twistweight, RANGES.twistweight),
    o,
    d: o === null ? null : 1 - o,
    strungEstimated: strung.is_estimated,
  };
}

const invOrNull = (v: number | null): number | null => (v === null ? null : inv(v));

/**
 * Traduz o rótulo de um termo para o CAMPO de especificação que o originou.
 *
 * Sem isto, `missing_fields` vazaria nomes internos ("stiffness_ra_inverse") para a mensagem de
 * confiança que o usuário lê. O usuário precisa saber qual DADO falta, não qual termo do cálculo.
 */
const TERM_TO_FIELD: Record<string, string> = {
  head_size: 'head_size_sq_in',
  head_size_inverse: 'head_size_sq_in',
  weight: 'unstrung_weight_g',
  weight_inverse: 'unstrung_weight_g',
  balance: 'balance_mm',
  balance_inverse: 'balance_mm',
  swingweight: 'swingweight',
  swingweight_inverse: 'swingweight',
  stiffness_ra: 'stiffness_ra',
  stiffness_ra_inverse: 'stiffness_ra',
  beam_width: 'beam_width_mm',
  beam_width_inverse: 'beam_width_mm',
  twistweight: 'twistweight',
  pattern_openness: 'string_pattern',
  pattern_density: 'string_pattern',
};

/** Nomes legíveis em pt-BR para exibição ao usuário nas razões de confiança. */
export const FIELD_LABEL_PT: Record<string, string> = {
  head_size_sq_in: 'tamanho da cabeça',
  unstrung_weight_g: 'peso',
  balance_mm: 'balanço',
  swingweight: 'swingweight',
  stiffness_ra: 'rigidez (RA)',
  beam_width_mm: 'perfil da viga',
  twistweight: 'twistweight',
  string_pattern: 'padrão de cordas',
};

export function humanizeMissingFields(fields: readonly string[]): string {
  return fields.map((f) => FIELD_LABEL_PT[f] ?? f).join(', ');
}

/**
 * Calcula os 11 atributos derivados + demand_index.
 *
 * Cada score usa `weighted()`, que descarta termos com dado ausente e renormaliza os pesos restantes.
 * Uma raquete sem swingweight não é punida — a lacuna vira `data_completeness`, que afeta a CONFIANÇA
 * do relatório, nunca a pontuação (R-02).
 */
export function computeRacketAttributes(specs: RacketSpecs): RacketAttributes {
  const n = normalizeSpecs(specs);
  const missing = new Set<string>();
  let coveredWeight = 0;
  let totalWeight = 0;

  const build = (terms: readonly WeightedTerm[]): number => {
    const result = weighted(terms);
    for (const label of result.missing) missing.add(TERM_TO_FIELD[label] ?? label);
    const sum = terms.reduce((acc, t) => acc + t.weight, 0);
    totalWeight += sum;
    coveredWeight += sum * result.coverage;
    return result.score;
  };

  const T = (label: string, value: number | null, weight: number): WeightedTerm => ({
    label,
    value,
    weight,
  });

  // Potência GRATUITA: o quanto o frame devolve sem esforço do jogador. Peso entra INVERTIDO — um
  // frame pesado exige o jogador. Plow-through pertence a stability_score, não aqui.
  const power_score = build([
    T('head_size', n.h, 0.3),
    T('stiffness_ra', n.r, 0.25),
    T('beam_width', n.m, 0.2),
    T('pattern_openness', n.o, 0.15),
    T('weight_inverse', invOrNull(n.w), 0.1),
  ]);

  const control_score = build([
    T('head_size_inverse', invOrNull(n.h), 0.28),
    T('pattern_density', n.d, 0.24),
    T('beam_width_inverse', invOrNull(n.m), 0.18),
    T('swingweight', n.s, 0.16),
    T('stiffness_ra_inverse', invOrNull(n.r), 0.14),
  ]);

  // Abertura domina (0.45) pelo mecanismo de snap-back do encordoamento.
  const spin_score = build([
    T('pattern_openness', n.o, 0.45),
    T('head_size', n.h, 0.2),
    T('swingweight', n.s, 0.2),
    T('stiffness_ra_inverse', invOrNull(n.r), 0.15),
  ]);

  // RA domina (0.45): rigidez do frame é o principal determinante da transmissão de choque.
  const comfort_score = build([
    T('stiffness_ra_inverse', invOrNull(n.r), 0.45),
    T('weight', n.w, 0.25),
    T('beam_width_inverse', invOrNull(n.m), 0.15),
    T('pattern_openness', n.o, 0.15),
  ]);

  const stability_score = build([
    T('swingweight', n.s, 0.35),
    T('weight', n.w, 0.3),
    T('twistweight', n.t, 0.25),
    T('balance', n.b, 0.1),
  ]);

  // Swingweight invertido domina (0.45): é o que o jogador sente ao acelerar o braço, não o peso estático.
  const maneuverability_score = build([
    T('swingweight_inverse', invOrNull(n.s), 0.45),
    T('weight_inverse', invOrNull(n.w), 0.3),
    T('balance_inverse', invOrNull(n.b), 0.25),
  ]);

  const forgiveness_score = build([
    T('head_size', n.h, 0.4),
    T('twistweight', n.t, 0.3),
    T('pattern_openness', n.o, 0.15),
    T('weight', n.w, 0.15),
  ]);

  const precision_score = build([
    T('pattern_density', n.d, 0.3),
    T('head_size_inverse', invOrNull(n.h), 0.25),
    T('swingweight', n.s, 0.2),
    T('stiffness_ra_inverse', invOrNull(n.r), 0.15),
    T('twistweight', n.t, 0.1),
  ]);

  const feel_score = build([
    T('stiffness_ra_inverse', invOrNull(n.r), 0.5),
    T('weight', n.w, 0.3),
    T('pattern_density', n.d, 0.2),
  ]);

  const launch_angle_score = build([
    T('pattern_openness', n.o, 0.4),
    T('head_size', n.h, 0.3),
    T('stiffness_ra', n.r, 0.2),
    T('beam_width', n.m, 0.1),
  ]);

  const arm_friendliness_score = build([
    T('stiffness_ra_inverse', invOrNull(n.r), 0.5),
    T('weight', n.w, 0.3),
    T('beam_width_inverse', invOrNull(n.m), 0.1),
    T('pattern_openness', n.o, 0.1),
  ]);

  // "Quanto de técnica este frame cobra": massa a acelerar, área de erro pequena, padrão denso.
  const demand_index = build([
    T('swingweight', n.s, 0.35),
    T('head_size_inverse', invOrNull(n.h), 0.25),
    T('pattern_density', n.d, 0.2),
    T('weight', n.w, 0.2),
  ]);

  return {
    power_score,
    control_score,
    spin_score,
    comfort_score,
    stability_score,
    maneuverability_score,
    forgiveness_score,
    precision_score,
    feel_score,
    launch_angle_score,
    arm_friendliness_score,
    demand_index,
    data_completeness: totalWeight === 0 ? 0 : clamp01(coveredWeight / totalWeight),
    missing_fields: [...missing].sort(),
    strung_weight_is_estimated: n.strungEstimated,
    methodology_version: METHODOLOGY_VERSION,
  };
}

/** Alvo de exigência por faixa de nível — docs/RECOMMENDATION_ENGINE.md §2. */
const DEMAND_TARGET: Record<SkillTier, number> = {
  beginner: 25,
  intermediate: 45,
  advanced: 65,
  competitive: 78,
};

function levelFit(demand: number, tier: SkillTier): number {
  return clamp(100 - Math.abs(demand - DEMAND_TARGET[tier]) * 1.6, 0, 100);
}

/** Perfis de adequação por nível e estilo (§6). Derivados, nunca digitados. */
export function computeFitProfile(a: RacketAttributes): RacketFitProfile {
  const d = a.demand_index;

  const styles: Record<PlayStyle, number> = {
    baseline: 0.4 * a.control_score + 0.3 * a.stability_score + 0.3 * a.spin_score,
    aggressive_baseliner:
      0.35 * a.stability_score +
      0.25 * a.control_score +
      0.25 * a.spin_score +
      0.15 * a.power_score,
    counterpuncher:
      0.35 * a.stability_score +
      0.25 * a.maneuverability_score +
      0.25 * a.control_score +
      0.15 * a.forgiveness_score,
    heavy_spin: 0.55 * a.spin_score + 0.25 * a.launch_angle_score + 0.2 * a.stability_score,
    flat_hitter: 0.4 * a.precision_score + 0.3 * a.control_score + 0.3 * a.stability_score,
    all_court:
      0.3 * a.maneuverability_score +
      0.25 * a.control_score +
      0.25 * a.stability_score +
      0.2 * a.feel_score,
    serve_and_volley:
      0.35 * a.maneuverability_score +
      0.3 * a.stability_score +
      0.2 * a.precision_score +
      0.15 * a.feel_score,
    net_player:
      0.4 * a.maneuverability_score + 0.3 * a.stability_score + 0.3 * a.feel_score,
  };

  return {
    beginner_fit:
      0.45 * levelFit(d, 'beginner') +
      0.3 * a.forgiveness_score +
      0.15 * a.power_score +
      0.1 * a.maneuverability_score,
    intermediate_fit:
      0.45 * levelFit(d, 'intermediate') +
      0.2 * a.forgiveness_score +
      0.2 * a.spin_score +
      0.15 * a.control_score,
    advanced_fit:
      0.45 * levelFit(d, 'advanced') +
      0.25 * a.control_score +
      0.2 * a.stability_score +
      0.1 * a.precision_score,
    competitive_fit:
      0.45 * levelFit(d, 'competitive') +
      0.25 * a.stability_score +
      0.2 * a.precision_score +
      0.1 * a.control_score,
    styles,
    methodology_version: METHODOLOGY_VERSION,
  };
}

export function scoreRacket(variant: RacketVariant): ScoredRacket {
  const attributes = computeRacketAttributes(variant.specs);
  return { variant, attributes, fitProfile: computeFitProfile(attributes) };
}

export function scoreRackets(variants: readonly RacketVariant[]): ScoredRacket[] {
  return variants.map(scoreRacket);
}

/** Índice de massa percebida — usado por `physical_fit`. */
export function massIndex(specs: RacketSpecs): number | null {
  const strung = resolveStrungWeight(specs).value;
  const wTerm = strung === null ? null : norm(strung, RANGES.strung_weight_g[0], RANGES.strung_weight_g[1]);
  const sTerm =
    specs.swingweight === null
      ? null
      : norm(specs.swingweight, RANGES.swingweight[0], RANGES.swingweight[1]);

  const result = weighted([
    { label: 'strung_weight', value: wTerm, weight: 0.55 },
    { label: 'swingweight', value: sTerm, weight: 0.45 },
  ]);
  return result.coverage === 0 ? null : toScore(result.score / 100);
}
