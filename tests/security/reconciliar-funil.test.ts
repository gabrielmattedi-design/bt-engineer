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

/**
 * O corpo de UMA função, e não "daqui até o fim do arquivo".
 *
 * A primeira versão destes testes fatiava do nome da função até o fim do fonte. Passou enquanto a
 * reconciliação era a última coisa do arquivo e quebrou na primeira função acrescentada depois —
 * `temPagamento`, que legitimamente contém 'paid', fez a asserção "não apaga o marco paid" falhar
 * sem que nada de errado tivesse sido escrito.
 *
 * Um teste que falha quando o código está certo é pior que um teste ausente: ele treina quem lê a
 * ignorar a falha. O recorte agora termina na próxima declaração de topo.
 */
function corpoDe(source: string, nome: string): string {
  const inicio = source.indexOf(nome);
  if (inicio === -1) return '';
  const resto = source.slice(inicio + nome.length);
  const fim = resto.search(/\n(?:export |async function |function |const )/);
  return fim === -1 ? resto : resto.slice(0, fim);
}

describe('a limpeza toca apenas o marco `report`', () => {
  const repo = sourceWithoutComments(REPO);
  const corpo = corpoDe(repo, 'export async function removerRelatoriosSemPagamento');

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
    const corpo = corpoDe(repo, 'async function hashesOrfaosDeRelatorio');
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
    const corpo = corpoDe(actions, 'export async function reconciliarFunil');
    expect(corpo).toContain('isAuthenticated');
  });

  it('o botão só é renderizado quando há incoerência', () => {
    const page = sourceWithoutComments(PAGE);
    expect(page).toMatch(/relatoriosSemPagamento > 0 \|\| convidadosNoFunil > 0/);
  });

  it('a contagem ignora o filtro de período', () => {
    // O resíduo é do banco inteiro. Passar `janela` faria o aviso sumir em "7 dias" e reaparecer em
    // "Tudo", ensinando que o problema vai e volta quando ele está parado no mesmo lugar.
    const page = sourceWithoutComments(PAGE);
    expect(page).toContain('contarRelatoriosSemPagamento()');
    expect(page).not.toContain('contarRelatoriosSemPagamento(janela)');
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 * O CONVIDADO SAI DO FUNIL — e o cliente NUNCA sai junto.
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Pedido do dono: "quem usar o cupom que dá acesso total de graça não fica registrado no funil".
 *
 * A remoção é a operação mais perigosa deste arquivo, porque apaga a jornada INTEIRA de alguém em
 * vez de um marco. Duas coisas a tornam segura, e as duas são fáceis de perder numa refatoração:
 *
 *   1. `coupon_redemptions` guarda os DOIS tipos de resgate — acesso grátis e desconto consumido no
 *      pagamento. Quem usou desconto pagou. Sem o filtro por `discount_percent IS NULL`, a limpeza
 *      apagaria clientes reais do funil, e o defeito apareceria como "a conversão caiu".
 *
 *   2. Uma pessoa pode ser convidada numa análise e COMPRAR em outra, do mesmo navegador. Sem a
 *      guarda de `paid`, a limpeza levaria a venda junto.
 *
 * Nenhum dos dois quebra nada visível quando se perde: o site continua funcionando e os números
 * ficam errados em silêncio. É exatamente o tipo de coisa que precisa de teste.
 */
describe('o convidado sai do funil', () => {
  const repo = sourceWithoutComments(REPO);

  it('só considera cupom de ACESSO, nunca de desconto', () => {
    const corpo = corpoDe(repo, 'async function analisesLiberadasPorCupom');
    expect(corpo).toContain('isNull(accessCoupons.discountPercent)');
  });

  it('nunca apaga a jornada de quem tem pagamento', () => {
    const corpo = corpoDe(repo, 'export async function removerDoFunilPelaAnalise');
    expect(corpo).toMatch(/if \(await temPagamento\(hash\)\) return 0;/);
  });

  it('a guarda de pagamento vem ANTES do delete', () => {
    // Ordem importa: conferir depois de apagar é não conferir.
    const corpo = corpoDe(repo, 'export async function removerDoFunilPelaAnalise');
    expect(corpo.indexOf('temPagamento')).toBeLessThan(corpo.indexOf('.delete('));
  });

  it('a remoção não derruba a concessão do acesso', () => {
    // Medição não pode custar ao convidado o relatório que ele veio buscar — mesma regra de
    // `markFunnel`. O `try/catch` é o que garante isso.
    const corpo = corpoDe(repo, 'export async function removerDoFunilPelaAnalise');
    expect(corpo).toContain('catch');
  });
});

describe('a remoção é chamada de onde o desconto não alcança', () => {
  const cupom = sourceWithoutComments(
    join(ROOT, 'src', 'database', 'repositories', 'coupon-repo.ts'),
  );

  it('sai de `grantEntitlements`, o caminho exclusivo do cupom de acesso', () => {
    const corpo = corpoDe(cupom, 'async function grantEntitlements');
    expect(corpo).toContain('removerDoFunilPelaAnalise(recommendationSessionId)');
  });

  it('a ramificação de desconto retorna antes de qualquer remoção', () => {
    /*
      O caminho do desconto termina em `kind: 'discount'` sem passar por `grantEntitlements` — é a
      posição no arquivo que impede a remoção de alcançar quem vai pagar. Se um dia a chamada subir
      para `redeemCoupon`, esta asserção falha e obriga a decisão a ser tomada de novo.
    */
    const trecho = cupom.slice(0, cupom.indexOf('async function grantEntitlements'));
    expect(trecho).toContain("kind: 'discount'");
    expect(trecho).not.toContain('removerDoFunilPelaAnalise(');
  });
});
