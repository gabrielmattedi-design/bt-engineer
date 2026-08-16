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

/**
 * Firmeza em CINCO níveis.
 *
 * ═══ POR QUE TRÊS NÃO BASTAVAM ═══════════════════════════════════════════════════════════════
 *
 * Com `soft | medium | firm`, os descritores admitiam 3 × 3 × 3 × 5 combinações por tipo — e o
 * mercado real de poliésters não cabe nisso. A consequência era medida e visível: cordas
 * diferentes recebiam vetores IDÊNTICOS, empatavam para sempre e sumiam do relatório.
 *
 * O caso que forçou a mudança: a Solinco Mach-10 é descrita pelas fontes com rigidez de 160–180
 * lb/in contra 200–220 de um poliéster comum — ou seja, ela é bem mais macia do que a Confidential,
 * que também é "soft". Com três níveis as duas caem no mesmo balde, com o mesmo formato pentagonal
 * e a mesma manutenção de tensão alta, e o motor passa a tratá-las como o mesmo produto. O
 * vocabulário, não a fórmula, era o teto da análise.
 *
 * Cinco níveis é o que as fontes sustentam. As resenhas ordenam maciez de forma consistente e
 * comparativa — "mais macia que a RPM Blast", "entre a RPM Power e a Hyper-G", "muito mais rígida
 * que a ALU Power" —, e ordenação relativa é exatamente o que um nível a mais para cada lado
 * expressa. Não inventamos número de laboratório: continuamos afirmando só o que dá para conferir.
 *
 * O §6 segue valendo: nenhum score é digitado. O que mudou é a resolução do descritor de entrada.
 */
export type Firmness = 'very_soft' | 'soft' | 'medium' | 'firm' | 'very_firm';
export type QualitativeLevel = 'low' | 'medium' | 'high';

/**
 * ═══ OS TRÊS DESCRITORES DE CARÁTER ══════════════════════════════════════════════════════════
 *
 * Tipo, formato, firmeza, durabilidade e manutenção de tensão descrevem a CONSTRUÇÃO da corda.
 * Duas cordas podem coincidir nos cinco e ainda assim jogar diferente — e jogam: quem troca de
 * corda percebe, e as resenhas descrevem a diferença com um vocabulário estável.
 *
 * Estes três capturam exatamente esse vocabulário:
 *
 *   `feel`    a resposta no impacto — abafada, seca, macia ou viva
 *   `launch`  o ângulo natural de saída da bola — rasante, médio ou alto
 *   `bite`    quanto a corda agarra e devolve a bola (snapback), além do que o formato explica
 *
 * ─── DE ONDE SAEM ESSES VALORES ────────────────────────────────────────────────────────────
 *
 * Da mesma lugar que os outros descritores: posicionamento do fabricante e resenhas técnicas. Eles
 * são MENOS objetivos que peso e formato, e isso está registrado na procedência de cada modelo —
 * `technical_review`, não `manufacturer`. O que eles NÃO são é invenção livre: "a Velocity MLT é a
 * multifilamento de controle, segura tensão e não vira trampolim" e "a NXT é a mais macia da
 * categoria" são afirmações que qualquer pessoa encontra repetidas nas mesmas fontes.
 *
 * ─── POR QUE ISTO PRECISOU EXISTIR ─────────────────────────────────────────────────────────
 *
 * Sem eles, seis grupos do catálogo tinham vetores idênticos — dezesseis modelos com gêmeo exato.
 * Empate permanente significa que um dos gêmeos nunca é indicado a ninguém, e um catálogo com
 * produtos que nunca são resposta de ninguém está mentindo sobre o próprio tamanho.
 *
 * O §6 continua intacto: nenhum score é digitado. Continuam sendo derivados — de um descritor a
 * mais, que é conferível contra as mesmas fontes.
 */
export type Feel = 'muted' | 'crisp' | 'plush' | 'lively';
export type Launch = 'low' | 'medium' | 'high';
export type Bite = 'low' | 'medium' | 'high';

export type StringDescriptors = {
  readonly string_type: StringType;
  readonly shape: StringShape | null;
  /** Posicionamento do fabricante e das resenhas quanto à sensação, em cinco graus. */
  readonly firmness: Firmness;
  readonly durability: QualitativeLevel;
  readonly tension_maintenance: QualitativeLevel;
  readonly feel: Feel;
  readonly launch: Launch;
  readonly bite: Bite;
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
  /**
   * NOTA DE CALIBRAÇÃO (v2.4.0): conforto e braço saíram de 88 para 76 e 74.
   *
   * Não é uma reavaliação da categoria — multifilamento continua sendo, depois da tripa, o que
   * existe de mais macio. É espaço de manobra. Com a base em 88, qualquer firmeza macia somada a
   * qualquer feel já estourava o teto de 100, e os SEIS multifilamentos do catálogo terminavam com
   * conforto 100 e braço 100, idênticos, nos dois eixos que mais decidem nessa categoria. A
   * diferenciação era calculada e jogada fora no clamp.
   *
   * Com a base mais baixa, os modificadores voltam a caber: a Rexis Comfort chega a 100, a
   * Sensation a 98, NXT e Addiction a 95, a Velocity MLT a 91. A ordem passa a existir, e ela é a
   * que as resenhas descrevem.
   */
  multifilament: {
    power_score: 76,
    control_score: 54,
    spin_score: 44,
    comfort_score: 76,
    stiffness_score: 28,
    durability_score: 38,
    tension_maintenance_score: 64,
    arm_friendliness_score: 74,
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

/**
 * Os dois níveis extremos ESTENDEM a escala, não a reescalam.
 *
 * `soft`, `medium` e `firm` mantêm exatamente os valores que já tinham: toda corda já classificada
 * continua com os mesmos scores, e a comparação com relatórios antigos segue de pé. `very_soft` e
 * `very_firm` acrescentam um degrau adiante de cada ponta, com passo próximo ao anterior — não o
 * dobro, porque a diferença entre uma poli macia e uma poli muito macia é real e é menor do que a
 * diferença entre macia e média.
 */
const FIRMNESS_MODIFIER: Record<Firmness, Partial<StringBaseAttributes>> = {
  very_soft: {
    comfort_score: 20,
    arm_friendliness_score: 21,
    stiffness_score: -26,
    control_score: -10,
    power_score: 11,
  },
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
  very_firm: {
    comfort_score: -14,
    arm_friendliness_score: -15,
    stiffness_score: 18,
    control_score: 9,
    power_score: -9,
  },
};

const LEVEL_DELTA: Record<QualitativeLevel, number> = { low: -12, medium: 0, high: 12 };

/**
 * Deltas de caráter — deliberadamente MENORES que os de construção.
 *
 * Feel, launch e bite ajustam o retrato; eles não redefinem a corda. Um multifilamento de resposta
 * seca continua sendo um multifilamento, e precisa continuar mais macio que qualquer poliéster.
 * Por isso nenhum destes passa de 8 pontos: o suficiente para separar dois produtos que a
 * construção não separa, insuficiente para atravessar a fronteira entre categorias.
 */
const FEEL_MODIFIER: Record<Feel, Partial<StringBaseAttributes>> = {
  // Abafada: a bola sai sem informação de volta para a mão. Previsível, pouco elástica.
  muted: { control_score: 5, power_score: -5, comfort_score: 3, tension_maintenance_score: 3 },
  // Seca: resposta rápida e nítida, com menos amortecimento.
  crisp: { control_score: 4, comfort_score: -5, arm_friendliness_score: -4, power_score: -2 },
  // Acolchoada: o leito de cordas afunda no impacto. É o extremo do conforto.
  plush: { comfort_score: 7, arm_friendliness_score: 8, control_score: -4, power_score: 3 },
  // Viva: devolve energia, sensação de mola.
  lively: { power_score: 7, comfort_score: 2, control_score: -5, tension_maintenance_score: -3 },
};

const LAUNCH_MODIFIER: Record<Launch, Partial<StringBaseAttributes>> = {
  low: { control_score: 6, power_score: -6, spin_score: -3 },
  medium: {},
  high: { power_score: 6, spin_score: 4, control_score: -5 },
};

/** Snapback: o quanto as cordas escorregam e voltam, agarrando a bola. */
const BITE_MODIFIER: Record<Bite, Partial<StringBaseAttributes>> = {
  low: { spin_score: -6, durability_score: 4 },
  medium: {},
  high: { spin_score: 7, durability_score: -4 },
};

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
  attrs = applyModifier(attrs, FEEL_MODIFIER[d.feel]);
  attrs = applyModifier(attrs, LAUNCH_MODIFIER[d.launch]);
  attrs = applyModifier(attrs, BITE_MODIFIER[d.bite]);
  return clampAll(attrs);
}

export const STRING_METHODOLOGY_VERSION = METHODOLOGY_VERSION;
