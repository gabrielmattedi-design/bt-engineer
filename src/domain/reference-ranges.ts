/**
 * Faixas de referência do domínio — docs/RECOMMENDATION_ENGINE.md §1.
 *
 * São as constantes que definem o que é "leve", "pesado", "rígido" e "flexível" no universo de frames
 * adultos de performance das quatro marcas da v1. Alterar qualquer valor aqui muda TODOS os scores
 * derivados e exige incrementar METHODOLOGY_VERSION.
 */

export const METHODOLOGY_VERSION = '1.0.0';

export type Range = readonly [lo: number, hi: number];

export const RANGES = {
  /** Menor e maior cabeça entre frames adultos das 4 marcas. */
  head_size_sq_in: [93, 115] as Range,
  /** Do mais leve "team/lite" ao mais pesado "tour/pro", não encordoado. */
  unstrung_weight_g: [255, 340] as Range,
  /** Peso encordoado (real ou derivado). */
  strung_weight_g: [265, 355] as Range,
  /** Balanço não encordoado: ~9 pts HL a ~4 pts HH. */
  balance_mm: [290, 345] as Range,
  /** Faixa prática de swingweight em frames encordoados. */
  swingweight: [275, 345] as Range,
  /** RA: flexível clássico a rígido de potência. */
  stiffness_ra: [55, 75] as Range,
  /** Perfil médio de viga: box beam a widebody. */
  beam_width_avg_mm: [19, 28] as Range,
  /** Twistweight medido em frames adultos. */
  twistweight: [12, 17] as Range,
} as const;

/**
 * Massa adicionada por um jogo de cordas.
 *
 * NÃO é uma especificação inventada: é uma derivação declarada, usada apenas quando
 * `strung_weight_g` é desconhecido, e sempre marcada como `is_estimated` (R-01, item 3).
 * Jamais é exibida ao usuário como especificação oficial do fabricante.
 */
export const STRING_SET_MASS_G = 16;

/** Limites físicos absolutos de tensão por tipo de corda (docs/STRING_AND_TENSION_ENGINE.md §4.4). */
export const TENSION_BOUNDS_LBS = {
  polyester: [40, 58] as Range,
  co_polyester: [40, 58] as Range,
  multifilament: [45, 64] as Range,
  synthetic_gut: [45, 62] as Range,
  natural_gut: [48, 66] as Range,
  hybrid: [42, 62] as Range,
} as const;

/**
 * Tensão base usada quando o fabricante não publica a faixa do frame.
 * Acompanhada obrigatoriamente de nota no relatório e de queda de confiança — nunca fingimos saber.
 */
export const FALLBACK_BASE_TENSION_LBS = 52;

/** Offset da cross em híbridos — convenção configurável (docs/STRING_AND_TENSION_ENGINE.md §4.5). */
export const HYBRID_CROSS_OFFSET_LBS = 2;

/** Diferença de fit abaixo da qual duas raquetes são um empate técnico (§23, §62). */
export const TECHNICAL_TIE_THRESHOLD = 2.0;

/** Fit mínimo para uma raquete ocupar posição no pódio (regra ética do §30). */
export const MIN_PODIUM_FIT = 75;

/** Abaixo disto, a variante tem dados insuficientes para uma recomendação paga (R-02). */
export const MIN_DATA_COMPLETENESS = 0.55;
