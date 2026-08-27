/**
 * Modelo de domínio de raquetes — docs/DATA_MODEL.md §3.
 *
 * A unidade recomendável é a VARIANTE (modelo + variante de peso + geração), nunca o modelo.
 * Uma raquete de 305 g e uma de 285 g não são o mesmo produto (§5).
 */

import type {
  AvailabilityStatus,
  ProductStatus,
  ProvenanceMap,
  VerificationState,
} from './sourced';
import type { Score } from './scores';

export type RacketBrand = 'HEAD' | 'Wilson' | 'Babolat' | 'Yonex';

export const RACKET_BRANDS: readonly RacketBrand[] = ['HEAD', 'Wilson', 'Babolat', 'Yonex'];

/**
 * Especificações. `null` significa "não sabemos" — jamais um default.
 * Campos marcados (obrigatório) impedem a variante de ser recomendável quando ausentes.
 */
/**
 * Especificações CONSOLIDADAS DE MERCADO — v2.
 *
 * Exatamente os campos que HEAD, Wilson, Babolat e Yonex publicam no catálogo e que qualquer
 * varejista especializado reproduz. São os mesmos campos do spec card do brand book, menos
 * swingweight (medição de laboratório, não publicada).
 *
 * Todos são OBRIGATÓRIOS exceto `recommended_tension_*`. `null` continua sendo permitido pelo tipo
 * para que a carga detecte a ausência em vez de silenciá-la, mas `hasRequiredSpecs()` reprova.
 */
export type RacketSpecs = {
  readonly head_size_sq_in: number | null;
  readonly length_in: number | null;
  readonly unstrung_weight_g: number | null;
  readonly balance_mm: number | null;
  /** Perfil do quadro como publicado: '23-26-23' ou '21'. */
  readonly beam_width_mm: string | null;
  readonly string_pattern_mains: number | null;
  readonly string_pattern_crosses: number | null;
  /** Opcional: nem toda marca publica para todo modelo. Ausência reduz a confiança da tensão. */
  readonly recommended_tension_min_lbs: number | null;
  readonly recommended_tension_max_lbs: number | null;
  readonly grip_sizes_available: readonly number[];
};

export type RacketVariant = {
  readonly id: string;
  readonly brand: RacketBrand;
  readonly family: string;
  readonly model: string;
  readonly variant: string;
  readonly generation: string;
  readonly year: number | null;
  /** Nome comercial completo, exibível ao usuário. */
  readonly product_name: string;
  readonly slug: string;
  readonly status: ProductStatus;
  readonly specs: RacketSpecs;
  readonly provenance: ProvenanceMap;
  readonly verification_state: VerificationState;
  readonly global_availability: AvailabilityStatus;
  readonly brazil_availability_status: AvailabilityStatus;
  readonly data_version: string;
  readonly last_verified_at: string | null;
  /**
   * Quando a curadoria confirmou que esta é a geração vigente. `null` = nunca confirmada.
   *
   * Silencia o aviso de idade do gate enquanto a confirmação for recente — ver `verificationSchema`
   * em `data/load.ts`.
   */
  readonly generation_confirmed_at: string | null;
  readonly image_url: string | null;
  /** Só exibimos a imagem se ela foi confirmada como sendo desta variante e geração (§54). */
  readonly image_verified: boolean;
};

/** Camada 2 — atributos derivados (docs/RECOMMENDATION_ENGINE.md §2). Nunca digitados à mão. */
export type RacketAttributes = {
  readonly power_score: Score;
  readonly control_score: Score;
  readonly spin_score: Score;
  readonly comfort_score: Score;
  readonly stability_score: Score;
  readonly maneuverability_score: Score;
  readonly forgiveness_score: Score;
  readonly precision_score: Score;
  readonly feel_score: Score;
  readonly launch_angle_score: Score;
  readonly arm_friendliness_score: Score;
  /** Quanto de técnica o frame cobra do jogador. */
  readonly demand_index: Score;
  /** 0–1. Fração dos dados necessários que estava presente. */
  readonly data_completeness: number;
  readonly missing_fields: readonly string[];
  /**
   * Índice de balanço Tennis Engineer (0–100) — inércia de swing derivada de peso × balanço.
   * NÃO é swingweight e nunca é exibido com esse nome.
   */
  readonly swing_index: Score;
  /** Índice de rigidez derivado do perfil da viga (0–100). Proxy publicado, não medição. */
  readonly stiffness_index: Score;
  readonly methodology_version: string;
};

export const RACKET_ATTRIBUTE_KEYS = [
  'power_score',
  'control_score',
  'spin_score',
  'comfort_score',
  'stability_score',
  'maneuverability_score',
  'forgiveness_score',
  'precision_score',
  'feel_score',
  'launch_angle_score',
  'arm_friendliness_score',
] as const;

export type RacketAttributeKey = (typeof RACKET_ATTRIBUTE_KEYS)[number];

export type PlayStyle =
  | 'baseline'
  | 'aggressive_baseliner'
  | 'counterpuncher'
  | 'heavy_spin'
  | 'flat_hitter'
  | 'all_court'
  | 'serve_and_volley'
  | 'net_player';

export const PLAY_STYLES: readonly PlayStyle[] = [
  'baseline',
  'aggressive_baseliner',
  'counterpuncher',
  'heavy_spin',
  'flat_hitter',
  'all_court',
  'serve_and_volley',
  'net_player',
];

export type SkillTier = 'beginner' | 'intermediate' | 'advanced' | 'competitive';

/** Adequações como gradiente (0–100), não booleanos — adequação nunca é binária (§6). */
export type RacketFitProfile = {
  readonly beginner_fit: Score;
  readonly intermediate_fit: Score;
  readonly advanced_fit: Score;
  readonly competitive_fit: Score;
  readonly styles: Readonly<Record<PlayStyle, Score>>;
  readonly methodology_version: string;
};

/** Uma variante com tudo que o motor precisa. Produzido por `normalize/racket-attributes.ts`. */
export type ScoredRacket = {
  readonly variant: RacketVariant;
  readonly attributes: RacketAttributes;
  readonly fitProfile: RacketFitProfile;
};

/** Campos sem os quais a variante não pode ser recomendada de forma alguma. */
/**
 * Campos sem os quais a variante não é recomendável.
 *
 * Na v2 todos são publicados pelo fabricante, então uma variante bem cadastrada passa sempre —
 * é isso que permite a confiança chegar a "Alta".
 */
export function hasRequiredSpecs(specs: RacketSpecs): boolean {
  return (
    specs.head_size_sq_in !== null &&
    specs.unstrung_weight_g !== null &&
    specs.balance_mm !== null &&
    specs.beam_width_mm !== null &&
    specs.string_pattern_mains !== null &&
    specs.string_pattern_crosses !== null
  );
}

/**
 * Perfil médio da viga a partir da string publicada pelo fabricante ('23-26-23' ou '21').
 *
 * Aceita hífen, barra ou travessão como separador — as marcas usam os três. Vive no domínio porque
 * tanto o motor quanto a análise de cobertura do catálogo precisam do mesmo número.
 */
export function averageBeam(beam: string | null): number | null {
  if (beam === null) return null;
  const parts = beam
    .split(/[/\-–]/)
    .map((p) => Number.parseFloat(p.trim()))
    .filter((n) => Number.isFinite(n));
  if (parts.length === 0) return null;
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

/**
 * Como a raquete ATUAL do jogador é nomeada — modelo e peso, nunca geração.
 *
 * ═══ O DEFEITO QUE ISTO CORRIGE ══════════════════════════════════════════════════════════════
 *
 * O questionário promete, com estas palavras: "Não precisa saber o ano nem a versão: o que importa
 * é o modelo e o peso". A lista de busca cumpre a promessa e mostra "Blade 98 16×19 · 305 g", sem
 * geração — decisão deliberada, documentada em `racket-picker.tsx` e em `questionario/page.tsx`:
 * ninguém sabe de que geração é a própria raquete, e ver um ano que não bate faz a pessoa concluir
 * que a dela não está na lista.
 *
 * O relatório então devolvia `product_name`, que é o nome COMERCIAL COMPLETO do catálogo:
 * "Wilson Blade 98 16×19 v10 (2026)". A pessoa nunca respondeu "v10", nunca respondeu "2026", e
 * recebia as duas coisas de volta como se tivesse afirmado. Num relatório pago, isso é o produto
 * pondo na boca do cliente um dado que ele não deu — e que pode estar errado, porque a variante
 * casada é uma escolha nossa entre gerações, não uma informação dele.
 *
 * ─── POR QUE UMA FUNÇÃO COMPARTILHADA, E NÃO DUAS MONTAGENS ────────────────────────────────
 *
 * Porque a regra é a mesma nos dois lugares e o defeito nasceu exatamente de elas serem separadas:
 * o picker seguia a regra, o relatório não. Com uma função só, mudar a forma do nome muda os dois
 * ao mesmo tempo, e o relatório não tem como voltar a divergir da pergunta em silêncio.
 *
 * ─── ONDE `product_name` CONTINUA CERTO ────────────────────────────────────────────────────
 *
 * Nas raquetes RECOMENDADAS. Ali a geração é informação necessária: a pessoa vai comprar, e
 * precisa saber qual versão foi avaliada. A assimetria é proposital — o que ela declara é o modelo,
 * o que nós indicamos é um produto específico.
 */
export function racketModelLabel(model: string, weightG: number | null): string {
  return typeof weightG === 'number' ? `${model} · ${weightG} g` : model;
}

export function currentRacketLabel(
  variant: Pick<RacketVariant, 'brand' | 'model' | 'specs'>,
): string {
  return `${variant.brand} ${racketModelLabel(variant.model, variant.specs.unstrung_weight_g)}`;
}
