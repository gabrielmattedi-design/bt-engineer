/**
 * Ponto de entrada do motor de recomendação.
 *
 * Função pura de alto nível: perfil + catálogo → resultado completo.
 * O simulador do admin (§47), os testes de persona (§49) e a rota de produção chamam EXATAMENTE
 * esta função — não há caminho alternativo, mock ou variação. É isso que faz o simulador ser uma
 * ferramenta de validação real e não um brinquedo.
 */


import type { ScoredRacket } from '@/domain/racket';
import type { PlayerProfile } from '@/domain/player-profile';
import type { RecommendationResult } from '@/domain/recommendation';
import { METHODOLOGY_VERSION } from '@/domain/reference-ranges';
import { RECOMMENDATION_ENGINE_VERSION } from './config/version';
import { WEIGHTS_VERSION } from './config/weights.v1';
import { computeConfidence } from './confidence';
import { rankRackets, selectPodium, type RankOptions } from './engine/rank-rackets';
import { DISPLAYED_ATTRIBUTES, scaleBands } from './engine/catalog-scale';
import { analyzeTransition } from './engine/transition';
import { selectStringVariant, type StringCatalog } from './strings/select-string';
import { computeTension } from './strings/tension';
import {
  computeSwingIndex,
  parseBeamAverage,
} from './normalize/racket-attributes';

export type RecommendInput = {
  readonly profile: PlayerProfile;
  readonly rackets: readonly ScoredRacket[];
  readonly strings?: StringCatalog | null;
  readonly datasetVersion: string;
  readonly mode?: RankOptions['mode'];
  /** Inclui corda + tensão. Corresponde ao entitlement `full_setup_access`. */
  readonly includeSetup?: boolean;
};

/**
 * Preenche, a partir do catálogo, o que `buildPlayerProfile` não tinha como saber.
 *
 * ═══ POR QUE ISTO É UMA FUNÇÃO EXPORTADA, E NÃO UM PASSO INTERNO ═════════════════════════════
 *
 * `buildPlayerProfile` é pura sobre respostas: ela recebe o que a pessoa digitou e não conhece
 * raquete nem corda de catálogo. O snapshot do equipamento atual sai de lá com os campos técnicos
 * em `null`, e alguém precisa resolvê-los contra o catálogo antes do cálculo.
 *
 * Isso acontecia dentro de `recommend`, o que bastava para o RANKING — e produzia um desencontro
 * silencioso no que fica GRAVADO: o questionário persiste o perfil que ele construiu, não o que o
 * motor usou. O registro do banco descrevia um jogador sem raquete conhecida, enquanto a análise
 * ao lado tinha sido calculada com todas as specs dela. Uma análise auditável precisa guardar a
 * entrada real do cálculo, e não uma versão mais pobre dela.
 *
 * Sendo exportada, o mesmo enriquecimento roda uma vez em `actions.ts` — antes de calcular e antes
 * de gravar — e continua rodando dentro de `recommend` para quem chama o motor direto (simulador,
 * testes de persona). É idempotente: aplicar duas vezes dá o mesmo perfil.
 */
export function enrichProfileWithCatalog(
  profile: PlayerProfile,
  rackets: readonly ScoredRacket[],
  strings: StringCatalog | null | undefined,
): PlayerProfile {
  /**
   * A raquete atual precisa ser resolvida ANTES do ranking: ela define a referência do
   * `objective_fit` e habilita `transition_fit`. Sem isto o componente devolvia sempre o valor
   * neutro, silenciosamente, e as penalizações P5/P5b não enxergavam o equipamento atual.
   */
  const racket =
    profile.current_racket?.variant_id != null
      ? (rackets.find((r) => r.variant.id === profile.current_racket?.variant_id) ?? null)
      : null;

  const comRaquete: PlayerProfile = racket
    ? {
        ...profile,
        current_racket: {
          variant_id: racket.variant.id,
          unrecognized: false,
          weight_g: racket.variant.specs.unstrung_weight_g,
          head_size_sq_in: racket.variant.specs.head_size_sq_in,
          balance_mm: racket.variant.specs.balance_mm,
          beam_width_avg_mm: parseBeamAverage(racket.variant.specs),
          swing_index: computeSwingIndex(racket.variant.specs),
        },
      }
    : profile;

  /**
   * A CORDA atual também — e este campo estava sendo coletado e descartado.
   *
   * ═══ O DEFEITO, E O TAMANHO DELE ═══════════════════════════════════════════════════════════
   *
   * `current_string.string_type` saía `null` de `buildPlayerProfile` e nada o preenchia depois.
   * `computeTension` lê exatamente esse campo para decidir quanto a experiência do jogador pesa:
   *
   *     mesma categoria de corda ....... a referência dele pesa 55%
   *     categoria diferente ............ pesa 35%, "porque a referência perde validade"
   *
   * Com `null` de um lado, a comparação nunca dava igual. Todo mundo caía nos 35%, e o relatório
   * imprimia "como o tipo de corda muda, sua referência anterior perde parte da validade" mesmo
   * para quem continua no mesmo tipo — uma frase falsa sobre a própria resposta da pessoa. A nota
   * de "você indicou que a tensão atual está ideal, mantivemos o setup próximo dela" dependia do
   * mesmo `sameType` e, por isso, nunca foi impressa uma vez sequer.
   *
   * A `gauge_mm` vem junto: a resposta do questionário é opcional, e quando ela falta a espessura
   * da variante escolhida é o dado real, não um palpite.
   */
  const variante =
    comRaquete.current_string?.string_variant_id != null && strings
      ? (strings.variants.find((v) => v.id === comRaquete.current_string?.string_variant_id) ?? null)
      : null;
  const modelo = variante
    ? (strings?.models.find((m) => m.id === variante.string_id) ?? null)
    : null;

  if (!variante || !modelo || !comRaquete.current_string) return comRaquete;

  return {
    ...comRaquete,
    current_string: {
      ...comRaquete.current_string,
      string_type: modelo.string_type,
      gauge_mm: comRaquete.current_string.gauge_mm ?? variante.gauge_mm,
    },
  };
}

export function recommend(input: RecommendInput): RecommendationResult {
  const mode = input.mode ?? 'strict';

  const profile = enrichProfileWithCatalog(input.profile, input.rackets, input.strings);

  const currentRacket =
    profile.current_racket?.variant_id != null
      ? (input.rackets.find((r) => r.variant.id === profile.current_racket?.variant_id) ?? null)
      : null;

  const ranked = rankRackets(profile, input.rackets, { mode, currentRacket });
  const podium = selectPodium(ranked.ranking, profile);
  const top = podium[0] ?? ranked.ranking[0] ?? null;

  const transition = top
    ? analyzeTransition(profile, top.racket, currentRacket)
    : { available: false, comparisons: [], expectations: [], attention_points: [] };

  let stringRecommendation = null;
  let tension = null;

  if (input.includeSetup && top && input.strings) {
    stringRecommendation = selectStringVariant(
      profile,
      top.racket,
      input.strings,
      ranked.scale,
      mode,
    );
    if (stringRecommendation) {
      tension = computeTension(top.racket, stringRecommendation.variant, profile);
    }
  }

  /**
   * O setup da raquete que a pessoa JÁ TEM — ver `current_racket_setup` em `domain/recommendation`.
   *
   * ─── É O MESMO CÁLCULO, E ISSO É O PONTO ──────────────────────────────────────────────────
   *
   * `selectStringVariant` e `computeTension` recebem uma raquete como argumento; nada neles supõe
   * que ela seja a vencedora. Passar a atual não é uma aproximação nem um modo degradado: é a
   * mesma função sobre outro quadro, e é isso que permite dizer "com a sua raquete, esta corda" com
   * o mesmo rigor com que o relatório diz a outra.
   *
   * ─── QUANDO ELE NÃO É CALCULADO ───────────────────────────────────────────────────────────
   *
   * Quando a raquete atual É a recomendada. Aí o setup principal já é o dela, e mostrar dois blocos
   * com a mesma corda faria a pessoa procurar a diferença entre duas coisas idênticas.
   *
   * A comparação com a corda que ela usa HOJE não é feita aqui: ela é texto de relatório, e mora em
   * `entitlements.ts` junto do resto da apresentação. Aqui fica só o número.
   */
  let currentRacketSetup: {
    string_recommendation: NonNullable<typeof stringRecommendation>;
    tension: NonNullable<typeof tension>;
  } | null = null;

  if (input.includeSetup && input.strings && currentRacket && currentRacket.variant.id !== top?.racket.variant.id) {
    const corda = selectStringVariant(profile, currentRacket, input.strings, ranked.scale, mode);
    if (corda) {
      currentRacketSetup = {
        string_recommendation: corda,
        tension: computeTension(currentRacket, corda.variant, profile),
      };
    }
  }

  const confidence = computeConfidence(profile, ranked.ranking, {
    tensionBaseIsFallback: tension?.base_source === 'fallback',
  });

  /**
   * §30 — o upsell existe quando há alternativa REAL a desbloquear, não quando dá para inventar
   * uma. A oferta some se o pódio tem uma raquete só; e o fit de cada posição bloqueada é exibido
   * ANTES do pagamento, para que ninguém compre uma opção fraca sem saber que ela é fraca.
   */
  const top3OfferAvailable = podium.length >= 2;

  return {
    engine_version: RECOMMENDATION_ENGINE_VERSION,
    weights_version: WEIGHTS_VERSION,
    dataset_version: input.datasetVersion,
    methodology_version: METHODOLOGY_VERSION,
    podium,
    full_ranking: ranked.ranking,
    excluded: ranked.excluded,
    candidates_evaluated: ranked.candidates_evaluated,
    transition,
    string_recommendation: stringRecommendation,
    tension,
    confidence,
    top3_offer_available: top3OfferAvailable,
    attribute_bands: scaleBands(ranked.scale, DISPLAYED_ATTRIBUTES),
    component_means: ranked.componentMeans,
    attribute_means: Object.fromEntries(
      DISPLAYED_ATTRIBUTES.map((key) => [key, ranked.scale.meanPosition(key)]),
    ),
    objective_reference: ranked.reference,
    current_racket_setup: currentRacketSetup,
  };
}

export { rankRackets, selectPodium } from './engine/rank-rackets';
/*
  A régua do catálogo é exportada porque quem RECALCULA um setup fora daqui precisa dela.

  `selectStringVariant` aceita a régua como argumento opcional, e omiti-la não é o mesmo cálculo:
  ela alimenta `computeStringTarget`, então a mesma raquete produz outra corda. Ver `withSetupFor`
  em `questionario/actions.ts`, que era exatamente o caminho que omitia.
*/
export { buildCatalogScale } from './engine/catalog-scale';
export { buildPlayerProfile } from './profile/build-profile';
export { scoreRacket, scoreRackets } from './normalize/racket-attributes';
export { selectStringVariant } from './strings/select-string';
export { computeTension } from './strings/tension';
export { computeConfidence, CONFIDENCE_LABEL_PT } from './confidence';
export { RECOMMENDATION_ENGINE_VERSION } from './config/version';
export { WEIGHTS_VERSION } from './config/weights.v1';
export type { StringCatalog } from './strings/select-string';
