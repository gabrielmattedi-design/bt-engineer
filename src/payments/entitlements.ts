/**
 * Entitlements — §32.
 *
 * "Não confiar apenas em ocultar informações no frontend. A API não deve entregar dados premium
 * para usuário sem entitlement. Nunca mandar segundo e terceiro modelos escondidos apenas por CSS."
 *
 * A garantia aqui é estrutural: `serializeRecommendation` CONSTRÓI o payload a partir dos
 * entitlements. Ela não filtra um objeto completo — dados premium nunca chegam a existir na
 * resposta de quem não comprou.
 */

import type { PlayerProfile } from '@/domain/player-profile';
import type { RankedRacket, RecommendationResult } from '@/domain/recommendation';
import { currentRacketLabel } from '@/domain/racket';
import { clamp, clamp01 } from '@/domain/scores';
import { CONFIDENCE_LABEL_PT } from '@/recommendation/confidence';
import { RECOMMENDATION_ENGINE_VERSION } from '@/recommendation/config/version';
import { buildTradeOffs, type TradeOff } from './trade-offs';
import { buildRadar, type RadarAxis } from './radar';
import {
  buildDistinction,
  buildSeparation,
  buildTieGroup,
  type PodiumDistinction,
  type PodiumSeparation,
  type PodiumTieGroup,
} from './podium-tie';
import { buildPlayerIdentity, type PlayerIdentity } from './player-identity';
import {
  explainComfort,
  explainCombination,
  explainExpectations,
  explainHeadline,
  explainRacketFit,
  explainString,
  explainTension,
  explainTransition,
} from '@/recommendation/explain/deterministic';

/**
 * ─── DESBLOQUEIO POR POSIÇÃO ─────────────────────────────────────────────────────────────────
 *
 * `rank2_access` e `rank3_access` substituem o antigo `top3_access` porque as posições passaram a
 * ser vendidas separadamente: quem só tem curiosidade sobre a 2ª não precisa pagar pela 3ª.
 *
 * `top3_access` PERMANECE e concede as duas. Ele existe em entitlements já concedidos, gravados no
 * banco de quem comprou antes — remover o nome faria esses relatórios perderem acesso a algo que
 * foi pago. Um entitlement é uma promessa cumprida; ela não expira porque o catálogo de produtos
 * mudou de forma.
 */
export type Entitlement =
  | 'racket_report_access'
  | 'full_setup_access'
  | 'rank2_access'
  | 'rank3_access'
  | 'top3_access';

export const ALL_ENTITLEMENTS: readonly Entitlement[] = [
  'racket_report_access',
  'full_setup_access',
  'rank2_access',
  'rank3_access',
  'top3_access',
];

/** Produtos e o que cada um concede (§25, §26, §30). Os PREÇOS vivem no banco (§34). */
export const PRODUCT_ENTITLEMENTS: Readonly<Record<string, readonly Entitlement[]>> = {
  racket_report: ['racket_report_access'],
  full_setup: ['racket_report_access', 'full_setup_access', 'rank2_access', 'rank3_access'],
  unlock_rank_2: ['rank2_access'],
  unlock_rank_3: ['rank3_access'],
  /** Upgrade para quem já tem o relatório da raquete e quer corda e tensão. */
  setup_upgrade: ['full_setup_access'],
  /** Produto legado: uma compra só que abria as duas posições. */
  top3_unlock: ['top3_access'],
};

/** A posição está liberada? Aceita tanto o entitlement específico quanto o legado. */
export function canSeeRank(granted: readonly Entitlement[], rank: number): boolean {
  if (rank <= 1) return true;
  if (hasEntitlement(granted, 'top3_access')) return true;
  if (rank === 2) return hasEntitlement(granted, 'rank2_access');
  if (rank === 3) return hasEntitlement(granted, 'rank3_access');
  return false;
}

export function hasEntitlement(
  granted: readonly Entitlement[],
  required: Entitlement,
): boolean {
  return granted.includes(required);
}

/** Lança se o entitlement não estiver presente. Usado nos handlers antes de qualquer serialização. */
export function assertEntitlement(
  granted: readonly Entitlement[],
  required: Entitlement,
): void {
  if (!hasEntitlement(granted, required)) {
    throw new EntitlementError(required);
  }
}

export class EntitlementError extends Error {
  constructor(public readonly required: Entitlement) {
    super(`Acesso não liberado: ${required}`);
    this.name = 'EntitlementError';
  }
}

// ── Formas públicas ────────────────────────────────────────────────────────────────────────────

/** O que QUALQUER pessoa vê antes de pagar (§27). Zero identificação de produto. */
export type TeaserPayload = {
  readonly kind: 'teaser';
  readonly candidates_evaluated: number;
  readonly string_variants_evaluated: number;
  readonly matches_found: number;
  readonly confidence_level: string;
  readonly analysis_steps: readonly string[];
  readonly engine_version: string;
  readonly dataset_version: string;
};

/** Colocado bloqueado: score e posicionamento, SEM marca, modelo, foto ou specs. */
export type LockedPodiumEntry = {
  readonly rank: number;
  readonly fit_score: number;
  readonly teaser: string;
  /**
   * Aviso de qualidade quando a opção é materialmente mais fraca que a 1ª. `null` quando as duas
   * são comparáveis.
   *
   * É o que sobrou — na forma certa — da regra do §30 que impedia opções fracas de ocuparem o
   * pódio. Aquele corte protegia escondendo, e escondendo protegia demais: o usuário não sabia
   * sequer que existia uma 2ª opção avaliada. Este aviso protege dizendo, ANTES do pagamento, que
   * a diferença é grande. Quem compra mesmo assim está fazendo uma escolha informada; quem não
   * compra economizou por saber, não por não ter sido perguntado.
   */
  readonly quality_note: string | null;
  readonly locked: true;
};

export type UnlockedPodiumEntry = {
  readonly rank: number;
  readonly fit_score: number;
  readonly locked: false;
  /**
   * Id da variante. Só existe na entrada DESBLOQUEADA — na bloqueada ele identificaria o produto
   * tão bem quanto o nome, e a lista fechada de chaves daquele tipo garante que não vaze.
   */
  readonly variant_id: string;
  readonly brand: string;
  readonly product_name: string;
  readonly image_url: string | null;
  readonly technical_tie_with_previous: boolean;
  /**
   * O que separa esta opção das outras EMPATADAS — `null` quando ela não está num empate.
   *
   * Ver `podium-tie.ts`: três cards marcando o mesmo número e sem nada escrito é o que fazia o
   * relatório parecer indeciso. A diferenciação vem do motivo, não de uma casa decimal.
   */
  readonly distinction: PodiumDistinction | null;
  readonly specs: Readonly<Record<string, number | string | null>>;
  readonly indices: Readonly<Record<string, number>>;
  readonly tags: readonly string[];
  readonly why: readonly string[];
  readonly expectations: readonly string[];
  /**
   * Trocas explicadas, não uma lista de defeitos. Ver `trade-offs.ts` para o raciocínio.
   * Só o 1º colocado recebe: para os outros seria comparar contra uma escolha que não foi feita.
   */
  readonly attention: readonly TradeOff[];
};

export type PodiumEntry = LockedPodiumEntry | UnlockedPodiumEntry;

export type SetupPayload = {
  readonly string_brand: string;
  readonly string_model: string;
  readonly string_type: string;
  readonly gauge_mm: number;
  readonly tension_lbs: number;
  readonly tension_kg: number;
  readonly tension_range_lbs: readonly [number, number];
  readonly mains_lbs: number | null;
  readonly crosses_lbs: number | null;
  readonly why_string: readonly string[];
  readonly why_tension: readonly string[];
  readonly why_combination: string;
  readonly comfort: readonly string[];
  readonly availability_warning: string | null;
};

export type ReportPayload = {
  readonly kind: 'report';
  readonly headline: string;
  readonly podium: readonly PodiumEntry[];
  /**
   * Presente só quando o topo do pódio empatou tecnicamente. Ver `podium-tie.ts`.
   *
   * Existe para responder à pergunta que três cards de "88%" levantam: se são iguais, por que esta
   * é a primeira? A resposta honesta é que não são "a melhor" e "as outras" — são equivalentes, e o
   * que as separa está escrito em cada card.
   */
  readonly podium_tie: PodiumTieGroup | null;
  /**
   * Quantas do catálogo inteiro empataram com a 1ª — e o que isso diz sobre o jogador.
   *
   * Ver `buildSeparation`. Existe para não deixar o usuário deduzir de um silêncio que "qualquer
   * uma serve": quando é esse o caso, o relatório diz que é, explica por que, e aponta para onde o
   * ajuste ainda rende.
   */
  readonly separation: PodiumSeparation | null;
  /**
   * Preenchido quando a análise gravada é de uma versão do motor anterior à que está no ar.
   *
   * ═══ POR QUE ISTO PRECISA APARECER ═══════════════════════════════════════════════════════
   *
   * Uma recomendação é calculada UMA vez, no momento em que o questionário é enviado, e o
   * resultado fica gravado. Abrir o link de novo não recalcula nada — o que é a decisão certa: um
   * relatório pago não pode mudar de conclusão sozinho entre duas leituras, e a versão gravada é o
   * que torna o resultado auditável depois.
   *
   * Só que a página é MONTADA a cada leitura. Ranking, pontuações e atributos vêm congelados do
   * banco, enquanto índices exibidos, radar e textos de empate são derivados aqui, pelo código que
   * estiver publicado. Depois de uma mudança de motor, um relatório antigo vira um híbrido: número
   * velho, apresentação nova. Ele não fica errado por isso, mas deixa de ser inteiramente o que o
   * rodapé diz que é.
   *
   * Então o relatório declara a diferença em vez de deixar o leitor descobrir por conta. Nada é
   * recalculado à revelia — a pessoa decide se quer refazer.
   */
  readonly analysis_outdated: {
    readonly stored: string;
    readonly current: string;
    readonly message: string;
  } | null;
  readonly transition: RecommendationResult['transition'];
  readonly confidence: {
    readonly level: string;
    readonly reasons: readonly { message: string; remedy: string | null }[];
  };
  readonly setup: SetupPayload | null;
  /** Para qual raquete do pódio o setup foi calculado. `null` = a 1ª colocada. */
  readonly setup_for_variant_id: string | null;
  readonly top3_offer_available: boolean;
  readonly comparison: readonly UnlockedPodiumEntry[] | null;
  readonly engine_version: string;
  readonly dataset_version: string;
  readonly indices_disclaimer: string;
  /**
   * Quatro leituras sobre os mesmos eixos: o que seu jogo pede, o que a recomendada entrega, o que
   * a sua atual entrega e a média do catálogo. Ver `radar.ts`.
   */
  readonly radar: readonly RadarAxis[];
  /** Nome e frase de identidade — alimentam o card compartilhável. */
  readonly identity: PlayerIdentity & { readonly playerName: string | null };
  /**
   * Onde a raquete que a pessoa JÁ TEM ficou — e se vale a pena trocar.
   *
   * `null` quando não há raquete atual reconhecida.
   */
  readonly current_racket_standing: CurrentRacketStanding | null;
};

export type CurrentRacketStanding = {
  readonly product_name: string;
  readonly rank: number;
  readonly fit_score: number;
  readonly gap_to_first: number;
  /** `keep` = trocar não se justifica; `marginal` = ganho pequeno; `upgrade` = ganho real. */
  readonly verdict: 'keep' | 'marginal' | 'upgrade';
  readonly message: string;
};

/**
 * Abaixo desta diferença de fit, trocar de raquete não se justifica.
 *
 * ═══ O PROBLEMA QUE ISTO RESOLVE ═════════════════════════════════════════════════════════════
 *
 * Reclamação do usuário, com um gráfico na mão: a linha do que o jogo pede estava praticamente
 * sobreposta à da raquete que ele já usa, e a recomendada aparecia mais longe. Medido no caso:
 *
 *     distância média ao que o jogo pede — ATUAL 6.5  |  RECOMENDADA 11.7
 *     fit — ATUAL 78.3 (7ª)  |  RECOMENDADA 81.2 (1ª)
 *
 * As duas coisas são verdadeiras ao mesmo tempo, e é isso que confunde. O radar mostra seis eixos
 * de COMPORTAMENTO DE BOLA; a decisão do motor é dominada por `physical_fit`, `skill_fit` e
 * `swing_fit`, que medem o encaixe com o CORPO e a TÉCNICA e não aparecem no gráfico. No caso
 * acima, `physical_fit` sozinho responde por +6.4 dos 2.9 pontos de vantagem — a raquete atual é
 * pesada demais para o jogador, e o radar não tem como mostrar isso.
 *
 * Só que nada disso justifica mandar alguém gastar mil reais por 2.9 pontos de um modelo. Um
 * consultor honesto, diante dessa diferença, diz para ficar com a raquete e mexer no setup — que é
 * a outra metade do que este produto vende.
 *
 * O limiar é o mesmo do empate técnico exibido no pódio: abaixo dele, as opções são alternativas
 * legítimas e não um upgrade.
 *
 * ═══ POR QUE O TEXTO DEIXOU DE DIZER "NÃO PAGA A TROCA" (v2.27.0) ════════════════════════════
 *
 * A frase anterior era `Uma diferença desse tamanho não paga a troca de um quadro`. O limiar está
 * certo e não mudou; o que mudou é que a FRASE afirmava mais do que o número sustenta, em três
 * pontos:
 *
 *   1. `gap` é a diferença entre dois `fit_score` AGREGADOS. Ele resume oito componentes num
 *      número só, e some justamente com a informação de ONDE a diferença está. Duas raquetes a 2
 *      pontos podem ser quase idênticas ou divergir forte num eixo e compensar no outro — e é o
 *      segundo caso que interessa a quem veio aqui incomodado com uma coisa específica.
 *
 *   2. Quem preenche este questionário com uma raquete na mão frequentemente está DESCONFORTÁVEL
 *      com ela — é o motivo de ter procurado a análise. Responder "fique com a sua" a quem disse
 *      que algo o incomoda ignora a pergunta que a pessoa fez. O gap agregado não sabe se o
 *      incômodo dela é exatamente o eixo em que a recomendada abre vantagem.
 *
 *   3. Nessa faixa, o que decide de fato não é medido por nenhum modelo: tato, tempo de adaptação
 *      a um quadro diferente, intimidade com uma marca. Afirmar o resultado financeiro de uma
 *      troca ("não paga") é uma conclusão que os dados não sustentam.
 *
 * O que NÃO mudou, e não pode mudar: o texto continua dizendo com todas as letras que o ganho
 * esperado é pequeno, continua oferecendo corda e tensão como o caminho de maior retorno, e
 * continua sem nenhuma urgência, escassez ou incentivo a comprar. A calibração é para PARAR DE
 * AFIRMAR DEMAIS — nos dois sentidos. Empurrar a troca aqui seria o mesmo defeito com o sinal
 * trocado, e §58 vale igual nas duas direções.
 */
const KEEP_CURRENT_GAP = 4;

/** Acima disto a troca tem ganho real; entre os dois, é escolha da pessoa. */
const REAL_UPGRADE_GAP = 9;

/**
 * Exportada para teste, pelo mesmo motivo de `recommendableVariants`.
 *
 * Os ramos desta função dependem de um empate no ARREDONDAMENTO entre a primeira e a atual — um
 * estado que nenhuma das 22 personas produz (medido: 0 delas cai em `gap === 0`). Um teste que
 * dependesse das personas para cobrir isso passaria vazio, que foi exatamente como o defeito do
 * "2º lugar é a melhor opção" chegou à produção.
 */
export function buildCurrentStanding(
  result: RecommendationResult,
  profile: PlayerProfile,
  first: RankedRacket,
): CurrentRacketStanding | null {
  const variantId = profile.current_racket?.variant_id;
  if (!variantId || profile.current_racket?.unrecognized) return null;

  const current = result.full_ranking.find((r) => r.racket.variant.id === variantId);
  if (!current) return null;

  const gap = Math.round(first.fit_score) - Math.round(current.fit_score);
  /**
   * O nome sai como a PESSOA declarou: modelo e peso, sem geração.
   *
   * `product_name` traria "Wilson Blade 98 16×19 v10 (2026)", e a pergunta nunca pediu a versão —
   * o questionário promete explicitamente que ela não é necessária. Ver `currentRacketLabel`.
   */
  const name = currentRacketLabel(current.racket.variant);

  /**
   * ═══ POR QUE O EMPATE ARREDONDADO NÃO PODE DIZER "É A MELHOR" (v2.29.0) ══════════════════════
   *
   * Defeito pego por leitura, com o relatório na tela:
   *
   *     Babolat Pure Drive · 300 g — 2º lugar, 88% de compatibilidade
   *     "A raquete que você já tem é A MELHOR OPÇÃO para o seu jogo entre as 8 deste ranking."
   *
   * O cabeçalho e o corpo do MESMO card se contradiziam. A causa é aritmética: `gap` é a diferença
   * entre dois `fit_score` já ARREDONDADOS, e a primeira tinha 88,45 contra 88,00 da atual. Os dois
   * viram 88, o gap dá 0, e o ramo de gap zero assumia que zero significa primeiro lugar.
   *
   * Não significa. Zero aqui quer dizer "empatadas no número que a gente exibe" — que é uma
   * informação boa, e diferente. A distinção importa porque o pódio, logo abaixo, diz com todas as
   * letras que a ordem entre as duas está correta e que a 1ª realmente pontuou mais. Um bloco
   * afirmando que a 2ª é a melhor, ao lado de outro dizendo que a 1ª pontuou mais, destrói a
   * confiança nos dois.
   */
  if (gap <= 0 && current.rank === 1) {
    return {
      product_name: name,
      rank: current.rank,
      fit_score: Math.round(current.fit_score),
      gap_to_first: 0,
      verdict: 'keep',
      message:
        `A raquete que você já tem é a melhor opção para o seu jogo entre as ` +
        `${result.full_ranking.length} deste ranking. Nenhuma troca de quadro te levaria adiante ` +
        `daqui — o que ainda dá para melhorar está na corda e na tensão.`,
    };
  }

  if (gap <= 0) {
    return {
      product_name: name,
      rank: current.rank,
      fit_score: Math.round(current.fit_score),
      gap_to_first: 0,
      verdict: 'keep',
      message:
        `Sua ${name} ficou em ${current.rank}º entre as ${result.full_ranking.length} deste ` +
        `ranking, com os mesmos ${Math.round(current.fit_score)}% de compatibilidade da primeira. ` +
        `A diferença entre as duas é menor que um ponto — menos do que separa duas unidades da ` +
        `mesma raquete saídas de fábrica. Não há ganho a buscar numa troca de quadro: o que ainda ` +
        `dá para melhorar está na corda e na tensão.`,
    };
  }

  if (gap < KEEP_CURRENT_GAP) {
    return {
      product_name: name,
      rank: current.rank,
      fit_score: Math.round(current.fit_score),
      gap_to_first: gap,
      verdict: 'keep',
      message:
        `Sua ${name} ficou em ${current.rank}º entre as ${result.full_ranking.length} deste ranking, ` +
        `a ${gap} ${gap === 1 ? 'ponto' : 'pontos'} da primeira. É uma diferença pequena, e nessa ` +
        `faixa o que decide deixa de ser o número: entram o tato de cada jogador, o tempo de ` +
        `adaptação a um quadro diferente e a intimidade com uma marca — coisas que nenhuma análise ` +
        `mede. Não espere um salto ao trocar. O caminho de maior retorno aqui é a corda e a tensão, ` +
        `que custam uma fração. Mas se o que te trouxe até aqui foi um incômodo específico, olhe os ` +
        `eixos abaixo: se a diferença estiver justamente nele, testar a recomendada faz sentido.`,
    };
  }

  if (gap < REAL_UPGRADE_GAP) {
    return {
      product_name: name,
      rank: current.rank,
      fit_score: Math.round(current.fit_score),
      gap_to_first: gap,
      verdict: 'marginal',
      message:
        `Sua ${name} ficou em ${current.rank}º, a ${gap} pontos da primeira. Aqui já existe ganho ` +
        `real, ainda que moderado — é o tipo de diferença que pode ser sentida em quadra, sobretudo ` +
        `nos eixos em que o vão é maior. Se você já pensava em trocar, esta é uma boa razão para ` +
        `experimentar a recomendada antes de decidir. Se prefere ir com calma, ajustar corda e ` +
        `tensão captura parte desse ganho sem trocar de quadro.`,
    };
  }

  return {
    product_name: name,
    rank: current.rank,
    fit_score: Math.round(current.fit_score),
    gap_to_first: gap,
    verdict: 'upgrade',
    message:
      `Sua ${name} ficou em ${current.rank}º, a ${gap} pontos da primeira. Aqui a diferença não é ` +
      `questão de gosto: a recomendada atende o seu perfil num nível que a sua atual não alcança, ` +
      `e a troca deve ser sentida em quadra. Se for para investir em uma coisa só, invista no ` +
      `quadro — e depois ajuste corda e tensão sobre ele.`,
  };
}

const INDICES_DISCLAIMER =
  'Índices Tennis Engineer (0–100). São métricas internas da nossa análise, não especificações do fabricante.';

function buildTags(ranked: RankedRacket): string[] {
  const a = ranked.racket.attributes;
  const tags: Array<[string, number]> = [
    ['CONTROLE', a.control_score],
    ['SPIN', a.spin_score],
    ['POTÊNCIA', a.power_score],
    ['ESTABILIDADE', a.stability_score],
    ['CONFORTO', a.comfort_score],
    ['MANOBRABILIDADE', a.maneuverability_score],
    ['PRECISÃO', a.precision_score],
  ];
  return tags
    .filter(([, score]) => score >= 60)
    .sort((x, y) => y[1] - x[1])
    .slice(0, 3)
    .map(([label]) => label);
}

/**
 * Piso da escala exibida. A raquete mais fraca do catálogo naquele eixo marca 50, a mais forte 100.
 *
 * ─── POR QUE NÃO 0 ───────────────────────────────────────────────────────────────────────────
 *
 * Nenhuma raquete de torneio tem "zero de potência" — a menos potente do catálogo ainda devolve
 * bola. Uma escala que começa no zero afirmaria uma ausência que não existe, e faria a metade de
 * baixo do catálogo parecer defeituosa quando ela é apenas mais controlada.
 *
 * O que a escala afirma é POSIÇÃO: 50 é o extremo inferior do que se pode comprar, 100 o superior.
 */
const DISPLAY_INDEX_FLOOR = 50;

/**
 * Índices exibidos, esticados na faixa REAL do catálogo.
 *
 * ─── O DEFEITO QUE ISTO CORRIGE ──────────────────────────────────────────────────────────────
 *
 * Os valores crus vinham comprimidos entre ~40 e ~55 — resultado de serem médias ponderadas de
 * especificações normalizadas, que regridem ao centro (ver `catalog-scale.ts`). Na tela, seis
 * barras quase idênticas em torno da metade não dizem nada: o relatório parecia afirmar que a
 * raquete é medíocre em tudo, quando estava dizendo que ela é média EM RELAÇÃO A UMA ESCALA
 * TEÓRICA que nenhum produto ocupa.
 *
 * Reposicionar contra a faixa que o catálogo realmente ocupa devolve a diferença que existe: a
 * raquete mais potente entre as avaliadas marca 100 em potência, e é isso que o usuário quer
 * saber ao comparar duas opções.
 *
 * O passo de 5 permanece — não sugerir precisão que o modelo não tem (R-04).
 */
function buildIndices(
  ranked: RankedRacket,
  bands: RecommendationResult['attribute_bands'],
): Record<string, number> {
  const a = ranked.racket.attributes;

  const stretch = (key: string, raw: number): number => {
    const band = bands[key];
    // Sem faixa (relatório antigo, gravado antes deste campo existir) o valor cru é o melhor
    // disponível — é preferível a inventar uma escala que não corresponde ao que foi vendido.
    if (!band || band[1] <= band[0]) return clamp(raw, DISPLAY_INDEX_FLOOR, 100);

    const position = (raw - band[0]) / (band[1] - band[0]);
    return DISPLAY_INDEX_FLOOR + clamp01(position) * (100 - DISPLAY_INDEX_FLOOR);
  };

  /**
   * O esticamento por eixo precisa ser renivelado — senão ele desfaz o orçamento.
   *
   * Os atributos crus já saem somando o mesmo total para toda raquete (ver `levelize` em
   * `racket-attributes.ts`). Só que aqui cada eixo é reposicionado contra a SUA faixa de catálogo,
   * e as faixas têm larguras diferentes: dez pontos crus num eixo estreito viram vinte e cinco na
   * tela, enquanto os mesmos dez pontos num eixo largo viram oito. O resultado media 405 a 465 de
   * soma exibida — o mesmo viés de nível voltando pela porta dos fundos.
   *
   * Renivelar aqui mantém a promessa onde ela é lida: na tabela e nas barras, toda raquete soma o
   * mesmo, e a diferença entre elas é inteiramente de DISTRIBUIÇÃO.
   */
  const leveled = levelizeDisplay([
    stretch('power_score', a.power_score),
    stretch('control_score', a.control_score),
    stretch('spin_score', a.spin_score),
    stretch('comfort_score', a.comfort_score),
    stretch('stability_score', a.stability_score),
    stretch('maneuverability_score', a.maneuverability_score),
  ]);

  return {
    potencia: leveled[0]!,
    controle: leveled[1]!,
    spin: leveled[2]!,
    conforto: leveled[3]!,
    estabilidade: leveled[4]!,
    manobrabilidade: leveled[5]!,
  };
}

/** Total exibido de toda raquete: seis eixos no ponto médio da escala 50–100. */
const DISPLAY_BUDGET = 6 * 75;

/** O passo de 5 permanece — não sugerir precisão que o modelo não tem (R-04). */
const DISPLAY_STEP = 5;

/**
 * Nivela os seis índices exibidos no orçamento e arredonda mantendo a soma exata.
 *
 * O arredondamento é por MAIOR RESTO, e não `Math.round` em cada eixo: arredondar um a um faz a
 * soma oscilar entre 445 e 455, e a promessa "toda raquete soma o mesmo" morre no arredondamento —
 * justamente onde o usuário pode conferir com a calculadora.
 */
function levelizeDisplay(values: readonly number[]): number[] {
  const out = [...values];

  for (let pass = 0; pass < out.length; pass += 1) {
    const deficit = DISPLAY_BUDGET - out.reduce((acc, v) => acc + v, 0);
    if (Math.abs(deficit) < 1e-9) break;

    const movable: number[] = [];
    for (let i = 0; i < out.length; i += 1) {
      if (deficit > 0 ? out[i]! < 100 : out[i]! > DISPLAY_INDEX_FLOOR) movable.push(i);
    }
    if (movable.length === 0) break;

    const step = deficit / movable.length;
    for (const i of movable) out[i] = clamp(out[i]! + step, DISPLAY_INDEX_FLOOR, 100);
  }

  // Maior resto sobre múltiplos de 5, respeitando piso e teto da escala.
  const units = out.map((v) => v / DISPLAY_STEP);
  const floors = units.map((u) => Math.floor(u));
  let remaining = Math.round(DISPLAY_BUDGET / DISPLAY_STEP) - floors.reduce((a, b) => a + b, 0);

  const order = units
    .map((u, i) => ({ i, frac: u - floors[i]! }))
    .sort((x, y) => y.frac - x.frac || x.i - y.i);

  const result = [...floors];
  for (const { i } of order) {
    if (remaining <= 0) break;
    if (result[i]! * DISPLAY_STEP >= 100) continue;
    result[i] = result[i]! + 1;
    remaining -= 1;
  }

  return result.map((u) => u * DISPLAY_STEP);
}

function unlockedEntry(
  ranked: RankedRacket,
  profile: PlayerProfile,
  bands: RecommendationResult['attribute_bands'],
  tradeOffs: readonly TradeOff[] = [],
  podium: readonly RankedRacket[] = [],
): UnlockedPodiumEntry {
  const specs = ranked.racket.variant.specs;
  return {
    rank: ranked.rank,
    fit_score: Math.round(ranked.fit_score),
    locked: false,
    variant_id: ranked.racket.variant.id,
    brand: ranked.racket.variant.brand,
    product_name: ranked.racket.variant.product_name,
    // §54: só exibimos foto confirmada como sendo desta variante e geração.
    image_url: ranked.racket.variant.image_verified ? ranked.racket.variant.image_url : null,
    technical_tie_with_previous: ranked.technical_tie_with_previous,
    distinction: buildDistinction(ranked, podium),
    specs: {
      cabeca_sq_in: specs.head_size_sq_in,
      peso_g: specs.unstrung_weight_g,
      balanco_mm: specs.balance_mm,
      // v2: apenas especificações publicadas pelo fabricante. `perfil_quadro_mm` é a string
      // oficial da viga ('23-26-23'); a rigidez aparece como índice derivado em `indices`.
      perfil_quadro_mm: specs.beam_width_mm,
      comprimento_in: specs.length_in,
      padrao: specs.string_pattern_mains && specs.string_pattern_crosses
        ? `${specs.string_pattern_mains}×${specs.string_pattern_crosses}`
        : null,
    },
    indices: buildIndices(ranked, bands),
    tags: buildTags(ranked),
    why: explainRacketFit(ranked, profile),
    /*
      Os eixos já explicados como TROCA não voltam em "o que você deve perceber".

      Repetir a mesma limitação em dois blocos vizinhos — num deles com o raciocínio e a
      alternativa, no outro como frase solta — é o que fazia a leitura parecer contraditória.
    */
    expectations: explainExpectations(
      ranked,
      profile,
      bands,
      tradeOffs.flatMap((t) => (t.axis ? [t.axis] : [])),
    ),
    attention: tradeOffs,
  };
}

/**
 * Distância de fit a partir da qual a diferença deixa de ser questão de preferência.
 *
 * Abaixo disso as duas opções são alternativas legítimas e a escolha entre elas é pessoal — dizer
 * "bem menos compatível" ali seria empurrar a pessoa para a 1ª por um dado que não sustenta isso.
 */
const MATERIAL_FIT_GAP = 6;

function qualityNote(ranked: RankedRacket, first: RankedRacket): string | null {
  /**
   * A diferença é medida sobre os valores ARREDONDADOS, os mesmos que aparecem na tela.
   *
   * Com os valores crus, um card mostrando 81% ao lado de outro de 87% podia não trazer o aviso
   * porque a distância real era 5,6 — e quem lê vê 6 pontos e um silêncio. A regra precisa
   * concordar com o número exibido, senão ela vira uma inconsistência visível.
   */
  const gap = Math.round(first.fit_score) - Math.round(ranked.fit_score);
  if (gap < MATERIAL_FIT_GAP) return null;
  return (
    `Compatibilidade ${Math.round(gap)} pontos abaixo da 1ª colocada. ` +
    'Continua sendo uma opção real, mas a diferença é grande — vale desbloquear só se você quiser ' +
    'entender o raciocínio ou comparar antes de comprar.'
  );
}

/** Frase de posicionamento do colocado bloqueado — informativa sem identificar o produto (§29). */
function teaserFor(ranked: RankedRacket, first: RankedRacket): string {
  const a = ranked.racket.attributes;
  const f = first.racket.attributes;
  const diffs: Array<[string, number]> = [
    ['um pouco mais de controle', a.control_score - f.control_score],
    ['mais potência e tolerância', a.power_score - f.power_score],
    ['mais spin', a.spin_score - f.spin_score],
    ['mais conforto', a.comfort_score - f.comfort_score],
    ['mais estabilidade', a.stability_score - f.stability_score],
    ['mais manobrabilidade', a.maneuverability_score - f.maneuverability_score],
  ];
  const best = diffs.sort((x, y) => y[1] - x[1])[0];
  if (!best || best[1] < 3) return 'Alternativa com equilíbrio semelhante, em outro frame.';
  return `Alternativa com ${best[0]}.`;
}

export function serializeTeaser(
  result: RecommendationResult,
  stringVariantsEvaluated: number,
): TeaserPayload {
  return {
    kind: 'teaser',
    candidates_evaluated: result.candidates_evaluated,
    string_variants_evaluated: stringVariantsEvaluated,
    matches_found: result.podium.length,
    confidence_level: CONFIDENCE_LABEL_PT[result.confidence.level],
    analysis_steps: [
      'Perfil físico analisado',
      'Nível técnico calibrado',
      'Swing analisado',
      'Estilo de jogo mapeado',
      'Equipamento atual comparado',
      'Objetivo interpretado',
    ],
    engine_version: result.engine_version,
    dataset_version: result.dataset_version,
  };
}

/**
 * Serializa o relatório POR ENTITLEMENT.
 *
 * Esta é a única função capaz de produzir o payload do resultado. Ela constrói cada colocado a
 * partir dos entitlements concedidos — sem `top3_access`, os colocados 2 e 3 são objetos
 * `{rank, fit_score, teaser, locked}` e não existe nenhum caminho que adicione marca ou modelo.
 */
export function serializeRecommendation(
  result: RecommendationResult,
  profile: PlayerProfile,
  granted: readonly Entitlement[],
): ReportPayload {
  assertEntitlement(granted, 'racket_report_access');

  const first = result.podium[0];
  if (!first) {
    throw new Error('Nenhuma raquete atingiu o mínimo de compatibilidade para o pódio.');
  }

  // Cada posição é avaliada isoladamente — 2ª e 3ª são compras independentes.
  const canSeeSetup = hasEntitlement(granted, 'full_setup_access');

  const podium: PodiumEntry[] = result.podium.map((entry, index) => {
    if (index === 0) {
      return unlockedEntry(
        entry,
        profile,
        result.attribute_bands,
        buildTradeOffs(
          entry,
          result.full_ranking,
          result.candidates_evaluated,
          /*
            O contexto só é passado quando a análise gravou a referência de objetivo.

            Ele habilita a explicação de PEDIDO NÃO ATENDIDO — o eixo que a pessoa pediu com força
            e que a raquete quase não moveu. Sem a referência, "quase não moveu" não é uma frase
            que se possa provar: seria preciso recalcular hoje o ponto de partida de uma análise de
            ontem, e a explicação passaria a descrever uma comparação que nunca foi feita.

            Relatórios antigos, então, seguem sem essa seção — que é o comportamento que eles
            sempre tiveram — em vez de ganhar uma justificativa fabricada.
          */
          result.objective_reference
            ? {
                profile,
                reference: result.objective_reference,
                bands: result.attribute_bands,
              }
            : undefined,
        ),
        result.podium,
      );
    }
    if (canSeeRank(granted, entry.rank)) {
      return unlockedEntry(entry, profile, result.attribute_bands, [], result.podium);
    }
    return {
      rank: entry.rank,
      fit_score: Math.round(entry.fit_score),
      teaser: teaserFor(entry, first),
      quality_note: qualityNote(entry, first),
      locked: true,
    };
  });

  let setup: SetupPayload | null = null;
  if (canSeeSetup && result.string_recommendation && result.tension) {
    const rec = result.string_recommendation;
    const t = result.tension;
    setup = {
      string_brand: rec.variant.model.brand,
      string_model: rec.variant.model.model,
      string_type: rec.variant.model.string_type,
      gauge_mm: rec.variant.variant.gauge_mm,
      tension_lbs: t.lbs,
      tension_kg: t.kg,
      tension_range_lbs: t.range_lbs,
      mains_lbs: t.mains_lbs,
      crosses_lbs: t.crosses_lbs,
      why_string: explainString(rec),
      why_tension: explainTension(t),
      why_combination: explainCombination(first, rec, t),
      comfort: explainComfort(first, profile, null),
      availability_warning: rec.variant.availability_warning,
    };
  }

  return {
    kind: 'report',
    headline: explainHeadline(first, result.podium[1]?.technical_tie_with_previous ?? false),
    podium,
    podium_tie: buildTieGroup(result.podium),
    separation: buildSeparation(result.full_ranking),
    analysis_outdated:
      result.engine_version === RECOMMENDATION_ENGINE_VERSION
        ? null
        : {
            stored: result.engine_version,
            current: RECOMMENDATION_ENGINE_VERSION,
            message:
              `Esta análise foi calculada com a versão ${result.engine_version} do motor, e a que ` +
              `está no ar hoje é a ${RECOMMENDATION_ENGINE_VERSION}. O resultado abaixo é o que ` +
              'foi calculado na época, e continua sendo exatamente o que você recebeu — não ' +
              'mexemos nele. Se quiser a leitura com os critérios atuais, refaça o questionário: ' +
              'isso gera uma análise nova, e este link continua acessível como está.',
          },
    transition: {
      ...result.transition,
      expectations: explainTransition(result.transition),
    },
    confidence: {
      level: CONFIDENCE_LABEL_PT[result.confidence.level],
      reasons: result.confidence.reasons.map((r) => ({
        message: r.message,
        remedy: r.remedy,
      })),
    },
    setup,
    setup_for_variant_id: result.setup_for_variant_id ?? first.racket.variant.id,
    top3_offer_available:
      result.top3_offer_available && result.podium.some((e) => !canSeeRank(granted, e.rank)),
    /**
     * A comparação lado a lado exige TODAS as posições liberadas.
     *
     * Ela contrasta as três entre si; montá-la com uma bloqueada produziria uma tabela com buraco,
     * que informa menos do que não existir — e revelaria por diferença o que a coluna oculta traz.
     */
    comparison: result.podium.every((e) => canSeeRank(granted, e.rank))
      ? result.podium.map((entry) =>
          unlockedEntry(entry, profile, result.attribute_bands, [], result.podium),
        )
      : null,
    engine_version: result.engine_version,
    dataset_version: result.dataset_version,
    indices_disclaimer: INDICES_DISCLAIMER,
    identity: { ...buildPlayerIdentity(profile), playerName: profile.player_name },
    current_racket_standing: buildCurrentStanding(result, profile, first),
    radar: buildRadar(
      profile,
      first,
      result.full_ranking,
      result.attribute_bands,
      result.attribute_means,
      result.component_means,
      // A raquete atual está no ranking quando foi reconhecida no catálogo e passou pelos filtros.
      result.full_ranking.find(
        (r) => r.racket.variant.id === profile.current_racket?.variant_id,
      ) ?? null,
    ),
  };
}
