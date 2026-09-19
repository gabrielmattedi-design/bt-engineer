import { describe, expect, it } from 'vitest';
import { totalDasOrigens, type LinhaSomavel } from '@/lib/origens';

/**
 * A soma da tabela "De onde vieram".
 *
 * ═══ O CASO QUE FEZ ISTO EXISTIR ═════════════════════════════════════════════════════════════
 *
 * 18/09/2026, quatro origens na tela e nenhuma linha de total. A leitura somou duas das quatro de
 * cabeça, chegou a 8, comparou com o 11 da caixa "O que o Meta recebeu" e concluiu que o sistema
 * estava errado. Não estava: 7+3+1+0 = 11, e as duas telas já concordavam.
 *
 * O teste guarda os números daquele dia porque eles são a prova de que a conta fecha.
 */

const linha = (l: Partial<LinhaSomavel>): LinhaSomavel => ({
  visitors: 0,
  finished: 0,
  paid: 0,
  clientes: 0,
  pedidos: 0,
  receitaCentavos: 0,
  ...l,
});

/** As quatro origens exatamente como apareceram na tela em 18/09/2026, 17h10. */
const DIA_18 = [
  linha({ visitors: 36, finished: 32, paid: 7, clientes: 7, pedidos: 7, receitaCentavos: 32993 }),
  linha({ visitors: 5, finished: 4, paid: 3, clientes: 3, pedidos: 3, receitaCentavos: 14997 }),
  linha({ visitors: 5, finished: 4, paid: 1, clientes: 1, pedidos: 1, receitaCentavos: 4999 }),
  linha({ visitors: 1, finished: 0, paid: 0, clientes: 0, pedidos: 0, receitaCentavos: 0 }),
];

describe('totalDasOrigens', () => {
  it('soma as quatro origens do dia 18/09 e fecha em 11 compras', () => {
    const t = totalDasOrigens(DIA_18);

    expect(t.visitors).toBe(47);
    expect(t.finished).toBe(40);
    expect(t.paid).toBe(11);
    expect(t.clientes).toBe(11);
    expect(t.pedidos).toBe(11);
    expect(t.receitaCentavos).toBe(52989); // R$ 529,89
  });

  /**
   * ⚠️ A armadilha que este teste existe para travar.
   *
   * A média simples das conversões das quatro linhas (19,4 + 60,0 + 20,0 + 0,0) ÷ 4 dá **24,9%**.
   * A conversão verdadeira do agregado é 11/47 = **23,4%**.
   *
   * A diferença vem de tratar uma origem de 1 visitante com o mesmo peso de uma com 36 — que é
   * como uma origem minúscula com conversão alta sequestra a leitura da tabela inteira.
   */
  it('a conversão do total é do agregado, e não a média das linhas', () => {
    const t = totalDasOrigens(DIA_18);

    expect(t.conversion).toBeCloseTo(23.4, 1);

    const mediaDasMedias = (19.4 + 60.0 + 20.0 + 0.0) / 4;
    expect(mediaDasMedias).toBeCloseTo(24.9, 1);
    expect(t.conversion).not.toBeCloseTo(mediaDasMedias, 1);
  });

  /** Tabela vazia devolve 0, e não `NaN`: um "NaN%" na tela faz duvidar dos números certos. */
  it('sem origem nenhuma, devolve zeros em vez de NaN', () => {
    const t = totalDasOrigens([]);
    expect(t.visitors).toBe(0);
    expect(t.conversion).toBe(0);
    expect(Number.isNaN(t.conversion)).toBe(false);
  });

  it('origem com visitantes e nenhuma compra não quebra a conversão', () => {
    const t = totalDasOrigens([linha({ visitors: 10 })]);
    expect(t.conversion).toBe(0);
  });
});
