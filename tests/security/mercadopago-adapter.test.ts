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
import type { PaymentEvent } from '@/payments/provider';

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


/**
 * Desembrulha o resultado para as asserções que só olham o evento.
 *
 * `parseWebhook` devolve um `WebhookOutcome` de três casos — evento, ignorada, inválida — porque a
 * rota precisa dar códigos de status diferentes para cada um. Os testes abaixo, escritos antes
 * dessa distinção, só perguntam "virou evento ou não", e continuam sendo a pergunta certa para eles.
 * Os testes que separam `ignored` de `invalid` ficam no bloco próprio, mais abaixo.
 */
async function parse(request: Request): Promise<PaymentEvent | null> {
  const r = await mercadoPagoProvider.parseWebhook(request);
  return r.kind === 'event' ? r.event : null;
}

describe('assinatura do webhook', () => {
  it('aceita uma notificação legítima', async () => {
    apiDevolve({ id: 123, status: 'approved', external_reference: 'ord_1', payment_method_id: 'pix' });
    const evento = await parse(notificacao('123'));

    expect(evento).not.toBeNull();
    expect(evento!.orderId).toBe('ord_1');
    expect(evento!.status).toBe('paid');
  });

  it('recusa assinatura ausente', async () => {
    apiDevolve({ id: 123, status: 'approved', external_reference: 'ord_1' });
    expect(await parse(notificacao('123', { signature: null }))).toBeNull();
  });

  it('recusa assinatura de outro segredo', async () => {
    apiDevolve({ id: 123, status: 'approved', external_reference: 'ord_1' });
    const forjada = `ts=1742505638683,v1=${createHmac('sha256', 'outro-segredo')
      .update('id:123;request-id:req-1;ts:1742505638683;')
      .digest('hex')}`;
    expect(
      await parse(notificacao('123', { signature: forjada })),
    ).toBeNull();
  });

  it('recusa quando o id assinado não é o id notificado', async () => {
    apiDevolve({ id: 999, status: 'approved', external_reference: 'ord_1' });
    // Assinatura válida para o pagamento 123, corpo falando do 999.
    const outra = assinar('123', 'req-1');
    expect(await parse(notificacao('999', { signature: outra }))).toBeNull();
  });

  /**
   * As notificações de teste do painel do Mercado Pago costumam vir sem `x-request-id`, e a
   * documentação manda REMOVER do manifesto o campo ausente — não mandá-lo vazio. É o primeiro
   * caminho que qualquer pessoa exercita, e o mais fácil de implementar errado.
   */
  it('aceita notificação sem x-request-id, com o campo fora do manifesto', async () => {
    apiDevolve({ id: 55, status: 'approved', external_reference: 'ord_9' });
    const evento = await parse(
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
    const evento = await parse(notificacao('7'));
    expect(evento!.status).toBe('failed');
  });

  it('sem resposta da API, não há evento — e portanto não há acesso', async () => {
    apiDevolve(null, false);
    expect(await parse(notificacao('7'))).toBeNull();
  });

  it('pagamento sem external_reference é descartado', async () => {
    // Sem ele não há como saber QUAL pedido foi pago; conceder no palpite seria pior que ignorar.
    apiDevolve({ id: 7, status: 'approved', external_reference: null });
    expect(await parse(notificacao('7'))).toBeNull();
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
      const evento = await parse(notificacao('1'));
      expect(evento!.status).toBe(nosso);
    });
  }

  /**
   * O teste que mais importa da lista: um estado que o gateway inventar amanhã não pode virar
   * `paid` por omissão. Conceder sem receber é o erro caro; ficar pendente é recuperável.
   */
  it('estado desconhecido não concede acesso', async () => {
    apiDevolve({ id: 1, status: 'estado_que_nao_existe_ainda', external_reference: 'ord_1' });
    expect(await parse(notificacao('1'))).toBeNull();

    apiDevolve({ id: 1, status: 'outra_coisa', external_reference: 'ord_1' });
    expect(await mercadoPagoProvider.getPaymentStatus('1')).toBe('pending');
  });
});

describe('idempotência', () => {
  it('o mesmo pagamento no mesmo estado gera sempre o mesmo id de evento', async () => {
    apiDevolve({ id: 42, status: 'approved', external_reference: 'ord_1' });
    const a = await parse(notificacao('42'));
    const b = await parse(
      notificacao('42', { requestId: 'req-DIFERENTE', signature: assinar('42', 'req-DIFERENTE') }),
    );
    // Reenvio com outro request-id é o MESMO fato — não pode conceder duas vezes.
    expect(a!.providerEventId).toBe(b!.providerEventId);
  });

  it('a transição de pendente para aprovado é um evento novo', async () => {
    apiDevolve({ id: 42, status: 'pending', external_reference: 'ord_1' });
    const pendente = await parse(notificacao('42'));
    apiDevolve({ id: 42, status: 'approved', external_reference: 'ord_1' });
    const aprovado = await parse(notificacao('42'));

    expect(pendente!.providerEventId).not.toBe(aprovado!.providerEventId);
  });
});

describe('notificações que não são de pagamento', () => {
  it('merchant_order é ignorada sem erro', async () => {
    apiDevolve({ id: 1, status: 'approved', external_reference: 'ord_1' });
    expect(
      await parse(notificacao('1', { type: 'merchant_order' })),
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
      failureUrl: 'https://exemplo.com/planos/x',
        notificationUrl: 'https://exemplo.com/api/webhooks/payment',
        payerEmail: 'comprador@exemplo.com',
        payerName: null,
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
      failureUrl: 'https://exemplo.com/planos/x',
      notificationUrl: 'https://exemplo.com/api/webhooks/payment',
      payerEmail: 'comprador@exemplo.com',
      payerName: null,
    });

    expect(sessao.redirectUrl).toBe('https://mp/checkout');

    const corpo = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as Record<string, any>;
    expect(corpo.external_reference, 'sem isto o webhook não acha o pedido').toBe('ord_abc');
    expect(corpo.items[0].unit_price, 'o Mercado Pago cobra em unidades, não centavos').toBe(49.99);
    expect(corpo.notification_url).toContain('/api/webhooks/payment');
  });

  /**
   * O comprador paga sem criar conta.
   *
   * O que garante isso é a AUSÊNCIA de `purpose` no corpo da preferência. Com
   * `purpose: 'wallet_purchase'`, o Mercado Pago exige login antes de pagar — e uma tela de
   * cadastro entre a vontade e o pagamento, num produto de R$ 19,99 comprado por impulso, é o
   * atrito mais caro que existe.
   *
   * O teste existe porque o defeito seria mudo: a linha extra não quebra nada, não gera erro, e o
   * sintoma é uma conversão menor que ninguém liga à causa meses depois.
   */
  it('não exige login do comprador', async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify({ id: 'pref_3', init_point: 'https://mp/c' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await mercadoPagoProvider.createCheckout({
      orderId: 'ord_1',
      sku: 'racket_report',
      productName: 'Relatório',
      amountCents: 1999,
      currency: 'BRL',
      returnUrl: 'https://exemplo.com/resultado/x',
      failureUrl: 'https://exemplo.com/planos/x',
      notificationUrl: 'https://exemplo.com/api/webhooks/payment',
      payerEmail: 'comprador@exemplo.com',
      payerName: null,
    });

    const corpo = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as Record<string, unknown>;
    expect(
      corpo,
      'purpose: wallet_purchase obrigaria o comprador a fazer login antes de pagar',
    ).not.toHaveProperty('purpose');
  });

  /**
   * ═══ O PAGADOR VAI IDENTIFICADO ═════════════════════════════════════════════════════════════
   *
   * O caso que trouxe isto foi um teste real do dono: comprou o relatório, o pagamento passou, e
   * minutos depois a compra do upgrade foi RECUSADA com o mesmo cartão.
   *
   *   "será que pode ser por passar num mesmo site dois pagamentos seguidos? talvez isso seja um
   *    problema para quem for fazer o upgrade"
   *
   * O e-mail já era exigido e validado no checkout — criava a conta, mandava o link, alimentava
   * /minhas-analises — e parava ali. À preferência não ia pagador nenhum: as duas compras chegavam
   * ao antifraude como dois desconhecidos. Duas transações do mesmo cartão em poucos minutos, sem
   * nada que as ligue à mesma pessoa, é o desenho de uma regra de velocidade.
   *
   * Não dá para provar daqui qual regra recusou aquele pagamento — isso está no painel do gateway,
   * no `status_detail`. O que dá para garantir é que o dado que existia deixe de ser jogado fora,
   * e é isso que este teste tranca. O upgrade é o fluxo em que a segunda compra é a REGRA, não a
   * exceção, então o custo de mandar o comprador anônimo cai justamente sobre ele.
   */
  it('identifica o pagador com o e-mail do checkout', async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify({ id: 'pref_4', init_point: 'https://mp/c' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await mercadoPagoProvider.createCheckout({
      orderId: 'ord_1',
      sku: 'unlock_rank_3',
      productName: 'Desbloquear a 3ª colocada',
      amountCents: 899,
      currency: 'BRL',
      returnUrl: 'https://exemplo.com/retorno/x',
      failureUrl: 'https://exemplo.com/planos/x',
      notificationUrl: 'https://exemplo.com/api/webhooks/payment',
      payerEmail: 'comprador@exemplo.com',
      payerName: 'Gabriel Mattedi',
    });

    const corpo = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as Record<string, any>;
    expect(corpo.payer, 'a compra voltou a chegar ao gateway sem pagador').toBeDefined();
    expect(corpo.payer.email).toBe('comprador@exemplo.com');
    expect(corpo.payer.name).toBe('Gabriel');
    expect(corpo.payer.surname, 'o sobrenome foi para o campo errado').toBe('Mattedi');
  });

  /** Só o primeiro nome informado não vira sobrenome inventado. */
  it('não inventa sobrenome de quem digitou um nome só', async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify({ id: 'pref_7', init_point: 'https://mp/c' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await mercadoPagoProvider.createCheckout({
      orderId: 'ord_1',
      sku: 'racket_report',
      productName: 'Relatório',
      amountCents: 2999,
      currency: 'BRL',
      returnUrl: 'https://exemplo.com/retorno/x',
      failureUrl: 'https://exemplo.com/planos/x',
      notificationUrl: 'https://exemplo.com/api/webhooks/payment',
      payerEmail: 'comprador@exemplo.com',
      payerName: 'Ana',
    });

    const corpo = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as Record<string, any>;
    expect(corpo.payer.name).toBe('Ana');
    expect(corpo.payer, 'sobrenome inventado é dado falso num campo de identidade').not.toHaveProperty('surname');
  });

  /** Campo vazio conta como dado ruim para a análise de risco — melhor não mandar o campo. */
  it('não inventa nome quando o jogador não informou', async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify({ id: 'pref_5', init_point: 'https://mp/c' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await mercadoPagoProvider.createCheckout({
      orderId: 'ord_1',
      sku: 'racket_report',
      productName: 'Relatório',
      amountCents: 2999,
      currency: 'BRL',
      returnUrl: 'https://exemplo.com/retorno/x',
      failureUrl: 'https://exemplo.com/planos/x',
      notificationUrl: 'https://exemplo.com/api/webhooks/payment',
      payerEmail: 'comprador@exemplo.com',
      payerName: null,
    });

    const corpo = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as Record<string, any>;
    expect(corpo.payer.email).toBe('comprador@exemplo.com');
    expect(corpo.payer, 'nome vazio é pior que nome ausente').not.toHaveProperty('name');
  });

  /**
   * Descrição e categoria também pesam na análise de risco — o gateway documenta a qualidade dos
   * dados enviados como fator de aprovação. `services` porque o que se vende é uma análise;
   * declarar produto físico pediria endereço de entrega que não existe.
   */
  it('descreve e categoriza o item', async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify({ id: 'pref_6', init_point: 'https://mp/c' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await mercadoPagoProvider.createCheckout({
      orderId: 'ord_1',
      sku: 'racket_report',
      productName: 'Relatório da raquete',
      amountCents: 2999,
      currency: 'BRL',
      returnUrl: 'https://exemplo.com/retorno/x',
      failureUrl: 'https://exemplo.com/planos/x',
      notificationUrl: 'https://exemplo.com/api/webhooks/payment',
      payerEmail: 'comprador@exemplo.com',
      payerName: null,
    });

    const corpo = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as Record<string, any>;
    expect(corpo.items[0].description).toBe('Relatório da raquete');
    expect(corpo.items[0].category_id).toBe('services');
  });

  /**
   * ═══ SÓ MEIOS DE APROVAÇÃO IMEDIATA ══════════════════════════════════════════════════════════
   *
   * Decisão do dono: "quero opção só de pix e cartão de débito e crédito (...) porque quero apenas
   * aprovação na hora."
   *
   * A razão é o produto. O relatório já está pronto esperando do outro lado, e o valor inteiro está
   * em vê-lo agora. Boleto compensa em um a três dias ÚTEIS: quem paga na sexta à noite fica sem o
   * que comprou até a quarta — tempo suficiente para esquecer o site, pedir estorno ou escrever
   * perguntando o que aconteceu.
   *
   * ─── O ERRO QUE ESTE TESTE EXISTE PARA IMPEDIR ─────────────────────────────────────────────
   *
   * No Brasil o PIX é do tipo `bank_transfer`. Quem lê a lista de tipos procurando o que excluir vê
   * "bank_transfer" e pensa em transferência bancária — e excluí-lo mata justamente o meio mais
   * rápido que existe aqui, que é o oposto do que se queria.
   *
   * O sintoma seria mudo: o checkout continua abrindo, continua aceitando cartão, e ninguém liga a
   * queda de conversão à linha que desligou o PIX. Por isso o teste afirma as duas coisas — o que
   * sai E o que tem de continuar entrando.
   */
  describe('meios de pagamento', () => {
    async function corpoDaPreferencia() {
      const fetchMock = vi.fn(
        async (_url: string, _init?: RequestInit) =>
          new Response(JSON.stringify({ id: 'pref_8', init_point: 'https://mp/c' }), {
            status: 200,
          }),
      );
      vi.stubGlobal('fetch', fetchMock);

      await mercadoPagoProvider.createCheckout({
        orderId: 'ord_1',
        sku: 'racket_report',
        productName: 'Relatório',
        amountCents: 2999,
        currency: 'BRL',
        returnUrl: 'https://exemplo.com/retorno/x',
        failureUrl: 'https://exemplo.com/planos/x',
        notificationUrl: 'https://exemplo.com/api/webhooks/payment',
        payerEmail: 'comprador@exemplo.com',
        payerName: null,
      });

      return JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as Record<string, any>;
    }

    it('exclui boleto e depósito, que compensam em dias', async () => {
      const excluidos = (await corpoDaPreferencia()).payment_methods.excluded_payment_types.map(
        (t: { id: string }) => t.id,
      );
      expect(excluidos, 'o boleto voltou ao checkout').toContain('ticket');
      expect(excluidos, 'o depósito em caixa voltou ao checkout').toContain('atm');
    });

    it('NÃO exclui o PIX, que no Brasil é bank_transfer', async () => {
      const excluidos = (await corpoDaPreferencia()).payment_methods.excluded_payment_types.map(
        (t: { id: string }) => t.id,
      );
      expect(
        excluidos,
        'bank_transfer foi excluído — no Brasil isso desliga o PIX, o meio mais rápido que existe',
      ).not.toContain('bank_transfer');
    });

    it('mantém crédito e débito', async () => {
      const excluidos = (await corpoDaPreferencia()).payment_methods.excluded_payment_types.map(
        (t: { id: string }) => t.id,
      );
      expect(excluidos).not.toContain('credit_card');
      expect(excluidos).not.toContain('debit_card');
    });

    /** Saldo da conta é aprovação instantânea — atende ao critério e é um toque para quem tem. */
    it('mantém o saldo da conta, que também é imediato', async () => {
      const excluidos = (await corpoDaPreferencia()).payment_methods.excluded_payment_types.map(
        (t: { id: string }) => t.id,
      );
      expect(excluidos).not.toContain('account_money');
    });
  });

  it('usa o sandbox_init_point quando é a única URL devolvida', async () => {
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
      failureUrl: 'https://exemplo.com/planos/x',
      notificationUrl: 'https://exemplo.com/api/webhooks/payment',
      payerEmail: 'comprador@exemplo.com',
      payerName: null,
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
      failureUrl: 'https://exemplo.com/planos/x',
        notificationUrl: 'https://exemplo.com/api/webhooks/payment',
        payerEmail: 'comprador@exemplo.com',
        payerName: null,
      }),
    ).rejects.toThrow(/401/);
  });
});

/**
 * Ignorar não é falhar — e a diferença custou uma investigação inteira.
 *
 * ═══ O CASO REAL (ago/2026) ══════════════════════════════════════════════════════════════════
 *
 * O Mercado Pago manda uma notificação de `merchant_order` junto de CADA pagamento. Nós
 * descartávamos, corretamente — mas respondendo `400`. Para o gateway, resposta fora da faixa 2xx
 * significa "falhei, tente de novo": ele reenfileira, reenvia, marca a entrega como falha e, se
 * persistir, desativa a notificação.
 *
 * O painel mostrava `0% de notificações entregues` e `400 - Com erro` em tudo, com o webhook
 * funcionando. E a leitura óbvia de `400` é "minha assinatura está errada" — a investigação foi
 * inteira por esse caminho, por causa de um código de status mal escolhido.
 *
 * Estes testes trancam a distinção nos dois sentidos, porque errar para o outro lado é pior:
 * responder 200 a uma assinatura forjada diria a quem tentou que está tudo bem.
 */
describe('o que é ignorado e o que é recusado', () => {
  function comTopico(topic: string, body: unknown): Request {
    return new Request(`https://exemplo.com/api/webhooks/payment?id=1&topic=${topic}`, {
      method: 'POST',
      headers: { 'x-signature': assinar('1', 'req-1'), 'x-request-id': 'req-1' },
      body: JSON.stringify(body),
    });
  }

  it('merchant_order é IGNORADA, não recusada', async () => {
    // Era este o caso que devolvia 400 e fazia o Mercado Pago reenviar para sempre.
    const r = await mercadoPagoProvider.parseWebhook(
      comTopico('merchant_order', { resource: 'https://api.mercadopago.com/merchant_orders/1' }),
    );
    expect(r.kind, 'merchant_order não pode responder erro ao gateway').toBe('ignored');
  });

  it('notificação de outro tipo também é ignorada', async () => {
    const r = await mercadoPagoProvider.parseWebhook(
      comTopico('payment', { type: 'fraud_alert', data: { id: '1' } }),
    );
    expect(r.kind).toBe('ignored');
  });

  /**
   * O outro lado da moeda, e o mais importante dos dois: assinatura ruim continua sendo FALHA.
   *
   * Se ela saísse como "ignorada", responderíamos 200 a uma tentativa de fraude — confirmando a
   * quem tentou que o caminho está aberto e apagando o rastro no painel do gateway.
   */
  it('assinatura inválida continua sendo recusa, não algo a ignorar', async () => {
    apiDevolve({ id: 1, status: 'approved', external_reference: 'ord_1' });
    const r = await mercadoPagoProvider.parseWebhook(notificacao('1', { signature: 'ts=1,v1=abc' }));
    expect(r.kind).toBe('invalid');
  });

  it('estado desconhecido é ignorado — o gateway não tem o que reenviar', async () => {
    // Reenviar não muda um estado que não sabemos traduzir; pedir reenvio seria loop sem saída.
    apiDevolve({ id: 1, status: 'estado_novo_do_mercado_pago', external_reference: 'ord_1' });
    const r = await mercadoPagoProvider.parseWebhook(notificacao('1'));
    expect(r.kind).toBe('ignored');
  });

  /**
   * Falha ao CONSULTAR a API é recusa, e não "ignorar" — porque aí o reenvio é justamente o que
   * queremos. Uma indisponibilidade momentânea da API do gateway não pode consumir o pagamento em
   * silêncio: o cliente pagou, e a próxima tentativa é a chance de liberar o acesso dele.
   */
  it('API indisponível pede reenvio em vez de descartar o pagamento', async () => {
    apiDevolve(null, false);
    const r = await mercadoPagoProvider.parseWebhook(notificacao('1'));
    expect(r.kind).toBe('invalid');
  });
});
