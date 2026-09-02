/**
 * Cupom de desconto: o que ele muda, e as quatro coisas que ele não pode fazer.
 *
 * ═══ POR QUE ELE É MAIS DELICADO QUE O CÓDIGO DE ACESSO ══════════════════════════════════════
 *
 * O código de acesso entrega e acaba: quem digita recebe o relatório, o uso é consumido, fim. O de
 * desconto atravessa TRÊS momentos separados no tempo — digitar, ir ao gateway, o pagamento voltar
 * — e cada fronteira entre eles é uma chance de o valor exibido e o valor cobrado se separarem.
 *
 * As regras que este arquivo tranca:
 *
 *   1. NADA é consumido quando a pessoa digita. Abandonar o checkout é o comportamento mais comum
 *      que existe, e um código digitado e abandonado não pode gastar o cupom de outra pessoa.
 *   2. O valor cobrado é recalculado NO SERVIDOR, no instante da compra. O que a tela mostrou não
 *      volta pelo formulário.
 *   3. O desconto nunca leva o preço abaixo do mínimo que o gateway aceita cobrar.
 *   4. Um código nunca é de acesso E de desconto ao mesmo tempo.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { brl, comDesconto, DESCONTO_MAX_PERCENT, PRECO_MIN_CENTS, PRODUCT_SEED } from '@/payments/catalogo';

const ROOT = join(__dirname, '..', '..');
const fonte = (...p: string[]): string => readFileSync(join(ROOT, ...p), 'utf8');
const semComentarios = (c: string): string =>
  c.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/**
 * O corpo de uma função exportada, do `export` dela até o próximo `export` do arquivo.
 *
 * A forma óbvia — `/export async function X[\s\S]*?\n}/` — parece funcionar e não funciona: várias
 * destas funções declaram o tipo dos parâmetros em bloco, e o `}` que fecha esse tipo está no
 * início de uma linha. O recorte terminava ali, nas primeiras linhas, e os testes passavam a
 * verificar a ASSINATURA achando que verificavam a lógica.
 */
function bloco(codigo: string, nome: string): string {
  const i = codigo.indexOf(`export async function ${nome}`);
  if (i === -1) return '';
  const j = codigo.indexOf('\nexport ', i + 1);
  return j === -1 ? codigo.slice(i) : codigo.slice(i, j);
}

describe('a aritmética do desconto', () => {
  it.each([
    [2999, 10, 2699],
    [2999, 15, 2549],
    [2999, 50, 1500],
    [4999, 20, 3999],
    [999, 50, 500],
  ])('%i centavos com %i%% viram %i', (preco, percent, esperado) => {
    expect(comDesconto(preco, percent)).toBe(esperado);
  });

  /**
   * O arredondamento é para o mais próximo, e não para baixo.
   *
   * R$ 29,99 com 15% dá 2549,15 centavos. Truncar entregaria um centavo a mais de desconto em quase
   * toda combinação — barato, e ainda assim dinheiro decidido por acidente de arredondamento.
   */
  it('arredonda o centavo, em vez de truncar', () => {
    expect(comDesconto(2999, 15)).toBe(2549);
    expect(comDesconto(999, 33)).toBe(669);
  });

  /**
   * O piso é o que impede um checkout que o gateway recusa — com o cliente na frente da tela.
   */
  it('nunca desce abaixo do mínimo cobrável', () => {
    expect(comDesconto(PRECO_MIN_CENTS, DESCONTO_MAX_PERCENT)).toBe(PRECO_MIN_CENTS);
    expect(comDesconto(150, 90)).toBe(PRECO_MIN_CENTS);
  });

  /**
   * O teto de 90% é calibrado pelo produto MAIS BARATO do catálogo, e o catálogo é editável.
   *
   * Este teste falha no dia em que alguém criar um produto barato o bastante para o teto deixar de
   * fazer sentido — que é exatamente quando alguém precisa reler a decisão.
   */
  it('o teto de 90% mantém todo produto do catálogo acima do mínimo', () => {
    for (const p of PRODUCT_SEED) {
      const final = comDesconto(p.priceCents, DESCONTO_MAX_PERCENT);
      expect(final, `${p.sku} a ${DESCONTO_MAX_PERCENT}% cai para ${brl(final)}`).toBeGreaterThanOrEqual(
        PRECO_MIN_CENTS,
      );
    }
  });
});

describe('digitar o código não gasta nada', () => {
  const repo = semComentarios(fonte('src', 'database', 'repositories', 'coupon-repo.ts'));

  /**
   * O trecho que trata o cupom de desconto precisa SAIR antes de qualquer consumo.
   *
   * Abaixo dele vivem o `UPDATE` que incrementa `used_count` e o `INSERT` em `coupon_redemptions`,
   * escritos para o código de ACESSO. Se o desconto passasse por ali, cada tentativa de digitar
   * queimaria um uso — e a pessoa nem teria pago ainda.
   */
  it('o desconto retorna antes do consumo do uso', () => {
    const corpo = bloco(repo, 'redeemCoupon');
    expect(corpo, 'redeemCoupon sumiu ou mudou de forma').not.toBe('');

    const posDesconto = corpo.indexOf("kind: 'discount'");
    const posConsumo = corpo.indexOf('usedCount: sql');

    expect(posDesconto, 'redeemCoupon não trata cupom de desconto').toBeGreaterThan(-1);
    expect(posConsumo, 'o consumo do uso sumiu').toBeGreaterThan(-1);
    expect(
      posDesconto,
      'o cupom de desconto passou a gastar um uso só por ter sido digitado',
    ).toBeLessThan(posConsumo);
  });

  /** O uso só é consumido quando o dinheiro entra. */
  it('o consumo acontece na confirmação do pagamento', () => {
    const commerce = semComentarios(
      fonte('src', 'database', 'repositories', 'commerce-repo.ts'),
    );
    const corpo = bloco(commerce, 'processPaymentEvent');
    expect(corpo).toContain('consumirCupomDoPedido');

    // Depois do portão que barra tudo que não é pagamento confirmado.
    const posPortao = corpo.indexOf("event.status !== 'paid'");
    expect(posPortao).toBeGreaterThan(-1);
    expect(corpo.indexOf('consumirCupomDoPedido')).toBeGreaterThan(posPortao);
  });
});

describe('o valor cobrado é decidido no servidor', () => {
  const commerce = semComentarios(fonte('src', 'database', 'repositories', 'commerce-repo.ts'));

  /**
   * O desconto é relido do banco dentro de `createOrder`, e não recebido de fora.
   *
   * Se ele viesse por parâmetro, quem chama decidiria quanto alguém paga — e um dos caminhos que
   * chega aqui nasce de um formulário.
   */
  it('createOrder relê o cupom do banco', () => {
    const corpo = bloco(commerce, 'createOrder');
    expect(corpo, 'createOrder sumiu ou mudou de forma').not.toBe('');
    expect(corpo).toContain('descontoDaAnalise');
    expect(corpo).toContain('comDesconto');

    /*
      A assinatura NÃO pode aceitar valor nem percentual vindo de fora. Este teste falha se alguém
      adicionar um `amountCents` ou `discountPercent` aos parâmetros, que é a forma mais natural de
      reintroduzir o furo.
    */
    const assinatura = corpo.slice(0, corpo.indexOf('{', corpo.indexOf('):')));
    expect(assinatura).not.toMatch(/amountCents|discountPercent|percent/);
  });

  /** O gateway recebe o valor do PEDIDO, que já passou pelo desconto — nunca o preço do produto. */
  it('o checkout manda ao gateway o valor do pedido', () => {
    const acoes = semComentarios(fonte('src', 'app', 'planos', '[sessionId]', 'actions.ts'));
    expect(acoes, 'o checkout voltou a mandar o preço cheio').not.toContain(
      'amountCents: order.product.priceCents',
    );
    expect(acoes).toContain('amountCents: order.amountCents');
  });

  /**
   * Um cupom desativado ou esgotado precisa parar de valer NA HORA, inclusive para quem já o
   * aplicou — por isso a análise guarda só o código, e o percentual é sempre relido.
   */
  it('a análise guarda o código, não a porcentagem', () => {
    const schema = fonte('src', 'database', 'schema', 'sessions.ts');
    expect(schema).toContain("couponCode: text('coupon_code')");
    expect(schema, 'copiar o percentual faria um cupom morto continuar valendo').not.toContain(
      "discountPercent: integer('discount_percent')",
    );
  });
});

describe('um código nunca é de acesso e de desconto', () => {
  it('o repositório zera os grants quando há desconto', () => {
    const corpo = bloco(
      semComentarios(fonte('src', 'database', 'repositories', 'coupon-repo.ts')),
      'upsertCoupon',
    );
    expect(corpo, 'upsertCoupon sumiu ou mudou de forma').not.toBe('');

    /*
      A regra vive no REPOSITÓRIO, e não só na tela. A tela é uma das formas de criar um código;
      trancar apenas nela deixaria qualquer outro caminho livre para criar o híbrido.
    */
    expect(corpo).toMatch(/desconto === null \? \[\.\.\.input\.grants\] : \[\]/);
  });

  it('o preset de desconto não concede nada', () => {
    const presets = fonte('src', 'app', 'admin', 'codigos', 'presets.ts');
    const bloco = /desconto: \{[\s\S]*?\},/.exec(presets)?.[0] ?? '';
    expect(bloco, 'o preset de desconto sumiu').not.toBe('');
    expect(bloco).toContain('grants: []');
  });
});
