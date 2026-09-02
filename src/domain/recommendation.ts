/**
 * Tipos de saída do motor — docs/RECOMMENDATION_ENGINE.md §7.
 *
 * Toda pontuação exibida ao usuário tem um `ScoreBreakdown` correspondente persistido. É isso que
 * impede o algoritmo de virar caixa-preta (§48) e o que alimenta o simulador do admin (§47).
 */

import type { ScoredRacket } from './racket';
import type { NeedKey } from './player-profile';
import type { ScoredStringVariant } from './string';
import type { ConfidenceLevel } from './sourced';
import type { Score, WeightedTerm } from './scores';

export type ComponentKey =
  | 'physical_fit'
  | 'skill_fit'
  | 'swing_fit'
  | 'playstyle_fit'
  | 'objective_fit'
  | 'comfort_fit'
  | 'transition_fit';

export const COMPONENT_KEYS: readonly ComponentKey[] = [
  'physical_fit',
  'skill_fit',
  'swing_fit',
  'playstyle_fit',
  'objective_fit',
  'comfort_fit',
  'transition_fit',
];

export type ComponentBreakdown = {
  readonly key: ComponentKey;
  /** Score bruto do componente, 0–100. */
  readonly raw: Score;
  readonly weight: number;
  readonly contribution: number;
  readonly terms: readonly WeightedTerm[];
  readonly missing_fields: readonly string[];
};

export type Penalty = {
  readonly code: string;
  readonly points: number;
  readonly reason: string;
  /**
   * Eixo de necessidade envolvido, quando a penalização é sobre um objetivo declarado.
   *
   * Sem ele o relatório só conseguia repetir a frase da penalização — "você pediu mais
   * estabilidade, mas este frame vai na direção contrária" —, que informa o problema e esconde o
   * raciocínio. Com o eixo dá para ir buscar no ranking o que a alternativa mais estável custaria,
   * e transformar a constatação numa troca explicada.
   */
  readonly axis?: NeedKey;
};

export type ScoreBreakdown = {
  readonly final_score: Score;
  readonly components: readonly ComponentBreakdown[];
  readonly penalties: readonly Penalty[];
  readonly data_completeness: number;
  /** Motivos legíveis pelos quais a raquete ganhou pontos. */
  readonly gained: readonly string[];
  /** Motivos legíveis pelos quais perdeu pontos. */
  readonly lost: readonly string[];
};

export type RankedRacket = {
  readonly rank: number;
  readonly racket: ScoredRacket;
  readonly fit_score: Score;
  readonly breakdown: ScoreBreakdown;
  /** true quando está a menos de TECHNICAL_TIE_THRESHOLD do vizinho no ranking (§62). */
  readonly technical_tie_with_previous: boolean;
};

/** Variante excluída antes da pontuação. O admin precisa ver POR QUE algo não apareceu. */
export type ExcludedRacket = {
  readonly variant_id: string;
  readonly product_name: string;
  readonly filter: string;
  readonly reason: string;
};

/** Comparação atual × recomendada (§22). */
export type SpecComparison = {
  readonly label: string;
  readonly current: number | null;
  readonly recommended: number | null;
  readonly unit: string;
  readonly delta: number | null;
  readonly direction: 'up' | 'down' | 'same' | 'unknown';
  /** Interpretação honesta: uma mudança pode ser ganho E perda ao mesmo tempo. */
  readonly interpretation: string;
};

export type TransitionAnalysis = {
  readonly available: boolean;
  readonly comparisons: readonly SpecComparison[];
  readonly expectations: readonly string[];
  readonly attention_points: readonly string[];
};

export type TensionAdjustment = {
  readonly factor: string;
  readonly delta_lbs: number;
  readonly rationale: string;
};

export type TensionRecommendation = {
  readonly lbs: number;
  readonly kg: number;
  readonly range_lbs: readonly [number, number];
  readonly mains_lbs: number | null;
  readonly crosses_lbs: number | null;
  readonly base_lbs: number;
  readonly base_source: 'manufacturer_range' | 'fallback';
  readonly adjustments: readonly TensionAdjustment[];
  readonly clamped_by: 'frame_range' | 'string_type_bounds' | null;
  /**
   * O valor ANTES dos limites de segurança — o que a conta daria se nada a tivesse contido.
   *
   * Existe para o relatório poder fechar a própria aritmética. Sem ele, o leitor via a base, via os
   * ajustes e via um resultado final que não era a soma dos dois, sem nada explicando a diferença.
   * `undefined` em relatórios gravados antes deste campo existir.
   */
  readonly pre_clamp_lbs?: number;
  readonly anchored_to_current: boolean;
  readonly anchor_weight: number;
  readonly guidance: string;
  readonly notes: readonly string[];
};

export type StringRecommendation = {
  readonly variant: ScoredStringVariant;
  readonly fit_score: Score;
  readonly target: Readonly<Record<string, number>>;
  readonly rationale: readonly string[];
  /** Nota quando o gauge ideal não existe para este modelo (Regra de Integridade). */
  readonly gauge_note: string | null;
  readonly excluded_types: readonly string[];
  /**
   * Modelos que a análise não conseguiu distinguir da escolhida.
   *
   * Vazio na maioria dos casos. Quando não é, é informação de primeira ordem: significa que os
   * dados publicados não separam estes produtos, e que a escolha entre eles cabe ao jogador, por
   * preço, disponibilidade ou preferência de marca. Omitir a lista seria afirmar uma distinção que
   * não foi feita.
   */
  readonly equivalents?: readonly string[];
};

export type ConfidenceReason = {
  readonly code: string;
  readonly points: number;
  readonly message: string;
  /** O que o usuário poderia informar para reduzir a incerteza. */
  readonly remedy: string | null;
};

export type RecommendationConfidence = {
  readonly score: Score;
  readonly level: ConfidenceLevel;
  readonly reasons: readonly ConfidenceReason[];
  /** Quão bem conhecemos o JOGADOR (respostas, contradições, sinais inferidos). */
  readonly profile_knowledge: Score;
  /** Quão bem conhecemos o EQUIPAMENTO (completude das specs, faixa de tensão do fabricante). */
  readonly data_knowledge: Score;
};

export type RecommendationResult = {
  readonly engine_version: string;
  readonly weights_version: string;
  readonly dataset_version: string;
  readonly methodology_version: string;

  readonly podium: readonly RankedRacket[];
  /** Ranking completo para auditoria e simulador. Nunca serializado ao cliente. */
  readonly full_ranking: readonly RankedRacket[];
  readonly excluded: readonly ExcludedRacket[];
  readonly candidates_evaluated: number;

  readonly transition: TransitionAnalysis;
  readonly string_recommendation: StringRecommendation | null;
  readonly tension: TensionRecommendation | null;

  readonly confidence: RecommendationConfidence;
  /** false quando não existe 2º ou 3º colocado para ofertar (§30). */
  readonly top3_offer_available: boolean;

  /**
   * Faixa [mín, máx] que o catálogo ocupa em cada atributo exibido, no momento desta análise.
   *
   * Viaja junto com o resultado, e não é recalculada na hora de mostrar, porque um relatório
   * comprado precisa continuar sendo lido exatamente como foi vendido. Se as faixas fossem
   * derivadas do catálogo vigente, incluir uma raquete nova amanhã mudaria os números de um
   * relatório de ontem — sem que nada tivesse acontecido com a raquete recomendada.
   */
  readonly attribute_bands: Readonly<Record<string, readonly [number, number]>>;
  /**
   * Posição da média do catálogo em cada eixo exibido, 0–100.
   *
   * Viaja no resultado pelo mesmo motivo de `attribute_bands`: um relatório comprado precisa
   * continuar sendo lido como foi vendido. E é indispensável ao radar — a média NÃO pode ser
   * recalculada a partir de `full_ranking`, que já passou pelos filtros e tem a média deslocada
   * para cima justamente no eixo que o jogador pediu.
   */
  readonly attribute_means: Readonly<Record<string, number>>;
  /**
   * Média de cada componente de encaixe sobre tudo que foi avaliado. Ver `RankResult`.
   *
   * Viaja no resultado pelos mesmos dois motivos das faixas: um relatório comprado precisa
   * continuar sendo lido como foi vendido, e a média NÃO pode ser recalculada a partir de
   * `full_ranking`, que já passou pelo piso de demanda.
   */
  readonly component_means: Readonly<Record<string, number>>;

  /**
   * Ponto de partida contra o qual o objetivo foi medido: a raquete atual quando reconhecida, a
   * média do catálogo filtrado quando não.
   *
   * Viaja no resultado pelo mesmo motivo de `attribute_bands` — o relatório precisa continuar
   * dizendo AMANHÃ o que disse na hora da compra —, mas serve a um propósito diferente: sem ele o
   * relatório consegue afirmar que a raquete entrega X, e não consegue afirmar o quanto isso
   * AVANÇOU em relação ao que a pessoa já tinha. É a diferença entre um número e uma resposta.
   *
   * Opcional porque relatórios gravados antes deste campo existir não o têm. Quem os lê perde a
   * explicação de pedido não atendido, e não ganha uma explicação inventada a partir de uma
   * referência recalculada hoje — que descreveria outra análise.
   */
  readonly objective_reference?: Readonly<Record<NeedKey, number>>;

  /**
   * Variante do pódio para a qual `string_recommendation` e `tension` foram calculados.
   *
   * `null` = a 1ª colocada, que é o padrão. Só muda quando o jogador compra o upgrade de setup e
   * escolhe outra posição — e é este campo que faz o relatório dizer PARA QUAL raquete o setup
   * vale, em vez de deixar a corda solta ao lado de três nomes.
   */
  readonly setup_for_variant_id?: string | null;

  /**
   * O mesmo cálculo de corda e tensão, aplicado à raquete que a pessoa JÁ TEM.
   *
   * ═══ POR QUE ISTO EXISTE ═════════════════════════════════════════════════════════════════════
   *
   * O relatório sabia dizer onde a raquete atual ficou no ranking e a que distância da primeira, e
   * parava aí. Para quem não vai trocar de quadro agora — que é a maioria, porque quadro custa
   * caro — o produto terminava numa constatação: "a sua está em 12º". Verdadeiro e inútil.
   *
   * A pergunta que faltava é a que qualquer pessoa faz em seguida: "está bem, mas o que eu faço
   * com a raquete que eu tenho?". E ela tem resposta técnica de verdade, porque corda e tensão
   * movem eixos reais — potência, conforto, controle, spin — por uma fração do preço de um quadro,
   * e são reversíveis no próximo encordoamento.
   *
   * ─── E POR QUE ISTO NÃO CANIBALIZA A RECOMENDAÇÃO DE QUADRO ────────────────────────────────
   *
   * Porque não substitui: o teto do que corda e tensão alcançam é menor que o de um quadro certo,
   * e o relatório diz isso. O que muda é a honestidade da entrega — §62 e §58. Vender uma análise
   * que aponta uma raquete de mil reais e cala sobre os trinta reais que melhorariam a de hoje é
   * exatamente o desenho que o produto se proíbe.
   *
   * ═══ `null` E AUSENTE NÃO SÃO A MESMA COISA ══════════════════════════════════════════════════
   *
   * `null` — a análise foi calculada com esta seção existindo, e não houve o que calcular: sem
   * raquete atual reconhecida, ou nenhuma corda compatível com as restrições do jogador.
   *
   * AUSENTE (a chave não existe) — a análise é anterior a este campo. `JSON.stringify` preserva
   * `null` e descarta chaves ausentes, então a distinção sobrevive ao banco, e o relatório diz
   * coisas diferentes nos dois casos: no primeiro explica que não havia o que calcular, no segundo
   * que a análise é antiga e que refazer o questionário traz a seção.
   *
   * ─── E POR QUE ELE É CALCULADO ATÉ QUANDO A RAQUETE ATUAL VENCE ────────────────────────────
   *
   * Porque quem decide se ele APARECE é o relatório, não o motor. O seletor de setup pode ser
   * movido depois do cálculo, e quem tem a própria raquete em 1º e aponta o setup para a 2ª deixaria
   * de ver o setup dela em lugar nenhum. Ver a nota em `recommend` (recommendation/index.ts).
   */
  readonly current_racket_setup?: {
    readonly string_recommendation: StringRecommendation;
    readonly tension: TensionRecommendation;
  } | null;
};
