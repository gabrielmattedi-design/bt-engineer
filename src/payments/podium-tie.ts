/**
 * Empate no pódio — o que dizer quando três opções mostram o mesmo número.
 *
 * ═══ A RECLAMAÇÃO ════════════════════════════════════════════════════════════════════════════
 *
 * Um relatório real trouxe as três primeiras raquetes marcando 88%, sem nada na tela que as
 * separasse. A leitura inevitável é a de que o motor não decidiu nada: se as três são 88, por que
 * esta é a primeira?
 *
 * ═══ POR QUE NÃO É CASA DECIMAL ══════════════════════════════════════════════════════════════
 *
 * A saída mais óbvia seria exibir 88.3 / 88.1 / 88.0. Ela resolve o sintoma e cria um problema
 * maior: sugere uma resolução que os dados não têm. O score sai de seis especificações publicadas
 * pelo fabricante — cabeça, peso, balanço, perfil de viga, comprimento e padrão de cordas. Nenhum
 * fabricante publica tolerância de fabricação, e a variação real entre duas unidades da MESMA
 * raquete costuma superar essas décimas. Escrever 88.3 contra 88.1 é afirmar uma diferença que
 * nenhuma medição sustenta — exatamente o tipo de precisão inventada que o produto promete não
 * fazer.
 *
 * Pior: no caso concreto do relatório, duas das três empatadas eram GÊMEAS DE ESPECIFICAÇÃO — 98
 * pol², 305 g, 315 mm, 16×19, 27". Elas não empatam por arredondamento; empatam até o último
 * decimal, porque recebem o mesmo vetor de atributos. Nenhuma casa decimal as separa, e insistir
 * em separá-las seria fabricar o número.
 *
 * ═══ O QUE ESTE MÓDULO FAZ ═══════════════════════════════════════════════════════════════════
 *
 * Diferencia pelo MOTIVO, não pelo dígito. Para cada opção dentro da faixa de empate, compara os
 * componentes do score contra a média das outras empatadas e devolve em que ela se destaca e em
 * que ela cede. Quando não há destaque nenhum acima do ruído, diz isso com todas as letras: são
 * equivalentes, e a escolha entre elas é de preço, disponibilidade ou gosto — critérios que o motor
 * não tem e não deve fingir ter.
 *
 * É o mesmo tratamento que as cordas idênticas já recebiam (`collectEquivalents`), aplicado às
 * raquetes.
 */

import type { ComponentKey, RankedRacket } from '@/domain/recommendation';
import { TECHNICAL_TIE_THRESHOLD } from '@/domain/reference-ranges';

/**
 * Diferença de componente abaixo da qual não vale a pena escrever uma frase.
 *
 * Os componentes vão de 0 a 100 e passam por equalização de dispersão; abaixo de dois pontos a
 * distância descreve o modelo, não a raquete.
 */
const MEANINGFUL_COMPONENT_GAP = 2;

/**
 * Piso mais baixo, usado só para COMPLETAR a frase.
 *
 * Sem ele, o card da 1ª colocada podia sair só com a parte negativa: no caso medido a VCORE 100
 * ganhava 1.2 em objetivo (abaixo do piso) e perdia 3.0 em conforto (acima), e o texto virava
 * "entre as empatadas, é menos amigável ao braço" — verdadeiro, e uma descrição absurda da raquete
 * que o motor acabou de escolher. Um destaque pequeno demais para abrir a frase ainda é grande o
 * bastante para fechá-la.
 */
const SECONDARY_COMPONENT_GAP = 0.75;

/** Só entram no grupo posições realmente exibidas — o pódio tem três. */
const MAX_TIE_GROUP = 3;

const COMPONENT_PT: Record<ComponentKey, { readonly strong: string; readonly weak: string }> = {
  physical_fit: {
    strong: 'encaixa melhor no seu peso e condicionamento',
    weak: 'exige um pouco mais do braço ao longo do jogo',
  },
  skill_fit: {
    strong: 'exige de você exatamente o nível que você tem',
    weak: 'cobra um pouco mais de técnica',
  },
  swing_fit: {
    strong: 'complementa melhor a velocidade do seu swing',
    weak: 'combina um pouco menos com a velocidade do seu swing',
  },
  playstyle_fit: {
    strong: 'acompanha melhor o seu estilo de jogo',
    weak: 'acompanha um pouco menos o seu estilo de jogo',
  },
  objective_fit: {
    strong: 'entrega mais do que você pediu na ordem que você pediu',
    weak: 'entrega um pouco menos do que você pediu',
  },
  comfort_fit: {
    strong: 'é mais amigável ao braço',
    weak: 'é menos amigável ao braço',
  },
  transition_fit: {
    strong: 'é uma troca mais suave a partir da sua raquete atual',
    weak: 'muda mais em relação à sua raquete atual',
  },
};

export type PodiumTieGroup = {
  /** Posições empatadas, em ordem. Sempre começa em 1 — só existe empate no topo. */
  readonly ranks: readonly number[];
  /** Maior distância dentro do grupo, arredondada como aparece na tela. */
  readonly spread: number;
  readonly message: string;
};

/** Como uma opção empatada se distingue das outras do mesmo grupo. */
export type PodiumDistinction = {
  readonly headline: string;
  /** `true` quando o vetor de atributos é idêntico ao de outra do grupo. */
  readonly identical_twin: boolean;
};

/**
 * As posições do topo que estão dentro da faixa de empate técnico.
 *
 * Retorna vazio quando a 1ª se destaca — o caso normal, em que não há nada a explicar.
 */
export function tieGroup(podium: readonly RankedRacket[]): readonly RankedRacket[] {
  const first = podium[0];
  if (!first) return [];

  const group = podium
    .slice(0, MAX_TIE_GROUP)
    .filter((e) => Math.abs(first.fit_score - e.fit_score) < TECHNICAL_TIE_THRESHOLD);

  return group.length > 1 ? group : [];
}

export function buildTieGroup(podium: readonly RankedRacket[]): PodiumTieGroup | null {
  const group = tieGroup(podium);
  if (group.length === 0) return null;

  const scores = group.map((e) => e.fit_score);
  const spread = Math.max(...scores) - Math.min(...scores);
  const n = group.length === 2 ? 'duas' : 'três';

  return {
    ranks: group.map((e) => e.rank),
    spread: Math.round(spread * 100) / 100,
    message:
      `Estas ${n} primeiras empataram tecnicamente: ${spread.toFixed(2)} ponto separa a maior da ` +
      'menor, num score construído sobre seis especificações publicadas. A ordem entre elas está ' +
      'correta — a 1ª realmente pontuou mais —, mas por uma margem menor do que a diferença entre ' +
      'duas unidades da mesma raquete saídas de fábrica. Não leia como "melhor" e "piores": são ' +
      'alternativas equivalentes, e o que separa cada uma está escrito no próprio card.',
  };
}

/**
 * O que separa `entry` das outras empatadas.
 *
 * A comparação é contra a MÉDIA das demais do grupo, e não contra a 1ª colocada: para a própria 1ª
 * não existiria referência, e comparar a 3ª com a 1ª ignoraria a 2ª, que está no meio.
 */
export function buildDistinction(
  entry: RankedRacket,
  podium: readonly RankedRacket[],
): PodiumDistinction | null {
  const group = tieGroup(podium);
  if (group.length === 0) return null;
  if (!group.some((e) => e.rank === entry.rank)) return null;

  const others = group.filter((e) => e.rank !== entry.rank);
  if (others.length === 0) return null;

  const deltas: Array<{ key: ComponentKey; delta: number; weight: number }> = [];
  for (const component of entry.breakdown.components) {
    if (component.weight <= 0) continue;
    const values = others.map(
      (o) => o.breakdown.components.find((c) => c.key === component.key)?.raw ?? component.raw,
    );
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    deltas.push({ key: component.key, delta: component.raw - mean, weight: component.weight });
  }

  const strongest = deltas.reduce((best, d) => (d.delta > best.delta ? d : best), {
    key: 'objective_fit' as ComponentKey,
    delta: -Infinity,
    weight: 0,
  });
  const weakest = deltas.reduce((worst, d) => (d.delta < worst.delta ? d : worst), {
    key: 'objective_fit' as ComponentKey,
    delta: Infinity,
    weight: 0,
  });

  /**
   * Basta UM lado acima do piso para haver o que dizer; o outro entra com o piso secundário.
   *
   * A frase precisa dos dois lados sempre que os dois existirem, porque o assunto dela é a TROCA
   * entre opções equivalentes. Só um lado deixaria o card ou vendendo ou depreciando.
   */
  const relevant =
    strongest.delta >= MEANINGFUL_COMPONENT_GAP || weakest.delta <= -MEANINGFUL_COMPONENT_GAP;
  const hasStrong = relevant && strongest.delta >= SECONDARY_COMPONENT_GAP;
  const hasWeak = relevant && weakest.delta <= -SECONDARY_COMPONENT_GAP;

  /**
   * Nenhuma diferença acima do ruído: são gêmeas.
   *
   * Isto não é falha da análise — é o resultado dela. Raquetes com as mesmas seis especificações
   * publicadas recebem o mesmo vetor porque é tudo o que os dados permitem afirmar. Dizer isso é
   * mais útil, e mais honesto, do que inventar um desempate.
   */
  if (!hasStrong && !hasWeak) {
    const twin = others.find((o) => sameAttributeVector(entry, o));
    return {
      headline: twin
        ? `Tecnicamente idêntica à ${twin.rank}ª (${twin.racket.variant.product_name}): mesmas ` +
          'especificações publicadas, mesmo resultado na análise. Escolha por preço, ' +
          'disponibilidade ou preferência de marca.'
        : 'Sem vantagem nem desvantagem relevante sobre as outras empatadas — as diferenças ficam ' +
          'abaixo do que as especificações publicadas conseguem distinguir.',
      identical_twin: twin !== undefined,
    };
  }

  const parts: string[] = [];
  if (hasStrong) parts.push(`Entre as empatadas, ${COMPONENT_PT[strongest.key].strong}`);
  if (hasWeak) {
    parts.push(
      hasStrong
        ? `em compensação, ${COMPONENT_PT[weakest.key].weak}`
        : `Entre as empatadas, ${COMPONENT_PT[weakest.key].weak}`,
    );
  }

  return { headline: `${parts.join('; ')}.`, identical_twin: false };
}

/** Duas raquetes com o mesmo vetor de atributos — o caso das gêmeas de especificação. */
function sameAttributeVector(a: RankedRacket, b: RankedRacket): boolean {
  const x = a.racket.attributes;
  const y = b.racket.attributes;
  return (
    x.power_score === y.power_score &&
    x.control_score === y.control_score &&
    x.spin_score === y.spin_score &&
    x.comfort_score === y.comfort_score &&
    x.stability_score === y.stability_score &&
    x.maneuverability_score === y.maneuverability_score
  );
}
