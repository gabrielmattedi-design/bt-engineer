/**
 * `PlayerProfile` — camada 3 (docs/RECOMMENDATION_ENGINE.md §3).
 *
 * É a única representação do jogador que o motor conhece. O questionário produz isto; o motor consome
 * isto. Nenhuma resposta bruta chega ao algoritmo de ranking.
 */

import type { PlayStyle } from './racket';
import type { Score } from './scores';

export const PROFILE_VERSION = '1.0.0';

export type SwingLength = 'short' | 'medium' | 'long' | 'unknown';

export type NeedKey =
  | 'power'
  | 'control'
  | 'spin'
  | 'comfort'
  | 'stability'
  | 'maneuverability'
  | 'forgiveness'
  | 'precision';

export const NEED_KEYS: readonly NeedKey[] = [
  'power',
  'control',
  'spin',
  'comfort',
  'stability',
  'maneuverability',
  'forgiveness',
  'precision',
];

/** Mapeia uma necessidade do jogador ao atributo correspondente da raquete. */
export const NEED_TO_RACKET_ATTRIBUTE = {
  power: 'power_score',
  control: 'control_score',
  spin: 'spin_score',
  comfort: 'comfort_score',
  stability: 'stability_score',
  maneuverability: 'maneuverability_score',
  forgiveness: 'forgiveness_score',
  precision: 'precision_score',
} as const satisfies Record<NeedKey, string>;

/** Specs da raquete atual, quando reconhecida no catálogo (habilita transition_fit e o §22). */
export type CurrentRacketSnapshot = {
  readonly variant_id: string | null;
  /** true quando o usuário digitou texto livre que não casou com o catálogo. */
  readonly unrecognized: boolean;
  readonly weight_g: number | null;
  readonly head_size_sq_in: number | null;
  readonly balance_mm: number | null;
  readonly beam_width_avg_mm: number | null;
  /** Índice de balanço derivado (peso × balanço). NÃO é swingweight. */
  readonly swing_index: number | null;
};

export type CurrentStringSnapshot = {
  readonly string_variant_id: string | null;
  readonly string_type: string | null;
  readonly gauge_mm: number | null;
  readonly tension_lbs: number | null;
  readonly tension_feeling:
    | 'muito_solta'
    | 'um_pouco_solta'
    | 'ideal'
    | 'um_pouco_dura'
    | 'muito_dura'
    | 'nao_sei'
    | null;
  readonly breakage_frequency: Score;
};

export type ObjectiveKey =
  | 'maximize_current'
  | 'more_power'
  | 'more_control'
  | 'more_spin'
  | 'attack_more'
  | 'more_comfort'
  | 'more_stability'
  | 'easier_equipment'
  | 'more_demanding_equipment'
  | 'unknown';

/** Divergência entre fontes de informação sobre o jogador. Nunca resolvida silenciosamente (R-05). */
export type Contradiction = {
  readonly code: string;
  readonly field: string;
  readonly objective_value: string;
  readonly signal_value: string;
  readonly resolution: 'objective_wins' | 'needs_confirmation';
  readonly message: string;
};

export type PlayerProfile = {
  readonly profile_version: string;

  // Nível e técnica
  readonly player_level_score: Score;
  readonly perceived_level_score: Score;
  readonly objective_level_score: Score;
  readonly technical_consistency_score: Score;

  // Swing e físico
  readonly swing_speed_score: Score;
  readonly swing_speed_inferred: boolean;
  readonly swing_length: SwingLength;
  readonly natural_power_score: Score;
  readonly physical_capacity_score: Score;
  readonly age: number | null;

  // Conforto
  readonly arm_sensitivity_score: Score;
  readonly discomfort_areas: readonly string[];

  // Necessidades (0–100, base 50)
  readonly needs: Readonly<Record<NeedKey, Score>>;
  /** Delta desejado por atributo, em pontos [-40, +40]. */
  readonly desired_change_vector: Readonly<Record<NeedKey, number>>;
  /**
   * Eixos que o jogador declarou GOSTAR na raquete atual — não são pedidos, são restrições.
   *
   * Ele não quer mais daquilo; não quer perder aquilo. Alimenta a penalização P9.
   */
  readonly preserved_needs: readonly NeedKey[];
  /**
   * Nitidez do vetor de necessidades, 0–1.
   *
   * Perto de 0 significa que a pessoa não marcou preferência forte — o que é uma resposta legítima,
   * e não a mesma coisa que "precisa de tudo". A confiança do relatório usa isto para não afirmar
   * convicção que o dado não sustenta.
   */
  readonly needs_definition: number;

  // Estilo
  readonly style_weights: Readonly<Record<PlayStyle, number>>;
  /**
   * false quando o jogador NÃO declarou um estilo de jogo — típico de iniciante, que ainda não
   * desenvolveu um. Nesse caso `style_weights` carrega um vetor difuso de placeholder e não deve
   * ser tratado como requisito: ver `DYNAMIC_ADJUSTMENTS.style_undetermined`.
   */
  readonly style_declared: boolean;

  // Equipamento atual
  readonly current_racket: CurrentRacketSnapshot | null;
  readonly current_string: CurrentStringSnapshot | null;

  // Objetivos
  readonly objectives: readonly ObjectiveKey[];

  // Qualidade da entrada
  readonly unknown_answer_ratio: number;
  readonly free_text_length: number;
  /** Primeiro nome, só para o card compartilhável. Não participa de nenhum cálculo. */
  readonly player_name: string | null;
  readonly contradictions: readonly Contradiction[];
};

/**
 * Sinal extraído do texto livre pela camada de IA.
 *
 * Nunca é um `PlayerProfile`, e `value` nunca é uma especificação técnica — apenas enum/booleano.
 * O merge com as respostas objetivas segue as regras de R-05.
 */
export type ProfileSignal = {
  readonly field: string;
  readonly value: string | number | boolean;
  readonly confidence: number; // 0–1
  /** Trecho literal do usuário que sustenta o sinal. Obrigatório: sem evidência, sem sinal. */
  readonly evidence: string;
};
