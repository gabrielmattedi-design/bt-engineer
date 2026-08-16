/**
 * Seleção de corda — docs/STRING_AND_TENSION_ENGINE.md §1–3.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────────────────────┐
 * │ REGRA DE INTEGRIDADE (bloco final da especificação)                                          │
 * │                                                                                              │
 * │ Esta função NUNCA calcula um gauge. Ela recebe `StringVariant[]` — variantes reais, já        │
 * │ verificadas e disponíveis no Brasil — e retorna UM ELEMENTO DESSE ARRAY.                     │
 * │                                                                                              │
 * │ Não existe caminho de código capaz de produzir um identificador sintético ou uma combinação  │
 * │ marca+modelo+gauge que não esteja no catálogo. Um gauge "ideal" inexistente jamais é          │
 * │ materializado como objeto.                                                                   │
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { clamp, round } from '@/domain/scores';
import { RECOMMENDABLE_AVAILABILITY, isRecommendable } from '@/domain/sourced';
import type { ScoredRacket } from '@/domain/racket';
import type {
  ScoredStringVariant,
  StringBaseAttributes,
  StringModel,
  StringType,
  StringVariant,
} from '@/domain/string';
import { availableGauges, STIFF_STRING_TYPES } from '@/domain/string';
import type { PlayerProfile } from '@/domain/player-profile';
import type { StringRecommendation } from '@/domain/recommendation';
import {
  STRING_FIT_WEIGHTS,
  STRING_FIT_WEIGHTS_ARM_SENSITIVE,
} from '@/recommendation/config/weights.v1';

export type StringCatalog = {
  readonly models: readonly StringModel[];
  readonly variants: readonly StringVariant[];
};

export type StringTarget = {
  readonly control: number;
  readonly power: number;
  readonly spin: number;
  readonly comfort: number;
  readonly durability: number;
  readonly arm: number;
};

/**
 * Vetor-alvo — §1. Note a COMPENSAÇÃO CRUZADA: um frame rígido eleva o alvo de conforto; um frame
 * potente eleva o alvo de controle. A corda corrige o frame, não o duplica.
 */
export function computeStringTarget(
  profile: PlayerProfile,
  racket: ScoredRacket,
): StringTarget {
  const a = racket.attributes;
  const breakage = profile.current_string?.breakage_frequency ?? 30;

  return {
    control: clamp(
      0.45 * profile.needs.control + 0.35 * a.power_score + 0.2 * profile.player_level_score,
      0,
      100,
    ),
    power: clamp(
      0.5 * profile.needs.power +
        0.3 * (100 - profile.natural_power_score) +
        0.2 * (100 - a.power_score),
      0,
      100,
    ),
    spin: clamp(
      0.55 * profile.needs.spin + 0.25 * a.spin_score + 0.2 * profile.swing_speed_score,
      0,
      100,
    ),
    comfort: clamp(
      0.5 * profile.needs.comfort +
        0.3 * profile.arm_sensitivity_score +
        0.2 * (100 - a.comfort_score),
      0,
      100,
    ),
    durability: clamp(
      0.6 * breakage + 0.25 * profile.swing_speed_score + 0.15 * profile.player_level_score,
      0,
      100,
    ),
    arm: clamp(
      0.6 * profile.arm_sensitivity_score + 0.4 * (100 - a.arm_friendliness_score),
      0,
      100,
    ),
  };
}

/**
 * Ajuste dos atributos do modelo pela espessura da variante — §3.1.
 *
 * A mesma corda em 1.20 e em 1.30 não se comporta igual (§8). Coeficientes modestos: espessura é
 * ajuste fino, não mudança de categoria. `durability` é o mais sensível por ser o efeito mais
 * consistentemente observado.
 */
export function adjustForGauge(
  base: StringBaseAttributes,
  gaugeMm: number,
): StringBaseAttributes {
  const delta = (1.25 - gaugeMm) / 0.05;
  const adj = (v: number, coef: number): number => clamp(v + coef * delta, 0, 100);

  return {
    power_score: adj(base.power_score, 1.5),
    control_score: adj(base.control_score, -0.8),
    spin_score: adj(base.spin_score, 2.0),
    comfort_score: adj(base.comfort_score, 1.5),
    stiffness_score: adj(base.stiffness_score, -1.0),
    durability_score: adj(base.durability_score, -4.0),
    tension_maintenance_score: base.tension_maintenance_score,
    arm_friendliness_score: adj(base.arm_friendliness_score, 1.2),
  };
}

/**
 * Regras duras de tipo — §2.
 *
 * A falha mais comum e mais lesiva do mercado é vender poliéster para jogador iniciante ou com
 * sensibilidade no braço. Aqui isso é impedido por filtro, não por penalização.
 */
export function excludedStringTypes(profile: PlayerProfile): {
  types: StringType[];
  reasons: string[];
} {
  const types = new Set<StringType>();
  const reasons: string[] = [];

  if (profile.arm_sensitivity_score >= 70) {
    for (const t of STIFF_STRING_TYPES) types.add(t);
    reasons.push(
      'Poliéster excluído pelo histórico de desconforto informado — conforto tratado como restrição, não preferência.',
    );
  }

  if (profile.player_level_score < 40) {
    for (const t of STIFF_STRING_TYPES) types.add(t);
    reasons.push(
      'Poliéster excluído para o nível técnico informado: um swing que ainda não gera velocidade não ativa a corda e recebe apenas o choque.',
    );
  }

  return { types: [...types], reasons };
}

function resolveWeights(profile: PlayerProfile): Record<string, number> {
  if (profile.arm_sensitivity_score >= 60) {
    return { ...STRING_FIT_WEIGHTS_ARM_SENSITIVE };
  }
  const w: Record<string, number> = {};
  for (const [key, entry] of Object.entries(STRING_FIT_WEIGHTS)) w[key] = entry.weight;
  return w;
}

/**
 * Eixos em que ULTRAPASSAR o alvo não é defeito nenhum.
 *
 * ═══ O BUG QUE ISTO CORRIGE ══════════════════════════════════════════════════════════════════
 *
 * `scoreVariant` media `|valor − alvo|` em todos os seis eixos. Para `control`, `power` e `spin`
 * isso está certo: são eixos de CARÁTER, e excesso é defeito de verdade — corda potente demais
 * manda a bola longa, corda de controle demais morre num swing lento.
 *
 * Mas `comfort`, `arm` e `durability` não são caráter, são REQUISITO. Ninguém foi prejudicado por
 * uma corda ser mais macia, mais amiga do braço ou mais durável do que o necessário. Cobrar o
 * excesso nesses eixos é cobrar por uma qualidade.
 *
 * E o efeito era brutal, porque o catálogo é BIMODAL — dez poliésters de um lado (conforto 22–46,
 * braço 26–46), cinco multifilamentos do outro (conforto 100, braço 100). Com distância nos dois
 * sentidos, o poliéster era punido no braço, o multifilamento era punido por ser confortável
 * DEMAIS, e sobrava exatamente uma corda no meio da tabela:
 *
 *     Wilson Synthetic Gut Power — 56 / 64 / 46 / 62 / 50 / 56 / 62
 *
 * A única do catálogo perto do centro em todos os eixos. Ela vencia quase todo perfil, com ou sem
 * dor, incluindo quem quebra corda toda semana. Não por ser a melhor para alguém — por ser a menos
 * distante de todo mundo. É o mesmo defeito do "hexágono perfeito", agora do lado das cordas: uma
 * métrica de distância sobre uma população bimodal sempre elege o centroide.
 *
 * Com o excesso liberado nesses três eixos, cada grupo volta a poder ganhar pelo que ele É.
 */
const REQUIREMENT_AXES: ReadonlySet<keyof StringTarget> = new Set(['comfort', 'arm', 'durability']);

/** Os seis eixos comparáveis, na ordem em que são pontuados. */
const SCORED_AXES: readonly (keyof StringTarget)[] = [
  'control',
  'power',
  'spin',
  'comfort',
  'arm',
  'durability',
];

/** Extrai do conjunto de atributos o valor do eixo — o par que o `scoreVariant` compara. */
function axisValue(a: StringBaseAttributes, axis: keyof StringTarget): number {
  switch (axis) {
    case 'control':
      return a.control_score;
    case 'power':
      return a.power_score;
    case 'spin':
      return a.spin_score;
    case 'comfort':
      return a.comfort_score;
    case 'arm':
      return a.arm_friendliness_score;
    case 'durability':
      return a.durability_score;
  }
}

/** Faixa realmente ocupada pelo catálogo de cordas em cada eixo. */
export type StringScale = Readonly<Record<keyof StringTarget, readonly [number, number]>>;

/** Largura mínima, pelo mesmo motivo de `MIN_BAND_WIDTH` em `catalog-scale.ts`. */
const MIN_STRING_BAND = 10;

/**
 * ═══ POR QUE O ALVO PRECISA DE UMA RÉGUA ═════════════════════════════════════════════════════
 *
 * `computeStringTarget` devolve números em "demanda do jogador", 0–100. Os atributos das cordas
 * vivem em faixas próprias, e nada garantia que as duas coisas se encontrassem. Medido no catálogo
 * de produção:
 *
 *     control  — multifilamento 48 | synthetic gut 56 | poliéster 76 … 89
 *     alvo de controle de um intermediário que PEDE controle: ~45
 *
 * O alvo ficava ABAIXO de todas as cordas do catálogo. Consequência: no eixo de maior peso (0.22),
 * o multifilamento era sempre o mais próximo e o poliéster levava 30 pontos de distância — mesmo
 * quando quem pedia controle era exatamente quem deveria receber poliéster. Pedir mais controle
 * empurrava para a corda de menos controle.
 *
 * É o mesmo erro de unidades que `catalog-scale.ts` corrigiu do lado das raquetes, e a correção é a
 * mesma: comparar POSIÇÃO com POSIÇÃO. "Alvo de controle 45" passa a significar "no meio do que
 * existe", e não um valor absoluto que nenhum produto ocupa.
 *
 * A régua sai do catálogo recomendável INTEIRO, antes das exclusões por tipo — pelo mesmo motivo
 * documentado do lado das raquetes: se ela saísse do que sobrou para cada perfil, dois usuários
 * veriam números incomparáveis.
 */
export function buildStringScale(attributeSets: readonly StringBaseAttributes[]): StringScale {
  const out = {} as Record<keyof StringTarget, readonly [number, number]>;

  for (const axis of SCORED_AXES) {
    const values = attributeSets.map((a) => axisValue(a, axis)).filter((v) => Number.isFinite(v));
    if (values.length === 0) {
      out[axis] = [0, 100];
      continue;
    }
    let lo = Math.min(...values);
    let hi = Math.max(...values);
    if (hi - lo < MIN_STRING_BAND) {
      const pad = (MIN_STRING_BAND - (hi - lo)) / 2;
      lo -= pad;
      hi += pad;
    }
    out[axis] = [lo, hi];
  }

  return out;
}

function positionOf(scale: StringScale, axis: keyof StringTarget, value: number): number {
  const [lo, hi] = scale[axis];
  return clamp(((value - lo) / (hi - lo)) * 100, 0, 100);
}

/** Distância ponderada entre a variante e o alvo, convertida em 0–100. */
function scoreVariant(
  attributes: StringBaseAttributes,
  target: StringTarget,
  weights: Record<string, number>,
  scale: StringScale,
): number {
  let penalty = 0;
  let weightSum = 0;

  for (const axis of SCORED_AXES) {
    const w = weights[axis] ?? 0;
    const value = positionOf(scale, axis, axisValue(attributes, axis));
    const targetValue = target[axis];
    const distance = REQUIREMENT_AXES.has(axis)
      ? Math.max(0, targetValue - value)
      : Math.abs(value - targetValue);
    penalty += w * distance;
    weightSum += w;
  }

  return weightSum === 0 ? 0 : clamp(100 - penalty / weightSum, 0, 100);
}

/**
 * Seleciona a melhor VARIANTE REAL.
 *
 * @param catalog variantes e modelos do banco — a fonte de verdade sobre o que existe
 * @returns `null` quando nenhuma variante sobrevive aos filtros (é honesto não recomendar)
 */
export function selectStringVariant(
  profile: PlayerProfile,
  racket: ScoredRacket,
  catalog: StringCatalog,
  mode: 'strict' | 'permissive' = 'strict',
): StringRecommendation | null {
  const target = computeStringTarget(profile, racket);
  const excluded = excludedStringTypes(profile);
  const weights = resolveWeights(profile);
  const modelsById = new Map(catalog.models.map((m) => [m.id, m]));

  type Candidate = {
    model: StringModel;
    variant: StringVariant;
    attributes: StringBaseAttributes;
    score: number;
  };

  const candidates: Candidate[] = [];

  /**
   * Tudo o que é recomendável, ANTES das exclusões por tipo — é o universo que define a régua.
   *
   * As exclusões vêm depois: uma corda proibida para este jogador não deixa de existir no mercado,
   * e tirá-la da régua faria o significado de "controle 100" mudar de pessoa para pessoa.
   */
  const recommendable = catalog.variants.filter((variant) => {
    const model = modelsById.get(variant.string_id);
    if (!model) return false;
    return isRecommendable(
      {
        verification_state: variant.verification_state,
        status: variant.status,
        brazil_availability_status: variant.brazil_availability_status,
      },
      mode,
    );
  });

  const scale = buildStringScale(
    recommendable.map((variant) =>
      adjustForGauge(modelsById.get(variant.string_id)!.base_attributes, variant.gauge_mm),
    ),
  );

  for (const variant of recommendable) {
    const model = modelsById.get(variant.string_id);
    if (!model) continue;

    // Regras duras de tipo (§2).
    if (excluded.types.includes(model.string_type)) continue;

    const attributes = adjustForGauge(model.base_attributes, variant.gauge_mm);
    let score = scoreVariant(attributes, target, weights, scale);

    // Bônus: poliéster para quem realmente quebra cordas e tem nível para ativá-lo.
    if (
      STIFF_STRING_TYPES.includes(model.string_type) &&
      (profile.current_string?.breakage_frequency ?? 0) >= 80 &&
      profile.player_level_score >= 55
    ) {
      score += 12;
    }

    // Bônus: manutenção de tensão entrega o setup por mais tempo — valor real para o usuário.
    if (attributes.tension_maintenance_score >= 75) score += 6;

    // Penalidade: disponibilidade limitada no Brasil (acompanhada de aviso obrigatório).
    if (variant.brazil_availability_status === 'limited') score -= 10;

    candidates.push({ model, variant, attributes, score: clamp(score, 0, 100) });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.variant.id.localeCompare(b.variant.id);
  });

  const winner = candidates[0] as Candidate;

  const availabilityWarning =
    winner.variant.brazil_availability_status === 'limited'
      ? 'Disponibilidade menor no Brasil — confirme com seu encordoador antes de encomendar.'
      : null;

  const scored: ScoredStringVariant = {
    model: winner.model,
    variant: winner.variant,
    attributes: winner.attributes,
    availability_warning: availabilityWarning,
  };

  return {
    variant: scored,
    fit_score: round(winner.score),
    target: { ...target },
    rationale: buildRationale(profile, racket, target, winner.model, winner.attributes),
    gauge_note: buildGaugeNote(catalog.variants, winner.variant, winner.model),
    excluded_types: excluded.reasons,
  };
}

/**
 * Nota sobre gauge — a materialização honesta da Regra de Integridade.
 *
 * Quando o modelo escolhido não existe em todas as espessuras, dizemos exatamente quais existem e
 * qual escolhemos. Nunca sugerimos uma espessura que não está à venda.
 */
function buildGaugeNote(
  allVariants: readonly StringVariant[],
  chosen: StringVariant,
  model: StringModel,
): string | null {
  const gauges = availableGauges(allVariants, chosen.string_id);
  if (gauges.length <= 1) {
    return `${model.brand} ${model.model} é comercializada apenas em ${chosen.gauge_mm.toFixed(2)} mm.`;
  }
  const list = gauges.map((g) => `${g.toFixed(2)} mm`).join(', ');
  return `Espessuras disponíveis para ${model.brand} ${model.model}: ${list}. Selecionamos ${chosen.gauge_mm.toFixed(2)} mm.`;
}

function buildRationale(
  profile: PlayerProfile,
  racket: ScoredRacket,
  target: StringTarget,
  model: StringModel,
  attributes: StringBaseAttributes,
): string[] {
  const out: string[] = [];

  if (racket.attributes.power_score >= 60 && target.control >= 60) {
    out.push(
      `Como o frame já entrega potência (índice ${round(racket.attributes.power_score)}), a corda foi escolhida para segurar a bola dentro da quadra.`,
    );
  }
  if (profile.arm_sensitivity_score >= 50) {
    out.push(
      `Pelo histórico de desconforto informado, priorizamos amigabilidade ao braço (índice ${round(attributes.arm_friendliness_score)}) sobre durabilidade.`,
    );
  }
  if (target.spin >= 65) {
    out.push(
      `Seu perfil pede spin: ${model.shape && model.shape !== 'round' ? `o formato ${model.shape} ` : 'esta corda '}favorece o encaixe e o retorno do encordoamento.`,
    );
  }
  if (target.durability >= 70) {
    out.push(
      'Pela frequência de quebra informada, a durabilidade teve peso relevante na escolha.',
    );
  }
  if (out.length === 0) {
    out.push(
      'Escolhemos a corda com menor distância entre suas necessidades declaradas e o comportamento do frame recomendado.',
    );
  }
  return out;
}

/** Filtro público — útil ao admin e aos testes de integridade. */
export function recommendableVariants(
  catalog: StringCatalog,
  mode: 'strict' | 'permissive' = 'strict',
): StringVariant[] {
  return catalog.variants.filter((v) =>
    isRecommendable(
      {
        verification_state: v.verification_state,
        status: v.status,
        brazil_availability_status: v.brazil_availability_status,
      },
      mode,
    ),
  );
}

export const RECOMMENDABLE_BR_STATUSES = RECOMMENDABLE_AVAILABILITY;
