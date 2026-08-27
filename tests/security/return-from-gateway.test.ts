/**
 * A volta do gateway não pode cair no relatório nem conceder acesso.
 *
 * ═══ O DEFEITO QUE ISTO TRANCA ═══════════════════════════════════════════════════════════════
 *
 * O `back_urls.success` apontava direto para `/resultado/<id>`. Pagar e receber acesso chegam por
 * caminhos diferentes — o comprador pelo navegador, a confirmação pelo webhook — e não há ordem
 * garantida entre eles. Quando o navegador chega primeiro, `/resultado` não acha entitlement e
 * devolve a pessoa para a página de planos, oferecendo com preço e botão exatamente o que ela
 * acabou de comprar.
 *
 * Aconteceu no primeiro pagamento de teste do sistema (ago/2026), com o pagamento aprovado.
 *
 * ═══ A OUTRA METADE: A TENTAÇÃO DE CONCEDER ══════════════════════════════════════════════════
 *
 * O Mercado Pago devolve `status=approved` na própria URL de retorno, e a correção "óbvia" seria
 * liberar o acesso ali. Isso criaria um segundo caminho de concessão acionável por qualquer pessoa
 * que digite o parâmetro na barra de endereço. O webhook é a origem única (§33), e a tela de espera
 * só espera.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mercadoPagoProvider } from '@/payments/adapters/mercadopago';

const ROOT = join(__dirname, '..', '..');

function fonte(...partes: string[]): string {
  return readFileSync(join(ROOT, ...partes), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('para onde o gateway devolve o comprador', () => {
  const actions = fonte('src', 'app', 'planos', '[sessionId]', 'actions.ts');

  it('o retorno de sucesso NÃO é a página de relatório', () => {
    expect(
      actions,
      'devolver direto ao relatório manda quem pagou de volta aos planos quando a confirmação ' +
        'ainda não chegou',
    ).not.toMatch(/returnUrl:\s*`[^`]*\/resultado\//);
  });

  it('o retorno de sucesso é a tela de espera', () => {
    expect(actions).toMatch(/returnUrl:\s*`[^`]*\/retorno\//);
  });

  /**
   * Recusa e sucesso não podem compartilhar a tela.
   *
   * A tela de espera abre com "Pagamento recebido". É a última frase que alguém com o cartão
   * recusado deveria ler — transformaria uma recusa banal de limite numa reclamação de dinheiro
   * sumido.
   */
  it('a recusa tem destino próprio, diferente do sucesso', () => {
    const sucesso = /returnUrl:\s*`([^`]*)`/.exec(actions)?.[1];
    const recusa = /failureUrl:\s*`([^`]*)`/.exec(actions)?.[1];
    expect(recusa, 'failureUrl não foi definido').toBeTruthy();
    expect(recusa).not.toBe(sucesso);
  });
});

describe('a tela de espera não é um caminho de concessão', () => {
  const page = fonte('src', 'app', 'retorno', '[sessionId]', 'page.tsx');

  it('lê o acesso do banco, como todo o resto do sistema', () => {
    expect(page).toContain('grantedEntitlements');
  });

  it('não traduz produto em entitlement por conta própria', () => {
    expect(page).not.toContain('PRODUCT_ENTITLEMENTS');
  });

  /**
   * O parâmetro de status que o gateway devolve na URL não pode influenciar nada além de texto.
   * Se o nome de qualquer um deles aparecer na página, quase certamente é para decidir acesso.
   */
  it('não olha o status que o gateway devolve na URL', () => {
    for (const param of ['collection_status', 'payment_id', 'preference_id', 'approved']) {
      expect(page, `a página lê "${param}" da URL`).not.toContain(param);
    }
  });
});

describe('o adapter separa sucesso de recusa', () => {
  beforeEach(() => {
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-token';
    process.env.MERCADOPAGO_WEBHOOK_SECRET = 'segredo';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.MERCADOPAGO_ACCESS_TOKEN;
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
  });

  it('manda a recusa para failureUrl e o pendente para a espera', async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify({ id: 'p', init_point: 'https://mp/c' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await mercadoPagoProvider.createCheckout({
      orderId: 'ord_1',
      sku: 'racket_report',
      productName: 'Relatório',
      amountCents: 1999,
      currency: 'BRL',
      returnUrl: 'https://exemplo.com/retorno/abc',
      failureUrl: 'https://exemplo.com/planos/abc',
      notificationUrl: 'https://exemplo.com/api/webhooks/payment',
    });

    const corpo = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as {
      back_urls: { success: string; pending: string; failure: string };
    };

    expect(corpo.back_urls.success).toBe('https://exemplo.com/retorno/abc');
    // PIX e boleto voltam pendentes; a tela de espera já diz a coisa certa para esse caso.
    expect(corpo.back_urls.pending).toBe('https://exemplo.com/retorno/abc');
    expect(corpo.back_urls.failure).toBe('https://exemplo.com/planos/abc');
  });
});
