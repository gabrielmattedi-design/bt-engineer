import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { semMarcacao, totalDasOrigens, type LinhaSomavel } from '@/lib/origens';

/**
 * ═══ A TABELA DE ORIGENS TEM DE SOMAR O FATURAMENTO ══════════════════════════════════════════
 *
 * ⚠️ DEFEITO DE LEITURA, MEDIDO EM 21/09/2026
 *
 * A tabela mostrava 9 pedidos num dia de 11 vendas e não dizia onde foram os outros 2. O subtítulo
 * avisava que só aparece quem chegou com `utm_source` — e não adianta: o número some da coluna, e
 * a conclusão natural de quem lê é que o sistema perdeu venda.
 *
 * O dono passou uma tarde tentando conciliar caixas que nunca foram feitas para bater e escreveu:
 * *"tá muito confuso, muita informação que só está servindo para complicar"*. O painel obrigava a
 * fazer de cabeça uma subtração que ele nunca mostrava — e somar à mão é exatamente a operação que
 * um painel existe para eliminar.
 *
 * Estes testes travam a propriedade que conserta isso: **a coluna soma o total, sempre.**
 */
const FONTE_DA_PAGINA = readFileSync('src/app/admin/funil/page.tsx', 'utf8');

/** Uma linha de origem, com só o que a soma usa. */
function origem(pedidos: number, receitaCentavos: number): LinhaSomavel {
  return { visitors: 0, finished: 0, paid: 0, clientes: 0, pedidos, receitaCentavos };
}

describe('a linha "sem marcação" fecha a tabela com o faturamento', () => {
  /** O caso real do dia 21: 11 vendas, 9 atribuídas. */
  it('o resto é o que não foi atribuído', () => {
    const totais = totalDasOrigens([origem(6, 29_994), origem(3, 12_997)]);
    const resto = semMarcacao(11, 54_989, totais);

    expect(resto.pedidos).toBe(2);
    expect(resto.receitaCentavos).toBe(54_989 - 42_991);
    expect(resto.excede).toBe(false);
  });

  /**
   * A propriedade que importa, e a única razão de esta função existir: somar as linhas mais o
   * resto tem de dar exatamente o total. Se um dia isto falhar, a tabela voltou a esconder venda.
   */
  it('linhas + resto = total, para qualquer combinação', () => {
    const casos: readonly (readonly [number, number, readonly LinhaSomavel[]])[] = [
      [11, 54_989, [origem(6, 29_994), origem(3, 12_997)]],
      [1, 4_999, [origem(1, 4_999)]],
      [7, 29_993, []],
      [20, 99_980, [origem(5, 24_995), origem(5, 24_995), origem(5, 24_995)]],
    ];

    for (const [vendas, receita, linhas] of casos) {
      const totais = totalDasOrigens(linhas);
      const resto = semMarcacao(vendas, receita, totais);

      expect(totais.pedidos + resto.pedidos, `pedidos não fecharam em ${vendas}`).toBe(vendas);
      expect(
        totais.receitaCentavos + resto.receitaCentavos,
        `receita não fechou em ${receita}`,
      ).toBe(receita);
    }
  });

  /** Tudo atribuído: o resto é zero, e a tela não desenha a linha. */
  it('sem resto quando toda venda tem origem', () => {
    const totais = totalDasOrigens([origem(4, 19_996)]);
    const resto = semMarcacao(4, 19_996, totais);

    expect(resto.pedidos).toBe(0);
    expect(resto.receitaCentavos).toBe(0);
    expect(resto.excede).toBe(false);
  });

  /**
   * ⚠️ A dupla atribuição não pode virar uma linha de zero silenciosa.
   *
   * `dinheiroPorOrigem` agrupa por (origem, campanha, criativo) e conta `distinct` DENTRO de cada
   * grupo. Quem chegou pelo anúncio na segunda e pela bio na terça tem duas linhas de campanha, e o
   * pedido dela é contado nas duas — então a soma das origens pode passar do total.
   *
   * `Math.max(0, …)` sozinho transformaria esse defeito numa linha plausível e muda. O valor é
   * zerado porque linha negativa não se desenha, e `excede` existe para a tela poder falar.
   */
  it('avisa quando as origens somam MAIS que o total', () => {
    const totais = totalDasOrigens([origem(6, 29_994), origem(4, 19_996)]);
    const resto = semMarcacao(8, 39_992, totais);

    expect(resto.excede, 'a dupla atribuição passou em silêncio').toBe(true);
    expect(resto.pedidos, 'linha negativa não se desenha').toBe(0);
    expect(resto.receitaCentavos).toBe(0);
  });
});

describe('a tela não volta a esconder o resto', () => {
  /**
   * O total da tabela vem de `vendas` e `receitaCentavos` — o registro do dinheiro —, e não da soma
   * das origens. Era a soma das origens que produzia o 9 num dia de 11.
   */
  it('o rodapé da tabela de origens usa o total de vendas, não a soma das linhas', () => {
    const rodape = /<tfoot>[\s\S]*?Total[\s\S]*?\{vendas\}[\s\S]*?\{brl\(receitaCentavos\)\}/;
    expect(
      FONTE_DA_PAGINA,
      'o rodapé voltou a somar só as origens, e o resto sumiu de novo',
    ).toMatch(rodape);
  });

  it('a linha do resto é desenhada quando existe', () => {
    expect(FONTE_DA_PAGINA).toContain('sem marcação');
    expect(FONTE_DA_PAGINA).toMatch(/resto\.pedidos > 0 \|\| resto\.receitaCentavos > 0/);
  });

  it('o aviso de dupla atribuição está ligado ao sinalizador', () => {
    expect(FONTE_DA_PAGINA, 'excede deixou de ser mostrado').toMatch(/\{resto\.excede &&/);
  });

  /**
   * As colunas por data de CHEGADA não podem voltar para a tabela principal: foi a convivência
   * delas com as colunas de dinheiro, na mesma linha, que produziu a confusão de 21/09.
   *
   * ⚠️ A busca é por CABEÇALHO (`<th>…</th>`), e não pela palavra solta. A primeira versão deste
   * teste procurava "Chegaram" em qualquer lugar do trecho e reprovava por causa do comentário que
   * EXPLICA a mudança — punindo a documentação da decisão certa. Já aconteceu neste projeto, com
   * `dangerouslySetInnerHTML`, e o conserto é o mesmo: casar com código, não com prosa.
   */
  it('as colunas de chegada ficam atrás do details', () => {
    /*
      Ancorado no `<h2>` e no `<details className=`, e não nas palavras soltas: "De onde vieram" e
      `<details>` aparecem antes, dentro de comentários, e um recorte por texto pegava o trecho
      errado — devolvia vazio e o teste passava por engano na direção contrária.
    */
    const principal = FONTE_DA_PAGINA.slice(
      FONTE_DA_PAGINA.indexOf('>De onde vieram</h2>'),
      FONTE_DA_PAGINA.indexOf('<details className='),
    );
    expect(principal, 'o recorte da tabela principal ficou vazio').not.toBe('');
    const cabecalhos = [...principal.matchAll(/<th[^>]*>\s*([^<{]+?)\s*<\/th>/g)].map((m) => m[1]);

    expect(cabecalhos, 'a tabela do dinheiro mudou de forma').toEqual([
      'Origem',
      'Vendas',
      'Receita',
    ]);
  });
});
