/**
 * Faixas de referência do domínio — docs/RECOMMENDATION_ENGINE.md §1.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────────────────┐
 * │ v2 — ESPECIFICAÇÕES CONSOLIDADAS DE MERCADO                                              │
 * │                                                                                          │
 * │ O motor usa EXCLUSIVAMENTE os campos que as quatro marcas publicam no próprio catálogo e │
 * │ que qualquer varejista especializado reproduz — os mesmos do spec card do brand book:    │
 * │                                                                                          │
 * │   peso (sem cordas) · balanço · padrão de encordoamento · tamanho da cabeça ·            │
 * │   perfil do quadro (viga) · comprimento · faixa de tensão                                │
 * │                                                                                          │
 * │ REMOVIDOS na v2: swingweight, rigidez RA, twistweight e peso encordoado. São medições de │
 * │ laboratório, não são publicadas pelo fabricante, variam por exemplar e não são obtíveis   │
 * │ de forma consistente entre as quatro marcas. Depender delas mantinha o catálogo em        │
 * │ completude 0.61 e travava a confiança em "Média" para todo mundo.                         │
 * └──────────────────────────────────────────────────────────────────────────────────────────┘
 */

/**
 * 2.11.0 — a linha tracejada do radar passou a ter duas leituras: BORDA nos cinco eixos de encaixe
 * (ninguém passa do ideal) e TAMANHO DO PEDIDO nos três de bola (a raquete pode entregar mais do
 * que se pediu, e isso é bom). As duas unificações anteriores falharam por lados opostos.
 *
 * 2.10.0 — um eixo de bola sem pedido deixou de ser desenhado em 70 e passa a aparecer atendido
 * (100), como o motor já o tratava: `objectiveFit` exclui esses eixos da média em vez de pontuá-los.
 * O número do match não muda — ele nunca contou esses eixos. O que muda é o gráfico parar de cobrar.
 *
 * 2.9.0 — a linha do radar passou a ser o IDEAL: a borda da escala de adequação, 100 em todo eixo,
 * que nenhuma raquete ultrapassa. A 2.8.0 a tinha posto como nível de pedido (55 a 94), o que
 * plotava duas grandezas diferentes no mesmo eixo — adequação contra intensidade de pedido.
 *
 * 2.8.0 — a linha "o que seu jogo pede" do radar deixou de ser o teto da oferta e passou a ser o
 * pedido do questionário, com hierarquia entre os eixos (ver `payments/radar.ts`).
 *
 * O RANKING não mudou: nenhum score, peso ou penalidade foi tocado, e as mesmas respostas produzem
 * a mesma raquete. Ainda assim a versão sobe, porque o relatório é o produto e um mesmo número de
 * metodologia não pode carregar dois significados diferentes para a mesma linha do mesmo gráfico —
 * quem abrir um relatório antigo precisa conseguir saber qual das duas leituras estava valendo.
 */
export const METHODOLOGY_VERSION = '2.11.0';

export type Range = readonly [lo: number, hi: number];

export const RANGES = {
  /** Da menor cabeça de torneio ao oversize recreativo. */
  head_size_sq_in: [93, 115] as Range,
  /**
   * Do ultraleve recreativo ao tour pesado, sem cordas.
   * O piso é 225 g porque frames de iniciante como a HEAD Ti.S6 chegam lá — cortar a faixa em
   * 255 g apagaria justamente o segmento que o catálogo precisa cobrir.
   */
  unstrung_weight_g: [225, 340] as Range,
  /** Peso com cordas (derivado). */
  strung_weight_g: [241, 356] as Range,
  /** Balanço sem cordas: ~9 pts head-light a fortemente head-heavy (frames leves de iniciante). */
  balance_mm: [290, 385] as Range,
  /** Perfil médio da viga: box beam fino a widebody de iniciante. */
  beam_width_avg_mm: [19, 29] as Range,
  /**
   * Índice de balanço Tennis Engineer — inércia de swing derivada de peso × balanço.
   * NÃO é swingweight e nunca é exibido como tal. Ver `computeSwingIndex()`.
   */
  swing_index: [1.25e7, 2.10e7] as Range,
} as const;

/**
 * Massa adicionada por um jogo de cordas (~16 g) e o deslocamento de balanço que ela provoca.
 *
 * As cordas ficam concentradas na cabeça, então encordoar sobe o balanço em torno de 8 mm num
 * frame de 27". Ambos são derivações declaradas a partir de dados publicados — nunca exibidas
 * como especificação do fabricante.
 */
export const STRING_SET_MASS_G = 16;
export const STRING_SET_BALANCE_SHIFT_MM = 8;

/** Eixo do índice de balanço: 10 cm do topo do cabo, convenção da indústria. */
export const SWING_AXIS_MM = 100;

/** Limites físicos absolutos de tensão por tipo de corda. */
export const TENSION_BOUNDS_LBS = {
  polyester: [40, 58] as Range,
  co_polyester: [40, 58] as Range,
  /**
   * Entre o poliéster e a synthetic gut, como o material.
   *
   * O piso sobe em relação ao poliéster porque a poliamida é mais elástica: encordoada muito baixa
   * ela vira trampolim, problema que um poliéster não tem. O teto fica abaixo do da synthetic gut
   * porque o fio único não perdoa tensão alta como uma trançada perdoa.
   */
  polyamide_monofilament: [43, 60] as Range,
  multifilament: [45, 64] as Range,
  synthetic_gut: [45, 62] as Range,
  natural_gut: [48, 66] as Range,
  hybrid: [42, 62] as Range,
} as const;

/** Usada quando o fabricante não publica a faixa — acompanhada de nota e queda de confiança. */
export const FALLBACK_BASE_TENSION_LBS = 52;

/** Offset da cross em híbridos — convenção configurável. */
export const HYBRID_CROSS_OFFSET_LBS = 2;

/** Diferença de fit abaixo da qual duas raquetes são um empate técnico (§23, §62). */
export const TECHNICAL_TIE_THRESHOLD = 2.0;

/**
 * Fit mínimo para ocupar a SEGUNDA e a TERCEIRA posição do pódio (regra ética do §30).
 *
 * Não se aplica ao primeiro colocado: ver a explicação em `selectPodium`. O §30 proíbe acrescentar
 * opções fracas para viabilizar o upsell, não entregar a melhor opção que existe.
 */
export const MIN_PODIUM_FIT = 75;

/**
 * Fit que o produto se propõe a entregar ao primeiro colocado de QUALQUER perfil.
 *
 * É uma meta de calibração, verificada pela matriz de personas — não uma trava de execução. Se o
 * motor não a atinge para algum perfil, o defeito é do motor ou do catálogo, e o lugar de corrigir
 * é lá. Inflar o número exibido para alcançá-la seria mentir sobre a qualidade da recomendação,
 * que é justamente o que este produto vende.
 */
export const TARGET_TOP_MATCH = 80;

/**
 * Piso absoluto do primeiro colocado, verificado em teste.
 *
 * Fica abaixo de `TARGET_TOP_MATCH` porque existem perfis cujo pedido é internamente
 * contraditório — mais estabilidade E mais manobrabilidade, que puxam a massa em direções opostas.
 * Para eles a melhor raquete do mercado ainda deixa algo por atender, e o número honesto é menor.
 */
export const MIN_TOP_MATCH = 75;

/** Abaixo disto a variante não tem dados suficientes para uma recomendação paga. */
export const MIN_DATA_COMPLETENESS = 0.85;

/**
 * Perfil de viga a partir do qual o quadro é considerado rígido o bastante para representar
 * risco a quem relata desconforto recorrente.
 *
 * ⚠️ LIMITAÇÃO CONHECIDA E DOCUMENTADA: o perfil da viga é um PROXY de rigidez, não uma medição.
 * A correlação é boa na média (viga larga ⇒ mais rígida), mas tem exceções conhecidas — a Wilson
 * Clash tem viga larga e é notoriamente flexível. Por isso a proteção ao braço na v2 é
 * multicamada e o filtro de quadro é o elo mais fraco dela:
 *
 *   1. corda  — poliéster é EXCLUÍDO por regra dura (proteção mais forte, independe deste proxy)
 *   2. tensão — reduzida proporcionalmente à sensibilidade relatada
 *   3. quadro — penalização graduada + exclusão apenas nos casos mais claros (aqui)
 */
export const STIFF_BEAM_THRESHOLD_MM = 25.5;
export const VERY_STIFF_BEAM_THRESHOLD_MM = 26.5;
