/**
 * Faixas de preço — docs/PROPOSTA_MOTOR_BT.md §4.5. Decisão do dono em 25/09/2026.
 *
 * ═══ POR QUE TRÊS, E POR QUE ESTES CORTES ═══════════════════════════════════════════════════════
 *
 * Com 32 raquetes cotadas, cada faixa a mais é menos raquete por faixa, e o pódio se repete.
 * Medido em 780 perfis, contando quantos recebem o MESMO pódio na pior faixa:
 *
 *     4 faixas (1.000 / 1.800 / 2.600)   acima de 2.600, 6 raquetes    51%
 *     3 faixas (1.000 / 1.700)           até 1.000, 6 raquetes         43%
 *     3 faixas (1.500 / 2.200)           acima de 2.200, 10 raquetes   24%
 *
 * R$ 1.500 e R$ 2.200 dividem o catálogo em 12 / 10 / 10. A regra é "três faixas do mesmo
 * tamanho", e não os valores: `tests/motor/faixas.test.ts` falha quando o catálogo crescer
 * torto, e é esse o aviso para refazer os cortes.
 *
 * ═══ PISO E TETO SÃO FILTROS ════════════════════════════════════════════════════════════════════
 *
 * Quem declara "sem limite" e recebe uma raquete de R$ 800 lê que a resposta dele foi ignorada.
 * "Sem limite" é a faixa 3, a leitura literal do que a pessoa disse.
 */

export type Faixa = 1 | 2 | 3;

/** Limite inferior de cada faixa, inclusivo. A Quicksand Kombat, a R$ 1.499,90, é faixa 1. */
export const CORTES_BRL = { 2: 1500, 3: 2200 } as const;

export function faixaDoPreco(preco_brl: number): Faixa {
  if (preco_brl >= CORTES_BRL[3]) return 3;
  if (preco_brl >= CORTES_BRL[2]) return 2;
  return 1;
}

export const ROTULO_DA_FAIXA: Readonly<Record<Faixa, string>> = {
  1: 'até R$ 1.500',
  2: 'de R$ 1.500 a R$ 2.200',
  3: 'acima de R$ 2.200',
};
