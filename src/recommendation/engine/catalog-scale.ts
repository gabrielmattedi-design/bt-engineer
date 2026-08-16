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

/** Constrói a escala a partir do catálogo. Pura e determinística. */
export function buildCatalogScale(catalog: readonly ScoredRacket[]): CatalogScale {
  const bands = new Map<ScaleKey, Band>();

  const record = (key: ScaleKey, values: readonly number[]): void => {
    const finite = values.filter((v) => Number.isFinite(v));
    if (finite.length === 0) {
      bands.set(key, [0, 100]);
      return;
    }
    bands.set(key, widen([Math.min(...finite), Math.max(...finite)]));
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

/** Descrição legível da escala, para a auditoria do admin (§48). */
export function describeScale(scale: CatalogScale, keys: readonly ScaleKey[]): string[] {
  return keys.map((key) => {
    const [lo, hi] = scale.band(key);
    return `${key}: ${round(lo, 1)} … ${round(hi, 1)}`;
  });
}
