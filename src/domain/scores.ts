/**
 * Primitivas numéricas do domínio.
 *
 * Ver docs/RECOMMENDATION_ENGINE.md §1. Toda função aqui é pura e total: dado um número finito,
 * retorna um número finito. Nenhuma lança exceção em uso normal — o motor precisa ser previsível.
 */

/** Score canônico do sistema: 0–100. */
export type Score = number;

export function clamp(x: number, lo: number, hi: number): number {
  if (Number.isNaN(x)) return lo;
  return Math.min(hi, Math.max(lo, x));
}

export function clamp01(x: number): number {
  return clamp(x, 0, 1);
}

/** Normaliza x para [0,1] dentro da faixa [lo,hi]. */
export function norm(x: number, lo: number, hi: number): number {
  if (hi === lo) return 0.5;
  return clamp01((x - lo) / (hi - lo));
}

export function inv(t: number): number {
  return 1 - t;
}

/** t ∈ [0,1] → 0–100 */
export function toScore(t: number): Score {
  return clamp01(t) * 100;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp01(t);
}

/** Arredonda para `places` casas, evitando ruído de ponto flutuante em comparações e snapshots. */
export function round(x: number, places = 2): number {
  const f = 10 ** places;
  return Math.round(x * f) / f;
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] as number;
  return ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

/**
 * Termo de uma soma ponderada. `value: null` significa "dado ausente" — o termo é descartado e o
 * peso é redistribuído entre os presentes (docs/RECOMMENDATION_ENGINE.md §2, R-02).
 *
 * Nunca substituímos `null` por um valor default: isso seria inventar dado.
 */
export type WeightedTerm = {
  readonly label: string;
  /** Valor já normalizado em [0,1]. `null` quando a especificação de origem é desconhecida. */
  readonly value: number | null;
  readonly weight: number;
  readonly note?: string;
};

export type WeightedResult = {
  /** Score 0–100 renormalizado sobre os termos presentes. */
  readonly score: Score;
  /** Fração do peso total que estava presente (1 = dados completos). */
  readonly coverage: number;
  readonly missing: readonly string[];
  readonly terms: readonly WeightedTerm[];
};

/**
 * Soma ponderada com degradação graciosa.
 *
 * Se `swingweight` é null, seu termo desaparece e os pesos restantes são renormalizados para somar 1 —
 * a raquete não é punida por uma lacuna do nosso catálogo. A lacuna vira `coverage`, que alimenta
 * `data_completeness` e, por consequência, a confiança do relatório (nunca o score).
 */
export function weighted(terms: readonly WeightedTerm[]): WeightedResult {
  let presentWeight = 0;
  let totalWeight = 0;
  let acc = 0;
  const missing: string[] = [];

  for (const term of terms) {
    totalWeight += term.weight;
    if (term.value === null || Number.isNaN(term.value)) {
      missing.push(term.label);
      continue;
    }
    presentWeight += term.weight;
    acc += clamp01(term.value) * term.weight;
  }

  if (presentWeight === 0) {
    return { score: 0, coverage: 0, missing, terms };
  }

  return {
    score: toScore(acc / presentWeight),
    coverage: totalWeight === 0 ? 0 : presentWeight / totalWeight,
    missing,
    terms,
  };
}
