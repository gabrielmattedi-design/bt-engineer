/**
 * Componentes do `racket_fit_score` — docs/RECOMMENDATION_ENGINE.md §4.1.
 *
 * Cada componente devolve 0–100 e a lista de termos que o produziu, para auditoria (§48).
 * Funções puras, sem I/O.
 */

import { RANGES } from '@/domain/reference-ranges';
import { clamp, norm, round, type WeightedTerm } from '@/domain/scores';
import type { PlayStyle, ScoredRacket } from '@/domain/racket';
import { PLAY_STYLES } from '@/domain/racket';
import type { NeedKey, PlayerProfile } from '@/domain/player-profile';
import { NEED_KEYS, NEED_TO_RACKET_ATTRIBUTE } from '@/domain/player-profile';
import type { ComponentBreakdown, ComponentKey } from '@/domain/recommendation';
import {
  computeSwingIndex,
  massIndex,
  resolveStrungWeight,
} from '@/recommendation/normalize/racket-attributes';

type ComponentOutput = Omit<ComponentBreakdown, 'weight' | 'contribution'>;

function output(
  key: ComponentKey,
  raw: number,
  terms: ComponentBreakdown['terms'],
  missing: readonly string[] = [],
): ComponentOutput {
  return { key, raw: round(clamp(raw, 0, 100)), terms, missing_fields: missing };
}

/**
 * `physical_fit` — o jogador consegue manejar a massa?
 *
 * A ASSIMETRIA é a decisão mais relevante deste componente: subir de peso além da capacidade produz
 * atraso de preparação e sobrecarga física (penalidade 1.35); descer de peso produz apenas perda de
 * desempenho, que é recuperável e às vezes desejada (penalidade 0.75).
 */
export function physicalFit(profile: PlayerProfile, racket: ScoredRacket): ComponentOutput {
  const mass = massIndex(racket.variant.specs);
  if (mass === null) {
    return output('physical_fit', 50, [], ['unstrung_weight_g']);
  }

  const capacity =
    0.45 * profile.physical_capacity_score +
    0.35 * profile.swing_speed_score +
    0.2 * profile.player_level_score;

  const delta = mass - capacity;
  const raw = delta > 0 ? 100 - delta * 1.35 : 100 - Math.abs(delta) * 0.75;

  return output('physical_fit', raw, [
    { label: 'mass_index', value: mass / 100, weight: 1, note: `índice de massa ${round(mass)}` },
    {
      label: 'player_capacity',
      value: capacity / 100,
      weight: 1,
      note: `capacidade ${round(capacity)}`,
    },
  ]);
}

/** `skill_fit` — a exigência do frame bate com o nível calibrado? */
export function skillFit(profile: PlayerProfile, racket: ScoredRacket): ComponentOutput {
  const targetDemand = 0.85 * profile.player_level_score + 8;
  const demand = racket.attributes.demand_index;
  const raw = 100 - Math.abs(demand - targetDemand) * 1.5;

  return output('skill_fit', raw, [
    { label: 'demand_index', value: demand / 100, weight: 1, note: `exigência ${round(demand)}` },
    {
      label: 'target_demand',
      value: targetDemand / 100,
      weight: 1,
      note: `alvo para o nível ${round(targetDemand)}`,
    },
  ]);
}

/**
 * `swing_fit` — o frame COMPLEMENTA a produção natural de potência?
 *
 * Jogador que gera muita potência precisa de frame contido; quem gera pouca precisa do frame.
 * Somar potência a quem já tem é a causa clássica de bolas longas.
 */
export function swingFit(profile: PlayerProfile, racket: ScoredRacket): ComponentOutput {
  const requiredFramePower = 100 - profile.natural_power_score;
  const powerTerm = 100 - Math.abs(racket.attributes.power_score - requiredFramePower) * 1.15;

  const maneuver = racket.attributes.maneuverability_score;
  let lengthTerm: number;
  switch (profile.swing_length) {
    case 'long':
      // Swing longo tolera swingweight alto; penaliza-se apenas o excesso de leveza.
      lengthTerm = 100 - Math.max(0, maneuver - 70) * 0.4;
      break;
    case 'short':
      lengthTerm = 0.7 * maneuver + 0.3 * racket.attributes.power_score;
      break;
    default:
      lengthTerm = 0.5 * maneuver + 0.5 * clamp(powerTerm, 0, 100);
  }

  const raw = 0.65 * clamp(powerTerm, 0, 100) + 0.35 * clamp(lengthTerm, 0, 100);

  return output('swing_fit', raw, [
    {
      label: 'power_complement',
      value: clamp(powerTerm, 0, 100) / 100,
      weight: 0.65,
      note: `frame ${round(racket.attributes.power_score)} vs necessário ${round(requiredFramePower)}`,
    },
    {
      label: 'swing_length_match',
      value: clamp(lengthTerm, 0, 100) / 100,
      weight: 0.35,
      note: `swing ${profile.swing_length}`,
    },
  ]);
}

/** `playstyle_fit` — produto interno entre o vetor de estilo do jogador e os fits do frame. */
export function playstyleFit(profile: PlayerProfile, racket: ScoredRacket): ComponentOutput {
  let weightSum = 0;
  let acc = 0;
  const terms: WeightedTerm[] = [];

  for (const style of PLAY_STYLES) {
    const w = profile.style_weights[style as PlayStyle] ?? 0;
    if (w <= 0) continue;
    const fit = racket.fitProfile.styles[style as PlayStyle];
    weightSum += w;
    acc += w * fit;
    terms.push({ label: `style:${style}`, value: fit / 100, weight: w });
  }

  const raw = weightSum === 0 ? 50 : acc / weightSum;
  return output('playstyle_fit', raw, terms);
}

/**
 * Mudança de atributo considerada MATERIALMENTE grande, em pontos de score. Serve de denominador
 * para normalizar o quanto o frame entregou: 20 pontos é uma diferença que o jogador percebe
 * claramente em quadra (ex.: um 18×20 contra um 16×19 de mesma cabeça em `spin_score`).
 */
const MATERIAL_DELTA = 20;

/** Intensidade máxima possível de um pedido, conforme `desired_change_vector` é construído (§3.4). */
const MAX_ASK = 40;

/**
 * `objective_fit` — o frame move o jogador na direção desejada?
 *
 * Compara contra a raquete atual quando conhecida; contra a média do catálogo quando não.
 *
 * NOTA DE CALIBRAÇÃO (v1.0.0): a formulação inicial dividia `delta` (pontos de ATRIBUTO) por
 * `|desired|` (pontos de NECESSIDADE) — grandezas de unidades diferentes. O efeito colateral era
 * perverso: quanto MAIS forte o pedido, maior o denominador e mais fraco o sinal, comprimindo o
 * componente numa faixa estreita em torno de 65 e tornando-o quase não discriminante.
 *
 * A formulação atual separa as duas dimensões:
 *   • `delivered`   — quanto o frame entregou, normalizado por uma mudança perceptível;
 *   • `askStrength` — quão forte foi o pedido, usado como PESO na média.
 *
 * Assim, os atributos que o jogador mais pediu dominam o componente, e entregar mais continua
 * valendo mais que entregar menos.
 */
export function objectiveFit(
  profile: PlayerProfile,
  racket: ScoredRacket,
  reference: Readonly<Record<NeedKey, number>>,
): ComponentOutput {
  const terms: WeightedTerm[] = [];
  let weightedSum = 0;
  let weightTotal = 0;

  for (const need of NEED_KEYS) {
    const desired = profile.desired_change_vector[need];
    if (Math.abs(desired) <= 5) continue;

    const attrKey = NEED_TO_RACKET_ATTRIBUTE[need];
    const racketValue = racket.attributes[attrKey as keyof typeof racket.attributes] as number;
    const delta = racketValue - reference[need];

    // Superar o pedido vale mais, com retorno decrescente (teto 1.5).
    // Ir na direcao contraria e o pior caso (piso -1).
    const delivered = clamp((delta * Math.sign(desired)) / MATERIAL_DELTA, -1, 1.5);
    const askStrength = clamp(Math.abs(desired) / MAX_ASK, 0, 1);

    weightedSum += delivered * askStrength;
    weightTotal += askStrength;

    terms.push({
      label: `objective:${need}`,
      value: clamp((delivered + 1) / 2.5, 0, 1),
      weight: round(askStrength, 3),
      note: `pedido ${desired > 0 ? '+' : ''}${round(desired)}, entregue ${delta > 0 ? '+' : ''}${round(delta)}`,
    });
  }

  // Nenhum objetivo declarado: valor neutro. Nao penalizamos nem premiamos ninguem.
  if (weightTotal === 0) return output('objective_fit', 65, terms);

  const avg = weightedSum / weightTotal;
  return output('objective_fit', 100 * clamp(0.5 + avg / 2, 0, 1), terms);
}

/**
 * `comfort_fit` — conforto do frame contra a sensibilidade declarada.
 *
 * Quando não há sensibilidade, o componente não zera o score de um frame rígido: ele apenas deixa de
 * discriminar (piso em 50). Punir rigidez em quem nunca teve desconforto seria viés, não análise.
 */
export function comfortFit(profile: PlayerProfile, racket: ScoredRacket): ComponentOutput {
  const armFriendly = racket.attributes.arm_friendliness_score;
  const sensitivity = profile.arm_sensitivity_score;

  const raw =
    sensitivity < 30
      ? 0.5 * armFriendly + 50
      : armFriendly >= 80
        ? 100
        : armFriendly * (0.6 + 0.4 * (sensitivity / 100));

  return output('comfort_fit', raw, [
    {
      label: 'arm_friendliness',
      value: armFriendly / 100,
      weight: 1,
      note: `frame ${round(armFriendly)}`,
    },
    {
      label: 'arm_sensitivity',
      value: sensitivity / 100,
      weight: 1,
      note: `sensibilidade ${round(sensitivity)}`,
    },
  ]);
}

/**
 * `transition_fit` (§22) — penaliza apenas o EXCEDENTE de mudança, com zonas mortas de
 * 12 g / 12 SW / 4 sq in. Trocas pequenas não devem ser penalizadas; grandes precisam ser conscientes.
 */
export function transitionFit(profile: PlayerProfile, racket: ScoredRacket): ComponentOutput {
  const current = profile.current_racket;
  if (!current || current.weight_g === null) {
    return output('transition_fit', 70, [], ['current_racket']);
  }

  const specs = racket.variant.specs;
  const newWeight = resolveStrungWeight(specs);
  const terms: WeightedTerm[] = [];
  let penalty = 0;

  if (newWeight !== null) {
    const currentStrung = current.weight_g + 16;
    const dw = Math.abs(newWeight - currentStrung);
    penalty += Math.max(0, dw - 12) * 1.2;
    terms.push({
      label: 'delta_weight',
      value: 1 - norm(dw, 0, 60),
      weight: 1,
      note: `Δ ${round(dw)} g`,
    });
  }

  const newSwing = computeSwingIndex(specs);
  if (current.swing_index !== null && newSwing !== null) {
    // Comparação RELATIVA: a inércia varia numa escala grande, então um delta absoluto não teria
    // significado uniforme entre frames leves e pesados.
    const rel = Math.abs(newSwing - current.swing_index) / current.swing_index;
    penalty += Math.max(0, rel - 0.08) * 260;
    terms.push({
      label: 'delta_swing_index',
      value: 1 - norm(rel, 0, 0.4),
      weight: 1,
      note: `Δ ${(rel * 100).toFixed(0)}% de inércia`,
    });
  }

  if (current.head_size_sq_in !== null && specs.head_size_sq_in !== null) {
    const dh = Math.abs(specs.head_size_sq_in - current.head_size_sq_in);
    penalty += Math.max(0, dh - 4) * 2.5;
    terms.push({ label: 'delta_head_size', value: 1 - norm(dh, 0, 20), weight: 1, note: `Δ ${round(dh)} sq in` });
  }

  return output('transition_fit', 100 - penalty, terms);
}

/**
 * Referência para `objective_fit` quando não há raquete atual: a média do catálogo avaliado.
 * Usar a média real (e não um valor fixo) mantém o componente calibrado ao universo disponível.
 */
export function catalogReference(rackets: readonly ScoredRacket[]): Record<NeedKey, number> {
  const ref = {} as Record<NeedKey, number>;
  for (const need of NEED_KEYS) {
    const attrKey = NEED_TO_RACKET_ATTRIBUTE[need];
    const values = rackets.map(
      (r) => r.attributes[attrKey as keyof typeof r.attributes] as number,
    );
    ref[need] = values.length === 0 ? 50 : values.reduce((s, v) => s + v, 0) / values.length;
  }
  return ref;
}

/** Referência a partir da raquete atual do jogador, quando reconhecida no catálogo. */
export function currentRacketReference(current: ScoredRacket): Record<NeedKey, number> {
  const ref = {} as Record<NeedKey, number>;
  for (const need of NEED_KEYS) {
    const attrKey = NEED_TO_RACKET_ATTRIBUTE[need];
    ref[need] = current.attributes[attrKey as keyof typeof current.attributes] as number;
  }
  return ref;
}

export const REFERENCE_RANGES_USED = RANGES;
