/**
 * A LOJA SÓ OFERECE O QUE A PESSOA CONSEGUE USAR.
 *
 * ═══ O QUE ESTAVA NA TELA ════════════════════════════════════════════════════════════════════
 *
 * Relato do dono, com o PDF da página na mão, depois de desistir de um pagamento e voltar:
 *
 *   "Essa tela habilita por exemplo o pagamento de desbloquear a segunda colocada, sem ter
 *    comprado nada, vai confundir o usuário."
 *
 * A página listava os cinco produtos para qualquer visitante — as duas portas de entrada e os três
 * upgrades. "Desbloquear a 2ª colocada" por R$ 8,99 oferecido a quem não tem nem a 1ª não é apenas
 * confuso: é vender o pedaço de um relatório que a pessoa não consegue abrir. Ela pagaria e
 * continuaria sem ver raquete nenhuma, e o conserto seria estorno manual dos dois lados.
 *
 * ═══ E POR QUE ELE VOLTOU JUSTAMENTE PARA LÁ ═════════════════════════════════════════════════
 *
 * O caminho real é `/analise/<id>` → `/planos/<id>?produto=racket_report` → gateway: quem clica
 * está numa página de UM produto. A URL de falha do checkout apontava para `/planos/<id>` sem o
 * parâmetro, e sem ele a página lista tudo. Desistir do pagamento devolvia a pessoa a uma tela que
 * ela nunca tinha visto.
 *
 * Um sintoma, duas causas. Estes testes trancam as duas — e a terceira coisa que faltava: a mesma
 * regra do lado do servidor, porque esconder o botão não fecha o endereço.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRODUCT_ENTITLEMENTS } from '@/payments/entitlements';
import { PRODUCT_SEED } from '@/payments/catalogo';

const ROOT = join(__dirname, '..', '..');
const semComentarios = (c: string): string =>
  c.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const pagina = semComentarios(
  readFileSync(join(ROOT, 'src', 'app', 'planos', '[sessionId]', 'page.tsx'), 'utf8'),
);
const acoes = semComentarios(
  readFileSync(join(ROOT, 'src', 'app', 'planos', '[sessionId]', 'actions.ts'), 'utf8'),
);

/**
 * As duas portas de entrada, e a razão de serem só estas duas: são os únicos produtos que concedem
 * `racket_report_access`, que é o que faz um relatório existir. Todo o resto estende um relatório.
 */
const ENTRADAS = ['racket_report', 'full_setup'] as const;

describe('o catálogo de produtos', () => {
  /**
   * Esta é a regra da qual as outras dependem. Se um dia nascer um upgrade que conceda
   * `racket_report_access`, a classificação "entrada × upgrade" deixa de ser derivável do jeito que
   * a página e o Server Action a derivam, e os dois passam a errar em silêncio.
   */
  it('só as duas entradas concedem acesso ao relatório', () => {
    for (const [sku, concede] of Object.entries(PRODUCT_ENTITLEMENTS)) {
      const abreRelatorio = concede.includes('racket_report_access');
      expect(
        abreRelatorio,
        `${sku}: ${abreRelatorio ? 'concede' : 'não concede'} racket_report_access`,
      ).toBe((ENTRADAS as readonly string[]).includes(sku));
    }
  });

  /** Todo SKU vendável precisa conceder alguma coisa — senão a loja cobra por nada. */
  it('todo produto do catálogo concede algum acesso', () => {
    for (const p of PRODUCT_SEED) {
      const concede = PRODUCT_ENTITLEMENTS[p.sku] ?? [];
      expect(concede.length, `${p.sku} não concede entitlement nenhum`).toBeGreaterThan(0);
    }
  });
});

describe('a vitrine', () => {
  /**
   * A lista era `all.filter((p) => p.sku !== 'top3_unlock')` — um SKU excluído à mão, e todo o
   * resto exibido a qualquer visitante. O filtro precisa olhar o que a pessoa TEM.
   */
  it('a lista é filtrada pelos entitlements de quem está olhando', () => {
    expect(pagina, 'a página não lê mais os entitlements concedidos').toContain(
      'grantedEntitlements',
    );
    expect(pagina, 'voltou o filtro por SKU fixo, sem olhar a posse').not.toMatch(
      /all\.filter\(\(p\) => p\.sku !== 'top3_unlock'\)/,
    );
  });

  /**
   * O `?produto=` estreita a lista JÁ FILTRADA, e não o catálogo inteiro.
   *
   * Antes ele passava por cima de tudo: `/planos/<id>?produto=unlock_rank_2` abria o checkout de um
   * upgrade para quem não tinha comprado nada. Uma tela que esconde o botão não protege enquanto o
   * endereço continua funcionando.
   */
  it('o parâmetro de produto não escapa do filtro', () => {
    expect(pagina, 'o ?produto= voltou a filtrar o catálogo cru').not.toMatch(
      /produto \? all\.filter/,
    );
    expect(pagina).toMatch(/disponiveis\.filter\(\(p\) => p\.sku === produto\)/);
  });

  /**
   * ═══ A PORTA DE ENTRADA FECHA DEPOIS DE ATRAVESSADA ══════════════════════════════════════
   *
   * O lado caro do mesmo erro, e ele sobreviveu à primeira versão do filtro: quem pagou R$ 29,99
   * pela raquete ainda via "Descubra seu setup completo" por R$ 44,99 — um produto que INCLUI a
   * raquete que ela acabou de comprar. Aceitar custaria R$ 74,98 pelo mesmo conteúdo que
   * `setup_upgrade` entrega por R$ 59,98, pagando duas vezes pelo relatório.
   */
  it('não revende a entrada para quem já entrou', () => {
    expect(pagina, 'a porta de entrada continua aberta depois de comprada').toMatch(
      /ENTRADAS\.has\(sku\) && temRelatorio/,
    );
  });

  /** A soma que torna a revenda indefensável, conferida contra os preços reais do catálogo. */
  it('comprar a entrada duas vezes sairia mais caro que o upgrade', () => {
    const preco = (sku: string): number =>
      PRODUCT_SEED.find((p) => p.sku === sku)?.priceCents ?? 0;

    const revenda = preco('racket_report') + preco('full_setup');
    const caminhoCerto = preco('racket_report') + preco('setup_upgrade');

    expect(revenda, 'os preços mudaram e a revenda deixou de ser mais cara').toBeGreaterThan(
      caminhoCerto,
    );
  });

  /**
   * Lista vazia passou a ter duas causas, e elas pedem respostas opostas: tabela sem produtos é
   * problema do dono do site; nada a oferecer é a boa notícia de quem já comprou tudo. Mandar essa
   * pessoa abrir `/admin/setup` responderia à pergunta errada, com um endereço que ela não abre.
   */
  it('quem já comprou tudo não recebe instrução de administrador', () => {
    expect(pagina, 'o estado vazio não distingue as duas causas').toMatch(/all\.length === 0/);
    expect(pagina).toMatch(/Você já tem tudo desta análise/);
    expect(pagina, 'falta o caminho de volta ao relatório').toMatch(/\/resultado\/\$\{sessionId\}/);
  });
});

describe('a volta do checkout', () => {
  /**
   * Quem desiste do pagamento tem de voltar para a página de onde saiu — que é uma página de UM
   * produto, e não a lista inteira.
   */
  it('a URL de falha preserva qual produto estava sendo comprado', () => {
    const linha = /failureUrl: `[^`]*`/.exec(acoes)?.[0] ?? '';
    expect(linha, 'não achei a URL de falha').not.toBe('');
    expect(linha, 'a volta perdeu o produto e cai na lista completa').toContain('produto=');
  });

  it('a volta de sucesso continua indo para a tela de espera, não para o relatório', () => {
    const linha = /returnUrl: `[^`]*`/.exec(acoes)?.[0] ?? '';
    expect(linha).toContain('/retorno/');
    expect(linha, 'a volta de sucesso passou a pular a espera da confirmação').not.toContain(
      '/resultado/',
    );
  });
});

/**
 * ═══ A VOLTA DE UM PAGAMENTO RECUSADO ═══════════════════════════════════════════════════════
 *
 * A URL de falha traz a pessoa de volta a esta página, e o gateway acrescenta `status=rejected` ao
 * endereço. A página ignorava esse parâmetro: quem teve o pagamento recusado via o mesmo card, o
 * mesmo preço e o mesmo botão, sem uma linha dizendo o que aconteceu.
 *
 * A recusa que mostrou o tamanho disso foi real, e o painel do gateway explicava:
 *
 *   "Protegemos você de um pagamento suspeito. Recomende a seu cliente que pague com o meio de
 *    pagamento e dispositivo que costuma usar para compras on-line."
 *
 * É antifraude, não é o cartão. Quem levou essa recusa acha que o problema é o cartão dela e tenta
 * de novo com o mesmo — que é justamente o que costuma ser recusado outra vez. O PIX passa por
 * fora dessa análise inteira, e ninguém tinha como saber disso.
 */
describe('a volta de um pagamento recusado', () => {
  it('a página lê o status que o gateway devolve', () => {
    expect(pagina, 'o parâmetro de status voltou a ser ignorado').toMatch(/collection_status/);
    expect(pagina).toMatch(/status === 'rejected'/);
  });

  it('diz que nada foi cobrado e que costuma não ser o cartão', () => {
    expect(pagina).toMatch(/O pagamento não foi aprovado/);
    expect(pagina, 'falta dizer que nada foi cobrado').toMatch(/Nada foi\s*\n?\s*cobrado/);
  });

  /** O caminho com mais chance, e o único que não passa pela análise de risco do cartão. */
  it('aponta o PIX como saída', () => {
    expect(pagina, 'a mensagem não oferece alternativa nenhuma').toMatch(/PIX/);
  });
});

describe('o Server Action', () => {
  /**
   * A guarda que a tela não substitui.
   *
   * O próprio arquivo já registrava o princípio para o modo convite — "esconder é decisão de tela e
   * tela é o que menos protege: um POST direto ao Server Action não passa por ela". A mesma frase
   * valia para os upgrades e a guarda não existia.
   */
  it('recusa upgrade de quem não comprou o relatório', () => {
    expect(acoes, 'o checkout não confere mais os entitlements').toContain('grantedEntitlements');
    expect(acoes, 'a guarda de pré-requisito sumiu').toContain('racket_report_access');
  });

  /**
   * E a recusa vem ANTES de `createOrder`, senão sobra pedido órfão em `pending` para limpar à mão.
   */
  it('recusa antes de criar o pedido', () => {
    const posGuarda = acoes.indexOf('racket_report_access');
    const posPedido = acoes.indexOf('createOrder({');
    expect(posGuarda, 'não achei a guarda').toBeGreaterThan(-1);
    expect(posPedido, 'não achei a criação do pedido').toBeGreaterThan(-1);
    expect(posGuarda, 'a guarda passou a rodar depois de criar o pedido').toBeLessThan(posPedido);
  });

  /** Nem vender de novo o que já foi comprado. */
  it('recusa o que a pessoa já tem', () => {
    expect(acoes).toMatch(/já tem este item liberado/i);
  });
});
