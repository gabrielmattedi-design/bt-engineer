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
import { STRING_TYPE_PT } from '@/domain/string';
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
  /**
   * Upgrade para quem já tem o relatório da raquete e quer corda e tensão.
   *
   * ═══ POR QUE ELE TAMBÉM ABRE A 2ª E A 3ª ═════════════════════════════════════════════════
   *
   * Ele concedia só `full_setup_access`, e a conta não fechava para o cliente. Comparando os dois
   * caminhos até o mesmo conteúdo:
   *
   *     de uma vez     full_setup .................................. R$ 49,99  (tudo)
   *     em duas etapas racket_report + setup_upgrade ............... R$ 59,98  (sem a 2ª e a 3ª)
   *                    + unlock_rank_2 + unlock_rank_3 ............. R$ 79,96  (tudo)
   *
   * Quem decidiu em duas etapas pagava 20% a mais para receber MENOS, e precisava de mais R$ 19,98
   * para empatar — 60% acima do preço de quem comprou tudo junto. Cobrar pelo parcelamento da
   * decisão é legítimo; entregar menos por mais dinheiro não é, e o cliente descobre isso depois de
   * pagar, que é a pior hora.
   *
   * Com a 2ª e a 3ª incluídas, os dois caminhos chegam ao mesmo conteúdo e a diferença de R$ 9,99
   * fica sendo o que ela sempre deveria ter sido: o preço de decidir em duas vezes.
   *
   * ═══ A DIFERENÇA DE R$ 9,99 SOBREVIVEU À MUDANÇA DE PREÇO ════════════════════════════════
   *
   * Set/2026, a raquete avulsa subiu de R$ 19,99 para R$ 29,99 e o upgrade desceu de R$ 39,99 para
   * R$ 29,99. Os R$ 10 saíram de um e entraram no outro, então TODO caminho que passa pelos dois
   * custa exatamente o que custava: R$ 59,98 para o conteúdo do plano completo, R$ 79,96 para o
   * caminho mais fatiado de todos. O que subiu foi só quem para na raquete avulsa.
   *
   * A razão de descer o upgrade é que ele NÃO está visível na hora da primeira escolha — a pessoa
   * descobre que ele existe depois de já ter pago. Cobrar prêmio por uma decisão tomada sem essa
   * informação é punir alguém por algo que não lhe foi dito.
   */
  setup_upgrade: ['full_setup_access', 'rank2_access', 'rank3_access'],
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

/**
 * "Tá, mas e a raquete que eu já tenho?" — o setup calculado para o quadro ATUAL do jogador.
 *
 * ═══ A PERGUNTA QUE O RELATÓRIO NÃO RESPONDIA ════════════════════════════════════════════════
 *
 * O bloco da raquete atual dizia a posição dela no ranking e a distância para a primeira, e parava.
 * Para quem não vai trocar de quadro agora — a maioria, porque quadro custa caro — o produto
 * terminava numa constatação sem saída: "a sua ficou em 12º".
 *
 * Corda e tensão movem eixos de verdade, custam uma fração de um quadro e são reversíveis no
 * encordoamento seguinte. Deixar isso de fora era vender o diagnóstico e sonegar o remédio barato.
 *
 * ═══ O QUE ESTE BLOCO NÃO PODE FAZER ═════════════════════════════════════════════════════════
 *
 * Prometer que corda e tensão substituem o quadro certo. Não substituem, e o teto é menor — por
 * isso `ceiling_note` existe e é obrigatória, não opcional. Um bloco que só listasse os ganhos
 * seria um argumento de venda disfarçado de análise, e §58 vale nas duas direções: nem empurrar a
 * troca de quadro, nem fingir que ela é dispensável.
 */
export type CurrentRacketSetupPayload = {
  /** A raquete do jogador, como ELE a declarou — modelo e peso, sem geração. */
  readonly racket_name: string;
  readonly string_brand: string;
  readonly string_model: string;
  readonly string_type: string;
  readonly gauge_mm: number;
  readonly tension_lbs: number;
  readonly tension_kg: number;
  readonly tension_range_lbs: readonly [number, number];
  readonly why_string: readonly string[];
  readonly why_tension: readonly string[];
  /**
   * O que muda em relação ao que ele usa HOJE. Vazio quando ele não declarou corda nem tensão.
   *
   * É a parte mais útil do bloco e a única que depende de dado que pode faltar: sem saber o ponto
   * de partida, "suba 2 lbs" não é uma instrução, é um palpite.
   */
  readonly change_from_current: readonly string[];
  /** Até onde isto leva, e onde só o quadro leva. Sempre presente. */
  readonly ceiling_note: string;
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
  /**
   * O setup calculado para a raquete que a pessoa JÁ TEM. Exige `full_setup_access`.
   *
   * `null` quando o setup não foi comprado, quando não há raquete atual reconhecida, quando ela É a
   * recomendada (o setup principal já é o dela) ou quando a análise foi gravada antes deste campo
   * existir — relatórios antigos não ganham uma seção calculada hoje sobre números de ontem.
   */
  readonly current_racket_setup: CurrentRacketSetupPayload | null;
  /**
   * Por que o bloco acima não está aqui — ver `buildCurrentRacketSetupNote`.
   *
   * Existe porque a ausência dele é indistinguível de uma entrega quebrada: o produto anuncia essa
   * seção, e quem pagou precisa saber que, no caso dele, não havia o que calcular. `null` quando o
   * bloco está presente.
   */
  readonly current_racket_setup_note: string | null;
  /**
   * Por que a raquete mais pesada pode ser a mais fácil de girar. Ver `buildWeightReading`.
   *
   * `null` quando não há comparação concreta a fazer — a versão genérica da frase não informa nada.
   */
  readonly weight_reading: string | null;
  /**
   * Aviso de migração juvenil, para menores de 16 anos ainda pequenos para o catálogo adulto.
   *
   * Ver `buildJuniorTransitionNote`. `null` para todo o resto, que é a quase totalidade.
   */
  readonly junior_transition: string | null;
};

export type CurrentRacketStanding = {
  readonly product_name: string;
  readonly rank: number;
  readonly fit_score: number;
  readonly gap_to_first: number;
  /** `keep` = trocar não se justifica; `marginal` = ganho pequeno; `upgrade` = ganho real. */
  readonly verdict: 'keep' | 'marginal' | 'upgrade';
  readonly message: string;
  /**
   * Presente quando a raquete do jogador é IRMÃ DE LINHA de uma que está no pódio, e por isso foi
   * pulada na montagem dele.
   *
   * ═══ QUANDO ISTO EXISTE, A TELA NÃO MOSTRA POSIÇÃO NEM PERCENTUAL ══════════════════════════
   *
   * É a única exceção, e ela conserta uma contradição real: o relatório dizia "ficou em 2º com 80%"
   * e o pódio, na página seguinte, trazia outra raquete em 2º com 78%. São duas listas — o ranking
   * completo e o pódio, que renumera de 1 a 3 — e o mesmo número de posição significava coisas
   * diferentes nas duas.
   *
   * A troca não é esconder informação, é trocá-la por informação melhor. Percentual e posição
   * existem para responder "vale trocar?"; entre duas raquetes da MESMA linha, quem responde isso é
   * o que separa as duas, eixo a eixo — não um agregado que, por construção, tende a empatar: os
   * índices exibidos são nivelados para somar o mesmo em toda raquete, então duas variantes da
   * mesma família trocam pontos entre eixos e chegam ao mesmo total.
   *
   * `rank` e `fit_score` continuam preenchidos aqui — são o registro da análise e alimentam o
   * veredicto e a auditoria do admin. O que muda é a página não os exibir neste caso.
   */
  readonly family_match: {
    readonly family: string;
    readonly sibling_name: string;
    /** Posição dela NO PÓDIO (1 a 3), que é a lista em que ela de fato aparece. */
    readonly sibling_rank: number;
    /** Eixos em que a raquete do jogador entrega mais, já na escala exibida. */
    readonly your_edge: readonly string[];
    /** Eixos em que a irmã do pódio entrega mais. */
    readonly sibling_edge: readonly string[];
  } | null;
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
  const base = standingCore(result, profile, first);
  if (!base) return base;

  /**
   * ═══ "2º LUGAR" E O PÓDIO PRECISAM FALAR DA MESMA LISTA ══════════════════════════════════════
   *
   * Defeito grave, pego num relatório impresso: o bloco dizia "Sua Yonex EZONE 100 · 300 g ficou em
   * 2º entre as 8 deste ranking", e o pódio, duas páginas depois, trazia outra raquete em 2º com
   * 78%. A raquete do jogador não aparecia em lugar nenhum do pódio.
   *
   * Não havia confusão de nomes nem erro de conta. São DUAS listas, e o relatório usava a palavra
   * "posição" para as duas sem avisar:
   *
   *   `full_ranking` — a ordem pura por encaixe. É de onde sai o "2º".
   *   `podium`       — uma seleção de três, com no máximo uma raquete por linha de produto (§29),
   *                    RENUMERADA de 1 a 3. É o que a pessoa vê.
   *
   * Quando a 1ª colocada é da mesma linha que a raquete do jogador — EZONE 100L e EZONE 100 são
   * ambas `Yonex::EZONE` —, a dele é pulada na montagem do pódio. Ela continua em 2º no ranking, e
   * some da única lista que o relatório exibe.
   *
   * Medido em 1.034 combinações de persona × raquete atual: 10 caem exatamente nesse caso, e em
   * todas elas a 1ª colocada é da mesma família. É ~1% — raro o bastante para ter passado, comum o
   * bastante para chegar a um cliente, como chegou.
   *
   * A regra de diversidade não muda aqui: ela existe para o pódio não virar três variações do mesmo
   * quadro. O que muda é o relatório parar de esconder que ela agiu.
   */
  const atualId = profile.current_racket?.variant_id;
  const noPodio = result.podium.some((e) => e.racket.variant.id === atualId);
  if (noPodio) return base;

  /**
   * A raquete foi PULADA pela regra de família, ou só ficou abaixo do corte?
   *
   * A distinção importa: uma raquete em 7º não foi pulada, ficou atrás mesmo — e para ela a posição
   * e o percentual são a resposta certa, sem contradição nenhuma com o pódio. Modo família é só
   * para quem TERIA entrado se a regra não existisse.
   *
   * ─── POR QUE SIMULAR O LAÇO, E NÃO COMPARAR COM A ÚLTIMA DO PÓDIO ─────────────────────────
   *
   * A primeira versão perguntava "a sua está acima da pior colocada do pódio?". Parece equivalente
   * e não é, e o caso que derrubou foi este: p14 com a Wilson Blade 98 18×20 em 3º, num pódio de
   * DUAS raquetes — a 1ª é Blade, a 2ª é Pure Strike, e a 3ª colocada do ranking foi pulada por ser
   * Blade também. Ali a "pior do pódio" estava em 2º no ranking, então a comparação dizia que a de
   * 3º não tinha sido pulada. Tinha.
   *
   * Percorrer o ranking na mesma ordem que `selectPodium` percorre elimina a aproximação. A
   * pertinência ao pódio é lida do resultado real, então esta leitura não pode divergir dele — nem
   * mesmo quando a regra de família está desligada (`wantsWeightChange`), caso em que ninguém é
   * pulado e o laço simplesmente não encontra o caso.
   */
  const atual = result.full_ranking.find((r) => r.racket.variant.id === atualId);
  if (!atual) return base;

  const idsPodio = new Set(result.podium.map((e) => e.racket.variant.id));
  const linhasUsadas = new Set<string>();
  let adicionadas = 0;
  let foiPulada = false;

  for (const entry of result.full_ranking) {
    if (adicionadas >= 3) break;
    const linha = `${entry.racket.variant.brand}::${entry.racket.variant.family}`;

    if (idsPodio.has(entry.racket.variant.id)) {
      linhasUsadas.add(linha);
      adicionadas++;
      continue;
    }
    if (entry.racket.variant.id === atualId) {
      foiPulada = linhasUsadas.has(linha);
      break;
    }
  }

  if (!foiPulada) return base;

  const irma = result.podium.find(
    (e) =>
      e.racket.variant.brand === atual.racket.variant.brand &&
      e.racket.variant.family === atual.racket.variant.family,
  );
  if (!irma) return base;

  return {
    ...base,
    family_match: buildFamilyMatch(atual, irma, result),
    /*
      A mensagem é reescrita por inteiro, e não acrescida.

      Os textos de `standingCore` giram em torno de "ficou em Nº, a X pontos da primeira" — que é
      exatamente o que este modo remove da tela. Emendar uma explicação no fim deixaria a
      contradição no começo do parágrafo.
    */
    message: familyMessage(atual, irma, result),
  };
}

/**
 * ═══ MODO FAMÍLIA: A COMPARAÇÃO SUBSTITUI A POSIÇÃO ══════════════════════════════════════════
 *
 * Decisão do dono do produto, e ela está certa. Nas palavras dele: "nesses casos de quando a
 * família estiver no pódio, não falar qual é o percentual nem a posição, mas acertar um pouco sobre
 * a família, qual é a diferença entre a sua e a que está no pódio, virtudes de cada uma".
 *
 * O raciocínio que sustenta isso: o percentual e a posição existem para responder UMA pergunta —
 * "vale trocar?". Quando a raquete do jogador é irmã de linha de uma que está no pódio, quem
 * responde melhor a essa pergunta não é o número: é o que separa as duas irmãs. E o número, ali,
 * ainda por cima colide com o pódio, porque a lista exibida renumera de 1 a 3.
 *
 * Ele também acertou o diagnóstico de por que os números se parecem tanto: "onde uma tem mais
 * valências e a outra tem mais dificuldade, e vice-versa, no fim isso pode se equilibrar por
 * questão matemática". É literalmente o que acontece — os atributos exibidos são nivelados para
 * somar o mesmo em toda raquete (ver `levelizeDisplay`), então duas variantes da mesma linha
 * trocam pontos entre eixos e chegam ao mesmo total. O agregado esconde a diferença; os eixos a
 * mostram.
 *
 * ─── O QUE NÃO SE PERDE ────────────────────────────────────────────────────────────────────
 *
 * A recomendação de trocar ou não. Ela continua, dita em palavras em vez de em pontos, com os
 * mesmos limiares de sempre (`KEEP_CURRENT_GAP` e `REAL_UPGRADE_GAP`). Esconder o número não pode
 * virar esconder a conclusão — §58 vale nas duas direções.
 *
 * `rank` e `fit_score` continuam no payload: eles são o registro da análise, servem à auditoria do
 * admin e alimentam o veredicto. O que muda é a tela não os exibir neste caso.
 */
function buildFamilyMatch(
  atual: RankedRacket,
  irma: RankedRacket,
  result: RecommendationResult,
): NonNullable<CurrentRacketStanding['family_match']> {
  const meus = buildIndices(atual, result.attribute_bands);
  const dela = buildIndices(irma, result.attribute_bands);

  const LABEL: Readonly<Record<string, string>> = {
    potencia: 'potência',
    controle: 'controle',
    spin: 'spin',
    conforto: 'conforto',
    estabilidade: 'estabilidade',
    manobrabilidade: 'manobrabilidade',
  };

  /*
    Um degrau da escala exibida é o mínimo para virar frase.

    Os índices andam de 5 em 5 — o passo existe para não sugerir precisão que o modelo não tem
    (R-04). Abaixo disso a diferença não é visível na tela nem afirmável fora dela.
  */
  const DEGRAU = 5;
  const meuForte: string[] = [];
  const dela_forte: string[] = [];

  for (const eixo of Object.keys(LABEL)) {
    const delta = (meus[eixo] ?? 0) - (dela[eixo] ?? 0);
    if (delta >= DEGRAU) meuForte.push(LABEL[eixo]!);
    else if (delta <= -DEGRAU) dela_forte.push(LABEL[eixo]!);
  }

  return {
    family: atual.racket.variant.family,
    sibling_name: irma.racket.variant.product_name,
    sibling_rank: irma.rank,
    your_edge: meuForte,
    sibling_edge: dela_forte,
  };
}

/** O texto do modo família. Sem posição, sem percentual — e sem deixar de concluir. */
function familyMessage(
  atual: RankedRacket,
  irma: RankedRacket,
  result: RecommendationResult,
): string {
  const nome = currentRacketLabel(atual.racket.variant);
  const gap = Math.round(result.full_ranking[0]?.fit_score ?? 0) - Math.round(atual.fit_score);

  const abertura =
    `A sua ${nome} é da mesma linha da ${irma.rank}ª colocada, a ` +
    `${irma.racket.variant.product_name}. É por isso que ela não aparece no pódio: mostramos no ` +
    `máximo uma raquete por linha de produto, para o pódio não virar três variações do mesmo ` +
    `quadro. São quadros diferentes de verdade — peso e medidas não batem —, e é justamente a ` +
    `diferença entre os dois que interessa aqui.`;

  /*
    A conclusão sobre trocar, em palavras.

    Os limiares são os mesmos que os outros ramos usam; o que muda é não imprimir o número. Uma
    seção que esconde a posição e também esconde a recomendação não seria discrição, seria omissão.
  */
  const conclusao =
    gap < KEEP_CURRENT_GAP
      ? `As duas ficaram praticamente lado a lado nesta análise. Não espere um salto ao trocar de ` +
        `uma para a outra dentro da mesma linha: o caminho de maior retorno para você é a corda e ` +
        `a tensão, que custam uma fração de um quadro.`
      : gap < REAL_UPGRADE_GAP
        ? `A do pódio abriu uma vantagem moderada sobre a sua — do tipo que dá para sentir em ` +
          `quadra, sobretudo nos eixos em que o vão é maior. Se você já pensava em trocar, ` +
          `experimentar a irmã antes de decidir faz sentido.`
        : `A do pódio abriu uma vantagem clara sobre a sua, mesmo sendo da mesma linha — em geral ` +
          `é diferença de peso e de balanço dentro da família. Aqui a troca deve ser sentida.`;

  return `${abertura} ${conclusao}`;
}

function standingCore(
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
   *
   * ─── ATÉ O CASO DE 1º LUGAR É CONDICIONAL (v2.31.0) ───────────────────────────────────────
   *
   * O ramo em que a raquete do jogador VENCE terminava em `Nenhuma troca de quadro te levaria
   * adiante daqui`. Verdade, e ainda assim um ponto final onde cabia um caminho: quem chegou aqui
   * incomodado com alguma coisa continua incomodado depois de ler que está tudo certo.
   *
   * Vencer o ranking não é o mesmo que estar satisfeito. O texto passa a separar os dois — se está
   * satisfeito, não há motivo para trocar; se algo incomoda, a alavanca é o setup, e os eixos dizem
   * onde. É a única resposta útil neste ramo, porque aqui não existe raquete melhor a oferecer: o
   * que sobra é justamente o componente mais barato e mais reversível do conjunto.
   *
   * ─── E POR QUE O TEXTO DELE SEGUE A MESMA ESCADA DOS OUTROS (v2.30.0) ──────────────────────
   *
   * A primeira versão deste ramo dizia `Não há ganho a buscar numa troca de quadro`. Era o registro
   * que a 2.27.0 tinha acabado de remover dos outros quatro casos, reintroduzido sem querer num
   * ramo novo — o mesmo defeito documentado logo acima em `KEEP_CURRENT_GAP`, e pela mesma razão:
   * concluir sobre a troca a partir de um agregado que não sabe ONDE está a diferença, para uma
   * pessoa que em geral chegou aqui incomodada com algo específico.
   *
   * Aqui a razão é ainda mais forte que no caso de 1 a 3 pontos, porque a diferença é MENOR — está
   * dentro do arredondamento. Se em três pontos o que decide já é tato, adaptação e marca, em menos
   * de um ponto isso vale integralmente. O texto diz o tamanho real da diferença, calibra a
   * expectativa, oferece o setup como caminho de maior retorno e manda olhar os eixos: é lá que
   * está a informação que o número agregado apagou.
   */
  if (gap <= 0 && current.rank === 1) {
    return {
      product_name: name,
      rank: current.rank,
      fit_score: Math.round(current.fit_score),
      gap_to_first: 0,
      verdict: 'keep',
      family_match: null,
      message:
        `A raquete que você já tem é a melhor opção para o seu jogo entre as ` +
        `${result.full_ranking.length} deste ranking — nenhuma outra que avaliamos te levaria ` +
        `adiante. Se você está satisfeito com ela, não há motivo para trocar de quadro. E se alguma ` +
        `coisa vem te incomodando, a alavanca aqui é a corda e a tensão: custam uma fração de um ` +
        `quadro e mudam bastante a resposta da raquete. Olhe os eixos abaixo — se o incômodo ` +
        `estiver num deles, é por ali que o ajuste começa.`,
    };
  }

  if (gap <= 0) {
    return {
      product_name: name,
      rank: current.rank,
      fit_score: Math.round(current.fit_score),
      gap_to_first: 0,
      verdict: 'keep',
      family_match: null,
      message:
        `Sua ${name} ficou em ${current.rank}º entre as ${result.full_ranking.length} deste ` +
        `ranking, com os mesmos ${Math.round(current.fit_score)}% de compatibilidade da primeira — ` +
        `a diferença entre as duas é menor que um ponto. Nessa faixa o número deixou de decidir: ` +
        `entram o tato de cada jogador, o tempo de adaptação a um quadro diferente e a intimidade ` +
        `com uma marca — coisas que nenhuma análise mede. Não espere um salto ao trocar. O caminho ` +
        `de maior retorno aqui é a corda e a tensão, que custam uma fração. Mas se o que te trouxe ` +
        `até aqui foi um incômodo específico, olhe os eixos abaixo: se a diferença estiver ` +
        `justamente nele, testar a recomendada faz sentido.`,
    };
  }

  if (gap < KEEP_CURRENT_GAP) {
    return {
      product_name: name,
      rank: current.rank,
      fit_score: Math.round(current.fit_score),
      gap_to_first: gap,
      verdict: 'keep',
      family_match: null,
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
      family_match: null,
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
    family_match: null,
    message:
      `Sua ${name} ficou em ${current.rank}º, a ${gap} pontos da primeira. Aqui a diferença não é ` +
      `questão de gosto: a recomendada atende o seu perfil num nível que a sua atual não alcança, ` +
      `e a troca deve ser sentida em quadra. Se for para investir em uma coisa só, invista no ` +
      `quadro — e depois ajuste corda e tensão sobre ele.`,
  };
}

/**
 * "Por que a raquete mais pesada é a mais fácil de girar?" — a pergunta que o peso levanta.
 *
 * ═══ O QUE ESTAVA FALTANDO ═══════════════════════════════════════════════════════════════════
 *
 * O motor ordena por INÉRCIA DE SWING, que é peso combinado com a distribuição dele. Isso é o
 * certo: é a inércia que a pessoa sente ao girar a raquete, não o número da balança. Só que o
 * relatório mostrava só o peso — e o peso, sozinho, contradiz o resultado com frequência:
 *
 *     Wilson Clash 100 Pro   305 g · balanço 310 mm  →  índice 32,4
 *     Babolat Pure Aero Lite 270 g · balanço 330 mm  →  índice 43,5
 *
 * Trinta e cinco gramas a mais e um terço menos de inércia. Quem lê "recomendamos 305 g" depois de
 * jogar com 285 g conclui, com toda razão aparente, que a análise está pedindo mais esforço dele.
 * Está pedindo menos, e não havia como saber pela página.
 *
 * ═══ POR QUE SÓ QUANDO HÁ COMPARAÇÃO CONCRETA ════════════════════════════════════════════════
 *
 * Porque a versão genérica da frase — "peso não é tudo, o que importa é o equilíbrio" — é um
 * lugar-comum que não prova nada e não muda a leitura de ninguém. O que convence é a conta feita
 * com os dois quadros que a pessoa tem na frente. Sem os dois números, não há nota.
 *
 * `null` quando não há raquete atual reconhecida nem diferença de peso relevante no pódio.
 */
function buildWeightReading(
  result: RecommendationResult,
  profile: PlayerProfile,
  first: RankedRacket,
): string | null {
  const vencedora = first.racket.variant.specs;
  const pesoNovo = vencedora.unstrung_weight_g;
  const inerciaNova = first.racket.attributes.swing_index;
  if (pesoNovo === null || inerciaNova === null) return null;

  /**
   * A raquete ATUAL é a melhor referência que existe: é a que a pessoa já sentiu na mão.
   *
   * Ela é buscada no `full_ranking`, e não em `profile.current_racket`, porque os dois campos
   * chamados `swing_index` NÃO são a mesma grandeza: o do perfil é o valor físico cru
   * (massa × braço², na casa dos milhares) e o dos atributos é o índice de 0 a 100 do catálogo.
   * Comparar um com o outro produziria uma frase com dois números incomparáveis lado a lado.
   */
  const atual = result.full_ranking.find(
    (r) => r.racket.variant.id === profile.current_racket?.variant_id,
  );
  const pesoAtual = atual?.racket.variant.specs.unstrung_weight_g ?? null;
  const inerciaAtual = atual?.racket.attributes.swing_index ?? null;

  if (
    pesoAtual !== null &&
    inerciaAtual !== null &&
    pesoNovo > pesoAtual &&
    inerciaNova <= inerciaAtual
  ) {
    return (
      `A recomendada pesa ${pesoNovo} g contra os ${pesoAtual} g da sua — e ainda assim ela gira ` +
      `com MENOS esforço, não mais. O que o braço sente ao acelerar não é o peso na balança: é a ` +
      `inércia, que combina o peso com o quanto dele está longe da mão. Um quadro mais pesado com ` +
      `a massa concentrada perto do punho é mais fácil de preparar que um leve com a massa na ` +
      `cabeça. No nosso índice de inércia (0–100), a sua marca ${Math.round(inerciaAtual)} e a ` +
      `recomendada ${Math.round(inerciaNova)} — quanto menor, menos esforço para girar. É por isso ` +
      `que a análise pode indicar mais gramas sem indicar mais cansaço.`
    );
  }

  /**
   * Sem raquete atual, o pódio serve de comparação — mas só quando ele próprio contradiz o peso.
   *
   * Se a mais pesada do pódio também é a de maior inércia, não há nada de contraintuitivo para
   * explicar, e a nota viraria ruído numa página que já é longa.
   */
  const maisLeve = result.podium
    .filter((e) => e.racket.variant.specs.unstrung_weight_g !== null)
    .sort(
      (a, b) =>
        (a.racket.variant.specs.unstrung_weight_g ?? 0) -
        (b.racket.variant.specs.unstrung_weight_g ?? 0),
    )[0];

  const pesoLeve = maisLeve?.racket.variant.specs.unstrung_weight_g ?? null;
  const inerciaLeve = maisLeve?.racket.attributes.swing_index ?? null;
  if (
    maisLeve &&
    pesoLeve !== null &&
    inerciaLeve !== null &&
    pesoNovo - pesoLeve >= 5 &&
    inerciaNova < inerciaLeve
  ) {
    return (
      `Uma leitura que costuma surpreender: a recomendada pesa ${pesoNovo} g e a mais leve do seu ` +
      `pódio pesa ${pesoLeve} g — e é a mais PESADA que exige menos do braço para girar. O que se ` +
      `sente ao acelerar não é o peso da balança, é a inércia: peso e distribuição juntos. Massa ` +
      `perto da mão gira fácil; a mesma massa na cabeça, não. No nosso índice de inércia (0–100) a ` +
      `recomendada marca ${Math.round(inerciaNova)} contra ${Math.round(inerciaLeve)} da mais ` +
      `leve, e quanto menor, menos esforço. É essa conta que o ranking usa — não a da balança.`
    );
  }

  return null;
}

/**
 * O aviso de MIGRAÇÃO JUVENIL — §62 e §69.
 *
 * ═══ O QUE O CATÁLOGO NÃO TEM, E POR QUE ISSO PRECISA SER DITO ═══════════════════════════════
 *
 * Este catálogo é de quadros ADULTOS: 27 polegadas, 270 g para cima. É uma decisão de escopo, está
 * documentada nos filtros duros, e para a esmagadora maioria de quem responde ela é irrelevante.
 *
 * Para um jovem em transição, não é. Um menino de 12 anos com 52 kg recebe a melhor resposta que
 * existe DENTRO deste catálogo — e a melhor resposta dentro de um catálogo pode não ser a melhor
 * resposta que existe. Quadros juvenis de 25 e 26 polegadas continuam sendo uma escolha legítima
 * nessa faixa, e o relatório não os avalia.
 *
 * Calar sobre isso seria vender uma análise que não se sustenta para aquele jogador (§62) —
 * apresentar como completo um universo que sabidamente não é o dele. Dizer é barato e é honesto: a
 * recomendação continua válida como "a melhor entre as adultas", que é exatamente o que ela é.
 *
 * ─── QUANDO ELE APARECE ─────────────────────────────────────────────────────────────────────
 *
 * Menor de 16 anos E com o teto vindo do PORTE, não da idade. A distinção importa: um rapaz de 15
 * anos com 70 kg tem o teto travado em 300 g pela regra etária e está inteiramente à vontade num
 * quadro adulto — para ele o aviso seria alarme falso. Quem precisa dele é quem ainda é pequeno
 * para a faixa que o catálogo cobre, e é isso que um teto abaixo de 300 g descreve.
 */
function buildJuniorTransitionNote(profile: PlayerProfile): string | null {
  const teto = profile.frame_weight_ceiling_g;
  if (profile.age === null || profile.age >= 16 || teto === null || teto >= 300) return null;

  return (
    `Você tem ${profile.age} anos, e isso muda como esta análise deve ser lida. Todas as raquetes ` +
    `que avaliamos são de padrão adulto — 27 polegadas, a partir de 270 g —, e o que você recebe ` +
    `abaixo é a melhor escolha DENTRO desse universo, com o peso já limitado ao que o seu corpo ` +
    `sustenta hoje. O que a análise não avalia são os quadros juvenis, de 25 e 26 polegadas, que ` +
    `nessa fase ainda podem fazer todo sentido: você está no meio da migração entre eles e os ` +
    `adultos, e essa passagem é gradual, não uma data. Se a raquete indicada parecer grande ou ` +
    `pesada na mão, isso não é um erro seu nem da análise — é o sinal de que a migração ainda ` +
    `está acontecendo. Converse com seu professor sobre o momento certo, e leia esta recomendação ` +
    `como o destino do caminho, não necessariamente como o passo de amanhã.`
  );
}

/**
 * Por que o bloco da raquete atual NÃO está na página.
 *
 * ═══ UMA AUSÊNCIA SILENCIOSA É UMA ENTREGA QUEBRADA ══════════════════════════════════════════
 *
 * A home, o comparativo de planos e a descrição do produto anunciam "corda e tensão para a raquete
 * que você já tem". Quem paga por isso e não encontra a seção conclui, com razão, que o produto não
 * entregou o que vendeu — e não tem como saber que, no caso dele, não havia o que entregar.
 *
 * Relatado assim, com dois testes lado a lado: "no meu teste pessoal apareceu, mas no teste infantil
 * não apareceu essa seção, não sei porquê". A pergunta não era retórica; a página não respondia.
 *
 * São duas razões possíveis, e as duas são legítimas:
 *
 *   1. Não há raquete atual reconhecida — a pessoa marcou que não tem, ou digitou um modelo que o
 *      catálogo não conhece. Não existe quadro sobre o qual calcular.
 *
 *   2. O setup principal JÁ É o da raquete dela — porque ela venceu o ranking, ou porque o próprio
 *      jogador apontou o seletor de setup para ela. Repetir o mesmo cálculo num segundo bloco não
 *      acrescentaria nada e faria a pessoa procurar uma diferença que não existe.
 *
 * Nos dois casos a resposta certa é dizer, não calar. `null` quando o bloco está presente — aí a
 * página já responde sozinha.
 */
function buildCurrentRacketSetupNote(
  result: RecommendationResult,
  profile: PlayerProfile,
  setupAlvoId: string,
  temBloco: boolean,
): string | null {
  if (temBloco) return null;

  const atualId = profile.current_racket?.variant_id;

  // ── 1. Não há raquete para calcular ────────────────────────────────────────────────────────
  if (atualId == null || profile.current_racket?.unrecognized) {
    return (
      'O setup completo também traz a corda e a tensão ideais para a raquete que você já tem — mas ' +
      'para isso precisamos saber qual é ela. Você não informou uma raquete atual, ou o modelo que ' +
      'você digitou não está no catálogo que analisamos. Se quiser essa parte, refaça o ' +
      'questionário escolhendo sua raquete na lista: a recomendação de quadro não muda por isso, e ' +
      'você ganha o ajuste que dá para fazer sem trocar nada.'
    );
  }

  const noRanking = result.full_ranking.find((r) => r.racket.variant.id === atualId);

  /**
   * ── 2. Reconhecida, mas fora da análise ──────────────────────────────────────────────────
   *
   * Antes este caso caía na mensagem de cima, que diz "você não informou, ou não está no catálogo".
   * As duas metades seriam falsas: a pessoa informou, e a raquete está no catálogo — nós é que a
   * tiramos, por um filtro duro (specs faltando, dados insuficientes, quadro fora do padrão
   * adulto). Culpar a resposta dela por uma decisão nossa é o tipo de mentira pequena que corrói a
   * confiança no resto do relatório.
   *
   * Com o catálogo de hoje isto não acontece — varrido: 47 de 47 raquetes permanecem no ranking
   * quando declaradas como atuais, inclusive para perfis com histórico de dor no braço. O ramo
   * existe porque o catálogo cresce e os filtros continuam valendo.
   */
  if (!noRanking) {
    return (
      'Reconhecemos a raquete que você informou, mas ela ficou de fora desta análise: faltam dados ' +
      'publicados que consideramos obrigatórios para uma recomendação paga, ou ela está fora do ' +
      'padrão de quadro adulto que avaliamos. Como não a avaliamos, não seria honesto sugerir uma ' +
      'corda e uma tensão para ela — a lista de exclusões e o motivo de cada uma ficam registrados ' +
      'na análise. A recomendação de quadro acima não é afetada por isso.'
    );
  }

  // ── 3. O setup acima JÁ É o dela ───────────────────────────────────────────────────────────
  if (atualId === setupAlvoId) {
    return (
      `Você não vai encontrar um bloco separado de "corda e tensão para a sua raquete atual" nesta ` +
      `página, e o motivo é bom: o setup acima JÁ É o dela. A ` +
      `${currentRacketLabel(noRanking.racket.variant)} que você já tem é a raquete para a qual esse ` +
      `setup foi calculado, então a corda, a espessura e a tensão que você leu ali são exatamente o ` +
      `que fazer no próximo encordoamento — sem trocar de quadro.`
    );
  }

  /**
   * ── 4. A análise é anterior a esta seção ─────────────────────────────────────────────────
   *
   * `undefined` e `null` significam coisas diferentes aqui, e a distinção sobrevive ao banco:
   * `JSON.stringify` preserva `null` e descarta chaves ausentes. Uma análise calculada depois desta
   * seção existir sempre grava a chave — com o objeto ou com `null`. Ausente, então, só pode ser
   * uma análise antiga.
   *
   * Recalcular hoje, sobre um resultado de ontem, produziria uma seção que descreve uma análise que
   * nunca aconteceu — §69, e a mesma razão pela qual `analysis_outdated` existe em vez de refazer a
   * conta em silêncio.
   */
  if (result.current_racket_setup === undefined) {
    return (
      `Esta análise foi calculada antes de existir a seção de corda e tensão para a raquete que ` +
      `você já tem, e por isso ela não aparece aqui. Não recalculamos um relatório já entregue: o ` +
      `que você comprou continua sendo exatamente o que foi calculado na época. Para receber essa ` +
      `parte, refaça o questionário — a análise nova sai com ela, e este link continua acessível ` +
      `como está.`
    );
  }

  /**
   * ── 5. Nenhuma corda serve para aquele quadro ────────────────────────────────────────────
   *
   * Sobra do caso em que a seleção de corda devolveu `null` — todo o catálogo excluído para aquele
   * jogador, por tipo proibido somado a disponibilidade. Não deve acontecer com o catálogo atual, e
   * ainda assim precisa de resposta: um silêncio aqui seria indistinguível de um defeito.
   */
  return (
    'Não conseguimos fechar uma recomendação de corda para a raquete que você já tem sem contrariar ' +
    'alguma das restrições do seu perfil — em geral é o histórico de desconforto no braço, que ' +
    'proíbe os tipos mais duros, combinado com o que está disponível no Brasil. Preferimos não ' +
    'sugerir nada a sugerir algo que a própria análise desaconselha.'
  );
}

/**
 * Monta o bloco "e a raquete que eu já tenho?" — ver `CurrentRacketSetupPayload`.
 *
 * ═══ POR QUE ELE NÃO É RECALCULADO AQUI ══════════════════════════════════════════════════════
 *
 * Os números vêm de `result.current_racket_setup`, gravado junto com a análise. Recalcular a corda
 * na hora de mostrar faria um relatório pago mudar de recomendação entre duas leituras — bastaria
 * o catálogo de cordas ganhar um modelo. É a mesma razão de `attribute_bands` viajar no resultado.
 *
 * Relatórios gravados antes deste campo existir devolvem `null` e seguem como sempre foram. A
 * alternativa — calcular hoje, sobre um perfil de ontem — produziria uma seção que descreve uma
 * análise que nunca aconteceu, e é exatamente o que §69 proíbe.
 */
function buildCurrentRacketSetup(
  result: RecommendationResult,
  profile: PlayerProfile,
  setupAlvoId: string,
): CurrentRacketSetupPayload | null {
  const dados = result.current_racket_setup;
  if (!dados) return null;

  const atualId = profile.current_racket?.variant_id;

  /**
   * ═══ UMA RAQUETE, UMA RESPOSTA ═══════════════════════════════════════════════════════════
   *
   * Se o setup principal já aponta para a raquete do jogador, este bloco não pode existir — senão
   * a mesma raquete aparece na página com DUAS cordas diferentes.
   *
   * Foi exatamente o que aconteceu, relatado com o relatório aberto: a raquete dele ficou no pódio,
   * ele usou o seletor para calcular o setup em cima dela, e o bloco "antes de trocar de raquete"
   * seguia mostrando o setup gravado na análise — outro modelo de corda, mesmo tipo, mesma tensão.
   *
   * Duas causas, as duas consertadas. A divergência de CÁLCULO estava em `withSetupFor`
   * (`questionario/actions.ts`), que omitia a régua do catálogo. A duplicação de BLOCO é esta
   * condição: `result.current_racket_setup` é gravado quando a atual não é a vencedora, e o
   * seletor de setup pode mudar o alvo depois, sem que o valor gravado saiba disso.
   */
  if (atualId && atualId === setupAlvoId) return null;

  const atual = result.full_ranking.find((r) => r.racket.variant.id === atualId);
  if (!atual) return null;

  const rec = dados.string_recommendation;
  const t = dados.tension;
  const tipoNovo = rec.variant.model.string_type;

  /**
   * O QUE MUDA — e por que cada linha só existe se houver de onde partir.
   *
   * "Suba 2 lbs" sem saber a tensão de hoje não é instrução, é palpite. Cada comparação abaixo é
   * condicional ao dado correspondente ter sido declarado; quem respondeu "não sei" na etapa da
   * corda recebe o bloco sem esta parte, e não uma comparação com um valor inventado.
   */
  const mudancas: string[] = [];
  const usada = profile.current_string;

  if (usada?.string_type) {
    // Rótulo, e não enum: é a comparação por família que o jogador enxerga — `polyester` e
    // `co_polyester` compartilham "Poliéster", e trocar de um para o outro não é trocar de tipo.
    const tipoAtual = STRING_TYPE_PT[usada.string_type as keyof typeof STRING_TYPE_PT];
    if (tipoAtual && tipoAtual !== STRING_TYPE_PT[tipoNovo]) {
      mudancas.push(
        `Tipo de corda: de ${tipoAtual} para ${STRING_TYPE_PT[tipoNovo]}. É a troca que mais ` +
          `muda a resposta do quadro sem tocar nele — e a que menos custa para desfazer, porque ` +
          `vale só até o próximo encordoamento.`,
      );
    } else if (tipoAtual) {
      mudancas.push(
        `Tipo de corda: ${tipoAtual}, o mesmo que você já usa. O ganho aqui não vem da categoria ` +
          `— vem do modelo, da espessura e da tensão.`,
      );
    }
  }

  if (usada?.gauge_mm != null) {
    const delta = rec.variant.variant.gauge_mm - usada.gauge_mm;
    if (Math.abs(delta) >= 0.02) {
      mudancas.push(
        `Espessura: de ${usada.gauge_mm.toFixed(2)} mm para ` +
          `${rec.variant.variant.gauge_mm.toFixed(2)} mm — ` +
          (delta < 0
            ? 'mais fina, o que devolve sensação e mordida na bola, ao custo de durar menos.'
            : 'mais grossa, o que alonga a vida da corda e firma a resposta.'),
      );
    }
  }

  if (usada?.tension_lbs != null) {
    const delta = Math.round(t.lbs - usada.tension_lbs);
    if (delta === 0) {
      mudancas.push(
        `Tensão: ${t.lbs} lbs, praticamente a que você já usa. Nesse ponto o número está certo — ` +
          `o ajuste que sobra está na corda, não na tensão.`,
      );
    } else {
      mudancas.push(
        `Tensão: de ${usada.tension_lbs} lbs para ${t.lbs} lbs (${delta > 0 ? '+' : ''}${delta}) — ` +
          (delta < 0
            ? 'mais solta devolve potência e absorve mais impacto no braço.'
            : 'mais firme devolve controle e encurta a bola.'),
      );
    }
  }

  /**
   * ═══ O TETO, E POR QUE ELE É OBRIGATÓRIO ═════════════════════════════════════════════════
   *
   * Sem esta frase o bloco vira promessa. Corda e tensão mexem em potência, conforto, controle e
   * spin dentro de uma faixa que o QUADRO define — e não movem peso, balanço, tamanho de cabeça
   * nem rigidez, que é onde a diferença para a recomendada mora.
   *
   * O texto muda conforme a distância: para quem está perto da primeira, o setup é de fato o
   * caminho de maior retorno e a frase diz isso; para quem está longe, dizer o mesmo seria vender
   * um remédio que não alcança o problema.
   */
  const gap = Math.round(result.podium[0]?.fit_score ?? 0) - Math.round(atual.fit_score);
  const ceiling_note =
    gap < 4
      ? 'Como a sua raquete já está muito perto da primeira colocada, este é o ajuste de maior ' +
        'retorno que existe para você hoje: ele custa uma fração de um quadro e é o que ainda ' +
        'não foi feito. O que corda e tensão não alcançam é peso, balanço e rigidez do quadro — e ' +
        'nesses eixos a sua já está bem posicionada.'
      : gap < 9
        ? 'Isto aproxima a sua raquete do que você precisa, mas não a transforma na recomendada: ' +
          'corda e tensão movem potência, conforto, controle e spin dentro da faixa que o quadro ' +
          'permite. Peso, balanço, tamanho de cabeça e rigidez continuam sendo os do seu quadro, e ' +
          'é neles que está a maior parte da diferença. Comece por aqui — e reavalie depois de ' +
          'jogar algumas semanas assim.'
        : 'Este ajuste vale a pena e é barato, e ainda assim precisa ser dito com clareza: ele não ' +
          'fecha a distância para a recomendada. A diferença entre as duas está principalmente em ' +
          'peso, balanço e rigidez, que nenhuma corda muda. Trate isto como o melhor uso possível ' +
          'da raquete que você já tem, não como substituto de uma troca.';

  return {
    racket_name: currentRacketLabel(atual.racket.variant),
    string_brand: rec.variant.model.brand,
    string_model: rec.variant.model.model,
    string_type: STRING_TYPE_PT[tipoNovo],
    gauge_mm: rec.variant.variant.gauge_mm,
    tension_lbs: t.lbs,
    tension_kg: t.kg,
    tension_range_lbs: t.range_lbs,
    why_string: explainString(rec),
    why_tension: explainTension(t),
    change_from_current: mudancas,
    ceiling_note,
    availability_warning: rec.variant.availability_warning,
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

  /**
   * PARA QUAL raquete o setup principal foi calculado — resolvido uma vez, usado em três lugares.
   *
   * `result.setup_for_variant_id` só é preenchido quando o jogador aponta o seletor para outra
   * posição do pódio; sem isso o alvo é a 1ª colocada, que é o padrão do motor. A resolução vive
   * aqui em cima porque o bloco da raquete atual precisa dela para não duplicar a mesma raquete
   * com duas cordas — ver `buildCurrentRacketSetup`.
   */
  const setupAlvoId = result.setup_for_variant_id ?? first.racket.variant.id;

  /*
    Sem `full_setup_access` o bloco não é CONSTRUÍDO, não é escondido por CSS — mesma garantia
    estrutural do §32 que vale para o resto do payload.
  */
  const setupDaAtual = canSeeSetup
    ? buildCurrentRacketSetup(result, profile, setupAlvoId)
    : null;

  let setup: SetupPayload | null = null;
  if (canSeeSetup && result.string_recommendation && result.tension) {
    const rec = result.string_recommendation;
    const t = result.tension;
    setup = {
      string_brand: rec.variant.model.brand,
      string_model: rec.variant.model.model,
      // Rótulo em português, e não o valor do enum. O card exibia `co_polyester` para quem pagou.
      string_type: STRING_TYPE_PT[rec.variant.model.string_type],
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
    setup_for_variant_id: setupAlvoId,
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
    // Faz parte do setup completo — sem `full_setup_access` o bloco não é CONSTRUÍDO, não é
    // escondido por CSS. É a mesma garantia estrutural do §32 que vale para o resto do payload.
    current_racket_setup: setupDaAtual,
    current_racket_setup_note: canSeeSetup
      ? buildCurrentRacketSetupNote(result, profile, setupAlvoId, setupDaAtual !== null)
      : null,
    /*
      Estas duas NÃO são premium, e é deliberado.

      Uma explica por que a recomendação que a pessoa acabou de comprar não é o que ela parece; a
      outra avisa que o catálogo pode não cobrir o caso dela. Cobrar por qualquer uma seria vender
      a análise e cobrar à parte pela ressalva que a torna honesta (§62).
    */
    weight_reading: buildWeightReading(result, profile, first),
    junior_transition: buildJuniorTransitionNote(profile),
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
