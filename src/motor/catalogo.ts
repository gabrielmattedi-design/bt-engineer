/**
 * O catálogo de raquetes, lido da planilha e posto no mapa — docs/PROPOSTA_MOTOR_BT.md §2 e §3.
 *
 * `src/catalogo/raquetes.json` é a planilha coluna por coluna, sem limpeza. Aqui ela ganha os dois
 * eixos, a posição de cada raquete na escala do catálogo e a faixa de preço.
 */

import fonte from '@/catalogo/raquetes.json';
import {
  durezaEva,
  nivelFabricante,
  PESOS_INERCIA,
  PESOS_RESPOSTA,
  REFERENCIA,
  rigidezFace,
} from './escalas';
import { faixaDoPreco, type Faixa } from './faixas';

/** Uma linha da planilha, com os tipos que ela realmente tem. */
export type LinhaDoCatalogo = {
  readonly id: string;
  readonly marca: string;
  readonly linha: string;
  readonly modelo: string;
  readonly ano_colecao: number;
  readonly peso_min_g: number;
  readonly peso_max_g: number;
  readonly balanco_min_mm: number;
  readonly balanco_max_mm: number;
  readonly espessura_mm: number;
  readonly fibra_face: string;
  readonly nucleo_eva: string;
  readonly nivel_indicado: string;
  readonly perfil_jogo: string;
  readonly claim_fabricante: string;
  readonly preco_min_brl: number | null;
  readonly preco_max_brl: number | null;
  readonly campos_estimados: readonly string[];
};

export type Raquete = {
  readonly id: string;
  readonly marca: string;
  readonly modelo: string;
  readonly linha: LinhaDoCatalogo;
  /** Centro da faixa publicada — ver o comentário de `montarRaquete`. */
  readonly peso_g: number;
  readonly balanco_mm: number;
  readonly espessura_mm: number;
  readonly eva: number;
  readonly face: number;
  /** 0–100, na escala absoluta das constantes de `REFERENCIA`. */
  readonly resposta: number;
  readonly inercia: number;
  /** 1 (iniciante) a 4 (profissional), como o fabricante indica. */
  readonly nivel_fabricante: number;
  /** "A partir de": o menor preço cotado. `null` quando a planilha não tem preço. */
  readonly preco_brl: number | null;
  readonly faixa: Faixa | null;
};

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
const norm = (x: number, [lo, hi]: readonly [number, number]): number => clamp01((x - lo) / (hi - lo));

/**
 * Peso e balanço entram pelo CENTRO da faixa publicada.
 *
 * A faixa é a tolerância de fábrica: duas unidades do mesmo modelo caem em pontos diferentes dela, e
 * o motor não sabe qual unidade a pessoa vai comprar. O centro é o valor esperado — e é o que a
 * própria marca quer dizer quando publica "310–330 g".
 */
export function montarRaquete(l: LinhaDoCatalogo): Raquete {
  const peso_g = (l.peso_min_g + l.peso_max_g) / 2;
  const balanco_mm = (l.balanco_min_mm + l.balanco_max_mm) / 2;
  const eva = durezaEva(l.nucleo_eva, l.id);
  const face = rigidezFace(l.fibra_face, l.id);
  return {
    id: l.id,
    marca: l.marca,
    modelo: l.modelo,
    linha: l,
    peso_g,
    balanco_mm,
    espessura_mm: l.espessura_mm,
    eva,
    face,
    resposta: resposta(eva, face, l.espessura_mm),
    inercia: inercia(peso_g, balanco_mm),
    nivel_fabricante: nivelFabricante(l.nivel_indicado, l.id),
    preco_brl: l.preco_min_brl,
    faixa: l.preco_min_brl === null ? null : faixaDoPreco(l.preco_min_brl),
  };
}

/** Exportadas para a raquete DESCRITA pela pessoa (§5), que entra no mapa pela mesma conta. */
export function resposta(eva: number, face: number, espessura_mm: number): number {
  return (
    100 *
    (PESOS_RESPOSTA.eva * eva +
      PESOS_RESPOSTA.face * face +
      PESOS_RESPOSTA.espessuraInvertida * (1 - norm(espessura_mm, REFERENCIA.espessura_mm)))
  );
}

export function inercia(peso_g: number, balanco_mm: number): number {
  return (
    100 *
    (PESOS_INERCIA.peso * norm(peso_g, REFERENCIA.peso_g) +
      PESOS_INERCIA.balanco * norm(balanco_mm, REFERENCIA.balanco_mm))
  );
}

/**
 * A escala do catálogo: onde cada eixo começa e termina nas raquetes que existem.
 *
 * O jogador é descrito nela, e não na escala absoluta. A raquete mais leve na mão do catálogo tem
 * inércia absoluta 34; um alvo absoluto de 25 para uma iniciante pequena nunca seria alcançado, e a
 * distância até ele puniria igualmente todas as candidatas — o motor deixaria de distinguir
 * justamente as raquetes entre as quais ela precisa escolher. O Tennis Engineer caiu nisso e passou
 * a trabalhar em posição de catálogo (`165310e`).
 */
export type Escala = {
  readonly resposta: readonly [number, number];
  readonly inercia: readonly [number, number];
  readonly mediaResposta: number;
  readonly mediaInercia: number;
};

export function escalaDo(raquetes: readonly Raquete[]): Escala {
  const r = raquetes.map((x) => x.resposta);
  const i = raquetes.map((x) => x.inercia);
  const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const faixaR = [quantil(r, 0.05), quantil(r, 0.95)] as const;
  const faixaI = [quantil(i, 0.05), quantil(i, 0.95)] as const;
  return {
    resposta: faixaR,
    inercia: faixaI,
    mediaResposta: posicao(media(r), faixaR),
    mediaInercia: posicao(media(i), faixaI),
  };
}

/**
 * A escala vai do percentil 5 ao 95, e não do mínimo ao máximo.
 *
 * Com mínimo e máximo, a Quicksand Kombat — inércia 74, contra 55 da segunda mais pesada na mão —
 * definia sozinha o topo da escala, e as outras 34 raquetes se espremiam na metade de baixo. O alvo
 * de um jogador forte caía longe de quase todas, e as raquetes certas para ele saíam com nota de 34
 * a 57. Medido no ex-tenista avançado de `tests/motor/podio.test.ts`.
 *
 * Com os percentis, a escala é definida pelo grosso do catálogo, e a Kombat cai acima de 100. Isso
 * não é erro, é o que ela é: mais pesada na mão do que qualquer outra.
 */
function quantil(xs: readonly number[], q: number): number {
  const o = [...xs].sort((a, b) => a - b);
  const pos = (o.length - 1) * q;
  const base = Math.floor(pos);
  const resto = pos - base;
  return o[base]! + (o[base + 1] !== undefined ? resto * (o[base + 1]! - o[base]!) : 0);
}

/**
 * 0 = a mais macia (ou mais leve na mão) do catálogo; 100 = a mais firme (ou mais pesada).
 * Sem clamp: uma raquete descrita pela pessoa pode cair fora do que o catálogo cobre, e isso é
 * informação, não erro.
 */
export function posicao(valor: number, [lo, hi]: readonly [number, number]): number {
  return hi === lo ? 50 : (100 * (valor - lo)) / (hi - lo);
}

export function carregarCatalogo(): Raquete[] {
  return (fonte.raquetes as unknown as LinhaDoCatalogo[]).map(montarRaquete);
}
