/**
 * As escalas que transformam o vocabulário do catálogo em número — docs/PROPOSTA_MOTOR_BT.md §2.1.
 *
 * Aprovadas pelo dono em 25/09/2026. É o lugar que decide o que "soft" e "carbono 12K" VALEM, e por
 * isso é o único: mudar uma posição aqui recalcula o mapa inteiro, e nada fora deste arquivo
 * conhece esses valores.
 *
 * ─── POR QUE A PLANILHA FICA COMO VEIO ──────────────────────────────────────────────────────────
 *
 * O catálogo tem o mesmo EVA escrito de nove jeitos (`soft`, `Soft`, `extra soft`, `extrasoft`,
 * `pro`, `Pro`, `black eva`...). Limpar isso no JSON apagaria o que a planilha dizia, e a varredura
 * do catálogo, que vem depois, precisa comparar contra a fonte original. A tradução mora aqui, e um
 * termo que ela não conhece DERRUBA o carregamento em vez de virar um valor médio em silêncio: um
 * EVA lido errado muda a raquete de lado no mapa, e ninguém veria.
 */

/**
 * Dureza do EVA, de 0 (extra soft) a 1.
 *
 * Duas equivalências são decisão, e não leitura:
 * - `pro` = medium. A única descrição de "EVA pro" no catálogo é a da Drop Shot Quantum 1.0:
 *   "densidade intermediária".
 * - `black eva` = hard. A Quicksand Kombat descreve "EVA black de alta densidade".
 */
const DUREZA_EVA: Readonly<Record<string, number>> = {
  'extra soft': 0.0,
  extrasoft: 0.0,
  soft: 0.3,
  medium: 0.55,
  pro: 0.55,
  hard: 0.85,
  'black eva': 0.85,
};

/**
 * Rigidez da face, de 0 a 1, na ordem que as marcas afirmam: mais K, mais rígida.
 *
 * Cada padrão casa só como palavra inteira (`\b`). Sem isso, `12k` casaria um `2k` e `24k` um `4k`,
 * e a raquete cairia na rigidez de outra fibra.
 */
const RIGIDEZ_FACE: readonly (readonly [RegExp, number])[] = [
  [/vidro/, 0.1],
  [/kevlar/, 0.6],
  [/\b24k\b/, 0.9],
  [/\b18k\b/, 0.8],
  [/\b12k\b/, 0.7],
  [/\b6k\b/, 0.55],
  [/\b3k\b/, 0.45],
];

export class VocabularioDesconhecido extends Error {
  constructor(campo: string, valor: string, id: string) {
    super(
      `${id}: ${campo} = ${JSON.stringify(valor)} não está em src/motor/escalas.ts. ` +
        'Um termo desconhecido não vira valor médio — decida onde ele cai na escala e registre aqui.',
    );
    this.name = 'VocabularioDesconhecido';
  }
}

export function durezaEva(valor: string, id: string): number {
  const v = DUREZA_EVA[valor.trim().toLowerCase()];
  if (v === undefined) throw new VocabularioDesconhecido('nucleo_eva', valor, id);
  return v;
}

export function rigidezFace(valor: string, id: string): number {
  const v = valor.trim().toLowerCase();
  for (const [padrao, rigidez] of RIGIDEZ_FACE) if (padrao.test(v)) return rigidez;
  throw new VocabularioDesconhecido('fibra_face', valor, id);
}

/**
 * Nível indicado pelo fabricante, na régua de 1 (iniciante) a 4 (profissional).
 *
 * `inicante-intermediario` está na planilha assim. Ele é aceito como grafia do mesmo termo, e não
 * corrigido na fonte, pela mesma razão das escalas acima.
 */
const NIVEL_FABRICANTE: Readonly<Record<string, number>> = {
  iniciante: 1,
  'iniciante-intermediario': 1.5,
  'inicante-intermediario': 1.5,
  intermediario: 2,
  'intermediario-avancado': 2.5,
  avancado: 3,
  profissional: 4,
};

export function nivelFabricante(valor: string, id: string): number {
  const v = NIVEL_FABRICANTE[valor.trim().toLowerCase()];
  if (v === undefined) throw new VocabularioDesconhecido('nivel_indicado', valor, id);
  return v;
}

/**
 * Faixas de referência para normalizar. São constantes do domínio, um pouco mais largas que o
 * catálogo atual (peso 309–345 g, balanço 240–284 mm, espessura 20–23 mm), para que uma raquete
 * nova no limite não saia do 0–1.
 */
export const REFERENCIA = {
  peso_g: [300, 350],
  balanco_mm: [235, 290],
  espessura_mm: [19, 24],
} as const;

/**
 * Os dois eixos — §3.2.
 *
 * Resposta: o que a face faz pela bola. EVA domina porque é o núcleo que deforma no impacto; a face
 * vem em seguida; a espessura entra invertida e pequena, porque núcleo mais grosso devolve mais.
 *
 * Inércia: o quanto a raquete pesa NA MÃO. Peso e balanço em partes iguais, porque é a combinação
 * dos dois que o braço sente ao acelerar — a mesma massa com o centro mais longe do cabo cobra mais.
 */
export const PESOS_RESPOSTA = { eva: 0.55, face: 0.3, espessuraInvertida: 0.15 } as const;
export const PESOS_INERCIA = { peso: 0.5, balanco: 0.5 } as const;
