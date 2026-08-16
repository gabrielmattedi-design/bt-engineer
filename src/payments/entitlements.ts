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
import { clamp01 } from '@/domain/scores';
import { CONFIDENCE_LABEL_PT } from '@/recommendation/confidence';
import { buildTradeOffs, type TradeOff } from './trade-offs';
import { buildRadar, type RadarAxis } from './radar';
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
};

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

  const display = (key: string, raw: number): number => {
    const band = bands[key];
    // Sem faixa (relatório antigo, gravado antes deste campo existir) o valor cru é o melhor
    // disponível — é preferível a inventar uma escala que não corresponde ao que foi vendido.
    if (!band || band[1] <= band[0]) return Math.round(raw / 5) * 5;

    const position = (raw - band[0]) / (band[1] - band[0]);
    const scaled = DISPLAY_INDEX_FLOOR + clamp01(position) * (100 - DISPLAY_INDEX_FLOOR);
    return Math.round(scaled / 5) * 5;
  };

  return {
    potencia: display('power_score', a.power_score),
    controle: display('control_score', a.control_score),
    spin: display('spin_score', a.spin_score),
    conforto: display('comfort_score', a.comfort_score),
    estabilidade: display('stability_score', a.stability_score),
    manobrabilidade: display('maneuverability_score', a.maneuverability_score),
  };
}

function unlockedEntry(
  ranked: RankedRacket,
  profile: PlayerProfile,
  bands: RecommendationResult['attribute_bands'],
  tradeOffs: readonly TradeOff[] = [],
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
    expectations: explainExpectations(ranked),
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
      );
    }
    if (canSeeRank(granted, entry.rank)) {
      return unlockedEntry(entry, profile, result.attribute_bands);
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
      ? result.podium.map((entry) => unlockedEntry(entry, profile, result.attribute_bands))
      : null,
    engine_version: result.engine_version,
    dataset_version: result.dataset_version,
    indices_disclaimer: INDICES_DISCLAIMER,
    identity: { ...buildPlayerIdentity(profile), playerName: profile.player_name },
    radar: buildRadar(
      profile,
      first,
      result.full_ranking,
      result.attribute_bands,
      // A raquete atual está no ranking quando foi reconhecida no catálogo e passou pelos filtros.
      result.full_ranking.find(
        (r) => r.racket.variant.id === profile.current_racket?.variant_id,
      ) ?? null,
    ),
  };
}
