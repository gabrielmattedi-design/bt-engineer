/**
 * Camada 3 — construção do `PlayerProfile`.
 *
 * Implementa docs/RECOMMENDATION_ENGINE.md §3. Função pura: respostas + sinais → perfil.
 * Nenhuma resposta bruta chega ao ranking; tudo passa por aqui e vira score documentado.
 */

import { clamp, mean, norm, round } from '@/domain/scores';
import type { PlayStyle } from '@/domain/racket';
import type {
  Contradiction,
  CurrentRacketSnapshot,
  CurrentStringSnapshot,
  NeedKey,
  ObjectiveKey,
  PlayerProfile,
  ProfileSignal,
  SwingLength,
} from '@/domain/player-profile';
import { NEED_KEYS, PROFILE_VERSION } from '@/domain/player-profile';
import {
  DISLIKE_NEED_BONUS,
  NEED_PRIORITY_BONUS,
  OBJECTIVE_NEED_BONUS,
} from '@/recommendation/config/weights.v1';
import type { QuestionnaireAnswers, TriState } from './answers';
import { countUnknowns } from './answers';

const TRISTATE_SCORE: Record<TriState, number> = { sim: 100, as_vezes: 55, nao: 15 };

const PERCEIVED_LEVEL_SCORE: Record<string, number> = {
  iniciante: 15,
  iniciante_avancado: 35,
  intermediario: 55,
  intermediario_avancado: 72,
  avancado: 88,
};

const EXPERIENCE_YEARS: Record<string, number> = {
  menos_6m: 0.4,
  '6_12m': 0.8,
  '1_2a': 1.5,
  '2_5a': 3.5,
  mais_5a: 6,
};

const TOURNAMENT_SCORE: Record<string, number> = {
  nunca: 20,
  amadores: 60,
  regionais: 85,
  competitivo: 100,
};

const SWING_SPEED_SCORE: Record<string, number> = {
  lenta: 20,
  moderada: 45,
  rapida: 72,
  muito_rapida: 90,
};

const SWING_LENGTH_SCORE: Record<SwingLength, number> = {
  short: 25,
  medium: 55,
  long: 85,
  unknown: 50,
};

const STRENGTH_SCORE: Record<string, number> = {
  abaixo: 25,
  media: 50,
  acima: 75,
  bem_acima: 95,
};

const FITNESS_SCORE: Record<string, number> = {
  sedentario: 20,
  moderado: 50,
  bom: 75,
  atletico: 95,
};

const BREAKAGE_SCORE: Record<string, number> = {
  nunca: 10,
  raramente: 30,
  a_cada_2_3_meses: 55,
  mensalmente: 80,
  semanalmente: 95,
};

/**
 * Fator etário para capacidade física. Platô até 34 anos, decaimento linear até 0.65 aos 65.
 * Abaixo de 16, 0.8 — não por fraqueza, mas por desenvolvimento físico incompleto.
 */
export function ageFactor(age: number | null): number {
  if (age === null) return 0.85;
  if (age < 16) return 0.8;
  if (age <= 34) return 1.0;
  if (age >= 65) return 0.65;
  return 1.0 - ((age - 34) / (65 - 34)) * 0.35;
}

/**
 * Nível calibrado — docs/RECOMMENDATION_ENGINE.md §3.1.
 *
 * O autoavaliado pesa apenas 0.15: carrega informação real, mas tem viés conhecido nas duas direções
 * e não pode dominar. As 6 perguntas objetivas pesam 0.60.
 */
export function calibrateLevel(a: QuestionnaireAnswers): {
  objective: number;
  perceived: number;
  final: number;
  mismatch: boolean;
} {
  const objectiveItems: number[] = [];
  for (const q of [
    a.can_sustain_rally,
    a.can_direct_ball,
    a.can_generate_spin,
    a.can_vary_depth,
    a.reliable_second_serve,
  ]) {
    if (q !== null) objectiveItems.push(TRISTATE_SCORE[q]);
  }
  if (a.tournament_experience !== null) {
    objectiveItems.push(TOURNAMENT_SCORE[a.tournament_experience] ?? 20);
  }

  const perceived =
    a.perceived_level === null ? 45 : (PERCEIVED_LEVEL_SCORE[a.perceived_level] ?? 45);

  // Sem nenhuma resposta objetiva, cai-se no autoavaliado — e a confiança despenca em confidence.ts.
  const objective = objectiveItems.length === 0 ? perceived : mean(objectiveItems);

  const years = a.experience_duration === null ? 1 : (EXPERIENCE_YEARS[a.experience_duration] ?? 1);
  const lessonsFactor =
    a.has_lessons === 'atualmente' ? 1 : a.has_lessons === 'ja_fiz' ? 0.75 : 0.4;
  const experience =
    0.5 * norm(years, 0, 5) +
    0.3 * norm(a.frequency_per_week ?? 1, 0, 4) +
    0.2 * lessonsFactor;

  const final = clamp(0.6 * objective + 0.25 * (100 * experience) + 0.15 * perceived, 0, 100);

  return {
    objective: round(objective),
    perceived,
    final: round(final),
    mismatch: Math.abs(perceived - objective) > 25,
  };
}

function computePhysicalCapacity(a: QuestionnaireAnswers): number {
  const strength = a.perceived_strength === null ? 50 : (STRENGTH_SCORE[a.perceived_strength] ?? 50);
  const fitness = a.fitness_level === null ? 50 : (FITNESS_SCORE[a.fitness_level] ?? 50);
  return clamp(
    0.35 * strength +
      0.3 * fitness +
      0.2 * (ageFactor(a.age) * 100) +
      0.15 * (norm(a.frequency_per_week ?? 1, 0, 4) * 100),
    0,
    100,
  );
}

function computeSwingLength(a: QuestionnaireAnswers): SwingLength {
  switch (a.swing_length) {
    case 'curto':
      return 'short';
    case 'medio':
      return 'medium';
    case 'longo':
      return 'long';
    default:
      return 'unknown';
  }
}

/** Sensibilidade no braço (§17). Nunca é diagnóstico — é um peso de decisão de equipamento. */
function computeArmSensitivity(areas: readonly string[]): number {
  const relevant = areas.filter((x) => x !== 'nenhum');
  if (relevant.length === 0) return 0;
  const scores: Record<string, number> = { cotovelo: 75, ombro: 65, punho: 60 };
  const values = relevant.map((r) => scores[r] ?? 60);
  const max = Math.max(...values);
  return clamp(relevant.length > 1 ? max + 10 : max, 0, 95);
}

const STYLE_ANSWER_MAP: Record<string, PlayStyle[]> = {
  dominar_fundo: ['aggressive_baseliner', 'baseline'],
  muito_topspin: ['heavy_spin'],
  mais_chapado: ['flat_hitter'],
  atacar_cedo: ['aggressive_baseliner'],
  contra_atacar: ['counterpuncher'],
  all_court: ['all_court'],
  subir_rede: ['serve_and_volley', 'net_player'],
  sem_estilo: ['baseline', 'all_court', 'counterpuncher'],
};

function computeStyleWeights(a: QuestionnaireAnswers): {
  weights: Record<PlayStyle, number>;
  declared: boolean;
} {
  const weights: Record<PlayStyle, number> = {
    baseline: 0,
    aggressive_baseliner: 0,
    counterpuncher: 0,
    heavy_spin: 0,
    flat_hitter: 0,
    all_court: 0,
    serve_and_volley: 0,
    net_player: 0,
  };

  const selections = a.play_style.filter((s) => s !== 'sem_estilo');
  for (const sel of selections) {
    for (const style of STYLE_ANSWER_MAP[sel] ?? []) {
      weights[style] += 1;
    }
  }

  // Forehand reforça o eixo spin/flat sem sobrepor a declaração explícita de estilo.
  if (a.forehand_type === 'topspin_pesado') weights.heavy_spin += 0.6;
  if (a.forehand_type === 'mais_chapado') weights.flat_hitter += 0.6;

  const total = Object.values(weights).reduce((s, v) => s + v, 0);
  if (total === 0) {
    /**
     * Nenhum estilo declarado — o jogador respondeu "ainda não tenho um estilo" ou pulou a
     * pergunta. Este é o caso NORMAL do iniciante, não uma resposta incompleta.
     *
     * O vetor devolvido é um placeholder difuso, mantido apenas para que consumidores que leem
     * `style_weights` tenham algo coerente. `declared: false` é o dado que importa: o motor
     * renormaliza `playstyle_fit` para fora em vez de cobrar aderência a um estilo inventado.
     * Sem isso, o iniciante era reprovado por não parecer um contra-atacante.
     */
    return { weights: { ...weights, baseline: 1, all_court: 1, counterpuncher: 1 }, declared: false };
  }
  return { weights, declared: true };
}

const OBJECTIVE_MAP: Record<string, ObjectiveKey> = {
  potencializar: 'maximize_current',
  ganhar_potencia: 'more_power',
  ganhar_controle: 'more_control',
  mais_spin: 'more_spin',
  atacar_mais: 'attack_more',
  mais_conforto: 'more_comfort',
  mais_estabilidade: 'more_stability',
  mais_facil: 'easier_equipment',
  mais_exigente: 'more_demanding_equipment',
  nao_sei: 'unknown',
};

const OBJECTIVE_NEED: Partial<Record<ObjectiveKey, NeedKey>> = {
  more_power: 'power',
  more_control: 'control',
  more_spin: 'spin',
  more_comfort: 'comfort',
  more_stability: 'stability',
};

/** Vetor de necessidades — docs/RECOMMENDATION_ENGINE.md §3.3. Base 50, ajustes acumulativos. */
function computeNeeds(
  a: QuestionnaireAnswers,
  objectives: readonly ObjectiveKey[],
  armSensitivity: number,
): Record<NeedKey, number> {
  const needs: Record<NeedKey, number> = {
    power: 50,
    control: 50,
    spin: 50,
    comfort: 50,
    stability: 50,
    maneuverability: 50,
    forgiveness: 50,
    precision: 50,
  };

  const isNeed = (s: string): s is NeedKey => (NEED_KEYS as readonly string[]).includes(s);

  // "Sente falta de" — ordenado por prioridade (+25 / +15 / +8).
  a.missing_attributes.forEach((attr, index) => {
    if (!isNeed(attr)) return;
    needs[attr] += NEED_PRIORITY_BONUS[index] ?? 0;
  });

  // Objetivos declarados.
  for (const obj of objectives) {
    const need = OBJECTIVE_NEED[obj];
    if (need) needs[need] += OBJECTIVE_NEED_BONUS;
    if (obj === 'attack_more') {
      needs.power += 10;
      needs.stability += 8;
    }
    if (obj === 'easier_equipment') {
      needs.forgiveness += 20;
      needs.maneuverability += 12;
      needs.precision -= 8;
    }
    if (obj === 'more_demanding_equipment') {
      needs.control += 15;
      needs.stability += 15;
      needs.precision += 10;
      needs.forgiveness -= 15;
    }
  }

  // Comportamento das bolas.
  for (const t of a.ball_tendency) {
    if (t === 'caem_curtas') needs.power += 15;
    if (t === 'passam_da_linha') {
      needs.control += 18;
      needs.spin += 10;
    }
    if (t === 'vao_para_rede') needs.power += 10;
    if (t === 'variam_demais') {
      needs.forgiveness += 15;
      needs.stability += 10;
    }
  }

  // Reclamações sobre a raquete atual — o sinal mais concreto que o jogador consegue dar.
  for (const d of a.current_racket_dislikes) {
    const mapping = DISLIKE_NEED_BONUS[d];
    if (mapping) needs[mapping.need] += mapping.points;
  }

  // Sensibilidade no braço eleva conforto a piso alto, independentemente do resto.
  if (armSensitivity >= 60) needs.comfort = Math.max(needs.comfort, 80);

  for (const k of NEED_KEYS) needs[k] = clamp(needs[k], 0, 100);
  return needs;
}

/**
 * Merge dos sinais de texto livre — regras de R-05.
 *
 * A resposta objetiva SEMPRE vence quando existe e diverge. Nenhum caminho aqui sobrescreve
 * silenciosamente uma resposta explícita do usuário.
 */
function mergeSignals(
  a: QuestionnaireAnswers,
  signals: readonly ProfileSignal[],
): { applied: Partial<QuestionnaireAnswers>; contradictions: Contradiction[] } {
  const applied: Record<string, unknown> = {};
  const contradictions: Contradiction[] = [];
  const answers = a as unknown as Record<string, unknown>;

  const CRITICAL_FIELDS = new Set(['perceived_level', 'discomfort_areas', 'swing_speed']);

  for (const signal of signals) {
    if (signal.confidence < 0.5) continue;

    const current = answers[signal.field];
    const isUnset = current === null || current === undefined || current === 'nao_sei';

    if (isUnset) {
      applied[signal.field] = signal.value;
      continue;
    }

    if (current === signal.value) continue; // concordância: nada a fazer além do ganho de confiança

    contradictions.push({
      code: 'free_text_conflict',
      field: signal.field,
      objective_value: String(current),
      signal_value: String(signal.value),
      resolution: CRITICAL_FIELDS.has(signal.field) ? 'needs_confirmation' : 'objective_wins',
      message: `Você respondeu "${String(current)}", mas no texto livre mencionou algo compatível com "${String(signal.value)}".`,
    });
  }

  return { applied: applied as Partial<QuestionnaireAnswers>, contradictions };
}

export function buildPlayerProfile(
  rawAnswers: QuestionnaireAnswers,
  signals: readonly ProfileSignal[] = [],
): PlayerProfile {
  const merge = mergeSignals(rawAnswers, signals);
  const a: QuestionnaireAnswers = { ...rawAnswers, ...merge.applied };

  const level = calibrateLevel(a);
  const physicalCapacity = computePhysicalCapacity(a);
  const armSensitivity = computeArmSensitivity(a.discomfort_areas);
  const swingLength = computeSwingLength(a);

  // Swing desconhecido é INFERIDO, e a inferência é marcada — nunca fingimos que o usuário respondeu.
  const swingSpeedInferred = a.swing_speed === null || a.swing_speed === 'nao_sei';
  const swingSpeed = swingSpeedInferred
    ? clamp(0.6 * level.final + 0.4 * physicalCapacity, 0, 100)
    : (SWING_SPEED_SCORE[a.swing_speed as string] ?? 45);

  const naturalPower = clamp(
    0.45 * swingSpeed +
      0.25 * SWING_LENGTH_SCORE[swingLength] +
      0.2 * physicalCapacity +
      0.1 * level.final,
    0,
    100,
  );

  const depthScore = a.depth_control === null ? 50 : TRISTATE_SCORE[a.depth_control];
  const consistencyPenalty = a.ball_tendency.includes('variam_demais') ? 20 : 0;
  const technicalConsistency = clamp(
    0.55 * (depthScore - consistencyPenalty) + 0.45 * level.final,
    0,
    100,
  );

  const objectives: ObjectiveKey[] =
    a.objective.length === 0
      ? ['unknown']
      : a.objective.map((o) => OBJECTIVE_MAP[o] ?? 'unknown');

  const needs = computeNeeds(a, objectives, armSensitivity);

  // Vetor de mudança desejada. Quem quer "potencializar o jogo atual" pede evolução, não revolução:
  // o ganho direcional cai pela metade.
  const conservative = objectives.includes('maximize_current');
  const gain = conservative ? 0.5 : 1.0;
  const style = computeStyleWeights(a);
  const desired: Record<NeedKey, number> = { ...needs };
  for (const k of NEED_KEYS) {
    desired[k] = round(clamp(needs[k] - 50, -40, 40) * gain);
  }

  const currentRacket: CurrentRacketSnapshot | null = a.no_current_racket
    ? null
    : {
        variant_id: a.current_racket_id,
        unrecognized: a.current_racket_id === null && !!a.current_racket_free_text,
        // Preenchidos pelo motor a partir do catálogo quando a raquete é reconhecida.
        weight_g: null,
        head_size_sq_in: null,
        balance_mm: null,
        beam_width_avg_mm: null,
        swing_index: null,
      };

  const currentString: CurrentStringSnapshot | null = a.no_current_racket
    ? null
    : {
        string_variant_id: a.current_string_id,
        string_type: null,
        gauge_mm: a.current_string_gauge,
        tension_lbs: a.current_tension_lbs,
        tension_feeling: a.current_tension_feeling,
        breakage_frequency: a.string_breakage === null ? 30 : (BREAKAGE_SCORE[a.string_breakage] ?? 30),
      };

  const unknowns = countUnknowns(a);
  const contradictions = [...merge.contradictions];
  if (level.mismatch) {
    contradictions.push({
      code: 'level_mismatch',
      field: 'perceived_level',
      objective_value: String(round(level.objective)),
      signal_value: String(level.perceived),
      resolution: 'objective_wins',
      message:
        'Seu nível autoavaliado difere do que as perguntas objetivas indicaram. Usamos o calibrado, ' +
        'com peso menor no autoavaliado.',
    });
  }

  return {
    profile_version: PROFILE_VERSION,
    player_level_score: level.final,
    perceived_level_score: level.perceived,
    objective_level_score: level.objective,
    technical_consistency_score: round(technicalConsistency),
    swing_speed_score: round(swingSpeed),
    swing_speed_inferred: swingSpeedInferred,
    swing_length: swingLength,
    natural_power_score: round(naturalPower),
    physical_capacity_score: round(physicalCapacity),
    age: a.age,
    arm_sensitivity_score: armSensitivity,
    discomfort_areas: a.discomfort_areas.filter((x) => x !== 'nenhum'),
    needs,
    desired_change_vector: desired,
    style_weights: style.weights,
    style_declared: style.declared,
    current_racket: currentRacket,
    current_string: currentString,
    objectives,
    unknown_answer_ratio:
      unknowns.answerable === 0 ? 0 : round(unknowns.unknown / unknowns.answerable, 3),
    free_text_length: a.free_text?.trim().length ?? 0,
    contradictions,
  };
}
