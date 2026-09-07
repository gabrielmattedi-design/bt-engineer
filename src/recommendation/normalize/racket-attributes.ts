/**
 * Camada 2 — normalização de raquetes (v2).
 *
 * Converte ESPECIFICAÇÕES CONSOLIDADAS DE MERCADO em atributos comparáveis 0–100.
 * Implementa docs/RECOMMENDATION_ENGINE.md §2.
 *
 * Entradas — todas publicadas pelo fabricante e reproduzidas por qualquer varejista:
 *   tamanho da cabeça · peso (sem cordas) · balanço · perfil da viga · padrão de encordoamento
 *
 * Duas grandezas derivadas, ambas calculadas a partir das acima e nomeadas de forma que não se
 * confundam com medições de laboratório:
 *   • `swing_index`     — inércia de swing (peso × balanço). NÃO é swingweight.
 *   • `stiffness_index` — proxy de rigidez a partir do perfil da viga. NÃO é RA.
 */

import {
  METHODOLOGY_VERSION,
  RANGES,
  STRING_SET_BALANCE_SHIFT_MM,
  STRING_SET_MASS_G,
  SWINGWEIGHT_FALLBACK,
} from '@/domain/reference-ranges';
import { clamp, clamp01, inv, norm, toScore, weighted, type WeightedTerm } from '@/domain/scores';
import { averageBeam } from '@/domain/racket';
import type {
  PlayStyle,
  RacketAttributes,
  RacketFitProfile,
  RacketSpecs,
  RacketVariant,
  ScoredRacket,
  SkillTier,
} from '@/domain/racket';

/**
 * Abertura do padrão de cordas.
 *
 * Mains pesam mais que crosses (0.60 vs 0.40) porque o espaçamento longitudinal domina o movimento
 * do encordoamento, que é o mecanismo do snap-back e portanto do spin.
 * Referência: 18×20 → 0.00 · 16×20 → 0.375 · 16×19 → 0.50 · 16×18 → 0.625 · 14×18 → 1.00
 */
export function computeOpenness(mains: number | null, crosses: number | null): number | null {
  if (mains === null || crosses === null) return null;
  const densityRaw = 0.6 * norm(mains, 14, 18) + 0.4 * norm(crosses, 16, 20);
  return clamp01((1 - densityRaw) / 0.8);
}

/**
 * Peso com cordas. Derivação declarada de `unstrung + 16 g`, nunca exibida como spec do fabricante.
 */
export function resolveStrungWeight(specs: RacketSpecs): number | null {
  return specs.unstrung_weight_g === null ? null : specs.unstrung_weight_g + STRING_SET_MASS_G;
}

/** Balanço com cordas: as cordas ficam na cabeça, então o balanço sobe ~8 mm. */
export function resolveStrungBalance(specs: RacketSpecs): number | null {
  return specs.balance_mm === null ? null : specs.balance_mm + STRING_SET_BALANCE_SHIFT_MM;
}

/** Perfil médio da viga, a partir da string publicada ('23-26-23' ou '21'). */
export function parseBeamAverage(specs: RacketSpecs): number | null {
  return averageBeam(specs.beam_width_mm);
}

/**
 * Índice de balanço Tennis Engineer — inércia de swing em g·mm².
 *
 * Momento de inércia de uma massa concentrada no ponto de balanço, em torno do eixo a 10 cm do topo
 * do cabo (convenção da indústria): `m × (balanço − 100 mm)²`.
 *
 * É a MESMA grandeza física que o swingweight mede, calculada a partir de dados publicados em vez
 * de medida em bancada. Por isso captura bem a diferença entre um frame leve e head-light e um
 * pesado e head-heavy, mas NÃO captura a polarização da distribuição de massa — dois frames de
 * mesmo peso e balanço com massa distribuída de formas diferentes recebem o mesmo índice.
 *
 * É por isso que ele não se chama swingweight e nunca é exibido como tal.
 */
export type SwingweightOrigem = 'lab' | 'modelo';

/**
 * Swingweight encordoado em kg·cm² — MEDIDO quando existe, estimado quando não.
 *
 * ═══ O QUE ESTA FUNÇÃO ERA, E POR QUE MUDOU ══════════════════════════════════════════════════
 *
 * Era `massa × (balanço − 100 mm)²`: um modelo de massa pontual que finge que o quadro inteiro
 * está concentrado no ponto de balanço. A decomposição exata do momento de inércia é
 *
 *     I = M·(balanço − 100)²  +  M·σ²
 *
 * e o segundo termo — o espalhamento da massa — nunca era calculado. Ele não é um resíduo: para
 * uma raquete real ele é MAIOR que o primeiro. O modelo devolvia o equivalente a 152 kg·cm² onde
 * a medição dá 327.
 *
 * Medido contra as 47 medições de laboratório em 07/09/2026:
 *
 *   • r(modelo, swingweight real) = 0,344 → R² = 0,119
 *   • r(peso estático, swingweight real) = 0,844 → R² = 0,713
 *   • o modelo ordenava 32,7% dos pares AO CONTRÁRIO da realidade (173 deles com diferença de
 *     8 pontos ou mais, que é onde a diferença deixa de ser acadêmica)
 *
 * Ou seja: era pior que não ter proxy nenhum. O caso que expôs isso está em `RacketSpecs`.
 *
 * ═══ POR QUE A ORIGEM VIAJA JUNTO COM O NÚMERO ═══════════════════════════════════════════════
 *
 * Um valor medido e um estimado não valem o mesmo, e a diferença precisa sobreviver até quem
 * escreve a frase do relatório. Devolver só o número deixaria os dois indistinguíveis a jusante —
 * que é exatamente como uma estimativa vira afirmação categórica sem ninguém decidir isso.
 */
export function resolveSwingweight(
  specs: RacketSpecs,
): { readonly kgcm2: number; readonly origem: SwingweightOrigem } | null {
  if (specs.swingweight_kgcm2 !== null) {
    return { kgcm2: specs.swingweight_kgcm2, origem: 'lab' };
  }
  const mass = specs.unstrung_weight_g;
  const balance = specs.balance_mm;
  if (mass === null || balance === null) return null;
  return {
    kgcm2:
      SWINGWEIGHT_FALLBACK.intercepto +
      SWINGWEIGHT_FALLBACK.por_grama * mass +
      SWINGWEIGHT_FALLBACK.por_mm_de_balanco * balance,
    origem: 'modelo',
  };
}

/** O valor cru, para quem só compara raquetes entre si. Prefira `resolveSwingweight`. */
export function computeSwingIndex(specs: RacketSpecs): number | null {
  return resolveSwingweight(specs)?.kgcm2 ?? null;
}

type NormalizedSpecs = {
  h: number | null; // cabeça
  w: number | null; // peso com cordas
  b: number | null; // balanço com cordas
  m: number | null; // perfil da viga
  o: number | null; // abertura do padrão
  d: number | null; // densidade = 1 - abertura
  s: number | null; // swingweight (medido, ou estimado pela reserva)
  r: number | null; // rigidez RA medida — `null` quando não há medição, de propósito
};

function normalizeSpecs(specs: RacketSpecs): NormalizedSpecs {
  const n = (v: number | null, r: readonly [number, number]): number | null =>
    v === null ? null : norm(v, r[0], r[1]);

  const o = computeOpenness(specs.string_pattern_mains, specs.string_pattern_crosses);

  return {
    h: n(specs.head_size_sq_in, RANGES.head_size_sq_in),
    w: n(resolveStrungWeight(specs), RANGES.strung_weight_g),
    b: n(resolveStrungBalance(specs), RANGES.balance_mm),
    m: n(parseBeamAverage(specs), RANGES.beam_width_avg_mm),
    o,
    d: o === null ? null : 1 - o,
    s: n(computeSwingIndex(specs), RANGES.swing_index),
    /*
      Sem reserva, DE PROPÓSITO — ao contrário do swingweight.

      A reserva do swingweight é uma regressão de R² = 0,816: estimar é melhor que ignorar. Para o
      RA não existe equivalente. O único candidato era o perfil da viga, que foi o que o
      `stiffness_index` usou até aqui, e medido contra os 47 RA reais ele dá R² = 0,010. Isso não
      é um proxy fraco, é ruído com aparência de dado.

      Quando o RA falta, o termo simplesmente sai da conta: `weighted()` redistribui o peso entre
      os presentes e `data_completeness` registra a ausência. Uma nota com um termo a menos e a
      falta declarada é honesta; a mesma nota preenchida com ruído não é.
    */
    r: n(specs.ra_stiffness, RANGES.ra_stiffness),
  };
}

const invOrNull = (v: number | null): number | null => (v === null ? null : inv(v));

/** Traduz o rótulo de um termo para o CAMPO publicado que o originou. */
const TERM_TO_FIELD: Record<string, string> = {
  head_size: 'head_size_sq_in',
  head_size_inverse: 'head_size_sq_in',
  weight: 'unstrung_weight_g',
  weight_inverse: 'unstrung_weight_g',
  balance: 'balance_mm',
  balance_inverse: 'balance_mm',
  beam_width: 'beam_width_mm',
  beam_width_inverse: 'beam_width_mm',
  /*
    Apontavam para `balance_mm` porque o swing_index NASCIA do balanço. Agora ele é uma medição de
    laboratório com campo e proveniência próprios — e é esse campo que a tela de "de onde veio este
    número" precisa citar. Deixar apontando para o balanço mandaria o leitor conferir a fonte
    errada, que é pior do que não mostrar fonte.
  */
  swing_index: 'swingweight_kgcm2',
  swing_index_inverse: 'swingweight_kgcm2',
  ra_inverse: 'ra_stiffness',
  pattern_openness: 'string_pattern',
  pattern_density: 'string_pattern',
};

export const FIELD_LABEL_PT: Record<string, string> = {
  head_size_sq_in: 'tamanho da cabeça',
  unstrung_weight_g: 'peso',
  balance_mm: 'balanço',
  beam_width_mm: 'perfil do quadro',
  string_pattern: 'padrão de cordas',
  swingweight_kgcm2: 'swingweight medido',
  ra_stiffness: 'rigidez RA medida',
};

export function humanizeMissingFields(fields: readonly string[]): string {
  return fields.map((f) => FIELD_LABEL_PT[f] ?? f).join(', ');
}

/**
 * Orçamento dos seis eixos de comportamento: 6 × 50, o ponto neutro de cada escala 0–100.
 *
 * É uma constante fixa e não a média do catálogo. Se fosse a média, incluir ou remover uma raquete
 * deslocaria os índices de TODAS as outras — e um relatório vendido em março passaria a exibir
 * números diferentes em abril sem que nada tivesse sido descoberto sobre aquela raquete.
 */
const ATTRIBUTE_BUDGET = 300;

/** Quantas rodadas de redistribuição. Seis eixos, então seis rodadas bastam no pior caso. */
const LEVELIZE_PASSES = 6;

/**
 * Nivela a soma dos eixos no orçamento, preservando o contraste interno.
 *
 * O deslocamento é o MESMO em todos os eixos, então as distâncias entre eles não mudam: uma
 * raquete que estava 12 pontos acima em potência em relação ao próprio controle continua 12 pontos
 * acima. Só o nível se move.
 *
 * O laço existe por causa dos limites 0 e 100. Quando um eixo satura, o que sobra dele é
 * redistribuído entre os que ainda podem andar — é assim que a Ti.S6, que é extrema, termina com
 * potência e spin colados no teto e o resto no fundo, em vez de com tudo espremido no meio.
 */
export function levelize(values: readonly number[]): number[] {
  const out = [...values];

  for (let pass = 0; pass < LEVELIZE_PASSES; pass += 1) {
    const sum = out.reduce((acc, v) => acc + v, 0);
    const deficit = ATTRIBUTE_BUDGET - sum;
    if (Math.abs(deficit) < 1e-9) break;

    const movable: number[] = [];
    for (let i = 0; i < out.length; i += 1) {
      if (deficit > 0 ? out[i]! < 100 : out[i]! > 0) movable.push(i);
    }
    if (movable.length === 0) break;

    const step = deficit / movable.length;
    for (const i of movable) out[i] = clamp(out[i]! + step, 0, 100);
  }

  return out;
}

/**
 * Calcula os 11 atributos derivados + demand_index + os dois índices auxiliares.
 *
 * Como todos os termos vêm de campos publicados, uma variante bem cadastrada tem
 * `data_completeness = 1.0` — que é o que permite a confiança do relatório chegar a "Alta".
 */
export function computeRacketAttributes(specs: RacketSpecs): RacketAttributes {
  const n = normalizeSpecs(specs);
  const missing = new Set<string>();
  let coveredWeight = 0;
  let totalWeight = 0;

  const build = (terms: readonly WeightedTerm[]): number => {
    const result = weighted(terms);
    for (const label of result.missing) missing.add(TERM_TO_FIELD[label] ?? label);
    const sum = terms.reduce((acc, t) => acc + t.weight, 0);
    totalWeight += sum;
    coveredWeight += sum * result.coverage;
    return result.score;
  };

  const T = (label: string, value: number | null, weight: number): WeightedTerm => ({
    label,
    value,
    weight,
  });

  // Potência GRATUITA: o quanto o frame devolve sem esforço do jogador. Cabeça grande e viga larga
  // dominam; peso entra INVERTIDO porque um frame pesado exige o jogador. Plow-through pertence a
  // stability_score, não aqui.
  const power_score = build([
    T('head_size', n.h, 0.3),
    T('beam_width', n.m, 0.28),
    T('pattern_openness', n.o, 0.17),
    T('weight_inverse', invOrNull(n.w), 0.15),
    T('balance', n.b, 0.1),
  ]);

  const control_score = build([
    T('head_size_inverse', invOrNull(n.h), 0.28),
    T('pattern_density', n.d, 0.26),
    T('beam_width_inverse', invOrNull(n.m), 0.2),
    T('swing_index', n.s, 0.16),
    T('balance_inverse', invOrNull(n.b), 0.1),
  ]);

  // Abertura domina (0.45) pelo mecanismo de snap-back do encordoamento.
  const spin_score = build([
    T('pattern_openness', n.o, 0.45),
    T('head_size', n.h, 0.2),
    T('swing_index', n.s, 0.2),
    T('balance', n.b, 0.15),
  ]);

  // Viga fina = quadro mais flexível = mais conforto. Massa absorve choque. Cabeça grande e padrão
  // aberto produzem um leito de cordas mais macio.
  /*
    Conforto também passa a ser RA, e não a viga — pelo mesmo motivo de `feel` e
    `arm_friendliness`, mas aqui a troca é OBRIGATÓRIA, não opcional.

    Deixar conforto na viga enquanto os outros dois iam para o RA quebrou a monotonicidade do
    motor na hora: subir a sensibilidade no braço passou a devolver um Top 5 com MENOS afinidade
    de braço (50,3 contra 51,4). Não é paradoxo — o ranking empurrava por `comfort_score`, medido
    pela viga, e o teste media `arm_friendliness_score`, medido pelo RA. Como viga e RA são
    descorrelacionados (R² = 0,010), as duas notas deixaram de falar da mesma coisa.

    A lição para quem mexer nisto depois: os eixos que descrevem COMO O QUADRO TRATA O CORPO
    — conforto, toque, braço — têm de sair todos da mesma grandeza. Misturar duas medidas de
    rigidez entre eles não deixa metade do motor certa; deixa o motor incoerente.
  */
  const comfort_score = build([
    T('ra_inverse', invOrNull(n.r), 0.38),
    T('weight', n.w, 0.3),
    T('pattern_openness', n.o, 0.17),
    T('head_size', n.h, 0.15),
  ]);

  /**
   * Estabilidade — resistência a ser deslocado pela bola.
   *
   * ─── NOTA DE CALIBRAÇÃO (v2.2.0) ───────────────────────────────────────────────────────────
   *
   * A formulação anterior era `swing_index 0.40 + weight 0.32 + head_size 0.18 + balance 0.10`, e
   * ela produzia um veredicto impossível: a HEAD Ti.S6 — 225 g, cabeça de 115 pol² — saía como a
   * raquete MAIS ESTÁVEL do catálogo, à frente de frames de 320 g.
   *
   * O erro tem duas metades, e as duas apontam para o mesmo lugar. `swing_index` é massa × braço²,
   * então um frame leve e muito head-heavy (balanço 380 mm) o infla sem ter massa nenhuma; e
   * `head_size` entrava como bônus, quando cabeça grande, a massa constante, é área a mais para a
   * bola torcer. Somados, os dois deixavam o balanço substituir a massa — e massa é exatamente o
   * que estabilidade significa.
   *
   * A física é direta: o que impede o quadro de recuar no impacto é inércia, e inércia contra uma
   * bola que chega é massa. Balanço redistribui a massa que existe; ele não cria massa. Por isso o
   * peso passa a dominar, `swing_index` vira termo secundário (ele CONTÉM a massa, e conta como
   * confirmação, não como substituto) e `head_size` sai — ele já paga o que deve em
   * `forgiveness_score`, que é onde cabeça grande de fato ajuda.
   */
  const stability_score = build([
    T('weight', n.w, 0.5),
    T('swing_index', n.s, 0.35),
    T('balance', n.b, 0.15),
  ]);

  // Índice de balanço invertido domina: é o que o jogador sente ao acelerar o braço.
  const maneuverability_score = build([
    T('swing_index_inverse', invOrNull(n.s), 0.55),
    T('weight_inverse', invOrNull(n.w), 0.3),
    T('balance_inverse', invOrNull(n.b), 0.15),
  ]);

  // Tolerância a impactos descentralizados: área útil primeiro, massa depois.
  const forgiveness_score = build([
    T('head_size', n.h, 0.45),
    T('weight', n.w, 0.25),
    T('pattern_openness', n.o, 0.18),
    T('swing_index', n.s, 0.12),
  ]);

  const precision_score = build([
    T('pattern_density', n.d, 0.32),
    T('head_size_inverse', invOrNull(n.h), 0.28),
    T('swing_index', n.s, 0.22),
    T('beam_width_inverse', invOrNull(n.m), 0.18),
  ]);

  /**
   * ─── NOTA DE CALIBRAÇÃO (07/09/2026) — RIGIDEZ MEDIDA NO LUGAR DA VIGA ─────────────────────
   *
   * `feel_score` e `arm_friendliness_score` pesavam o perfil da viga em 0,45 como PROXY DE
   * RIGIDEZ. Com os 47 RA medidos deu para conferir o proxy pela primeira vez:
   *
   *     r(perfil da viga, RA real) = 0,098  →  R² = 0,010
   *
   * Um por cento. O termo mais pesado dos dois eixos era, na prática, aleatório. Nos dois eixos a
   * viga sai e entra o RA medido.
   *
   * A viga PERMANECE em `precision_score` e `launch_angle_score`, e isso não é inconsistência: lá
   * ela não está representando rigidez, está representando geometria — quadro largo lança mais
   * alto e perdoa mais por causa da seção, não por causa do quanto flexiona. O que se corrigiu foi
   * usar viga onde a pergunta era rigidez.
   *
   * Onde o RA falta, o termo sai da conta em vez de cair na viga. Ver a nota em `normalizeSpecs`.
   */
  const feel_score = build([
    T('ra_inverse', invOrNull(n.r), 0.45),
    T('weight', n.w, 0.32),
    T('pattern_density', n.d, 0.23),
  ]);

  const launch_angle_score = build([
    T('pattern_openness', n.o, 0.4),
    T('head_size', n.h, 0.32),
    T('beam_width', n.m, 0.2),
    T('balance', n.b, 0.08),
  ]);

  const arm_friendliness_score = build([
    T('ra_inverse', invOrNull(n.r), 0.45),
    T('weight', n.w, 0.3),
    T('head_size', n.h, 0.15),
    T('pattern_openness', n.o, 0.1),
  ]);

  // "Quanto de técnica este frame cobra": inércia a acelerar, área de erro pequena, padrão denso.
  const demand_index = build([
    T('swing_index', n.s, 0.35),
    T('head_size_inverse', invOrNull(n.h), 0.28),
    T('pattern_density', n.d, 0.22),
    T('weight', n.w, 0.15),
  ]);

  /**
   * Os seis eixos de comportamento passam a ser um ORÇAMENTO, não uma nota.
   *
   * ═══ O DEFEITO MEDIDO ════════════════════════════════════════════════════════════════════
   *
   * Somando os seis índices exibidos, o catálogo ia de 410 a 485 num total médio de 454 — 18% de
   * diferença de NÍVEL entre uma raquete e outra. E a diferença não era aleatória:
   *
   *     mais baixas   Ti.S6 410 · Ultra 100L 425 · Speed Pro 430 · Blade 98 18x20 430
   *     mais altas    Radical Pro 485 · Percept 97 480 · EZONE 98 475 · VCORE 98 475
   *
   * Frames de controle e frames leves apareciam fracos em tudo; frames de 305 g com viga fina
   * apareciam fortes em quase tudo. Isso produzia exatamente a leitura que um usuário reclamou:
   * "a recomendada é melhor em tudo menos potência, isso não é possível" — e ele estava certo,
   * porque não era possível: era viés do modelo.
   *
   * ═══ DE ONDE VINHA ═══════════════════════════════════════════════════════════════════════
   *
   * Somando o coeficiente da MASSA nos seis eixos: potência −0.15, conforto +0.30, estabilidade
   * +0.50, manobrabilidade −0.30. Saldo +0.35. Somando `swing_index`: controle +0.16, spin +0.20,
   * estabilidade +0.35, manobrabilidade −0.55. Saldo +0.16. Ou seja, massa entrava com meio ponto
   * POSITIVO de saldo — o frame pesado ganhava conforto e estabilidade sem pagar o preço
   * equivalente dentro dos seis.
   *
   * E o preço existe: é o esforço de carregar a raquete pela partida inteira. Só que ele mora em
   * `physical_fit` e em `demand_index`, fora destes seis. O saldo positivo aqui não era física —
   * era um custo contabilizado em outro lugar e um benefício contabilizado duas vezes.
   *
   * ═══ A CORREÇÃO ══════════════════════════════════════════════════════════════════════════
   *
   * Todo frame recebe o mesmo total e distribui internamente. Potência alta passa a implicar em
   * algo mais baixo, necessariamente — que é como projeto de raquete de fato funciona: cabeça,
   * viga, massa e padrão de cordas são um orçamento que o engenheiro reparte, não uma escala de
   * qualidade em que modelos caros ganham em tudo.
   *
   * O deslocamento é ADITIVO e igual em todos os eixos, então o CONTRASTE interno de cada raquete
   * — quem é forte em quê, e por quanto — sobrevive intacto. O que muda é só o nível.
   *
   * Os índices fora dos seis (`forgiveness`, `precision`, `feel`, `launch_angle`,
   * `arm_friendliness`, `demand_index`) NÃO entram no orçamento: eles são justamente onde os
   * custos reais são cobrados, e nivelá-los apagaria a cobrança.
   */
  const [power, control, spin, comfort, stability, maneuverability] = levelize([
    power_score,
    control_score,
    spin_score,
    comfort_score,
    stability_score,
    maneuverability_score,
  ]);

  return {
    power_score: power!,
    control_score: control!,
    spin_score: spin!,
    comfort_score: comfort!,
    stability_score: stability!,
    maneuverability_score: maneuverability!,
    forgiveness_score,
    precision_score,
    feel_score,
    launch_angle_score,
    arm_friendliness_score,
    demand_index,
    swing_index: n.s === null ? 0 : toScore(n.s),
    /*
      Passa a ser o RA medido, e não mais o perfil da viga (R² = 0,010 contra o RA real).

      Quando não há RA, cai para a viga em vez de zerar: aqui o índice é EXIBIDO na ficha técnica,
      e um zero seria lido como "quadro macíssimo" em vez de "não sabemos". A viga é ruim como
      medida de rigidez, mas como último recurso de exibição ela ao menos ordena quadros grossos
      acima de finos. Note a diferença de tratamento em relação a `normalizeSpecs`: lá, onde o
      valor ENTRA numa nota que decide recomendação, o termo some; aqui, onde ele só aparece, a
      aproximação é preferível ao silêncio enganoso.
    */
    stiffness_index: n.r !== null ? toScore(n.r) : n.m === null ? 0 : toScore(n.m),
    data_completeness: totalWeight === 0 ? 0 : clamp01(coveredWeight / totalWeight),
    missing_fields: [...missing].sort(),
    methodology_version: METHODOLOGY_VERSION,
  };
}

/** Alvo de exigência por faixa de nível. */
const DEMAND_TARGET: Record<SkillTier, number> = {
  beginner: 25,
  intermediate: 45,
  advanced: 65,
  competitive: 78,
};

function levelFit(demand: number, tier: SkillTier): number {
  return clamp(100 - Math.abs(demand - DEMAND_TARGET[tier]) * 1.6, 0, 100);
}

export function computeFitProfile(a: RacketAttributes): RacketFitProfile {
  const d = a.demand_index;

  const styles: Record<PlayStyle, number> = {
    baseline: 0.4 * a.control_score + 0.3 * a.stability_score + 0.3 * a.spin_score,
    aggressive_baseliner:
      0.35 * a.stability_score +
      0.25 * a.control_score +
      0.25 * a.spin_score +
      0.15 * a.power_score,
    counterpuncher:
      0.35 * a.stability_score +
      0.25 * a.maneuverability_score +
      0.25 * a.control_score +
      0.15 * a.forgiveness_score,
    heavy_spin: 0.55 * a.spin_score + 0.25 * a.launch_angle_score + 0.2 * a.stability_score,
    flat_hitter: 0.4 * a.precision_score + 0.3 * a.control_score + 0.3 * a.stability_score,
    all_court:
      0.3 * a.maneuverability_score +
      0.25 * a.control_score +
      0.25 * a.stability_score +
      0.2 * a.feel_score,
    serve_and_volley:
      0.35 * a.maneuverability_score +
      0.3 * a.stability_score +
      0.2 * a.precision_score +
      0.15 * a.feel_score,
    net_player: 0.4 * a.maneuverability_score + 0.3 * a.stability_score + 0.3 * a.feel_score,
  };

  return {
    beginner_fit:
      0.45 * levelFit(d, 'beginner') +
      0.3 * a.forgiveness_score +
      0.15 * a.power_score +
      0.1 * a.maneuverability_score,
    intermediate_fit:
      0.45 * levelFit(d, 'intermediate') +
      0.2 * a.forgiveness_score +
      0.2 * a.spin_score +
      0.15 * a.control_score,
    advanced_fit:
      0.45 * levelFit(d, 'advanced') +
      0.25 * a.control_score +
      0.2 * a.stability_score +
      0.1 * a.precision_score,
    competitive_fit:
      0.45 * levelFit(d, 'competitive') +
      0.25 * a.stability_score +
      0.2 * a.precision_score +
      0.1 * a.control_score,
    styles,
    methodology_version: METHODOLOGY_VERSION,
  };
}

export function scoreRacket(variant: RacketVariant): ScoredRacket {
  const attributes = computeRacketAttributes(variant.specs);
  return { variant, attributes, fitProfile: computeFitProfile(attributes) };
}

export function scoreRackets(variants: readonly RacketVariant[]): ScoredRacket[] {
  return variants.map(scoreRacket);
}

/** Índice de massa percebida — usado por `physical_fit`. Peso e inércia, ambos derivados do publicado. */
export function massIndex(specs: RacketSpecs): number | null {
  const strung = resolveStrungWeight(specs);
  const swing = computeSwingIndex(specs);

  const result = weighted([
    {
      label: 'strung_weight',
      value: strung === null ? null : norm(strung, RANGES.strung_weight_g[0], RANGES.strung_weight_g[1]),
      weight: 0.5,
    },
    {
      label: 'swing_index',
      value: swing === null ? null : norm(swing, RANGES.swing_index[0], RANGES.swing_index[1]),
      weight: 0.5,
    },
  ]);
  return result.coverage === 0 ? null : result.score;
}
