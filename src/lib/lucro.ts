/**
 * O lucro do dia, e o que ele exige de honestidade.
 *
 * ═══ POR QUE ISTO É UMA FUNÇÃO PURA, E NÃO TRÊS DIVISÕES NA PÁGINA ═══════════════════════════
 *
 * Pedido pelo dono em 17/09/2026: *"queria saber o lucro que estou tendo por dia"*. Até então o
 * painel dizia a FÓRMULA — "CAC = gasto ÷ Clientes" — e ele dividia à mão, todo dia, no celular.
 *
 * Divisão à mão erra em silêncio, e este projeto já pagou por isso: um CAC inflado por divisor
 * errado é exatamente o sinal que manda cortar orçamento de uma campanha que está indo bem
 * (`commerce-repo.ts`, `contarVendas`). Num cálculo que decide orçamento, os casos de borda
 * precisam de teste, e teste precisa de função pura.
 *
 * ─── A DECISÃO MAIS IMPORTANTE DAQUI: A TAXA NÃO TEM PADRÃO ──────────────────────────────────
 *
 * A tentação era embutir 0,9447 — a razão entre o líquido de R$ 45,60 e o ticket de R$ 48,27 que
 * aparecem em `docs/OPERACAO_DA_CAMPANHA.md`. NÃO foi embutida, por dois motivos:
 *
 *   1. Aqueles dois números são ARREDONDADOS de conversa. Uma razão derivada de dois arredondados
 *      vira constante de aparência precisa, e `limites.md` §5 existe por causa disso: "nunca um
 *      número digitado à mão num arquivo — é assim que uma afirmação envelhece em silêncio".
 *   2. A taxa real depende do meio de pagamento. Pix e cartão cobram diferente, e a mistura muda
 *      de dia para dia. Uma taxa única seria falsa em todo dia que não fosse a média.
 *
 * Então a taxa é ENTRADA, e quando ela não vem o resultado se declara "antes das taxas" em vez de
 * chutar. Número ausente é melhor que número inventado — e o `null` força a tela a dizer isso.
 */

export type Lucro = {
  readonly receitaCentavos: number;
  readonly gastoCentavos: number;
  /** `null` quando a taxa não foi informada — o lucro devolvido é BRUTO. */
  readonly taxaCentavos: number | null;
  readonly lucroCentavos: number;
  /** `true` quando a taxa não entrou na conta, e a tela precisa dizer isso. */
  readonly antesDasTaxas: boolean;
  /** `null` com zero clientes: não existe custo por cliente quando não houve cliente. */
  readonly cacCentavos: number | null;
  /** `null` com gasto zero: divisão por zero devolveria Infinity e a tela imprimiria "∞". */
  readonly roas: number | null;
};

const DINHEIRO = /^\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?$|^\d+(?:[.,]\d{1,2})?$/;

/**
 * Lê dinheiro digitado por humano brasileiro e devolve centavos.
 *
 * ═══ A AMBIGUIDADE QUE OBRIGA ESTA FUNÇÃO A EXISTIR ══════════════════════════════════════════
 *
 * `"1.234"` é mil duzentos e trinta e quatro (ponto de milhar, como se escreve no Brasil) ou um
 * real e vinte e três (ponto decimal, como o teclado numérico sugere)? As duas leituras são
 * plausíveis e a diferença é de mil vezes.
 *
 * A regra usada: **o ÚLTIMO separador manda, e só é decimal se tiver 1 ou 2 dígitos depois.**
 *
 *   "126,17"    → 12617    vírgula com 2 dígitos = decimal
 *   "126.17"    → 12617    ponto com 2 dígitos = decimal (o teclado do celular só tem ponto)
 *   "1.234"     → 123400   3 dígitos depois = milhar, não decimal
 *   "1.234,56"  → 123456   o último separador é a vírgula
 *   "126"       → 12600
 *
 * `parseFloat` sozinho responderia 1.234 → 1,23 e transformaria mil reais de gasto em um real —
 * um CAC mil vezes menor, que parece ótimo e manda escalar.
 */
export function lerDinheiroEmCentavos(bruto: string | undefined): number | null {
  if (bruto === undefined) return null;

  const limpo = bruto.trim().replace(/^R\$\s*/i, '').replace(/\s/g, '');
  if (limpo === '') return null;
  if (!DINHEIRO.test(limpo)) return null;

  const ultimoPonto = limpo.lastIndexOf('.');
  const ultimaVirgula = limpo.lastIndexOf(',');
  const corte = Math.max(ultimoPonto, ultimaVirgula);

  let inteiros: string;
  let centavos: string;

  if (corte === -1) {
    inteiros = limpo;
    centavos = '00';
  } else {
    const depois = limpo.slice(corte + 1);
    if (depois.length <= 2) {
      inteiros = limpo.slice(0, corte).replace(/[.,]/g, '');
      centavos = depois.padEnd(2, '0');
    } else {
      // 3 dígitos depois do último separador: ele era milhar, não decimal.
      inteiros = limpo.replace(/[.,]/g, '');
      centavos = '00';
    }
  }

  const total = Number(`${inteiros}${centavos}`);
  return Number.isSafeInteger(total) ? total : null;
}

/** Lê a taxa em porcento. Recusa negativo e acima de 100 — nenhum dos dois é taxa. */
export function lerTaxaPercentual(bruto: string | undefined): number | null {
  if (bruto === undefined) return null;
  const limpo = bruto.trim().replace(/%/g, '').replace(',', '.');
  if (limpo === '') return null;
  const n = Number(limpo);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n;
}

export function calcularLucro(entrada: {
  readonly receitaCentavos: number;
  readonly gastoCentavos: number;
  readonly taxaPercentual: number | null;
  readonly clientes: number;
}): Lucro {
  const receitaCentavos = Math.max(0, Math.round(entrada.receitaCentavos));
  const gastoCentavos = Math.max(0, Math.round(entrada.gastoCentavos));
  const clientes = Math.max(0, Math.trunc(entrada.clientes));

  const taxaCentavos =
    entrada.taxaPercentual === null
      ? null
      : Math.round((receitaCentavos * entrada.taxaPercentual) / 100);

  return {
    receitaCentavos,
    gastoCentavos,
    taxaCentavos,
    /*
      O lucro pode ser NEGATIVO e isso não é erro — é o dia em que se gastou mais do que entrou.
      Nenhum clamp aqui: esconder prejuízo atrás de um zero é a única coisa pior que não medir.
    */
    lucroCentavos: receitaCentavos - (taxaCentavos ?? 0) - gastoCentavos,
    antesDasTaxas: taxaCentavos === null,
    cacCentavos: clientes > 0 ? Math.round(gastoCentavos / clientes) : null,
    roas: gastoCentavos > 0 ? receitaCentavos / gastoCentavos : null,
  };
}

/** Centavos em `1.234,56`. Existe aqui para a tela e o teste concordarem sobre o formato. */
export function emReais(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
