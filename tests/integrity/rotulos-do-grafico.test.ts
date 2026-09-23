import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { rotulosDoGrafico } from '@/lib/financeiro';

/**
 * ═══ O GRÁFICO NÃO PODE MENTIR SOBRE QUAL BARRA É QUAL DIA ═══════════════════════════════════
 *
 * ⚠️ DEFEITO REAL, LIDO PELO DONO EM 23/09/2026
 *
 * *"O gráfico só tá contando até dia 20"* — e **as barras estavam todas lá**. A tabela ao lado, na
 * mesma tela, mostrava 21/09 com R$ 909,81 e 22/09 com R$ 809,83.
 *
 * Quem mentia eram os rótulos. As duas fileiras são `flex` com `flex-1` e a mesma quantidade de
 * itens, o que parece garantir alinhamento e não garante: item de flex tem `min-width: auto`, então
 * o item de barra (vazio) encolhe a zero e o de rótulo (dois dígitos) não. Com 21 dias num celular
 * a fileira de rótulos transborda, cada um escorrega para a direita do seu bar, e o erro acumula.
 *
 * **O pior tipo de defeito de painel: número certo, leitura errada, nada quebrado.** O dono passou
 * a desconfiar de dados que estavam corretos — que é o mesmo custo da confusão de 21/09.
 */
const FONTE = readFileSync('src/app/admin/financeiro/page.tsx', 'utf8');

describe('os rótulos raream sem perder o alinhamento', () => {
  /** Série curta cabe inteira: rarear aí seria esconder informação sem motivo. */
  it('até 14 dias mostra todos', () => {
    for (const n of [1, 7, 13, 14]) {
      const r = rotulosDoGrafico(n);
      expect(r, `${n} dias deveriam mostrar todos os rótulos`).toEqual(Array(n).fill(true));
    }
  });

  /**
   * ⚠️ A propriedade que sustenta a correção inteira: **um item por barra, sempre.**
   *
   * São os itens vazios que mantêm as duas fileiras com a mesma contagem e, portanto, alinhadas.
   * Devolver só os rótulos visíveis quebraria exatamente o que isto conserta.
   */
  it('devolve um item por barra, qualquer que seja o tamanho', () => {
    for (const n of [0, 1, 15, 21, 60, 365]) {
      expect(rotulosDoGrafico(n), `${n} barras`).toHaveLength(n);
    }
  });

  /**
   * O último dia é o que se está lendo. Um gráfico cujo rótulo mais à direita é "20" quando a
   * última barra é do 23 recria a confusão de 23/09 em vez de desfazê-la.
   */
  it('o último dia sempre tem rótulo', () => {
    for (const n of [1, 5, 21, 30, 100]) {
      expect(rotulosDoGrafico(n).at(-1), `${n} dias: o último ficou sem rótulo`).toBe(true);
    }
  });

  /** Acima do limite, o número de rótulos fica legível em vez de virar uma tarja de dígitos. */
  it('séries longas ficam com no máximo oito rótulos', () => {
    for (const n of [15, 21, 40, 90, 365]) {
      const visiveis = rotulosDoGrafico(n).filter(Boolean).length;
      expect(visiveis, `${n} dias produziram ${visiveis} rótulos`).toBeLessThanOrEqual(8);
      expect(visiveis, `${n} dias ficaram sem rótulo suficiente`).toBeGreaterThanOrEqual(2);
    }
  });

  /**
   * O espaçamento é regular a partir do FIM. Contando do início, a divisão inexata deixaria o
   * penúltimo rótulo colado no último — e dois números grudados são tão ilegíveis quanto vinte.
   */
  it('o espaçamento é regular', () => {
    const indices = rotulosDoGrafico(21)
      .map((v, i) => (v ? i : -1))
      .filter((i) => i >= 0);

    const saltos = new Set(indices.slice(1).map((v, i) => v - indices[i]!));
    expect(saltos.size, `espaçamento irregular: ${[...saltos].join(', ')}`).toBe(1);
  });

  /** O caso exato do dia 23: 21 barras, e os últimos dias precisam estar nomeados. */
  it('a série de 23/09 nomeia o dia mais recente', () => {
    const r = rotulosDoGrafico(21);
    expect(r).toHaveLength(21);
    expect(r[20], 'o dia 23 ficou sem rótulo').toBe(true);
  });
});

describe('a tela aplica as duas metades da correção', () => {
  /**
   * ⚠️ Sem `min-w-0` o item de rótulo volta a se recusar a encolher, e o desalinhamento volta —
   * mesmo com o rareamento, porque basta um rótulo mais largo que a barra para a fileira crescer.
   */
  it('os itens de rótulo podem encolher como os de barra', () => {
    const fileira = FONTE.slice(FONTE.indexOf('rotulo.slice(8)') - 600);
    expect(fileira, 'min-w-0 caiu do item de rótulo').toContain('min-w-0');
  });

  it('o rareamento é usado de fato', () => {
    expect(FONTE).toContain('rotulosDoGrafico(grafico.barras.length)');
    expect(FONTE, 'o rótulo voltou a ser desenhado sempre').toMatch(/visiveis\[i\]/);
  });
});
