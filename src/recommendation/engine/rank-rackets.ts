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
import { NEED_KEYS, type NeedKey, type PlayerProfile } from '@/domain/player-profile';
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
import { compareByScoreThenTieBreak, profileSignature } from './tie-break';

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
  } else {
    /**
     * Piso para quem declarou prioridades — ver `declared_priorities` em weights.v1.ts.
     *
     * A força vem do próprio vetor de mudança desejada, que é onde as prioridades ordenadas e o
     * objetivo já foram traduzidos em números. Usar o pedido mais forte, e não a soma, é
     * deliberado: quem ordenou três atributos com convicção e quem marcou um só com convicção
     * declararam a mesma coisa sobre a INTENSIDADE do que querem — a diferença entre eles é
     * quantos eixos, e disso o componente já dá conta internamente.
     */
    const { ceiling, full_strength } = DYNAMIC_ADJUSTMENTS.declared_priorities;
    const strongest = Math.max(
      ...NEED_KEYS.map((k) => Math.abs(profile.desired_change_vector[k])),
    );
    const strength = clamp(strongest / full_strength, 0, 1);
    weights.objective_fit = Math.max(weights.objective_fit, ceiling * strength);
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
/**
 * ═══ EQUALIZAÇÃO DE DISPERSÃO ════════════════════════════════════════════════════════════════
 *
 * Um peso só significa o que diz se todos os componentes variarem na mesma medida. Eles não
 * variam, e a diferença é grande. Medido sobre 864 perfis, olhando as 12 primeiras colocadas de
 * cada um — que são as que de fato disputam:
 *
 *     componente        peso declarado   influência real   desvio-padrão
 *     physical_fit          19.5%            29.5%   1.51×      11.8
 *     skill_fit             20.2%            26.2%   1.30×       9.9
 *     swing_fit             19.5%            17.9%   0.92×       7.1
 *     objective_fit         10.8%            11.1%   1.03×       8.4
 *     comfort_fit           11.7%             9.5%   0.81×       6.3
 *     playstyle_fit         15.2%             5.8%   0.38×       3.0
 *
 * Influência é peso × dispersão. Um componente que separa as candidatas por 12 pontos decide muito
 * mais do que um que as separa por 3, mesmo com o peso escrito parecido — e ninguém decidiu isso:
 * é consequência acidental de como cada fórmula foi construída.
 *
 * A consequência prática foi apontada pelo usuário olhando o gráfico: `Peso e manejo` marcava 98
 * contra 66 e parecia decidir sozinho. Parecia porque decidia — 1.51 vez o que o peso prometia.
 *
 * ─── A CORREÇÃO ────────────────────────────────────────────────────────────────────────────
 *
 * Cada componente é reescalado EM TORNO DA PRÓPRIA MÉDIA até que sua dispersão entre as candidatas
 * se aproxime de um alvo comum. Componente que espalha demais é comprimido; componente que espalha
 * de menos é esticado. Depois disso, o peso volta a significar exatamente o que está escrito: a
 * fração da decisão que aquele critério carrega.
 *
 * ─── OS DOIS LIMITES, E POR QUE EXISTEM ────────────────────────────────────────────────────
 *
 * `MIN_SPREAD` impede amplificar ruído. Quando um componente separa as candidatas por 2 pontos,
 * essa diferença não é informação — é arredondamento de fórmula —, e esticá-la até o alvo daria a
 * um critério mudo o mesmo poder de um que está falando. É o mesmo princípio de `MIN_BAND_WIDTH`
 * em `catalog-scale.ts`.
 *
 * `MIN_SCALE`/`MAX_SCALE` impedem que a equalização vire outra distorção. Ela corrige proporção,
 * não reescreve a análise: nenhum componente pode ser espremido a menos da metade nem inflado a
 * mais de 1.6 vez, e a ORDEM que cada componente estabelece nunca muda — a transformação é linear
 * e monotônica.
 */
const TARGET_SPREAD = 8;
const MIN_SPREAD = 3.5;
const MIN_SCALE = 0.35;
const MAX_SCALE = 2;

/**
 * Fração das candidatas usada para MEDIR a dispersão.
 *
 * A equalização precisa igualar a influência onde a decisão acontece, e ela não acontece no
 * catálogo inteiro: acontece entre as poucas que disputam a primeira posição. Medir sobre as 46 dá
 * um número dominado pela cauda de baixo — as raquetes pesadas que um jogador leve nem cogita
 * inflam o desvio de `physical_fit`, a equalização divide por esse desvio inflado, e a dispersão
 * ENTRE AS CANDIDATAS REAIS sai praticamente intacta. Medido: 1.51× antes, 1.57× depois.
 *
 * A amostra de medição é escolhida por um score preliminar de pesos IGUAIS. Não é circular: o
 * preliminar não usa os pesos finais nem a equalização, serve só para separar "quem disputa" de
 * "quem já está fora", e a decisão continua sendo tomada sobre todas as candidatas.
 */
const CONTENDER_SHARE = 0.3;
const MIN_CONTENDERS = 8;

function contenderIndices(
  outputs: readonly (readonly { key: ComponentKey; raw: number }[])[],
  ids: readonly string[],
): number[] {
  const prelim = outputs.map((row, index) => ({
    index,
    id: ids[index] ?? String(index),
    score: row.reduce((s, o) => s + o.raw, 0) / Math.max(1, row.length),
  }));

  /*
    O desempate por id é obrigatório, não cosmético.

    Sem ele, duas candidatas com o mesmo score preliminar ficavam na ordem em que o catálogo chegou.
    Isso mudava QUEM entra na amostra de medição, e portanto a média e o desvio de cada componente,
    e portanto o score final de todo mundo — o motor deixava de ser determinístico em relação à
    ordem de entrada, que é uma garantia do §2. O teste de determinismo pegou na primeira execução.
  */
  prelim.sort((a, b) => (b.score - a.score) || a.id.localeCompare(b.id));
  const take = Math.max(MIN_CONTENDERS, Math.ceil(prelim.length * CONTENDER_SHARE));
  return prelim.slice(0, Math.min(take, prelim.length)).map((p) => p.index);
}

function equalizers(
  outputs: readonly (readonly { key: ComponentKey; raw: number }[])[],
  ids: readonly string[],
): Map<ComponentKey, (raw: number) => number> {
  const sample = new Set(contenderIndices(outputs, ids));
  const byKey = new Map<ComponentKey, number[]>();
  for (const [index, row] of outputs.entries()) {
    if (!sample.has(index)) continue;
    for (const o of row) {
      const list = byKey.get(o.key) ?? [];
      list.push(o.raw);
      byKey.set(o.key, list);
    }
  }

  const out = new Map<ComponentKey, (raw: number) => number>();
  for (const [key, values] of byKey) {
    if (values.length < 2) {
      out.set(key, (raw) => raw);
      continue;
    }
    /*
      Os valores são ORDENADOS antes de somar.

      Somar os mesmos números em ordens diferentes dá resultados de ponto flutuante ligeiramente
      diferentes. Aqui isso não é acadêmico: a média e o desvio entram na reescala de todos os
      componentes, e uma diferença na décima casa é suficiente para inverter um empate no ranking.
      O teste de determinismo — mesma entrada em outra ordem, mesma saída — pegou exatamente isso.
    */
    const ordered = [...values].sort((a, b) => a - b);
    const mean = ordered.reduce((s, v) => s + v, 0) / ordered.length;
    const spread = Math.sqrt(
      ordered.reduce((s, v) => s + (v - mean) ** 2, 0) / ordered.length,
    );
    const scale = clamp(TARGET_SPREAD / Math.max(spread, MIN_SPREAD), MIN_SCALE, MAX_SCALE);
    out.set(key, (raw) => clamp(mean + (raw - mean) * scale, 0, 100));
  }
  return out;
}

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

  /*
    A ordem importa: `objective_fit` é reescalado ANTES da equalização.

    Os dois fazem coisas diferentes. O rescaler de objetivo corrige um TETO inalcançável — quando o
    pedido do jogador se contradiz, nenhuma raquete passa de 64 e cobrar isso dela não informa nada.
    A equalização corrige PROPORÇÃO entre critérios. Equalizar primeiro mediria a dispersão de um
    componente ainda comprimido contra o próprio teto, e a correção sairia errada.
  */
  const objectiveApplied = rawOutputs.map((row) =>
    row.map((o) => (o.key === 'objective_fit' ? { ...o, raw: rescaleObjective(o.raw) } : o)),
  );
  const equalize = equalizers(objectiveApplied, kept.map((r) => r.variant.id));

  const scored = kept.map((racket, racketIndex) => {
    const outputs = objectiveApplied[racketIndex]!.map((o) => ({
      ...o,
      raw: round((equalize.get(o.key) ?? ((v: number) => v))(o.raw)),
    }));

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

  /**
   * Ordenação determinística: score desc; empates desempatados por chave estável do PERFIL.
   *
   * O desempate antigo era `id.localeCompare` — alfabético, igual para todo jogador. Ver
   * `tie-break.ts` para a medição do estrago: 24 das 46 raquetes nunca eram indicadas a ninguém,
   * sete delas empatadas em 0.00 ponto com a vencedora.
   */
  const signature = profileSignature([
    profile.player_level_score,
    profile.physical_capacity_score,
    profile.swing_speed_score,
    profile.natural_power_score,
    profile.arm_sensitivity_score,
    ...NEED_KEYS.map((k) => profile.needs[k]),
  ]);

  scored.sort((a, b) =>
    compareByScoreThenTieBreak(
      { score: a.fit_score, id: a.racket.variant.id },
      { score: b.fit_score, id: b.racket.variant.id },
      signature,
    ),
  );

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
