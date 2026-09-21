import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  semMarcacao,
  semMarcacaoNaCoorte,
  totalDasOrigens,
  type LinhaSomavel,
} from '@/lib/origens';

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

/** Uma linha de origem, com só o que a soma do DINHEIRO usa. */
function origem(pedidos: number, receitaCentavos: number): LinhaSomavel {
  return { visitors: 0, finished: 0, paid: 0, clientes: 0, pedidos, receitaCentavos };
}

/** A mesma linha, pelo lado da CHEGADA — o outro relógio. */
function origemDeChegada(visitors: number, finished: number, paid: number): LinhaSomavel {
  return { visitors, finished, paid, clientes: 0, pedidos: 0, receitaCentavos: 0 };
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

/**
 * ═══ A TABELA DE CHEGADAS TAMBÉM PRECISA FECHAR ══════════════════════════════════════════════
 *
 * O dono olhou a tabela "onde cada origem falha" e disse: *"aqui deveria ter o 'sem marcação'
 * também para fechar a conta"*. Está certo, e pelo mesmo motivo da outra: um rodapé chamado
 * "Total" que mostra menos que o total ensina a desconfiar da tela.
 *
 * ⚠️ O QUE TORNA ESTE CASO DIFERENTE, E PERIGOSO
 *
 * A subtração óbvia seria `Pagou do funil − soma das origens`. Ela produz um número plausível e
 * ERRADO: `funnelReport` recorta pela data do MARCO, e a tabela de origens pela data de CHEGADA.
 * Quem chegou hoje e paga amanhã entra numa e não na outra.
 *
 * Por isso o total vem de `coorteDeChegada`, que usa a MESMA regra de tempo de `campaignReport`.
 */
describe('a linha "sem marcação" fecha também a tabela de chegadas', () => {
  it('o resto é a coorte menos as origens marcadas', () => {
    const totais = totalDasOrigens([origemDeChegada(712, 660, 139), origemDeChegada(217, 179, 53)]);
    const resto = semMarcacaoNaCoorte({ visitors: 1100, finished: 900, paid: 210 }, totais);

    expect(resto.visitors).toBe(1100 - 929);
    expect(resto.finished).toBe(900 - 839);
    expect(resto.paid).toBe(210 - 192);
    expect(resto.excede).toBe(false);
  });

  /** A propriedade que justifica a função existir. */
  it('linhas + resto = coorte', () => {
    const totais = totalDasOrigens([origemDeChegada(712, 660, 139), origemDeChegada(104, 84, 10)]);
    const coorte = { visitors: 1038, finished: 923, paid: 202 };
    const resto = semMarcacaoNaCoorte(coorte, totais);

    expect(totais.visitors + resto.visitors).toBe(coorte.visitors);
    expect(totais.finished + resto.finished).toBe(coorte.finished);
    expect(totais.paid + resto.paid).toBe(coorte.paid);
  });

  /**
   * A conversão do resto é `pagaram ÷ chegaram` DELE, não herdada do total — mesma regra que
   * `totalDasOrigens` aplica, e pelo mesmo motivo.
   */
  it('a conversão do resto é a dele', () => {
    const totais = totalDasOrigens([origemDeChegada(100, 90, 20)]);
    const resto = semMarcacaoNaCoorte({ visitors: 150, finished: 130, paid: 25 }, totais);

    expect(resto.visitors).toBe(50);
    expect(resto.paid).toBe(5);
    expect(resto.conversion).toBeCloseTo(10, 5);
  });

  /** Sem chegada no resto a conversão é 0, e não `NaN` — uma tela com NaN derruba a confiança toda. */
  it('resto vazio não produz NaN', () => {
    const totais = totalDasOrigens([origemDeChegada(80, 70, 15)]);
    const resto = semMarcacaoNaCoorte({ visitors: 80, finished: 70, paid: 15 }, totais);

    expect(resto.conversion).toBe(0);
    expect(Number.isNaN(resto.conversion)).toBe(false);
  });

  /**
   * ⚠️ Origens acima da coorte é caso REAL: `quiz:start` é único por visitante na vida, enquanto
   * uma linha de campanha nasce a cada chegada marcada. O visitante recorrente entra nas origens de
   * hoje e não nesta coorte — e a tela diz isso em vez de zerar calada.
   */
  it('avisa quando as origens passam da coorte', () => {
    const totais = totalDasOrigens([origemDeChegada(300, 280, 60)]);
    const resto = semMarcacaoNaCoorte({ visitors: 250, finished: 240, paid: 55 }, totais);

    expect(resto.excede, 'visitante recorrente passou em silêncio').toBe(true);
    expect(resto.visitors).toBe(0);
    expect(resto.paid).toBe(0);
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
    expect(FONTE_DA_PAGINA, 'o excede da coorte deixou de ser mostrado').toMatch(
      /\{restoDaCoorte\.excede &&/,
    );
  });

  /**
   * ⚠️ A ARMADILHA QUE ESTE TESTE EXISTE PARA IMPEDIR.
   *
   * O rodapé da tabela de chegadas precisa vir da COORTE. Trocá-lo pelo `pagaram` do funil é a
   * simplificação óbvia — os dois se chamam "pagou" e num dia fechado quase coincidem —, e está
   * errada: o funil recorta por data do MARCO e a tabela por data de CHEGADA. O resultado sairia
   * plausível, que é o pior jeito de estar errado.
   */
  it('o rodapé das chegadas vem da coorte, não do funil', () => {
    const detalhes = FONTE_DA_PAGINA.slice(FONTE_DA_PAGINA.indexOf('Onde cada origem falha'));
    const rodape = detalhes.slice(detalhes.indexOf('<tfoot>'), detalhes.indexOf('</tfoot>'));

    expect(rodape, 'o rodapé das chegadas deixou de usar a coorte').toContain('coorte.visitors');
    expect(rodape, 'o rodapé voltou a somar só as origens marcadas').not.toContain(
      'totais.visitors',
    );
    expect(rodape, 'o rodapé passou a usar o relógio do marco, e não o da chegada').not.toContain(
      '{pagaram}',
    );
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
