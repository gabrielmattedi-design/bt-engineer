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
import type { CatalogScale, ScaleKey } from '@/recommendation/engine/catalog-scale';
import type { PriceTier } from '@/domain/string';
import type {
  ScoredStringVariant,
  StringBaseAttributes,
  StringModel,
  StringType,
  StringVariant,
} from '@/domain/string';
import { availableGauges, STIFF_STRING_TYPES } from '@/domain/string';
import { compareByScoreThenTieBreak, profileSignature } from '@/recommendation/engine/tie-break';
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
  /**
   * Quanto o BOLSO precisa ser respeitado, 0–100.
   *
   * ═══ POR QUE ESTE EIXO PRECISOU EXISTIR ════════════════════════════════════════════════════
   *
   * A análise de dominância mostrou que a tripa natural vence TODOS os multifilamentos em todos os
   * eixos do modelo: conforto, potência, amigabilidade ao braço, manutenção de tensão. E isso está
   * fisicamente certo — tripa natural é, de fato, a melhor corda que existe nesses quesitos.
   *
   * O problema é que o modelo só tinha eixos em que a tripa ganha. Levado a sério, ele mandaria
   * todo mundo comprar tripa; e cinco multifilamentos do catálogo não podiam ser a resposta de
   * ninguém, porque não havia dimensão nenhuma em que eles fossem melhores.
   *
   * Preço é essa dimensão, e ela não é detalhe: uma tripa custa quatro a seis vezes um
   * multifilamento no Brasil, e dura menos. Recomendar tripa a quem arrebenta corda toda semana não
   * é ambição, é conta que não fecha. Um multifilamento não é uma tripa pior — é conforto que cabe
   * no orçamento, e esse é um fim específico, legítimo e de longe o mais comum.
   */
  readonly cost: number;
};

/** Quão acessível é a corda, 0–100. Mais alto = mais barata. */
const PRICE_ACCESSIBILITY: Record<PriceTier, number> = {
  budget: 100,
  mid: 68,
  premium: 38,
  ultra: 10,
};

/**
 * Ganho de contraste por eixo do alvo.
 *
 * ═══ O TERCEIRO ANDAR DO MESMO DEFEITO ═══════════════════════════════════════════════════════
 *
 * Cada componente do alvo é uma MÉDIA PONDERADA, e média de valores centrados regride ao meio.
 * Medido sobre 540 perfis que varrem nível, swing, físico, estilo e objetivo:
 *
 *     control    32 … 69        comfort    30 … 41
 *     power      31 … 75        arm        14 … 22
 *     spin       38 … 79        durability 26 … 93
 *
 * Nenhum alvo de controle passava de 69. Como as cordas agora são medidas por POSIÇÃO no catálogo,
 * isso significava que o terço superior do eixo era território morto: ALU Power (87), Tour Bite
 * (89), Hyper-G (84), RPM Blast (85), Lynx Tour (85) e Poly Tour Strike (87) ULTRAPASSAVAM o alvo
 * em qualquer perfil concebível, levavam penalização por excesso, e nunca eram indicadas a
 * ninguém. Oito dos dez poliésters do catálogo estavam nessa situação.
 *
 * `comfort` e `arm` eram piores: 11 e 8 pontos de amplitude. Juntos eles carregam 34% do peso, e
 * um eixo que não varia não decide nada — na prática o motor decidia com 66% do peso que julgava
 * ter.
 *
 * A correção é a mesma já aplicada ao vetor de necessidades (`needs.ts`): recentrar em 50 e
 * amplificar. O SIGNIFICADO de cada termo não muda — frame potente ainda pede mais controle, dor
 * ainda pede mais conforto —, muda a amplitude com que a diferença chega ao ranking.
 *
 * Os ganhos abaixo foram medidos, não estimados: cada um é o valor que faz o eixo ocupar
 * aproximadamente 0–100 na mesma varredura de 540 perfis. `durability` fica em 1.0 porque já
 * varria 26–93 sozinho — ele depende de `breakage`, que é pergunta direta e não média de nada.
 */
const TARGET_GAIN: Readonly<Record<keyof StringTarget, number>> = {
  control: 2.2,
  power: 1.8,
  spin: 1.9,
  comfort: 3.2,
  arm: 3.6,
  durability: 1.0,
  // O custo já nasce em 0–100 a partir de uma pergunta direta; amplificar seria distorcer.
  cost: 1.0,
};

/**
 * Quanto o preço precisa ser respeitado, a partir do que o jogador disse.
 *
 * A resposta explícita manda. Sem ela, a necessidade é INFERIDA de dois fatos que o questionário já
 * coleta e que mudam a conta de verdade: quem arrebenta corda toda semana paga a corda 40 vezes por
 * ano e não tem como bancar tripa; e quem ainda está começando raramente quer investir no topo da
 * faixa antes de saber do que gosta. Nenhuma das duas é palpite sobre a renda de ninguém — são
 * consequências aritméticas do uso declarado.
 */
const BUDGET_TARGET: Record<string, number> = {
  economico: 88,
  equilibrado: 55,
  sem_limite: 12,
};

function costTarget(profile: PlayerProfile): number {
  const declared = BUDGET_TARGET[profile.string_budget ?? ''];
  if (declared !== undefined) return declared;

  const breakage = profile.current_string?.breakage_frequency ?? 30;
  // Quebra alta multiplica o custo anual; nível baixo raramente justifica o topo da faixa.
  return clamp(30 + 0.45 * breakage + 0.25 * (100 - profile.player_level_score), 0, 100);
}

/** Recentra em 50 e amplifica, preservando o neutro. */
function contrast(raw: number, gain: number): number {
  return clamp(50 + (raw - 50) * gain, 0, 100);
}

/**
 * Vetor-alvo — §1. Note a COMPENSAÇÃO CRUZADA: um frame rígido eleva o alvo de conforto; um frame
 * potente eleva o alvo de controle. A corda corrige o frame, não o duplica.
 *
 * `racketScale` traduz os atributos da raquete para posição de catálogo antes de misturá-los com
 * scores do jogador — sem isso, os dois lados vivem em escalas diferentes e a média não significa
 * nada (ver `catalog-scale.ts`). É opcional para não quebrar chamadas diretas em teste; quando
 * ausente, o valor cru é o melhor disponível.
 */
export function computeStringTarget(
  profile: PlayerProfile,
  racket: ScoredRacket,
  racketScale?: CatalogScale,
): StringTarget {
  const a = racket.attributes;
  const breakage = profile.current_string?.breakage_frequency ?? 30;

  const pos = (key: ScaleKey, value: number): number =>
    racketScale ? racketScale.position(key, value) : value;

  const powerPos = pos('power_score', a.power_score);

  return {
    control: contrast(
      0.45 * profile.needs.control + 0.35 * powerPos + 0.2 * profile.player_level_score,
      TARGET_GAIN.control,
    ),
    power: contrast(
      0.5 * profile.needs.power +
        0.3 * (100 - profile.natural_power_score) +
        0.2 * (100 - powerPos),
      TARGET_GAIN.power,
    ),
    spin: contrast(
      0.55 * profile.needs.spin +
        0.25 * pos('spin_score', a.spin_score) +
        0.2 * profile.swing_speed_score,
      TARGET_GAIN.spin,
    ),
    comfort: contrast(
      0.5 * profile.needs.comfort +
        0.3 * profile.arm_sensitivity_score +
        0.2 * (100 - pos('comfort_score', a.comfort_score)),
      TARGET_GAIN.comfort,
    ),
    durability: contrast(
      0.6 * breakage + 0.25 * profile.swing_speed_score + 0.15 * profile.player_level_score,
      TARGET_GAIN.durability,
    ),
    arm: contrast(
      0.6 * profile.arm_sensitivity_score +
        0.4 * (100 - pos('arm_friendliness_score', a.arm_friendliness_score)),
      TARGET_GAIN.arm,
    ),
    cost: costTarget(profile),
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

  /**
   * ─── O QUE SAIU DAQUI, E POR QUÊ ───────────────────────────────────────────────────────────
   *
   * Havia uma segunda regra dura: sensibilidade ≥ 70 eliminava todo poliéster. Ela virou PESO
   * (ver `stiffnessPenalty`), por decisão de produto.
   *
   * O motivo é o mesmo que fez a dor deixar de ser um bloco único. Um filtro binário sobre um
   * sinal que agora é graduado devolve o pior dos dois mundos: a pessoa responde "leve, há muito
   * tempo", o motor entende corretamente que o sinal é fraco — e mesmo assim dez das dezessete
   * cordas do catálogo somem da análise dela, por causa de um limiar que não sabe disso.
   *
   * Como PESO, a mesma proteção continua existindo e passa a ser proporcional: com dor forte e
   * atual, nenhum poliéster sobrevive à penalização na prática; com histórico leve, um poliéster
   * macio volta a ser uma opção legítima — que é exatamente o que um encordoador diria.
   *
   * A regra de NÍVEL abaixo continua dura, e de propósito: ela não é sobre intensidade de nada. Um
   * swing que ainda não gera velocidade não ativa a corda e recebe só o choque — isso é verdadeiro
   * ou falso, não é mais ou menos (§37).
   */
  if (profile.player_level_score < 40) {
    for (const t of STIFF_STRING_TYPES) types.add(t);
    reasons.push(
      'Poliéster excluído para o nível técnico informado: um swing que ainda não gera velocidade não ativa a corda e recebe apenas o choque.',
    );
  }

  return { types: [...types], reasons };
}

/**
 * Penalização por rigidez, proporcional à sensibilidade declarada — substitui o filtro duro.
 *
 * ─── COMO ELA FOI CALIBRADA ────────────────────────────────────────────────────────────────
 *
 * Duas grandezas entram: o quanto a pessoa é sensível, e o quanto AQUELA corda é hostil ao braço.
 * A segunda importa porque "poliéster" não é uma categoria homogênea — o Luxilon Element e o Yonex
 * Poly Tour Pro marcam 46 de amigabilidade, contra 26 do ALU Power e do Tour Bite. Um filtro por
 * TIPO tratava os dois como a mesma coisa, e é justamente essa diferença que decide o caso de
 * quem tem histórico leve.
 *
 * A escala foi conferida contra o comportamento que o filtro duro tinha: em sensibilidade 75 com
 * uma corda de amigabilidade 26, a penalização passa de 35 pontos — nenhum poliéster rígido
 * sobrevive a isso, que era o efeito do filtro. Já em sensibilidade 11, a mesma corda perde ~5
 * pontos: um empurrão, não um veto.
 *
 * O piso de `NO_CONCERN` existe para não cobrar rigidez de quem nunca relatou nada. Punir todo
 * mundo por precaução seria viés, não análise — é o mesmo princípio de `comfortFit`.
 */
const NO_CONCERN = 25;

export function stiffnessPenalty(
  armSensitivity: number,
  stringArmFriendliness: number,
): number {
  if (armSensitivity <= NO_CONCERN) return 0;
  const concern = (armSensitivity - NO_CONCERN) / (100 - NO_CONCERN);
  const hostility = Math.max(0, 70 - stringArmFriendliness);
  return concern * hostility * 0.85;
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
const REQUIREMENT_AXES: ReadonlySet<keyof StringTarget> = new Set([
  'comfort',
  'arm',
  'durability',
  // Custo é requisito pelo mesmo motivo dos outros três: ninguém foi prejudicado por uma corda ser
  // mais barata do que o orçamento permitia. Só a falta é cobrada.
  'cost',
]);

/** Os seis eixos comparáveis, na ordem em que são pontuados. */
const SCORED_AXES: readonly (keyof StringTarget)[] = [
  'control',
  'power',
  'spin',
  'comfort',
  'arm',
  'durability',
  'cost',
];

/** Extrai do conjunto de atributos o valor do eixo — o par que o `scoreVariant` compara. */
function axisValue(
  a: StringBaseAttributes,
  axis: keyof StringTarget,
  accessibility = 50,
): number {
  switch (axis) {
    case 'cost':
      return accessibility;
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
    if (axis === 'cost') {
      out[axis] = [0, 100];
      continue;
    }
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
  accessibility: number,
): number {
  let penalty = 0;
  let weightSum = 0;

  for (const axis of SCORED_AXES) {
    const w = weights[axis] ?? 0;
    /*
      Custo NÃO passa pela régua do catálogo.

      As outras cinco dimensões são posição relativa: "controle 80" significa "entre os 20% mais
      controladores do que existe". Preço não funciona assim — R$ 300 é caro em termos absolutos,
      não em relação ao catálogo. Reposicionar transformaria a corda mais barata da lista em
      "acessível 100" mesmo que a lista inteira fosse cara.
    */
    const raw = axisValue(attributes, axis, accessibility);
    const value = axis === 'cost' ? accessibility : positionOf(scale, axis, raw);
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
  racketScale?: CatalogScale,
): StringRecommendation | null {
  const target = computeStringTarget(profile, racket, racketScale);
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
    const accessibility = PRICE_ACCESSIBILITY[model.price_tier];
    let score = scoreVariant(attributes, target, weights, scale, accessibility);

    /**
     * ─── DOIS DEGRAUS QUE VIRARAM RAMPAS ─────────────────────────────────────────────────────
     *
     * Os dois bônus abaixo eram `if` com limiar fixo: poliéster ganhava +12 inteiros ao cruzar
     * "quebra ≥ 80 E nível ≥ 55", e qualquer corda ganhava +6 ao cruzar 75 de manutenção de tensão.
     *
     * Degrau é a forma mais cara de expressar uma preferência fraca. O de tensão era o pior: entre
     * cinco multifilamentos com atributos NUMERICAMENTE IDÊNTICOS, um marca 76 e os outros 64 —
     * diferença que ninguém sente em quadra e que o degrau transformava em 6 pontos fixos. Aquele
     * modelo vencia os outros quatro em todo perfil do catálogo, para sempre, e os quatro nunca
     * eram indicados a ninguém. Não por serem piores: por estarem do lado errado de um limiar.
     *
     * Como rampa, a mesma preferência continua existindo e passa a valer o que ela vale — décimos,
     * não pontos —, e opções que a análise não distingue voltam a empatar de fato, indo para o
     * desempate por perfil em vez de para o esquecimento.
     */
    const breakage = profile.current_string?.breakage_frequency ?? 0;
    if (STIFF_STRING_TYPES.includes(model.string_type)) {
      // Quem quebra muito E tem swing para ativar o poliéster; ambos os fatores são graduais.
      const breaks = clamp((breakage - 45) / 45, 0, 1);
      const canActivate = clamp((profile.player_level_score - 40) / 25, 0, 1);
      score += 12 * breaks * canActivate;
    }

    // Manutenção de tensão entrega o setup por mais tempo — valor real, porém pequeno.
    score += clamp((attributes.tension_maintenance_score - 55) / 45, 0, 1) * 4;

    /*
      Disponibilidade limitada: penalidade, não veto.

      Eram 10 pontos fixos — outro degrau, e o mais consequente que restava. As duas tripas naturais
      do catálogo são `limited` (importação), e 10 pontos bastavam para nenhuma delas jamais vencer,
      em nenhum perfil. Um produto que o motor nunca pode indicar não deveria estar no catálogo; e
      tripa natural DEVE estar, porque para quem tem braço sensível, não quebra corda e pode pagar,
      ela é objetivamente a resposta certa.

      Cinco pontos continuam desempatando a favor do que se acha na esquina, sem apagar a categoria.
      O aviso obrigatório de disponibilidade permanece — quem receber a indicação lê que vai precisar
      encomendar.
    */
    if (variant.brazil_availability_status === 'limited') score -= 5;

    // Rigidez contra sensibilidade — o que substituiu o filtro duro de poliéster.
    score -= stiffnessPenalty(profile.arm_sensitivity_score, attributes.arm_friendliness_score);

    candidates.push({ model, variant, attributes, score: clamp(score, 0, 100) });
  }

  if (candidates.length === 0) return null;

  const signature = profileSignature([
    profile.player_level_score,
    profile.swing_speed_score,
    profile.natural_power_score,
    profile.arm_sensitivity_score,
    profile.current_string?.breakage_frequency ?? 0,
    ...SCORED_AXES.map((axis) => target[axis]),
  ]);

  candidates.sort((a, b) =>
    compareByScoreThenTieBreak(
      { score: a.score, id: a.variant.id },
      { score: b.score, id: b.variant.id },
      signature,
    ),
  );

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
    equivalents: collectEquivalents(candidates, winner),
  };
}

/**
 * Modelos que empatam com a vencedora — entregues ao usuário, não escondidos.
 *
 * ═══ POR QUE ISTO EXISTE ═════════════════════════════════════════════════════════════════════
 *
 * Cinco multifilamentos do catálogo têm atributos NUMERICAMENTE IDÊNTICOS, porque os números saem
 * de quatro rótulos qualitativos (maciez, durabilidade, manutenção de tensão, formato) e esses
 * cinco produtos compartilham os quatro. Três pares de poliésters estão na mesma situação.
 *
 * Escolher um e calar sobre os outros seria afirmar uma distinção que a análise não fez. Pior:
 * seria tirar do jogador a única informação capaz de decidir o caso — preço, disponibilidade na
 * loja dele, marca que ele já usa. São critérios legítimos que o motor não tem, e o jeito honesto
 * de tratar o que não se sabe é dizer que não se sabe.
 *
 * Só um modelo por linha: variantes do mesmo modelo em espessuras diferentes já são tratadas por
 * `gauge_note`, e repeti-las aqui viraria ruído.
 */
type EquivalenceInput = {
  readonly model: StringModel;
  readonly attributes: StringBaseAttributes;
  readonly score: number;
};

/** Assinatura dos eixos que a análise realmente compara. Iguais aqui = indistinguíveis. */
function scoredFingerprint(a: StringBaseAttributes): string {
  return SCORED_AXES.filter((axis) => axis !== 'cost')
    .map((axis) => axisValue(a, axis).toFixed(2))
    .join('/');
}

function collectEquivalents(
  candidates: readonly EquivalenceInput[],
  winner: EquivalenceInput,
): readonly string[] {
  const roundedScore = Math.round(winner.score);
  const fingerprint = scoredFingerprint(winner.attributes);
  const seen = new Set<string>([winner.model.id]);
  const out: string[] = [];

  for (const candidate of candidates) {
    if (seen.has(candidate.model.id)) continue;

    /*
      Duas condições, e as duas são necessárias para cobrir os casos reais do catálogo.

      A pontuação arredondada pega o empate no resultado final — inclusive entre cordas de
      atributos diferentes que, para ESTE jogador, dão no mesmo.

      A impressão digital pega o caso que a pontuação deixa passar, e que é o mais gritante: cinco
      multifilamentos com atributos idênticos nos seis eixos, separados no ranking por uma
      diferença de manutenção de tensão que vale um ponto. Um ponto basta para o arredondamento
      cair de um lado, e aí quatro produtos indistinguíveis somem do relatório sem nunca terem sido
      distinguidos de nada.
    */
    const sameScore = Math.round(candidate.score) === roundedScore;
    const sameShape = scoredFingerprint(candidate.attributes) === fingerprint;
    if (!sameScore && !sameShape) continue;

    seen.add(candidate.model.id);
    out.push(`${candidate.model.brand} ${candidate.model.model}`);
  }

  return out;
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

    /**
     * Poliéster indicado a quem relatou desconforto EXIGE explicação, sempre.
     *
     * O filtro que proibia esta combinação virou peso, e a mudança é boa: o poliéster mais macio do
     * catálogo, em tensão baixa, é uma resposta legítima para quem destrói um multifilamento em
     * dois treinos — e era isso que a regra binária impedia.
     *
     * Mas quem lê "você relatou dor" e logo abaixo vê uma corda de poliéster tem todo o direito de
     * achar que o sistema se contradisse. A frase existe para que a exceção apareça como decisão, e
     * para que a pessoa saiba o que fazer com ela: a tensão já vem reduzida, e a troca frequente é
     * parte da recomendação, não um detalhe.
     */
    if (STIFF_STRING_TYPES.includes(model.string_type)) {
      out.push(
        'Mesmo com o desconforto relatado, um poliéster macio venceu aqui pela frequência de ' +
          'quebra que você informou: uma corda mais macia arrebentaria antes de você voltar à ' +
          'quadra. Escolhemos o poliéster menos agressivo ao braço do catálogo e já reduzimos a ' +
          'tensão por isso. Se o braço reclamar, o primeiro ajuste é baixar mais a tensão; o ' +
          'segundo é passar para multifilamento e aceitar trocar com mais frequência.',
      );
    }
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
