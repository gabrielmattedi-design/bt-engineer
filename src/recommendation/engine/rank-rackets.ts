/**
 * Camada 4 — o ranking. Núcleo do produto.
 *
 * Função pura e determinística: mesmas entradas ⇒ mesma saída, sempre (docs/PRODUCT_SPEC.md §2).
 * Sem I/O, sem Date.now(), sem Math.random(). Ver tests/property/determinism.test.ts.
 */

import {

  TECHNICAL_TIE_THRESHOLD,
} from '@/domain/reference-ranges';
import { clamp, round } from '@/domain/scores';
import type { ScoredRacket } from '@/domain/racket';
import type { NeedKey, PlayerProfile } from '@/domain/player-profile';
import type {
  ComponentBreakdown,
  ComponentKey,
  ExcludedRacket,
  RankedRacket,
  ScoreBreakdown,
} from '@/domain/recommendation';
import {
  BASE_COMPONENT_WEIGHTS,
  DYNAMIC_ADJUSTMENTS,
} from '@/recommendation/config/weights.v1';
import {
  catalogReference,
  comfortFit,
  currentRacketReference,
  objectiveFit,
  physicalFit,
  playstyleFit,
  skillFit,
  swingFit,
  transitionFit,
} from './fit-components';
import { buildCatalogScale, type CatalogScale } from './catalog-scale';
import { applyHardFilters, type FilterMode } from './hard-filters';
import { computePenalties } from './penalties';

/**
 * Resolve os pesos finais aplicando os ajustes dinâmicos e renormalizando para somar 1.
 *
 * A renormalização é o que impede que zerar `transition_fit` (jogador sem raquete) reduza
 * artificialmente todos os scores — os 0.06 são redistribuídos, não perdidos.
 */
export function resolveWeights(profile: PlayerProfile): Record<ComponentKey, number> {
  const weights: Record<ComponentKey, number> = {
    physical_fit: BASE_COMPONENT_WEIGHTS.physical_fit.weight,
    skill_fit: BASE_COMPONENT_WEIGHTS.skill_fit.weight,
    swing_fit: BASE_COMPONENT_WEIGHTS.swing_fit.weight,
    playstyle_fit: BASE_COMPONENT_WEIGHTS.playstyle_fit.weight,
    objective_fit: BASE_COMPONENT_WEIGHTS.objective_fit.weight,
    comfort_fit: BASE_COMPONENT_WEIGHTS.comfort_fit.weight,
    transition_fit: BASE_COMPONENT_WEIGHTS.transition_fit.weight,
  };

  if (profile.arm_sensitivity_score >= DYNAMIC_ADJUSTMENTS.arm_sensitivity_high.threshold) {
    weights.comfort_fit = DYNAMIC_ADJUSTMENTS.arm_sensitivity_high.weight;
  }

  const hasCurrentRacket =
    profile.current_racket !== null &&
    profile.current_racket.variant_id !== null &&
    !profile.current_racket.unrecognized;
  if (!hasCurrentRacket) {
    weights.transition_fit = DYNAMIC_ADJUSTMENTS.no_current_racket.weight;
  } else if (profile.objectives.includes('maximize_current')) {
    weights.transition_fit = DYNAMIC_ADJUSTMENTS.objective_maximize_current.weight;
  }

  if (!profile.style_declared) {
    weights.playstyle_fit = DYNAMIC_ADJUSTMENTS.style_undetermined.weight;
  }

  if (profile.objectives.length === 1 && profile.objectives[0] === 'unknown') {
    weights.objective_fit = DYNAMIC_ADJUSTMENTS.objective_unknown.weight;
  }

  if (profile.contradictions.some((c) => c.code === 'level_mismatch')) {
    weights.skill_fit *= DYNAMIC_ADJUSTMENTS.level_mismatch.multiplier;
  }

  const total = Object.values(weights).reduce((s, v) => s + v, 0);
  if (total === 0) return weights;
  for (const key of Object.keys(weights) as ComponentKey[]) {
    weights[key] = weights[key] / total;
  }
  return weights;
}

/** Traduz componentes e penalizações em frases legíveis de ganho/perda (§48). */
function explainBreakdown(
  components: readonly ComponentBreakdown[],
  penalties: ScoreBreakdown['penalties'],
): { gained: string[]; lost: string[] } {
  const LABELS: Record<ComponentKey, string> = {
    physical_fit: 'compatibilidade física com a massa do frame',
    skill_fit: 'exigência do frame alinhada ao nível técnico',
    swing_fit: 'potência do frame complementar ao seu swing',
    playstyle_fit: 'características alinhadas ao seu estilo de jogo',
    objective_fit: 'direção alinhada ao objetivo declarado',
    comfort_fit: 'conforto e amigabilidade ao braço',
    transition_fit: 'proximidade com o equipamento atual',
  };

  const gained: string[] = [];
  const lost: string[] = [];

  for (const c of components) {
    if (c.weight <= 0) continue;
    if (c.raw >= 80) gained.push(`Ganhou pontos por ${LABELS[c.key]} (${round(c.raw)}/100).`);
    else if (c.raw < 55) lost.push(`Perdeu pontos por ${LABELS[c.key]} (${round(c.raw)}/100).`);
  }
  for (const p of penalties) {
    lost.push(`Penalização de ${p.points} pontos: ${p.reason}`);
  }

  return { gained, lost };
}

/**
 * Reescala `objective_fit` contra o que é ALCANÇÁVEL, não contra o que foi pedido.
 *
 * ─── O PROBLEMA ──────────────────────────────────────────────────────────────────────────────
 *
 * Objetivos declarados frequentemente se opõem entre si dentro da física da raquete: mais controle
 * e mais spin puxam o padrão de cordas em direções contrárias; mais estabilidade e mais
 * manobrabilidade puxam a massa. Quando isso acontece, NENHUMA raquete do catálogo consegue um
 * `objective_fit` alto — para o júnior avançado (p09) o teto era 64 em 46 raquetes avaliadas.
 *
 * Cobrar da recomendação uma contradição que estava no próprio pedido não informa nada: o usuário
 * via um score baixo sem que existisse escolha melhor. É o mesmo defeito de teto inalcançável que
 * `catalog-scale.ts` corrige nos outros componentes, só que aqui o teto varia por PERFIL, e por
 * isso precisa ser medido sobre o ranking em vez de sair da escala do catálogo.
 *
 * ─── O QUE CONTINUA SENDO DITO ───────────────────────────────────────────────────────────────
 *
 * A reescala é linear e monotônica: a ordem entre as raquetes não muda, nenhuma ultrapassa outra.
 * E os TERMOS do componente continuam trazendo o número cru, eixo por eixo ("entregue −64% do
 * espaço disponível") — que é o que o relatório mostra ao usuário e o que a auditoria do admin lê.
 * O conflito não some; ele deixa de ser cobrado da raquete que não tinha como resolvê-lo.
 */
function objectiveRescaler(
  outputs: readonly (readonly { key: ComponentKey; raw: number }[])[],
): (raw: number) => number {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;

  for (const row of outputs) {
    for (const o of row) {
      if (o.key !== 'objective_fit') continue;
      if (o.raw < lo) lo = o.raw;
      if (o.raw > hi) hi = o.raw;
    }
  }

  // Faixa inexistente ou já saudável: não mexe. Reescalar uma faixa estreita perto do topo só
  // amplificaria ruído, e o componente já está dizendo "todas entregam mais ou menos o mesmo".
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi - lo < 1 || hi >= 95) {
    return (raw) => raw;
  }

  return (raw) => clamp(lo + ((raw - lo) * (100 - lo)) / (hi - lo), 0, 100);
}

export type RankOptions = {
  readonly mode?: FilterMode;
  /** Raquete atual já pontuada, quando reconhecida no catálogo. Habilita transição e referência. */
  readonly currentRacket?: ScoredRacket | null;
  /** Limite do ranking retornado. O pódio sempre sai dos 3 primeiros. */
  readonly limit?: number;
};

export type RankResult = {
  readonly ranking: readonly RankedRacket[];
  readonly excluded: readonly ExcludedRacket[];
  readonly candidates_evaluated: number;
  readonly weights: Readonly<Record<ComponentKey, number>>;
  readonly reference: Readonly<Record<NeedKey, number>>;
  readonly scale: CatalogScale;
};

export function rankRackets(
  profile: PlayerProfile,
  catalog: readonly ScoredRacket[],
  options: RankOptions = {},
): RankResult {
  const mode = options.mode ?? 'strict';
  const { kept, excluded } = applyHardFilters(catalog, profile, mode);

  /**
   * A régua sai do catálogo COMPLETO, antes dos filtros duros — ver `catalog-scale.ts`. Se saísse
   * de `kept`, cada perfil teria sua própria escala e dois usuários veriam percentuais que não
   * podem ser comparados entre si.
   */
  const scale = buildCatalogScale(catalog);

  const weights = resolveWeights(profile);
  const reference = options.currentRacket
    ? currentRacketReference(options.currentRacket)
    : catalogReference(kept);
  const referencePower = options.currentRacket
    ? options.currentRacket.attributes.power_score
    : (reference.power ?? null);

  const rawOutputs = kept.map((racket) => [
    physicalFit(profile, racket, scale),
    skillFit(profile, racket, scale),
    swingFit(profile, racket, scale),
    playstyleFit(profile, racket, scale),
    objectiveFit(profile, racket, reference, scale),
    comfortFit(profile, racket, scale),
    transitionFit(profile, racket),
  ]);

  const rescaleObjective = objectiveRescaler(rawOutputs);

  const scored = kept.map((racket, racketIndex) => {
    const outputs = rawOutputs[racketIndex]!.map((o) =>
      o.key === 'objective_fit' ? { ...o, raw: rescaleObjective(o.raw) } : o,
    );

    const components: ComponentBreakdown[] = outputs.map((o) => {
      const weight = weights[o.key];
      return { ...o, weight: round(weight, 4), contribution: round(o.raw * weight) };
    });

    const weightedSum = components.reduce((s, c) => s + c.raw * c.weight, 0);
    const penalties = computePenalties(profile, racket, referencePower, { reference, scale });
    const penaltyTotal = penalties.reduce((s, p) => s + p.points, 0);
    const finalScore = clamp(weightedSum - penaltyTotal, 0, 100);
    const { gained, lost } = explainBreakdown(components, penalties);

    const breakdown: ScoreBreakdown = {
      final_score: round(finalScore),
      components,
      penalties,
      data_completeness: round(racket.attributes.data_completeness, 3),
      gained,
      lost,
    };

    return { racket, fit_score: round(finalScore), breakdown };
  });

  // Ordenação determinística: score desc; empates desempatados pelo id, nunca pela ordem de entrada.
  scored.sort((a, b) => {
    if (b.fit_score !== a.fit_score) return b.fit_score - a.fit_score;
    return a.racket.variant.id.localeCompare(b.racket.variant.id);
  });

  const limit = options.limit ?? scored.length;
  const ranking: RankedRacket[] = scored.slice(0, limit).map((entry, index) => {
    const previous = index > 0 ? scored[index - 1] : undefined;
    return {
      rank: index + 1,
      racket: entry.racket,
      fit_score: entry.fit_score,
      breakdown: entry.breakdown,
      technical_tie_with_previous:
        previous !== undefined &&
        Math.abs(previous.fit_score - entry.fit_score) < TECHNICAL_TIE_THRESHOLD,
    };
  });

  return {
    ranking,
    excluded,
    candidates_evaluated: kept.length,
    weights,
    reference,
    scale,
  };
}

/**
 * Seleciona o pódio (§28, §29) com regra de diversidade de família.
 *
 * Duas variantes da mesma família ocupando o pódio raramente ajudam o usuário — exceto quando a
 * diferença entre elas É o eixo do objetivo declarado (peso), caso em que a comparação é informativa.
 *
 * ─── POR QUE NÃO EXISTE MAIS PISO DE FIT AQUI ────────────────────────────────────────────────
 *
 * O §30 proíbe ENCHER o pódio com opções fracas para viabilizar o upsell do Top 3. A leitura
 * inicial foi aplicar `MIN_PODIUM_FIT` como corte: quem não chegasse a 75 sumia do pódio.
 *
 * Duas coisas mostraram que o corte estava errado.
 *
 * Primeiro, aplicado ao 1º colocado ele esvaziava o pódio inteiro: o usuário respondia tudo, o
 * motor pontuava as 46 raquetes, e a resposta era "ainda não podemos recomendar com segurança".
 *
 * Depois, aplicado ao 2º e ao 3º, ele produzia um pódio de uma raquete só — escondendo do usuário
 * que existiam alternativas reais, avaliadas e ordenadas. O que o §30 quer impedir é apresentar
 * uma opção fraca COMO SE FOSSE boa. Sonegar a existência dela não é o mesmo cuidado: é tirar do
 * usuário a informação para decidir.
 *
 * O pódio agora traz as três melhores, sempre, e cada uma exibe seu fit REAL antes de qualquer
 * pagamento. Quem desbloqueia a 2ª sabendo que ela marca 71% está fazendo uma escolha informada,
 * que é uma proteção mais forte do que a ausência da informação. Cabe a `top3_offer_available` e
 * ao rótulo de qualidade da vitrine dizer quando a diferença é grande.
 */
export function selectPodium(
  ranking: readonly RankedRacket[],
  profile: PlayerProfile,
): readonly RankedRacket[] {
  const wantsWeightChange =
    Math.abs(profile.desired_change_vector.maneuverability) > 15 ||
    Math.abs(profile.desired_change_vector.stability) > 15;

  const podium: RankedRacket[] = [];
  const familiesUsed = new Set<string>();

  for (const entry of ranking) {
    if (podium.length >= 3) break;

    const familyKey = `${entry.racket.variant.brand}::${entry.racket.variant.family}`;
    if (familiesUsed.has(familyKey) && !wantsWeightChange) continue;

    familiesUsed.add(familyKey);
    podium.push({ ...entry, rank: podium.length + 1 });
  }

  return podium;
}
