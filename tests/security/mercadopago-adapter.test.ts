/**
 * O adapter que movimenta dinheiro de verdade.
 *
 * ═══ O QUE ESTES TESTES PROTEGEM ═════════════════════════════════════════════════════════════
 *
 * Três falhas possíveis aqui, em ordem de custo:
 *
 *   1. conceder acesso sem receber — assinatura aceita quando não devia, ou estado do gateway
 *      traduzido para `paid` por engano;
 *   2. não conceder acesso a quem pagou — assinatura recusada quando devia passar;
 *   3. conceder duas vezes — reenvio da mesma notificação tratado como evento novo.
 *
 * Nenhuma delas aparece em desenvolvimento: o caminho só é exercitado com um gateway real do outro
 * lado. Por isso o adapter é testado com a rede simulada, e não "quando der para testar em
 * sandbox" — que é depois do anúncio no ar.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { mercadoPagoProvider } from '@/payments/adapters/mercadopago';

const SECRET = 'segredo-de-teste-do-webhook';
const TOKEN = 'TEST-access-token';

beforeEach(() => {
  process.env.MERCADOPAGO_ACCESS_TOKEN = TOKEN;
  process.env.MERCADOPAGO_WEBHOOK_SECRET = SECRET;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.MERCADOPAGO_ACCESS_TOKEN;
  delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
});

/** Monta a assinatura exatamente como o Mercado Pago monta. */
function assinar(dataId: string, requestId: string | null, ts = '1742505638683'): string {
  const manifesto = `id:${dataId};` + (requestId ? `request-id:${requestId};` : '') + `ts:${ts};`;
  const v1 = createHmac('sha256', SECRET).update(manifesto).digest('hex');
  return `ts=${ts},v1=${v1}`;
}

function notificacao(
  dataId: string,
  opcoes: { signature?: string | null; requestId?: string | null; type?: string } = {},
): Request {
  const headers: Record<string, string> = {};
  const assinatura =
    opcoes.signature === undefined ? assinar(dataId, opcoes.requestId ?? 'req-1') : opcoes.signature;
  if (assinatura) headers['x-signature'] = assinatura;
  if (opcoes.requestId !== null) headers['x-request-id'] = opcoes.requestId ?? 'req-1';

  return new Request('https://exemplo.com/api/webhooks/payment', {
    method: 'POST',
    headers,
    body: JSON.stringify({ type: opcoes.type ?? 'payment', action: 'payment.updated', data: { id: dataId } }),
  });
}

/** Simula a API do Mercado Pago devolvendo um pagamento. */
function apiDevolve(payment: Record<string, unknown> | null, ok = true): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      ok && payment
        ? new Response(JSON.stringify(payment), { status: 200 })
        : new Response('não encontrado', { status: 404 }),
    ),
  );
}

describe('assinatura do webhook', () => {
  it('aceita uma notificação legítima', async () => {
    apiDevolve({ id: 123, status: 'approved', external_reference: 'ord_1', payment_method_id: 'pix' });
    const evento = await mercadoPagoProvider.parseWebhook(notificacao('123'));

    expect(evento).not.toBeNull();
    expect(evento!.orderId).toBe('ord_1');
    expect(evento!.status).toBe('paid');
  });

  it('recusa assinatura ausente', async () => {
    apiDevolve({ id: 123, status: 'approved', external_reference: 'ord_1' });
    expect(await mercadoPagoProvider.parseWebhook(notificacao('123', { signature: null }))).toBeNull();
  });

  it('recusa assinatura de outro segredo', async () => {
    apiDevolve({ id: 123, status: 'approved', external_reference: 'ord_1' });
    const forjada = `ts=1742505638683,v1=${createHmac('sha256', 'outro-segredo')
      .update('id:123;request-id:req-1;ts:1742505638683;')
      .digest('hex')}`;
    expect(
      await mercadoPagoProvider.parseWebhook(notificacao('123', { signature: forjada })),
    ).toBeNull();
  });

  it('recusa quando o id assinado não é o id notificado', async () => {
    apiDevolve({ id: 999, status: 'approved', external_reference: 'ord_1' });
    // Assinatura válida para o pagamento 123, corpo falando do 999.
    const outra = assinar('123', 'req-1');
    expect(await mercadoPagoProvider.parseWebhook(notificacao('999', { signature: outra }))).toBeNull();
  });

  /**
   * As notificações de teste do painel do Mercado Pago costumam vir sem `x-request-id`, e a
   * documentação manda REMOVER do manifesto o campo ausente — não mandá-lo vazio. É o primeiro
   * caminho que qualquer pessoa exercita, e o mais fácil de implementar errado.
   */
  it('aceita notificação sem x-request-id, com o campo fora do manifesto', async () => {
    apiDevolve({ id: 55, status: 'approved', external_reference: 'ord_9' });
    const evento = await mercadoPagoProvider.parseWebhook(
      notificacao('55', { requestId: null, signature: assinar('55', null) }),
    );
    expect(evento).not.toBeNull();
    expect(evento!.orderId).toBe('ord_9');
  });
});

describe('o estado vem da API, não do corpo', () => {
  it('ignora o que a notificação afirma e usa o que a API responde', async () => {
    // A API diz `rejected`; nenhum campo do corpo poderia sobrepor isso.
    apiDevolve({ id: 7, status: 'rejected', external_reference: 'ord_7' });
    const evento = await mercadoPagoProvider.parseWebhook(notificacao('7'));
    expect(evento!.status).toBe('failed');
  });

  it('sem resposta da API, não há evento — e portanto não há acesso', async () => {
    apiDevolve(null, false);
    expect(await mercadoPagoProvider.parseWebhook(notificacao('7'))).toBeNull();
  });

  it('pagamento sem external_reference é descartado', async () => {
    // Sem ele não há como saber QUAL pedido foi pago; conceder no palpite seria pior que ignorar.
    apiDevolve({ id: 7, status: 'approved', external_reference: null });
    expect(await mercadoPagoProvider.parseWebhook(notificacao('7'))).toBeNull();
  });
});

describe('tradução de estados', () => {
  const casos: Array<[string, string]> = [
    ['approved', 'paid'],
    ['pending', 'pending'],
    ['in_process', 'pending'],
    ['authorized', 'pending'],
    ['rejected', 'failed'],
    ['cancelled', 'cancelled'],
    ['refunded', 'refunded'],
    ['charged_back', 'refunded'],
  ];

  for (const [mp, nosso] of casos) {
    it(`${mp} → ${nosso}`, async () => {
      apiDevolve({ id: 1, status: mp, external_reference: 'ord_1' });
      const evento = await mercadoPagoProvider.parseWebhook(notificacao('1'));
      expect(evento!.status).toBe(nosso);
    });
  }

  /**
   * O teste que mais importa da lista: um estado que o gateway inventar amanhã não pode virar
   * `paid` por omissão. Conceder sem receber é o erro caro; ficar pendente é recuperável.
   */
  it('estado desconhecido não concede acesso', async () => {
    apiDevolve({ id: 1, status: 'estado_que_nao_existe_ainda', external_reference: 'ord_1' });
    expect(await mercadoPagoProvider.parseWebhook(notificacao('1'))).toBeNull();

    apiDevolve({ id: 1, status: 'outra_coisa', external_reference: 'ord_1' });
    expect(await mercadoPagoProvider.getPaymentStatus('1')).toBe('pending');
  });
});

describe('idempotência', () => {
  it('o mesmo pagamento no mesmo estado gera sempre o mesmo id de evento', async () => {
    apiDevolve({ id: 42, status: 'approved', external_reference: 'ord_1' });
    const a = await mercadoPagoProvider.parseWebhook(notificacao('42'));
    const b = await mercadoPagoProvider.parseWebhook(
      notificacao('42', { requestId: 'req-DIFERENTE', signature: assinar('42', 'req-DIFERENTE') }),
    );
    // Reenvio com outro request-id é o MESMO fato — não pode conceder duas vezes.
    expect(a!.providerEventId).toBe(b!.providerEventId);
  });

  it('a transição de pendente para aprovado é um evento novo', async () => {
    apiDevolve({ id: 42, status: 'pending', external_reference: 'ord_1' });
    const pendente = await mercadoPagoProvider.parseWebhook(notificacao('42'));
    apiDevolve({ id: 42, status: 'approved', external_reference: 'ord_1' });
    const aprovado = await mercadoPagoProvider.parseWebhook(notificacao('42'));

    expect(pendente!.providerEventId).not.toBe(aprovado!.providerEventId);
  });
});

describe('notificações que não são de pagamento', () => {
  it('merchant_order é ignorada sem erro', async () => {
    apiDevolve({ id: 1, status: 'approved', external_reference: 'ord_1' });
    expect(
      await mercadoPagoProvider.parseWebhook(notificacao('1', { type: 'merchant_order' })),
    ).toBeNull();
  });
});

describe('credenciais ausentes falham alto', () => {
  it('sem access token, o checkout não é criado em silêncio', async () => {
    delete process.env.MERCADOPAGO_ACCESS_TOKEN;
    await expect(
      mercadoPagoProvider.createCheckout({
        orderId: 'ord_1',
        sku: 'racket_report',
        productName: 'Relatório',
        amountCents: 1999,
        currency: 'BRL',
        returnUrl: 'https://exemplo.com/resultado/x',
        notificationUrl: 'https://exemplo.com/api/webhooks/payment',
      }),
    ).rejects.toThrow(/MERCADOPAGO_ACCESS_TOKEN/);
  });
});

describe('criação do checkout', () => {
  it('manda o orderId como external_reference e converte centavos', async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify({ id: 'pref_1', init_point: 'https://mp/checkout' }), {
          status: 200,
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const sessao = await mercadoPagoProvider.createCheckout({
      orderId: 'ord_abc',
      sku: 'full_setup',
      productName: 'Setup completo',
      amountCents: 4999,
      currency: 'BRL',
      returnUrl: 'https://exemplo.com/resultado/x',
      notificationUrl: 'https://exemplo.com/api/webhooks/payment',
    });

    expect(sessao.redirectUrl).toBe('https://mp/checkout');

    const corpo = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as Record<string, any>;
    expect(corpo.external_reference, 'sem isto o webhook não acha o pedido').toBe('ord_abc');
    expect(corpo.items[0].unit_price, 'o Mercado Pago cobra em unidades, não centavos').toBe(49.99);
    expect(corpo.notification_url).toContain('/api/webhooks/payment');
  });

  it('usa o sandbox_init_point quando a credencial é de teste', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ id: 'pref_2', sandbox_init_point: 'https://sandbox/mp' }), {
            status: 200,
          }),
      ),
    );

    const sessao = await mercadoPagoProvider.createCheckout({
      orderId: 'ord_1',
      sku: 'racket_report',
      productName: 'Relatório',
      amountCents: 1999,
      currency: 'BRL',
      returnUrl: 'https://exemplo.com/resultado/x',
      notificationUrl: 'https://exemplo.com/api/webhooks/payment',
    });

    expect(sessao.redirectUrl).toBe('https://sandbox/mp');
  });

  it('recusa explicitamente quando o gateway rejeita a preferência', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('invalid token', { status: 401 })));
    await expect(
      mercadoPagoProvider.createCheckout({
        orderId: 'ord_1',
        sku: 'racket_report',
        productName: 'Relatório',
        amountCents: 1999,
        currency: 'BRL',
        returnUrl: 'https://exemplo.com/resultado/x',
        notificationUrl: 'https://exemplo.com/api/webhooks/payment',
      }),
    ).rejects.toThrow(/401/);
  });
});
