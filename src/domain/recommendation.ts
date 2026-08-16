/**
 * Tipos de saída do motor — docs/RECOMMENDATION_ENGINE.md §7.
 *
 * Toda pontuação exibida ao usuário tem um `ScoreBreakdown` correspondente persistido. É isso que
 * impede o algoritmo de virar caixa-preta (§48) e o que alimenta o simulador do admin (§47).
 */

import type { ScoredRacket } from './racket';
import type { NeedKey } from './player-profile';
import type { ScoredStringVariant } from './string';
import type { ConfidenceLevel } from './sourced';
import type { Score, WeightedTerm } from './scores';

export type ComponentKey =
  | 'physical_fit'
  | 'skill_fit'
  | 'swing_fit'
  | 'playstyle_fit'
  | 'objective_fit'
  | 'comfort_fit'
  | 'transition_fit';

export const COMPONENT_KEYS: readonly ComponentKey[] = [
  'physical_fit',
  'skill_fit',
  'swing_fit',
  'playstyle_fit',
  'objective_fit',
  'comfort_fit',
  'transition_fit',
];

export type ComponentBreakdown = {
  readonly key: ComponentKey;
  /** Score bruto do componente, 0–100. */
  readonly raw: Score;
  readonly weight: number;
  readonly contribution: number;
  readonly terms: readonly WeightedTerm[];
  readonly missing_fields: readonly string[];
};

export type Penalty = {
  readonly code: string;
  readonly points: number;
  readonly reason: string;
  /**
   * Eixo de necessidade envolvido, quando a penalização é sobre um objetivo declarado.
   *
   * Sem ele o relatório só conseguia repetir a frase da penalização — "você pediu mais
   * estabilidade, mas este frame vai na direção contrária" —, que informa o problema e esconde o
   * raciocínio. Com o eixo dá para ir buscar no ranking o que a alternativa mais estável custaria,
   * e transformar a constatação numa troca explicada.
   */
  readonly axis?: NeedKey;
};

export type ScoreBreakdown = {
  readonly final_score: Score;
  readonly components: readonly ComponentBreakdown[];
  readonly penalties: readonly Penalty[];
  readonly data_completeness: number;
  /** Motivos legíveis pelos quais a raquete ganhou pontos. */
  readonly gained: readonly string[];
  /** Motivos legíveis pelos quais perdeu pontos. */
  readonly lost: readonly string[];
};

export type RankedRacket = {
  readonly rank: number;
  readonly racket: ScoredRacket;
  readonly fit_score: Score;
  readonly breakdown: ScoreBreakdown;
  /** true quando está a menos de TECHNICAL_TIE_THRESHOLD do vizinho no ranking (§62). */
  readonly technical_tie_with_previous: boolean;
};

/** Variante excluída antes da pontuação. O admin precisa ver POR QUE algo não apareceu. */
export type ExcludedRacket = {
  readonly variant_id: string;
  readonly product_name: string;
  readonly filter: string;
  readonly reason: string;
};

/** Comparação atual × recomendada (§22). */
export type SpecComparison = {
  readonly label: string;
  readonly current: number | null;
  readonly recommended: number | null;
  readonly unit: string;
  readonly delta: number | null;
  readonly direction: 'up' | 'down' | 'same' | 'unknown';
  /** Interpretação honesta: uma mudança pode ser ganho E perda ao mesmo tempo. */
  readonly interpretation: string;
};

export type TransitionAnalysis = {
  readonly available: boolean;
  readonly comparisons: readonly SpecComparison[];
  readonly expectations: readonly string[];
  readonly attention_points: readonly string[];
};

export type TensionAdjustment = {
  readonly factor: string;
  readonly delta_lbs: number;
  readonly rationale: string;
};

export type TensionRecommendation = {
  readonly lbs: number;
  readonly kg: number;
  readonly range_lbs: readonly [number, number];
  readonly mains_lbs: number | null;
  readonly crosses_lbs: number | null;
  readonly base_lbs: number;
  readonly base_source: 'manufacturer_range' | 'fallback';
  readonly adjustments: readonly TensionAdjustment[];
  readonly clamped_by: 'frame_range' | 'string_type_bounds' | null;
  readonly anchored_to_current: boolean;
  readonly anchor_weight: number;
  readonly guidance: string;
  readonly notes: readonly string[];
};

export type StringRecommendation = {
  readonly variant: ScoredStringVariant;
  readonly fit_score: Score;
  readonly target: Readonly<Record<string, number>>;
  readonly rationale: readonly string[];
  /** Nota quando o gauge ideal não existe para este modelo (Regra de Integridade). */
  readonly gauge_note: string | null;
  readonly excluded_types: readonly string[];
};

export type ConfidenceReason = {
  readonly code: string;
  readonly points: number;
  readonly message: string;
  /** O que o usuário poderia informar para reduzir a incerteza. */
  readonly remedy: string | null;
};

export type RecommendationConfidence = {
  readonly score: Score;
  readonly level: ConfidenceLevel;
  readonly reasons: readonly ConfidenceReason[];
  /** Quão bem conhecemos o JOGADOR (respostas, contradições, sinais inferidos). */
  readonly profile_knowledge: Score;
  /** Quão bem conhecemos o EQUIPAMENTO (completude das specs, faixa de tensão do fabricante). */
  readonly data_knowledge: Score;
};

export type RecommendationResult = {
  readonly engine_version: string;
  readonly weights_version: string;
  readonly dataset_version: string;
  readonly methodology_version: string;

  readonly podium: readonly RankedRacket[];
  /** Ranking completo para auditoria e simulador. Nunca serializado ao cliente. */
  readonly full_ranking: readonly RankedRacket[];
  readonly excluded: readonly ExcludedRacket[];
  readonly candidates_evaluated: number;

  readonly transition: TransitionAnalysis;
  readonly string_recommendation: StringRecommendation | null;
  readonly tension: TensionRecommendation | null;

  readonly confidence: RecommendationConfidence;
  /** false quando não existe 2º ou 3º colocado para ofertar (§30). */
  readonly top3_offer_available: boolean;

  /**
   * Faixa [mín, máx] que o catálogo ocupa em cada atributo exibido, no momento desta análise.
   *
   * Viaja junto com o resultado, e não é recalculada na hora de mostrar, porque um relatório
   * comprado precisa continuar sendo lido exatamente como foi vendido. Se as faixas fossem
   * derivadas do catálogo vigente, incluir uma raquete nova amanhã mudaria os números de um
   * relatório de ontem — sem que nada tivesse acontecido com a raquete recomendada.
   */
  readonly attribute_bands: Readonly<Record<string, readonly [number, number]>>;

  /**
   * Variante do pódio para a qual `string_recommendation` e `tension` foram calculados.
   *
   * `null` = a 1ª colocada, que é o padrão. Só muda quando o jogador compra o upgrade de setup e
   * escolhe outra posição — e é este campo que faz o relatório dizer PARA QUAL raquete o setup
   * vale, em vez de deixar a corda solta ao lado de três nomes.
   */
  readonly setup_for_variant_id?: string | null;
};
