/**
 * Camada 2 — normalização de cordas.
 *
 * PROBLEMA: diferente de raquetes, cordas não têm specs numéricas públicas das quais derivar scores.
 * A saída fácil seria digitar "power: 72, control: 85" para cada modelo — exatamente o que o §6 proíbe
 * ("nunca atribuir scores subjetivos aleatoriamente").
 *
 * SOLUÇÃO: o catálogo armazena DESCRITORES qualitativos verificáveis contra o posicionamento do
 * fabricante (tipo, material, formato, firmeza, durabilidade, manutenção de tensão), e os scores são
 * derivados deles por esta função. Dois modelos com os mesmos descritores recebem os mesmos scores —
 * é reproduzível, auditável e revisável, ao contrário de um número digitado à mão.
 *
 * Quando houver medição de rigidez dinâmica (lab, tier 3), ela substitui o descritor `firmness` e a
 * precisão sobe. O caminho de melhoria está aberto sem reescrever nada.
 */

import { clamp } from '@/domain/scores';
import { METHODOLOGY_VERSION } from '@/domain/reference-ranges';
import type { StringBaseAttributes, StringShape, StringType } from '@/domain/string';

export type Firmness = 'soft' | 'medium' | 'firm';
export type QualitativeLevel = 'low' | 'medium' | 'high';

export type StringDescriptors = {
  readonly string_type: StringType;
  readonly shape: StringShape | null;
  /** Posicionamento do fabricante quanto à sensação: macia, média ou firme. */
  readonly firmness: Firmness;
  readonly durability: QualitativeLevel;
  readonly tension_maintenance: QualitativeLevel;
};

/** Arquétipo por tipo de corda. Base física antes dos modificadores. */
const TYPE_ARCHETYPE: Record<StringType, StringBaseAttributes> = {
  polyester: {
    power_score: 32,
    control_score: 86,
    spin_score: 74,
    comfort_score: 26,
    stiffness_score: 84,
    durability_score: 80,
    tension_maintenance_score: 50,
    arm_friendliness_score: 26,
  },
  co_polyester: {
    power_score: 38,
    control_score: 82,
    spin_score: 76,
    comfort_score: 34,
    stiffness_score: 76,
    durability_score: 76,
    tension_maintenance_score: 58,
    arm_friendliness_score: 34,
  },
  multifilament: {
    power_score: 76,
    control_score: 54,
    spin_score: 44,
    comfort_score: 88,
    stiffness_score: 28,
    durability_score: 38,
    tension_maintenance_score: 64,
    arm_friendliness_score: 88,
  },
  synthetic_gut: {
    power_score: 64,
    control_score: 56,
    spin_score: 46,
    comfort_score: 62,
    stiffness_score: 50,
    durability_score: 56,
    tension_maintenance_score: 58,
    arm_friendliness_score: 62,
  },
  natural_gut: {
    power_score: 88,
    control_score: 70,
    spin_score: 56,
    comfort_score: 95,
    stiffness_score: 24,
    durability_score: 46,
    tension_maintenance_score: 92,
    arm_friendliness_score: 95,
  },
  hybrid: {
    power_score: 58,
    control_score: 70,
    spin_score: 66,
    comfort_score: 60,
    stiffness_score: 55,
    durability_score: 66,
    tension_maintenance_score: 62,
    arm_friendliness_score: 60,
  },
};

/** Formato não redondo aumenta a mordida na bola, ao custo de durabilidade da própria corda. */
const SHAPE_MODIFIER: Record<string, Partial<StringBaseAttributes>> = {
  round: {},
  pentagonal: { spin_score: 10, control_score: 3, durability_score: -5, comfort_score: -3 },
  hexagonal: { spin_score: 11, control_score: 3, durability_score: -6, comfort_score: -3 },
  square: { spin_score: 12, control_score: 2, durability_score: -7, comfort_score: -4 },
  textured: { spin_score: 8, control_score: 2, durability_score: -4, comfort_score: -2 },
};

const FIRMNESS_MODIFIER: Record<Firmness, Partial<StringBaseAttributes>> = {
  soft: {
    comfort_score: 12,
    arm_friendliness_score: 12,
    stiffness_score: -15,
    control_score: -6,
    power_score: 6,
  },
  medium: {},
  firm: {
    comfort_score: -8,
    arm_friendliness_score: -8,
    stiffness_score: 10,
    control_score: 5,
    power_score: -5,
  },
};

const LEVEL_DELTA: Record<QualitativeLevel, number> = { low: -12, medium: 0, high: 12 };

function applyModifier(
  base: StringBaseAttributes,
  mod: Partial<StringBaseAttributes>,
): StringBaseAttributes {
  const out = { ...base } as Record<string, number>;
  for (const [key, delta] of Object.entries(mod)) {
    out[key] = (out[key] ?? 0) + (delta as number);
  }
  return out as unknown as StringBaseAttributes;
}

function clampAll(a: StringBaseAttributes): StringBaseAttributes {
  const out = {} as Record<string, number>;
  for (const [key, value] of Object.entries(a)) out[key] = clamp(value as number, 0, 100);
  return out as unknown as StringBaseAttributes;
}

/**
 * Deriva os atributos base do MODELO a partir dos descritores.
 * O ajuste por espessura acontece depois, por variante, em `strings/select-string.ts#adjustForGauge`.
 */
export function computeStringBaseAttributes(d: StringDescriptors): StringBaseAttributes {
  let attrs = TYPE_ARCHETYPE[d.string_type];
  attrs = applyModifier(attrs, SHAPE_MODIFIER[d.shape ?? 'round'] ?? {});
  attrs = applyModifier(attrs, FIRMNESS_MODIFIER[d.firmness]);
  attrs = applyModifier(attrs, {
    durability_score: LEVEL_DELTA[d.durability],
    tension_maintenance_score: LEVEL_DELTA[d.tension_maintenance],
  });
  return clampAll(attrs);
}

export const STRING_METHODOLOGY_VERSION = METHODOLOGY_VERSION;
