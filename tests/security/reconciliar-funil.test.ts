/**
 * A reconciliação apaga o resíduo do defeito antigo — e nada além dele.
 *
 * ═══ O PEDIDO, E POR QUE ELE NÃO FOI ATENDIDO AO PÉ DA LETRA ═════════════════════════════════
 *
 * O dono pediu: "tinham três vendas e quatro relatórios. Voltar o relatório pra três?"
 *
 * Fazer isso literalmente — apagar linhas até a conta fechar — resolveria a tela daquele dia e
 * deixaria um funil com um número digitado no meio dos medidos. No primeiro dia em que o total não
 * batesse, ninguém saberia se o dado está errado ou se a correção manual está velha.
 *
 * A regra implementada é derivada: depois do conserto da instrumentação, `report` só é gravado
 * quando existe entitlement vindo de PEDIDO, na mesma identidade que `paid` usa. Logo, todo
 * `report` sem `paid` correspondente é resíduo do defeito antigo — e nenhum outro é. O total cai
 * onde tem de cair, sem ninguém escolher.
 *
 * Estes testes travam as três coisas que fariam a limpeza deixar de ser derivada: apagar outro
 * marco, apagar por contagem em vez de por critério, e apagar quando não há nada errado.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const REPO = join(ROOT, 'src', 'database', 'repositories', 'funnel-repo.ts');
const ACTIONS = join(ROOT, 'src', 'app', 'admin', 'actions.ts');
const PAGE = join(ROOT, 'src', 'app', 'admin', 'funil', 'page.tsx');

function sourceWithoutComments(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('a limpeza toca apenas o marco `report`', () => {
  const repo = sourceWithoutComments(REPO);
  const corpo = repo.slice(repo.indexOf('export async function removerRelatoriosSemPagamento'));

  it('o delete filtra por `report`', () => {
    expect(corpo).toContain("eq(funnelMarkers.marker, 'report')");
  });

  it('não apaga marcos de questionário, prévia, planos ou checkout', () => {
    /*
      As visitas daquelas pessoas às etapas anteriores ACONTECERAM. O defeito era a identidade do
      último marco, não a existência da visita — apagar o caminho inteiro trocaria um número errado
      no fim por um buraco no meio.
    */
    for (const marco of ['quiz:', 'analysis', 'plans', 'checkout']) {
      expect(corpo).not.toContain(marco);
    }
  });

  it('não apaga o marco `paid`', () => {
    // `paid` é a referência da comparação. Apagá-lo junto destruiria a prova de que a venda existiu
    // para consertar a contagem de quem a viu.
    const deleteStmt = corpo.slice(corpo.indexOf('.delete('));
    expect(deleteStmt).not.toContain("'paid'");
  });
});

describe('a limpeza é por critério, nunca por contagem', () => {
  const repo = sourceWithoutComments(REPO);

  it('o conjunto a apagar vem da diferença entre `report` e `paid`', () => {
    expect(repo).toContain('hashesOrfaosDeRelatorio');
    expect(repo).toMatch(/pagaram\.has\(l\.hash\)/);
  });

  it('não existe limite, alvo ou número escrito à mão', () => {
    const corpo = repo.slice(repo.indexOf('async function hashesOrfaosDeRelatorio'));
    // `.limit(` ou `.slice(` seriam a forma de "apagar até a conta fechar" — o pedido literal.
    expect(corpo).not.toContain('.limit(');
    expect(corpo).not.toContain('.slice(');
  });

  it('lista vazia não vira SQL inválido', () => {
    // `inArray` com array vazio gera SQL inválido em vez de não apagar nada; sem a guarda, o botão
    // quebraria justamente no funil coerente, que é quando ele não deveria fazer nada.
    expect(repo).toMatch(/orfaos\.length === 0.*return 0/s);
  });
});

describe('a ação e a tela', () => {
  it('a Server Action revalida a autenticação', () => {
    const actions = sourceWithoutComments(ACTIONS);
    const corpo = actions.slice(actions.indexOf('export async function reconciliarFunil'));
    expect(corpo).toContain('isAuthenticated');
  });

  it('o botão só é renderizado quando há incoerência', () => {
    const page = sourceWithoutComments(PAGE);
    expect(page).toMatch(/relatoriosSemPagamento > 0 &&\s*\(?\s*<ReconciliarFunilForm/);
  });

  it('a contagem ignora o filtro de período', () => {
    // O resíduo é do banco inteiro. Passar `janela` faria o aviso sumir em "7 dias" e reaparecer em
    // "Tudo", ensinando que o problema vai e volta quando ele está parado no mesmo lugar.
    const page = sourceWithoutComments(PAGE);
    expect(page).toContain('contarRelatoriosSemPagamento()');
    expect(page).not.toContain('contarRelatoriosSemPagamento(janela)');
  });
});
