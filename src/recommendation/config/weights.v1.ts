/**
 * Pesos do motor de recomendação — docs/RECOMMENDATION_ENGINE.md §4.2.
 *
 * §21 da especificação: "Não escolher pesos arbitrariamente. Pesos iniciais precisam de justificativa
 * técnica e devem ser configuráveis."
 *
 * O tipo `WeightedConfig` torna `rationale` OBRIGATÓRIO — é impossível adicionar um peso a este arquivo
 * sem escrever por que ele existe. Esta é a barreira de tipo que sustenta o §21.
 */

import type { ComponentKey } from '@/domain/recommendation';
import type { NeedKey } from '@/domain/player-profile';

export const WEIGHTS_VERSION = 'weights.v1';

export type WeightEntry = {
  readonly weight: number;
  readonly rationale: string;
};

export type ComponentWeights = Readonly<Record<ComponentKey, WeightEntry>>;

/** Pesos base. Somam 1.00. Ajustes dinâmicos em `resolveWeights()`. */
export const BASE_COMPONENT_WEIGHTS: ComponentWeights = {
  skill_fit: {
    weight: 0.2,
    rationale:
      'Maior peso do motor. Entregar um frame acima ou abaixo do nível técnico é o erro mais custoso ' +
      'e mais comum do mercado: uma raquete exigente demais degrada o jogo de quem a compra, e uma ' +
      'raquete fácil demais limita quem já evoluiu.',
  },
  physical_fit: {
    weight: 0.18,
    rationale:
      'Massa manejável é pré-requisito físico. Se o jogador não consegue acelerar o frame, nenhum ' +
      'outro atributo se materializa em quadra — o erro se propaga para todos os golpes.',
  },
  swing_fit: {
    weight: 0.18,
    rationale:
      'Determina se a bola entra na quadra. A potência do frame deve COMPLEMENTAR a produção natural ' +
      'do jogador, não somar-se a ela; somar potência a quem já tem é a causa clássica de bolas longas.',
  },
  objective_fit: {
    weight: 0.16,
    rationale:
      'O jogador pagou para atingir um objetivo declarado. Ignorá-lo é falha de produto, mesmo que a ' +
      'raquete seja tecnicamente boa. Peso abaixo dos fatores físicos porque objetivo mal calibrado ' +
      'não pode sobrepor limitação física real.',
  },
  playstyle_fit: {
    weight: 0.14,
    rationale:
      'Relevante, mas estilos são autodeclarados e ruidosos: muitos jogadores descrevem o estilo que ' +
      'gostariam de ter. Peso deliberadamente menor que nível e físico, que são mais verificáveis.',
  },
  comfort_fit: {
    weight: 0.08,
    rationale:
      'Baixo por padrão porque a maioria dos jogadores não relata sensibilidade — nesse caso o termo ' +
      'só faria ruído. Sobe para 0.20 quando há histórico de desconforto (ver DYNAMIC_ADJUSTMENTS).',
  },
  transition_fit: {
    weight: 0.06,
    rationale:
      'Suavizar a troca de equipamento reduz o risco de rejeição, mas nunca deve impedir a raquete ' +
      'correta. Peso baixo e assimétrico: penaliza apenas mudanças acima das zonas mortas.',
  },
};

/**
 * Ajustes dinâmicos de peso. Aplicados em ordem; os demais pesos são renormalizados após cada regra.
 * Cada ajuste declara sua condição e sua justificativa.
 */
export const DYNAMIC_ADJUSTMENTS = {
  arm_sensitivity_high: {
    threshold: 60,
    component: 'comfort_fit' as ComponentKey,
    weight: 0.2,
    rationale:
      'Histórico de desconforto muda a natureza do problema: conforto deixa de ser preferência e ' +
      'passa a ser restrição. É a única categoria em que uma recomendação errada pode causar dano ' +
      'físico (docs/00_RISKS_AND_DECISIONS.md#r-11).',
  },
  no_current_racket: {
    component: 'transition_fit' as ComponentKey,
    weight: 0,
    rationale:
      'Sem raquete atual reconhecida não existe transição a avaliar. Zerar o peso é honesto; ' +
      'atribuir um valor neutro introduziria ruído em todas as raquetes igualmente.',
  },
  style_undetermined: {
    component: 'playstyle_fit' as ComponentKey,
    weight: 0,
    rationale:
      'Iniciante ainda não tem estilo de jogo. Quando nenhum estilo é declarado, o vetor de estilo ' +
      'é um placeholder difuso, e cobrar aderência a ele reprova justamente os frames de iniciante ' +
      '— que são projetados para tolerância, não para um padrão tático. Zerar o peso é honesto; os ' +
      '0.15 são redistribuídos entre físico, nível, swing e conforto, que é onde a informação real ' +
      'deste jogador está.',
  },
  objective_unknown: {
    component: 'objective_fit' as ComponentKey,
    weight: 0.08,
    rationale:
      'Jogador que respondeu "ainda não sei" não deve ter um objetivo inventado a partir de outras ' +
      'respostas. O peso cai, mas não zera: os "sente falta de" ainda carregam intenção real.',
  },
  objective_maximize_current: {
    component: 'transition_fit' as ComponentKey,
    weight: 0.12,
    rationale:
      'Quem quer potencializar o jogo atual está pedindo evolução, não revolução. A proximidade com ' +
      'o equipamento atual passa a ser um objetivo, não apenas um atenuante de risco.',
  },
  level_mismatch: {
    component: 'skill_fit' as ComponentKey,
    multiplier: 0.8,
    rationale:
      'Quando o nível autoavaliado diverge muito do calibrado, o dado está sob suspeita. Reduzir o ' +
      'peso do componente que depende dele é preferível a confiar num número provavelmente errado.',
  },
} as const;

/** Pesos da seleção de corda — docs/STRING_AND_TENSION_ENGINE.md §3. */
export const STRING_FIT_WEIGHTS: Readonly<Record<string, WeightEntry>> = {
  control: {
    weight: 0.22,
    rationale:
      'A corda é o principal regulador de controle do setup e o ajuste mais barato e reversível ' +
      'disponível ao jogador.',
  },
  comfort: {
    weight: 0.2,
    rationale:
      '§37 é explícito: "conforto deve possuir peso real". Peso alto por decisão de produto, contra ' +
      'a prática de mercado de recomendar poliéster por padrão.',
  },
  spin: {
    weight: 0.18,
    rationale:
      'Material e formato da corda alteram spin de forma mensurável, com efeito comparável ao do ' +
      'padrão de cordas do frame.',
  },
  power: {
    weight: 0.16,
    rationale:
      'Relevante, mas a potência é majoritariamente determinada pelo frame e pela tensão; a corda ' +
      'ajusta na margem.',
  },
  arm: {
    weight: 0.14,
    rationale:
      'Separado de "comfort" porque conforto percebido e carga sobre o braço não são a mesma coisa: ' +
      'uma corda pode agradar no toque e ainda assim transmitir choque.',
  },
  durability: {
    weight: 0.1,
    rationale:
      'Importa economicamente para quem quebra cordas com frequência, mas nunca deve sobrepor ' +
      'conforto ou controle. Menor peso do conjunto.',
  },
  cost: {
    weight: 0.12,
    rationale:
      'Sem este eixo o modelo só media dimensões em que a tripa natural vence, e a conclusão ' +
      'coerente com ele seria mandar todo mundo comprar tripa. Peso próximo ao da durabilidade: ' +
      'preço decide de verdade — quatro a seis vezes de diferença — mas nunca deve fazer alguém ' +
      'com dor receber uma corda que castiga o braço por ser mais barata.',
  },
};

/**
 * Para quem relata desconforto, conforto e braço dominam — e o custo cai pela metade.
 *
 * É deliberado: economizar na corda é uma escolha legítima, mas não à custa de um cotovelo que já
 * dói. Quem tem dor recebe a melhor corda para o braço dentro do que sobrou, e o preço volta a
 * pesar só entre as que passam nesse critério.
 */
export const STRING_FIT_WEIGHTS_ARM_SENSITIVE: Readonly<Record<string, number>> = {
  comfort: 0.26,
  arm: 0.2,
  control: 0.16,
  spin: 0.13,
  power: 0.1,
  durability: 0.09,
  cost: 0.06,
};

/** Necessidades que os "sente falta de" elevam, por posição de prioridade (§14). */
export const NEED_PRIORITY_BONUS: readonly number[] = [25, 15, 8];

export const OBJECTIVE_NEED_BONUS = 18;

export const DISLIKE_NEED_BONUS: Readonly<Record<string, { need: NeedKey; points: number }>> = {
  falta_estabilidade: { need: 'stability', points: 22 },
  acho_pesada: { need: 'maneuverability', points: 22 },
  dificuldade_acelerar: { need: 'maneuverability', points: 22 },
  acho_leve: { need: 'stability', points: 18 },
  falta_potencia: { need: 'power', points: 20 },
  falta_controle: { need: 'control', points: 20 },
  sinto_vibracao: { need: 'comfort', points: 20 },
  muito_exigente: { need: 'forgiveness', points: 18 },
};
