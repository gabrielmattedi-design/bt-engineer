/**
 * Escala do catálogo — a régua contra a qual os componentes de fit medem uma raquete.
 *
 * ─── O DEFEITO QUE ESTE MÓDULO CORRIGE ───────────────────────────────────────────────────────
 *
 * Os atributos derivados (`power_score`, `demand_index`, …) são médias ponderadas de várias
 * especificações normalizadas contra faixas TEÓRICAS amplas (`RANGES`). Média de valores
 * normalizados regride fortemente ao centro: nenhuma raquete real está no extremo de todas as
 * suas especificações ao mesmo tempo. O resultado, medido sobre o catálogo de produção:
 *
 *     demand_index            41.8 … 71.3          maneuverability_score   36.5 … 58.0
 *     stability_score         40.7 … 63.2          arm_friendliness_score  22.3 … 66.4
 *     style:baseline          46.7 … 53.7          style:counterpuncher    47.7 … 53.5
 *
 * Os componentes de fit, porém, comparavam esses números com scores do JOGADOR, que ocupam a
 * faixa 0–100 inteira. Um jogador de nível 97 recebia `target_demand = 90`, e a raquete mais
 * exigente que existe no catálogo marca 71 — ele perdia 30 pontos de `skill_fit` por uma
 * diferença que NENHUM produto do mercado poderia fechar. Um jogador que se declara `baseline`
 * nunca passava de ~54 de `playstyle_fit`, porque 54 é o teto físico daquele eixo.
 *
 * É o mesmo erro de unidades já documentado em `objectiveFit` (nota de calibração v1.0.0):
 * comparar duas grandezas que não vivem na mesma escala. A consequência era sistemática — TODA
 * raquete era subavaliada, o `fit_score` do primeiro colocado se comprimia entre 65 e 89, e
 * perfis legítimos terminavam sem nenhuma raquete acima do piso do pódio.
 *
 * ─── A CORREÇÃO ──────────────────────────────────────────────────────────────────────────────
 *
 * A régua passa a ser o que EXISTE, não o que é teoricamente concebível. `position()` devolve
 * onde a raquete está dentro da faixa realmente ocupada pelo catálogo, e `target()` faz o
 * caminho inverso: traduz uma exigência do jogador (0–100) para o ponto correspondente daquela
 * faixa. Assim "100 de potência" passa a significar "a raquete mais potente que você pode
 * comprar" — que é exatamente o que o usuário entende ao ler o número.
 *
 * ─── CONSEQUÊNCIAS ACEITAS ───────────────────────────────────────────────────────────────────
 *
 * A escala depende do catálogo: incluir uma raquete mais extrema move a régua de todo mundo.
 * Isso é deliberado e correto — a pergunta que o produto responde é "qual a melhor entre as que
 * você pode comprar hoje", e a resposta precisa se re-ancorar quando o mercado muda. É também
 * auditável: a escala sai versionada junto com `dataset_version`.
 *
 * A escala é construída sobre o catálogo COMPLETO, não sobre o que sobrou dos filtros duros. Se
 * ela dependesse do subconjunto de cada perfil, dois usuários veriam números incomparáveis e o
 * simulador do admin deixaria de reproduzir a régua de produção.
 */

import { clamp, round } from '@/domain/scores';
import type { PlayStyle, ScoredRacket } from '@/domain/racket';
import { PLAY_STYLES } from '@/domain/racket';
import { massIndex } from '@/recommendation/normalize/racket-attributes';

/** Eixos numéricos calibráveis. `style:*` cobre os oito estilos de jogo. */
export type ScaleKey =
  | 'power_score'
  | 'control_score'
  | 'spin_score'
  | 'comfort_score'
  | 'stability_score'
  | 'maneuverability_score'
  | 'forgiveness_score'
  | 'precision_score'
  | 'feel_score'
  | 'launch_angle_score'
  | 'arm_friendliness_score'
  | 'demand_index'
  | 'mass_index'
  | `style:${PlayStyle}`;

const ATTRIBUTE_KEYS = [
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
  'demand_index',
] as const;

/**
 * Largura mínima de uma faixa, em pontos.
 *
 * Protege contra amplificação de ruído: num catálogo pequeno, ou num eixo em que todas as
 * variantes são quase idênticas, esticar uma faixa de 2 pontos para 0–100 transformaria
 * diferenças irrelevantes em veredictos. Abaixo deste piso a faixa é alargada em torno do seu
 * centro, e o eixo simplesmente discrimina pouco — que é a leitura honesta.
 */
export const MIN_BAND_WIDTH = 12;

export type Band = readonly [number, number];

export type CatalogScale = {
  /** Faixa [min, max] realmente ocupada pelo catálogo neste eixo, já com o piso de largura. */
  readonly band: (key: ScaleKey) => Band;
  /** Onde `value` está dentro da faixa, em 0–100. */
  readonly position: (key: ScaleKey, value: number) => number;
  /** Valor de atributo correspondente a uma exigência do jogador expressa em 0–100. */
  readonly target: (key: ScaleKey, playerPosition: number) => number;
  /** Largura da faixa, em pontos de atributo. Denominador honesto para deltas neste eixo. */
  readonly spread: (key: ScaleKey) => number;
  /**
   * Melhor aderência que QUALQUER raquete do catálogo alcança para uma mistura de estilos.
   *
   * `playstyle_fit` precisa disto porque os eixos de estilo já são scores de aderência, e não
   * especificações: perguntar "em que percentil do catálogo este frame está" amplificaria ruído
   * num eixo como `baseline`, cujo catálogo inteiro cabe entre 46.7 e 53.7. A pergunta correta é
   * outra — "comparado com o melhor frame que existe para o seu estilo, quão bom é este?" — e ela
   * exige justamente este teto.
   */
  readonly styleCeiling: (weights: Readonly<Partial<Record<PlayStyle, number>>>) => number;
};

function widen([lo, hi]: Band): Band {
  const width = hi - lo;
  if (width >= MIN_BAND_WIDTH) return [lo, hi];
  const pad = (MIN_BAND_WIDTH - width) / 2;
  return [lo - pad, hi + pad];
}

/**
 * ═══ POR QUE A FAIXA NÃO É SIMPLESMENTE O MÍNIMO E O MÁXIMO ══════════════════════════════════
 *
 * `[min, max]` entrega a régua inteira ao produto mais extremo do catálogo, e um único item
 * atípico basta para arruiná-la. O caso real, medido:
 *
 *     power_score — HEAD Ti.S6: 90.1 | Wilson Clash 108: 57.8 | Yonex EZONE 105: 54.3
 *
 * A Ti.S6 é um frame de 225 g e 115 pol², de uma categoria que as outras 45 raquetes não
 * disputam. Com a faixa esticada até 90, TODO o catálogo que um jogador de clube consideraria
 * cabia nos 45% de baixo da escala — e o relatório dizia a um intermediário que a raquete
 * recomendada para ele tinha "potência 34 de 100". O número era aritmeticamente correto e
 * comunicava uma falsidade: não que a raquete seja fraca, mas que ela é fraca perto de um produto
 * que não é alternativa para ninguém que esteja lendo aquilo.
 *
 * O estrago não parava na tela. `position()` alimenta todos os componentes de fit, então a
 * compressão entrava na DECISÃO: `objectiveFit` media avanços numa escala em que quase não havia
 * espaço para andar, e o motor concluía — corretamente, dentro da própria régua — que pouco podia
 * ser feito por quem pedia potência.
 *
 * ─── POR QUE VÃO, E NÃO PERCENTIL NEM CERCA DE TUKEY ─────────────────────────────────────────
 *
 * Duas tentativas anteriores erraram, e cada uma ensinou metade da resposta.
 *
 * A primeira aparava 5% de cada ponta. Consertou a potência e estragou o resto, o que os testes de
 * persona mostraram na hora: em `demand_index` a ponta de baixo é justamente o segmento de
 * iniciante — raquetes densamente agrupadas, não um caso excêntrico — e aparar por POSIÇÃO
 * eliminava exatamente as opções que um iniciante precisa distinguir, empilhando meia dúzia delas
 * em 0. A persona 1 parou de saber diferenciar uma cabeça de 105 pol² de uma de 100.
 *
 * A segunda usava a cerca de Tukey (`q3 + k × IQR`). Ela mede a distância do extremo aos QUARTIS,
 * o que é uma pergunta sobre a largura do miolo, não sobre o extremo. Num eixo de miolo largo como
 * `power_score` a cerca caía em 82 — deixando quase intacto um vão de 32 pontos —, enquanto em
 * eixos de miolo estreito ela cortava caudas perfeitamente legítimas.
 *
 * A pergunta certa é sobre o VÃO: o item mais extremo está grudado no resto, ou separado dele? É
 * literalmente o que distingue os dois casos. Na potência, a Ti.S6 está a 32 pontos da 2ª colocada,
 * enquanto as 45 restantes ocupam 37 pontos no total — o vão sozinho vale quase toda a distribuição.
 * Na tolerância, o vão do topo é de 6 pontos contra 25 de corpo: é uma cauda, não um destacamento.
 *
 * Por isso a régua recua uma posição só quando o vão até o vizinho supera `GAP_RATIO` do que sobra,
 * e no máximo duas vezes por ponta. Um eixo denso fica idêntico ao que era; um eixo com produto de
 * outra categoria perde o vão morto.
 *
 * O extremo não desaparece: `position()` satura em 0 e 100, e a Ti.S6 continua sendo a mais
 * potente do catálogo — agora com a leitura "no topo do que existe" em vez de "sozinha na escala".
 */
const GAP_RATIO = 0.35;

/**
 * Quantas posições cada ponta pode recuar.
 *
 * Duas, e não "enquanto houver vão", porque recuar é destrutivo: cada passo é uma raquete real cuja
 * diferença some da régua. Um catálogo com três produtos destacados na mesma ponta não é um
 * catálogo com outliers — é um catálogo com dois segmentos, e a resposta certa aí é curadoria, não
 * estatística.
 */
const MAX_RETREAT = 2;

/** Amostra mínima para recuar. Abaixo disso "o vão" é só o formato de uma amostra pequena. */
const MIN_SAMPLE_FOR_RETREAT = 12;

/**
 * Faixa robusta: mínimo e máximo reais, recuando apenas por cima de um vão destacado.
 *
 * As duas pontas são independentes — um eixo pode ter um produto solto no topo e uma cauda normal
 * embaixo.
 */
function robustBand(sorted: readonly number[]): Band {
  if (sorted.length < MIN_SAMPLE_FOR_RETREAT) {
    return [sorted[0]!, sorted[sorted.length - 1]!];
  }

  let lo = 0;
  let hi = sorted.length - 1;

  for (let step = 0; step < MAX_RETREAT; step += 1) {
    // O "corpo" é o que sobraria depois de recuar: é contra ele que o vão é medido.
    const gap = sorted[hi]! - sorted[hi - 1]!;
    const body = sorted[hi - 1]! - sorted[lo]!;
    if (body <= 0 || gap <= body * GAP_RATIO) break;
    hi -= 1;
  }

  for (let step = 0; step < MAX_RETREAT; step += 1) {
    const gap = sorted[lo + 1]! - sorted[lo]!;
    const body = sorted[hi]! - sorted[lo + 1]!;
    if (body <= 0 || gap <= body * GAP_RATIO) break;
    lo += 1;
  }

  return [sorted[lo]!, sorted[hi]!];
}

/** Constrói a escala a partir do catálogo. Pura e determinística. */
export function buildCatalogScale(catalog: readonly ScoredRacket[]): CatalogScale {
  const bands = new Map<ScaleKey, Band>();

  const record = (key: ScaleKey, values: readonly number[]): void => {
    const finite = values.filter((v) => Number.isFinite(v));
    if (finite.length === 0) {
      bands.set(key, [0, 100]);
      return;
    }

    const sorted = [...finite].sort((a, b) => a - b);
    bands.set(key, widen(robustBand(sorted)));
  };

  for (const key of ATTRIBUTE_KEYS) {
    record(
      key,
      catalog.map((r) => r.attributes[key]),
    );
  }

  for (const style of PLAY_STYLES) {
    record(
      `style:${style}`,
      catalog.map((r) => r.fitProfile.styles[style]),
    );
  }

  record(
    'mass_index',
    catalog.map((r) => massIndex(r.variant.specs)).filter((v): v is number => v !== null),
  );

  const band = (key: ScaleKey): Band => bands.get(key) ?? [0, 100];
  const styleVectors = catalog.map((r) => r.fitProfile.styles);

  return {
    band,
    styleCeiling: (weights) => {
      const active = PLAY_STYLES.filter((s) => (weights[s] ?? 0) > 0);
      const total = active.reduce((sum, s) => sum + (weights[s] ?? 0), 0);
      if (total <= 0) return 0;

      let best = 0;
      for (const styles of styleVectors) {
        const mix = active.reduce((sum, s) => sum + (weights[s] ?? 0) * styles[s], 0) / total;
        if (mix > best) best = mix;
      }
      return best;
    },
    position: (key, value) => {
      const [lo, hi] = band(key);
      return clamp(((value - lo) / (hi - lo)) * 100, 0, 100);
    },
    target: (key, playerPosition) => {
      const [lo, hi] = band(key);
      return lo + (hi - lo) * (clamp(playerPosition, 0, 100) / 100);
    },
    spread: (key) => {
      const [lo, hi] = band(key);
      return hi - lo;
    },
  };
}

/**
 * Faixas em DADO PURO, para viajarem dentro do resultado até o relatório.
 *
 * `CatalogScale` carrega funções, e o resultado da recomendação é persistido como JSON — funções
 * não sobrevivem à serialização. O relatório precisa das mesmas faixas para exibir os índices na
 * escala do catálogo, então elas vão junto como pares de números.
 */
export function scaleBands(
  scale: CatalogScale,
  keys: readonly ScaleKey[],
): Record<string, readonly [number, number]> {
  const out: Record<string, readonly [number, number]> = {};
  for (const key of keys) out[key] = scale.band(key);
  return out;
}

/** Eixos que o relatório exibe ao usuário. */
export const DISPLAYED_ATTRIBUTES = [
  'power_score',
  'control_score',
  'spin_score',
  'comfort_score',
  'stability_score',
  'maneuverability_score',
  'precision_score',
] as const satisfies readonly ScaleKey[];

/** Descrição legível da escala, para a auditoria do admin (§48). */
export function describeScale(scale: CatalogScale, keys: readonly ScaleKey[]): string[] {
  return keys.map((key) => {
    const [lo, hi] = scale.band(key);
    return `${key}: ${round(lo, 1)} … ${round(hi, 1)}`;
  });
}
