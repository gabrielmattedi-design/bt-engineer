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
import {
  NEED_KEYS,
  NEED_LABEL_PT,
  NEED_TO_RACKET_ATTRIBUTE,
  type NeedKey,
  type PlayerProfile,
} from '@/domain/player-profile';
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
import { buildCatalogScale, type CatalogScale, type ScaleKey } from './catalog-scale';
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

/**
 * ═══ A TOLERÂNCIA POR POSIÇÃO ════════════════════════════════════════════════════════════════
 *
 * Quantas das raquetes COMPATÍVEIS COM O PERFIL, ordenadas por aquele atributo, contam como
 * "atendeu" cada posição do top-3 declarado.
 *
 * Proposta do usuário, e ela resolve um defeito das versões anteriores deste filtro: elas usavam
 * pisos ABSOLUTOS — posição 60 do catálogo, média do catálogo, não pior que a sua raquete atual —
 * e piso absoluto pode ser impossível de cumprir. Nas palavras dele: "se a raquete é a primeira
 * colocada em spin e o cliente pede spin em primeiro lugar, não tem como dar outra".
 *
 * Uma tolerância por POSIÇÃO nunca tem esse problema: as dez melhores sempre existem. E ela se
 * ajusta sozinha ao catálogo — se todas as raquetes adequadas ao jogador são fracas em potência, o
 * topo delas continua sendo a melhor resposta possível, sem o filtro desligar por não alcançar um
 * número absoluto.
 *
 * Medido em 660 perfis com prioridade declarada:
 *
 *     a vencedora de hoje já cumpre .......... 493 (74,7%)
 *     quando não cumpre, está fora por ....... 6,3 posições em média (mediana 4)
 *     custo de exigir ........................ mediana 4,9 pontos de match, p90 9,7
 *
 * Contra a regra absoluta que ela substitui, cuja mediana de custo era 23 pontos e cujo p90 era 35.
 *
 * A folga cresce com a posição declarada porque a convicção decresce: quem põe algo em 1º está
 * dizendo que é isso; quem põe em 3º está dizendo que também importa.
 */
const PRIORITY_TOLERANCE = [10, 15, 20];

/**
 * Encaixe mínimo para uma raquete ser considerada COMPATÍVEL com o perfil.
 *
 * ═══ A VÁLVULA, E POR QUE ELA É O QUE TORNA ISTO VIÁVEL ══════════════════════════════════════
 *
 * A alternativa testada antes foi subir o peso de `objective_fit` para 50%. Medida nas 22 personas,
 * ela produzia recomendação insegura de verdade:
 *
 *     p02   nível 82 -> 35    Wilson Clash 108 v3, quadro de 108 pol² para quem já passou disso
 *     p04   físico 100 -> 40  HEAD Radical Pro, massa acima do que o corpo sustenta
 *
 * Pedido declarado não pode sobrepor limitação física real. Aqui o pedido escolhe DENTRO do que é
 * compatível — nunca contra. É a diferença entre atender o cliente e obedecê-lo.
 *
 * ═══ POR QUE O PISO DE NÍVEL SUBIU DE 55 PARA 65 ═════════════════════════════════════════════
 *
 * Porque o papel dele mudou. Antes ele era só uma VÁLVULA — "existe alguma candidata segura?" —, e
 * para essa pergunta 55 bastava. Com a tolerância por posição ele virou o POOL de onde as dez
 * melhores são tiradas, e aí um piso permissivo deixa entrar quadros marginais que a tolerância
 * então promove.
 *
 * Medido nas 22 personas, variando só este número:
 *
 *     piso   match médio   match mín   nível mín   personas que trocam
 *      55       90,1          77          57              3
 *      65       90,5          79          67              2
 *      70       90,8          79          69              1
 *
 * Com 55, a p14 saía de nível 78 para 57 — raspando o próprio piso. 70 melhora mais um pouco a
 * qualidade, mas esvazia o campo da tolerância (719 checagens sem candidatas suficientes contra
 * 608 em 65), e uma regra que não age não protege ninguém. 65 mantém a tolerância ativa e devolve
 * o nível mínimo ao patamar de antes.
 */
export const FLOOR_SAFE_PHYSICAL = 70;
export const FLOOR_SAFE_SKILL = 65;

/**
 * Mínimo de sobreviventes para a tolerância valer.
 *
 * O pódio tem três posições e a regra de diversidade de família (§29) precisa de folga acima disso.
 * Abaixo de seis o filtro estaria escolhendo o pódio inteiro, que é mais do que ele se propõe.
 */
const TOLERANCE_MIN_SURVIVORS = 6;

/**
 * A premissa exige MENOS sobreviventes que a tolerância, e a diferença é deliberada.
 *
 * As duas regras não valem o mesmo. A tolerância é uma preferência forte — "fique entre as dez
 * melhores nisso" —, e uma preferência não justifica esvaziar o pódio. A premissa é uma PROMESSA:
 * quem pede potência não recebe potência abaixo da média. Aplicar a ela o mesmo mínimo de seis
 * fazia a promessa desligar exatamente onde ela é mais necessária, que é quando as raquetes
 * adequadas ao jogador são poucas naquele eixo.
 *
 * Medido nas 22 personas, variando só este número: com 6 a p14 fica em 57 contra 60 da média;
 * com 2 ela cumpre, e o match médio das personas cai 0,1 ponto (88,7 -> 88,6), com o mínimo
 * intacto em 79.
 *
 * Dois é o menor número que preserva o produto inteiro: a vencedora mais uma alternativa real —
 * que é o que `top3_offer_available` exige para o upsell existir (§30). Com um, o pódio viraria
 * uma raquete só e a oferta sumiria; e medido, um não recupera nenhum caso a mais que dois.
 */
const PREMISE_MIN_SURVIVORS = 2;

type ScoredEntry = { racket: ScoredRacket; fit_score: number; breakdown: ScoreBreakdown };

/**
 * Mínimo de sobreviventes para o teto de peso valer.
 *
 * Mesmo número da tolerância, e pela mesma razão: abaixo de seis o teto estaria escolhendo o pódio
 * inteiro. Na prática ele quase nunca é acionado — o teto mais restritivo que a fórmula produz
 * (270 g, para o menor corpo que o questionário aceita) ainda deixa 15 quadros de pé no catálogo
 * de 47. A válvula existe para o dia em que o catálogo mudar de forma, não para o caso comum.
 */
const CEILING_MIN_SURVIVORS = 6;

/**
 * Tira do ranking os quadros acima do teto de peso do jogador — §4.4.
 *
 * ═══ POR QUE AQUI, E NÃO JUNTO DOS FILTROS DUROS ═════════════════════════════════════════════
 *
 * Foi tentado antes de pontuar, que é onde os outros limites moram, e o resultado estava errado de
 * um jeito que só apareceu ao medir perfil por perfil. A atleta de 30 anos e 68 kg tem teto de
 * 303 g e recebia um quadro de 285 g — mais leve do que a de 54 kg, cujo teto é 289.
 *
 * A causa é que quase tudo que o motor calcula é RELATIVO ao conjunto: `catalogReference`,
 * `objectiveRescaler`, `equalizers` e `componentMeans` saem de `kept`. Encolher `kept` não remove
 * candidatas — ele reescreve o significado de todas as notas que sobram. Com o pool cortado em
 * 303 g, um quadro de 285 g deixava de ser leve e passava a ser "o mais pesado disponível", e a
 * pontuação o tratava como tal.
 *
 * Aplicado DEPOIS, sobre `scored`, nada disso se move: cada raquete conserva a nota que teria no
 * catálogo inteiro, e o teto só decide quais dessas notas seguem para o ranking. É o mesmo
 * mecanismo do piso de demanda declarada, pelo mesmo motivo, e a ordem entre os dois importa —
 * ver a chamada em `rankRackets`.
 *
 * ═══ E POR QUE NÃO UMA PENALIZAÇÃO GRADUADA ══════════════════════════════════════════════════
 *
 * Porque penalização é negociável e isto não é. Uma penalização de peso deixa um quadro acima do
 * teto vencer desde que ganhe o suficiente nos outros seis componentes — que foi exatamente o que
 * aconteceu no caso que originou a regra: os dois quadros de 300 g que sobraram para o menino de
 * 12 anos marcavam 77 e 84 em encaixe físico, notas boas, e venciam com folga. Nenhum coeficiente
 * de penalização resolve isso sem quebrar o resto do ranking; o que faltava era um NÃO.
 *
 * A raquete ATUAL é isenta, como no piso de demanda: ela é referência do relatório, não candidata.
 * Se a pessoa já joga com um quadro acima do teto, sumir com ele da análise seria esconder dela
 * justamente a comparação que explica o teto.
 *
 * Devolve `null` quando não há teto, quando nada é excluído, ou quando sobrariam candidatas de
 * menos para montar um pódio.
 */
function applyWeightCeiling(
  scored: readonly ScoredEntry[],
  profile: PlayerProfile,
  currentRacket: ScoredRacket | null,
): { kept: ScoredEntry[]; excluded: ExcludedRacket[] } | null {
  const teto = profile.frame_weight_ceiling_g;
  if (teto === null) return null;

  /** Sem peso publicado a raquete passa: o filtro pune o dado que falta, não a raquete. */
  const peso = (e: ScoredEntry): number | null => e.racket.variant.specs.unstrung_weight_g;

  const dentro = (e: ScoredEntry): boolean => {
    const g = peso(e);
    return g === null || g <= teto || e.racket.variant.id === currentRacket?.variant.id;
  };

  const kept = scored.filter(dentro);
  if (kept.length === scored.length) return null; // o teto não restringiu nada
  if (kept.length < CEILING_MIN_SURVIVORS) return null;

  const excluded: ExcludedRacket[] = scored
    .filter((e) => !dentro(e))
    .map((e) => ({
      variant_id: e.racket.variant.id,
      product_name: e.racket.variant.product_name,
      filter: 'static_weight_ceiling',
      /*
        O motivo NÃO diz qual termo da fórmula travou.

        Porte, idade e sexo entram todos no mesmo número, e qual deles é o que aperta muda de perfil
        para perfil — no menino de 12 anos com 52 kg é o porte (293 g) e não a idade (300 g), o
        contrário do que a intuição diria. Uma frase que apontasse a causa acertaria em uns casos e
        mentiria em outros, e a exclusão fica registrada na auditoria do admin: um motivo errado ali
        é pior do que um motivo genérico.
      */
      reason:
        `Quadro de ${peso(e)} g, acima do limite de ${teto} g que esta análise calcula para o seu ` +
        'perfil físico. Acima desse peso a raquete cansa antes do fim do jogo, e o que ela ganha ' +
        'em estabilidade você perde em preparação de golpe.',
    }));

  return { kept, excluded };
}

/**
 * Tira do ranking as raquetes que não atendem o piso do que o jogador declarou querer.
 *
 * ─── O QUE ISTO CONSERTA ─────────────────────────────────────────────────────────────────────
 *
 * Relato do usuário, com o relatório na mão: "ordenei potência como prioridade 1, disse que quero
 * atacar mais, e a recomendada veio tendo potência como o pior atributo dela — parece que não
 * respeitou meu desejo". Nada estava quebrado. O `objective_fit` mede DIREÇÃO (saiu da referência
 * para o lado certo?) e a P6 penaliza contradição, também relativa à referência. Nenhum dos dois
 * olhava a posição ABSOLUTA no eixo pedido, então uma raquete um pouco mais potente que a atual
 * passava limpa pelos dois estando no terço de baixo do catálogo em potência.
 *
 * ─── POR QUE EXCLUSÃO, DEPOIS DE DUAS TENTATIVAS PIORES ──────────────────────────────────────
 *
 * 1. Subir `objective_fit` para 50%. Medido: recomendação insegura (ver `FLOOR_SAFE_PHYSICAL`).
 *
 * 2. Uma penalização (P9) por posição baixa no eixo pedido. Medida na mesma varredura de 770
 *    perfis, satura em +3,5 pontos de posição por mais que se aumente o coeficiente, e para
 *    chegar lá derruba a fração de perfis com match >= 80% de 79,9% para ~62%. Ela desconta de
 *    todo mundo em vez de escolher melhor: as raquetes acima do corte perdem nos outros
 *    componentes por margem maior do que qualquer desconto razoável recupera.
 *
 * 3. Reordenar o ranking, promovendo ao topo quem passa do corte. Quebra o significado do próprio
 *    ranking: `buildCurrentStanding` calcula `gap = primeira − atual` e conclui pelo sinal, então
 *    com ordem não-monotônica o relatório diz "a raquete que você já tem é a melhor opção" na
 *    mesma página em que recomenda outra. O "12º entre as 47" também deixa de significar o que diz.
 *
 * A exclusão dá a mesma escolha que a reordenação daria — a melhor entre as que atendem o pedido —
 * sem tocar em nenhuma das duas propriedades: o ranking continua monotônico por fit e cada posição
 * continua sendo posição. É também o mecanismo que o motor já usa para "esta raquete não entra na
 * sua análise", com `reason` legível na auditoria, igual aos filtros duros.
 *
 * ─── A RAQUETE ATUAL É ISENTA ────────────────────────────────────────────────────────────────
 *
 * Ela não é candidata: é referência. Excluí-la faria o bloco "sua raquete atual nesta análise"
 * sumir sem explicação justamente para quem tem uma raquete pouco alinhada ao que pediu — que é
 * quem mais precisa ler aquilo. E como ela permanece no ranking pelo próprio fit, continua podendo
 * vencer: quando vence, a resposta honesta é "fique com a sua", não uma troca.
 *
 * Devolve `null` quando o piso não se aplica — sem pedido forte, sem sobrevivente seguro, ou
 * sobreviventes de menos para um pódio.
 */
function applyDeclaredFloor(
  scored: readonly ScoredEntry[],
  profile: PlayerProfile,
  scale: CatalogScale,
  currentRacket: ScoredRacket | null,
): { kept: ScoredEntry[]; excluded: ExcludedRacket[] } | null {
  const prioridades = profile.declared_priorities.slice(0, PRIORITY_TOLERANCE.length);
  if (prioridades.length === 0) return null;

  const componentRaw = (b: ScoreBreakdown, key: ComponentKey): number =>
    b.components.find((c) => c.key === key)?.raw ?? 0;

  const valorDe = (entry: ScoredEntry, need: NeedKey): number => {
    const attrKey = NEED_TO_RACKET_ATTRIBUTE[need] as ScaleKey;
    const attributes = entry.racket.attributes;
    return attributes[attrKey as keyof typeof attributes] as number;
  };

  /** Compatíveis com o perfil: é entre ELAS que a tolerância conta posições. */
  const compativeis = scored.filter(
    (e) =>
      componentRaw(e.breakdown, 'physical_fit') >= FLOOR_SAFE_PHYSICAL &&
      componentRaw(e.breakdown, 'skill_fit') >= FLOOR_SAFE_SKILL,
  );
  if (compativeis.length === 0) return null;

  /**
   * As restrições entram UMA A UMA, da mais forte para a mais fraca, e só se o que sobra continuar
   * viável.
   *
   * Exigir tudo de uma vez é conjuntivo, e conjunção colapsa: basta a última não ter campo para a
   * regra inteira desligar e nem a primeira ficar protegida. Medido numa versão anterior deste
   * filtro, o efeito era recusar alternativas que custavam 0,1 ponto de match.
   */
  type Restricao = {
    readonly need: NeedKey;
    readonly permitidas: Set<string>;
    /** O motivo cita ONDE a raquete ficou, e cada restrição mede isso na régua dela. */
    readonly motivo: (entry: ScoredEntry) => string;
  };

  const aplicadas: Restricao[] = [];
  let restante: readonly ScoredEntry[] = scored;

  /** A raquete ATUAL é isenta: ela é referência no relatório, não candidata. */
  const tentar = (restricao: Restricao, minimo: number): void => {
    const proximo = restante.filter(
      (e) =>
        restricao.permitidas.has(e.racket.variant.id) ||
        e.racket.variant.id === currentRacket?.variant.id,
    );
    if (proximo.length < minimo) return;

    restante = proximo;
    aplicadas.push(restricao);
  };

  /**
   * ═══ A PREMISSA, E POR QUE ELA VEM ANTES DA TOLERÂNCIA ═════════════════════════════════
   *
   * Exigência do usuário, nas palavras dele: "não posso pedir potência, e o sistema não só tirar
   * potência comparado à minha atual, mas também me entregar potência abaixo da média".
   *
   * A tolerância por posição SOZINHA não garante isso, e a medição mostrou por quê: ela é
   * RELATIVA — pede que a raquete esteja entre as dez melhores DO POOL COMPATÍVEL com o jogador.
   * Se o pool inteiro é fraco no eixo pedido, o topo dele continua abaixo da média do catálogo.
   *
   * Medido nas 22 personas, com potência forçada em 1º lugar em todas:
   *
   *                                    só tolerância    + premissa
   *     abaixo da média em potência        4/22            4/22
   *     exatamente EM CIMA da média        6/22            1/22
   *
   * O número que salta é o segundo. Sem a premissa, seis perfis diferentes caíam EXATAMENTE na
   * média — todos na mesma raquete, um frame equilibrado que não é bom em nada em particular.
   * É o retrato do defeito: pedir potência e receber a média. Com a premissa esses seis sobem.
   *
   * Nas personas como elas de fato respondem, a conta é 1 abaixo da média antes e ZERO depois, ao
   * custo de 0,1 ponto de match médio (88,7 -> 88,6) e nenhum ponto no match mínimo.
   *
   * E variar a folga da tolerância não mexe nisso: top 8, 10, 12, e só a 1ª prioridade dão todos
   * entre 3 e 4 de 22. A tolerância não é a alavanca deste problema — o piso absoluto é.
   *
   * ─── POR QUE SÓ NO EIXO DECLARADO EM 1º ────────────────────────────────────────────────
   *
   * Porque potência, controle e spin se opõem dentro da física do quadro. Exigir a média do
   * catálogo nos três empurra a escolha para o meio de tudo, que é o defeito oposto e igualmente
   * ruim: a raquete deixa de ser boa naquilo que a pessoa pôs em primeiro lugar. A 1ª posição é
   * onde a convicção está, e é ela que recebe a garantia forte.
   *
   * ─── E POR QUE ELA PODE NÃO AGIR ──────────────────────────────────────────────────────
   *
   * Se nenhuma candidata compatível com o físico e o nível do jogador chega à média do catálogo
   * naquele eixo, a regra não age — e é correto que não aja. Promover uma raquete que o corpo não
   * sustenta para cumprir um número seria o dano já medido ao subir `objective_fit` para 50%.
   * Nesses casos o bloco "As trocas desta escolha" explica o vão, que é o trabalho dele.
   *
   * Os 4 de 22 que sobram acima são exatamente esses, e foi verificado que são irredutíveis:
   * baixando o mínimo de sobreviventes até 1 — o limite teórico — continuam 4. Não é a regra sendo
   * tímida, é o catálogo não tendo, para aqueles jogadores, nenhuma raquete segura acima da média.
   */
  const primeira = prioridades[0]!;
  const attrPrimeira = NEED_TO_RACKET_ATTRIBUTE[primeira] as ScaleKey;
  const mediaDoCatalogo = scale.meanPosition(attrPrimeira);
  const posicaoNoCatalogo = (entry: ScoredEntry, need: NeedKey): number =>
    scale.position(NEED_TO_RACKET_ATTRIBUTE[need] as ScaleKey, valorDe(entry, need));

  const naMedia = compativeis.filter(
    (e) => posicaoNoCatalogo(e, primeira) >= mediaDoCatalogo,
  );
  if (naMedia.length > 0) {
    tentar({
      need: primeira,
      permitidas: new Set(naMedia.map((e) => e.racket.variant.id)),
      motivo: (entry) =>
        `Você colocou ${NEED_LABEL_PT[primeira]} em primeiro lugar, e esta raquete entrega menos ` +
        `que a raquete média do mercado que analisamos nesse aspecto ` +
        `(${Math.round(posicaoNoCatalogo(entry, primeira))} de 100, contra ` +
        `${Math.round(mediaDoCatalogo)}).`,
    }, PREMISE_MIN_SURVIVORS);
  }

  for (const [posicao, need] of prioridades.entries()) {
    const n = PRIORITY_TOLERANCE[posicao]!;
    if (compativeis.length < n) continue; // sem campo: a tolerância não restringe nada

    const ordenadas = [...compativeis].sort((a, b) => valorDe(b, need) - valorDe(a, need));
    const topo = ordenadas.slice(0, n);

    tentar({
      need,
      permitidas: new Set(topo.map((e) => e.racket.variant.id)),
      motivo: (entry) => {
        const posicaoDela =
          ordenadas.findIndex((e) => e.racket.variant.id === entry.racket.variant.id) + 1;
        return (
          `Você colocou ${NEED_LABEL_PT[need]} entre o que mais quer, e entre as raquetes ` +
          `adequadas ao seu perfil esta não está nas ${n} melhores nesse aspecto` +
          (posicaoDela > 0 ? ` (está em ${posicaoDela}º).` : '.')
        );
      },
    }, TOLERANCE_MIN_SURVIVORS);
  }

  if (aplicadas.length === 0) return null;

  const kept: ScoredEntry[] = [];
  const excluded: ExcludedRacket[] = [];
  for (const entry of scored) {
    const id = entry.racket.variant.id;
    if (id === currentRacket?.variant.id) {
      kept.push(entry);
      continue;
    }

    const falhou = aplicadas.find((a) => !a.permitidas.has(id));
    if (!falhou) {
      kept.push(entry);
      continue;
    }

    excluded.push({
      variant_id: id,
      product_name: entry.racket.variant.product_name,
      filter: 'declared_priority_tolerance',
      reason: falhou.motivo(entry),
    });
  }

  return { kept, excluded };
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
  /**
   * Média de cada componente sobre TUDO que foi pontuado — antes do piso de demanda excluir nada.
   *
   * É a série "Média do catálogo" dos eixos de encaixe do radar, e ela precisa vir daqui porque
   * não pode ser recalculada a partir de `ranking`: o piso remove raquetes de um lado só, e a
   * média do que sobra desloca. Medido em 2560 eixos, a média calculada sobre o ranking filtrado
   * desviava 12,6 pontos da real, com casos de 40 — `physical_fit` aparecendo como 87 quando o
   * catálogo entrega 47 para aquele jogador.
   *
   * O viés é sistemático e tem direção: o piso tira as raquetes fracas no eixo pedido, que tendem
   * a ser as mais pesadas, então quem sobra é mais leve e a média de encaixe físico sobe. O efeito
   * na tela é o inverso do que se imagina — a linha de comparação infla e a recomendada parece
   * MENOS especial do que é.
   */
  readonly componentMeans: Readonly<Record<ComponentKey, number>>;
  readonly excluded: readonly ExcludedRacket[];
  /**
   * Quantas raquetes foram PONTUADAS contra este perfil.
   *
   * Não é o tamanho do ranking. O piso de demanda declarada (ver `applyDeclaredFloor`) tira do
   * ranking raquetes que foram avaliadas — elas contam aqui e aparecem em `excluded` com o motivo.
   * Qualquer frase de POSIÇÃO ("ficou em 12º de N") precisa usar o tamanho do ranking, não este
   * número, senão o denominador não corresponde às posições que existem.
   */
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

  /**
   * O TETO DE PESO VEM ANTES DO PISO DE DEMANDA, e a ordem é a regra inteira.
   *
   * O piso de demanda escolhe as melhores no eixo que a pessoa pediu, DENTRO do que sobrou. Rodando
   * depois do teto, ele escolhe entre quadros que o corpo dela sustenta — que é o que "atender o
   * cliente sem obedecê-lo" significa aqui.
   *
   * Na ordem inversa o teto viraria enfeite. Foi o defeito exato do caso que originou a regra: o
   * menino de 12 anos declarou controle e precisão, o piso de demanda reduziu 47 raquetes a duas, e
   * as duas pesavam 300 g. Um teto aplicado depois disso teria que escolher entre esvaziar a
   * análise e desligar-se — e um limite que se desliga quando é acionado não é um limite.
   */
  const ceilingCut = applyWeightCeiling(scored, profile, options.currentRacket ?? null);
  const withinCeiling = ceilingCut === null ? scored : ceilingCut.kept;

  const floorCut = applyDeclaredFloor(withinCeiling, profile, scale, options.currentRacket ?? null);
  const finalists = floorCut === null ? withinCeiling : floorCut.kept;
  const allExcluded = [
    ...excluded,
    ...(ceilingCut?.excluded ?? []),
    ...(floorCut?.excluded ?? []),
  ];

  const limit = options.limit ?? finalists.length;
  const ranking: RankedRacket[] = finalists.slice(0, limit).map((entry, index) => {
    const previous = index > 0 ? finalists[index - 1] : undefined;
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

  /** Sobre `scored`, não sobre `finalists`: a média é do que foi avaliado, não do que sobrou. */
  const componentMeans = Object.fromEntries(
    (Object.keys(weights) as ComponentKey[]).map((key) => [
      key,
      scored.length === 0
        ? 50
        : round(
            scored.reduce(
              (sum, e) => sum + (e.breakdown.components.find((c) => c.key === key)?.raw ?? 50),
              0,
            ) / scored.length,
          ),
    ]),
  ) as Record<ComponentKey, number>;

  return {
    ranking,
    componentMeans,
    excluded: allExcluded,
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
 *
 * ═══ A DIVERSIDADE DE FAMÍLIA PARA NO PÓDIO, E NÃO SOBE PARA O 1º LUGAR ══════════════════════
 *
 * Isto é uma decisão, não um esquecimento, e ela foi tomada depois de medir. Varredura de 20.000
 * perfis (8.000 com respostas sorteadas de forma independente e 12.000 com respostas
 * correlacionadas como as de um jogador real):
 *
 *     raquetes que aparecem em 1º ........ 47 de 47
 *     nunca no pódio de nenhum perfil .... 0
 *     concentração em 1º ................. top1 7,0%  ·  top5 29,8%  ·  top10 45,5%
 *     por família ........................ Wilson Blade 21,9%  ·  as três primeiras somam 42,1%
 *     por marca .......................... Wilson 1,38× o share dela no catálogo
 *
 * O 1,38× da Wilson NÃO vem da composição do catálogo: na faixa modal (295–310 g, 97–100 pol²) as
 * marcas estão equilibradas — HEAD 8, Wilson 8, Babolat 7, Yonex 6 de 29. E a vitória é frágil:
 * proibir a família vencedora custa MEDIANA DE 1,11 PONTO de match, abaixo do próprio
 * `TECHNICAL_TIE_THRESHOLD` de 2,0. Em mais da metade dos perfis a melhor alternativa de outra
 * família está tecnicamente empatada com a que ganhou.
 *
 * ─── POR QUE MESMO ASSIM NÃO SE GIRA A FAMÍLIA NO TOPO ─────────────────────────────────────
 *
 * 1. Seria recomendar uma raquete que pontuou MENOS, por um motivo que o usuário não pediu. Ele
 *    paga pela melhor compatibilidade, não por equilíbrio de marcas. Empate técnico não é empate:
 *    a 1ª realmente pontuou mais, e o produto diz isso com todas as letras em `buildTieGroup`.
 *
 * 2. Quebraria a consistência do relatório, e o defeito é concreto. Hoje `podium[0]` é sempre
 *    `ranking[0]`, porque o primeiro do ranking nunca é filtrado pela diversidade. Promover outra
 *    família ao topo separaria os dois, e `buildCurrentStanding` calcula `gap = podium[0] − atual`
 *    exibindo `atual.rank` vindo do `full_ranking` — a pessoa leria "sua raquete ficou em 2º, a 1
 *    ponto da primeira" tendo pontuado MAIS que a recomendada. É a mesma armadilha já documentada
 *    em `applyDeclaredFloor`, item 3.
 *
 * 3. O que a concentração revela JÁ É DITO, e por um caminho honesto: `buildSeparation` conta
 *    quantas das 47 empataram tecnicamente com a 1ª e, quando são muitas, conclui que para aquele
 *    jogador o quadro importa pouco e o que importa é a corda e a tensão. Girar a marca escondendo
 *    isso trocaria uma informação verdadeira por uma aparência de variedade.
 *
 * Se um dia isto for revisitado, o caminho que não mente é atacar a CAUSA — pesos e réguas que
 * favorecem o perfil equilibrado 98–100 pol² / 300–305 g — e não o efeito.
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
