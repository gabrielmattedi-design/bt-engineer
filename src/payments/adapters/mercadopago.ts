import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  CheckoutSession,
  CreateCheckoutInput,
  PaymentEvent,
  PaymentProvider,
  PaymentStatus,
} from '../provider';

/**
 * Adapter do Mercado Pago — Checkout Pro.
 *
 * ═══ POR QUE CHECKOUT PRO, E NÃO CAMPOS DE CARTÃO NO SITE ════════════════════════════════════
 *
 * No Checkout Pro o cliente sai daqui, paga numa tela do Mercado Pago e volta. Nenhum dado de
 * cartão passa por este servidor, o que tira o produto inteiro do escopo de PCI-DSS — a diferença
 * entre uma integração que uma pessoa mantém e um projeto de conformidade.
 *
 * Ele também entrega PIX, cartão e boleto na mesma tela sem nenhum código a mais, e é a tela que o
 * comprador brasileiro reconhece. Para um produto de R$ 19,99 a R$ 49,99, reconhecimento na hora
 * de pagar vale mais do que qualquer customização de checkout.
 *
 * ═══ AS TRÊS COISAS QUE ESTE ARQUIVO PRECISA ACERTAR ═════════════════════════════════════════
 *
 * 1. O `external_reference` carrega o NOSSO `orderId`. É por ele que o webhook reencontra o
 *    pedido — o id do pagamento é do Mercado Pago e não significa nada do lado de cá.
 *
 * 2. A notificação NÃO traz o status. Ela traz só o id do pagamento, e é obrigatório ir buscar o
 *    estado na API. Confiar no corpo da notificação seria confiar em quem a enviou.
 *
 * 3. A assinatura é validada antes de qualquer coisa. Sem isso, quem descobrisse a URL do webhook
 *    concederia acesso a si mesmo com um `curl` — que é exatamente o buraco que o adapter fake já
 *    fecha, e seria absurdo fechar no simulado e deixar aberto no que movimenta dinheiro.
 */

const API = 'https://api.mercadopago.com';

/**
 * As duas credenciais, lidas em CHAMADA e não no topo do módulo.
 *
 * Lidas no topo, elas congelam no build. O deploy que roda `next build` sem as variáveis
 * publicaria um adapter permanentemente quebrado, e o sintoma apareceria só no primeiro pagamento
 * — depois do anúncio, com o cliente na tela.
 */
function accessToken(): string {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      'MERCADOPAGO_ACCESS_TOKEN não configurado. Pegue o Access Token em Suas integrações → sua ' +
        'aplicação → Credenciais, e defina a variável na hospedagem.',
    );
  }
  return token;
}

function webhookSecret(): string {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      'MERCADOPAGO_WEBHOOK_SECRET não configurado. Ele aparece em Suas integrações → sua ' +
        'aplicação → Webhooks → Configurar notificação, junto com a URL que você cadastrar.',
    );
  }
  return secret;
}

/**
 * Estados do Mercado Pago traduzidos para os nossos.
 *
 * A lista é EXPLÍCITA e sem `default` permissivo de propósito: um estado novo do gateway não pode
 * virar `paid` por omissão. Se aparecer algo fora desta tabela, o pagamento fica pendente e o
 * acesso não é concedido — o erro caro é conceder sem receber, não o contrário.
 *
 * `in_process` e `authorized` são pendentes de verdade: o dinheiro ainda não é seu. `authorized`
 * é cartão com valor reservado e não capturado; `in_process` é análise antifraude.
 */
const STATUS: Readonly<Record<string, PaymentStatus>> = {
  approved: 'paid',
  pending: 'pending',
  in_process: 'pending',
  authorized: 'pending',
  in_mediation: 'pending',
  rejected: 'failed',
  cancelled: 'cancelled',
  refunded: 'refunded',
  charged_back: 'refunded',
};

type MercadoPagoPayment = {
  readonly id: number | string;
  readonly status: string;
  readonly external_reference?: string | null;
  readonly payment_method_id?: string | null;
};

async function fetchPayment(paymentId: string): Promise<MercadoPagoPayment | null> {
  const response = await fetch(`${API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken()}` },
    cache: 'no-store',
  });
  if (!response.ok) return null;
  return (await response.json()) as MercadoPagoPayment;
}

/**
 * Valida a assinatura `x-signature`.
 *
 * O cabeçalho chega como `ts=1742505638683,v1=<hex>`, e o que é assinado não é o corpo: é um
 * manifesto montado a partir do id do pagamento, do `x-request-id` e do timestamp, no formato
 * `id:<id>;request-id:<req>;ts:<ts>;`.
 *
 * Isso surpreende quem vem de outros gateways — em quase todos assina-se o corpo cru. Assinar o
 * corpo aqui produz uma comparação que nunca bate, e o sintoma é um webhook que rejeita 100% das
 * notificações legítimas silenciosamente.
 */
function assinaturaConfere(
  signature: string | null,
  requestId: string | null,
  dataId: string,
): boolean {
  if (!signature) return false;

  let ts: string | null = null;
  let v1: string | null = null;
  for (const parte of signature.split(',')) {
    const [chave, valor] = parte.split('=', 2);
    if (!chave || !valor) continue;
    if (chave.trim() === 'ts') ts = valor.trim();
    if (chave.trim() === 'v1') v1 = valor.trim();
  }
  if (!ts || !v1) return false;

  /*
    Os campos ausentes SAEM do manifesto — não entram vazios.

    A documentação é explícita nisso, e é a diferença entre `request-id:;` e a ausência da chave.
    Notificações de teste do painel costumam vir sem `x-request-id`, então o caminho sem ele é o
    primeiro que qualquer pessoa exercita.
  */
  const manifesto =
    `id:${dataId};` + (requestId ? `request-id:${requestId};` : '') + `ts:${ts};`;

  const esperado = createHmac('sha256', webhookSecret()).update(manifesto).digest('hex');

  // Comparação em tempo constante: comparar hash com `===` vaza o prefixo correto pelo tempo.
  const a = Buffer.from(esperado);
  const b = Buffer.from(v1);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const mercadoPagoProvider: PaymentProvider = {
  id: 'mercadopago',

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    const response = await fetch(`${API}/checkout/preferences`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [
          {
            id: input.sku,
            title: input.productName,
            quantity: 1,
            currency_id: input.currency,
            // O Mercado Pago trabalha em unidades, não em centavos.
            unit_price: input.amountCents / 100,
          },
        ],
        /*
          A ponte entre os dois sistemas.

          O webhook devolve o id do PAGAMENTO, que não existe do nosso lado. Sem o
          `external_reference`, não haveria como saber qual pedido foi pago.
        */
        external_reference: input.orderId,
        back_urls: {
          success: input.returnUrl,
          pending: input.returnUrl,
          failure: input.returnUrl,
        },
        /*
          Volta sozinho só quando aprovado.

          Em PIX e boleto o pagamento fica pendente por minutos ou dias, e devolver a pessoa ao
          relatório nesse estado a faria ver a tela de "ainda não liberado" achando que pagou por
          nada. Nesses casos ela fica na tela do Mercado Pago, que explica o que falta.
        */
        auto_return: 'approved',
        notification_url: input.notificationUrl,
        statement_descriptor: 'TENNISENGINEER',
      }),
    });

    if (!response.ok) {
      const detalhe = await response.text();
      throw new Error(
        `O Mercado Pago recusou a criação do checkout (HTTP ${response.status}). ${detalhe.slice(0, 300)}`,
      );
    }

    const pref = (await response.json()) as {
      id: string;
      init_point?: string;
      sandbox_init_point?: string;
    };

    /*
      Credencial de TESTE devolve `sandbox_init_point`; a de produção, `init_point`.

      Escolher pelo que veio, e não por uma variável separada de ambiente, elimina a combinação
      que dói: credencial de teste com URL de produção manda o cliente para uma tela que recusa o
      pagamento dele sem explicar por quê.
    */
    const redirectUrl = pref.init_point ?? pref.sandbox_init_point;
    if (!redirectUrl) {
      throw new Error('O Mercado Pago não devolveu a URL de checkout na preferência criada.');
    }

    return { providerPaymentId: pref.id, redirectUrl };
  },

  async parseWebhook(request: Request): Promise<PaymentEvent | null> {
    const body = await request.text();

    let payload: { type?: string; action?: string; data?: { id?: string | number } };
    try {
      payload = JSON.parse(body) as typeof payload;
    } catch {
      return null;
    }

    // Só notificação de pagamento interessa. As de merchant_order chegam junto e são ruído aqui.
    const tipo = payload.type ?? payload.action?.split('.')[0];
    if (tipo !== 'payment') return null;

    const dataId = payload.data?.id;
    if (dataId === undefined || dataId === null) return null;

    if (
      !assinaturaConfere(
        request.headers.get('x-signature'),
        request.headers.get('x-request-id'),
        String(dataId),
      )
    ) {
      return null;
    }

    /*
      O ESTADO VEM DA API, NUNCA DO CORPO DA NOTIFICAÇÃO.

      A notificação diz apenas "o pagamento X mudou". Quem tem autoridade sobre o estado é a API,
      e buscar lá fecha a janela em que um payload forjado — ainda que assinado por engano —
      pudesse declarar `approved`.
    */
    const payment = await fetchPayment(String(dataId));
    if (!payment) return null;

    const orderId = payment.external_reference;
    if (!orderId) return null;

    const status = STATUS[payment.status];
    if (!status) return null;

    return {
      /*
        Idempotência por PAGAMENTO + ESTADO, não por notificação.

        O Mercado Pago reenvia a mesma notificação quando não recebe 200, e manda várias ao longo
        da vida de um pagamento (pendente → aprovado). Usar o id da notificação deixaria os
        reenvios passarem como eventos novos; usar só o id do pagamento bloquearia a transição
        legítima de pendente para aprovado. O par resolve os dois.
      */
      providerEventId: `mp:${payment.id}:${payment.status}`,
      eventType: payload.action ?? `payment.${payment.status}`,
      providerPaymentId: String(payment.id),
      orderId,
      status,
      method: payment.payment_method_id ?? null,
      raw: payment,
    };
  },

  async getPaymentStatus(providerPaymentId: string): Promise<PaymentStatus> {
    const payment = await fetchPayment(providerPaymentId);
    // Sem resposta da API, o honesto é "ainda não sei" — e pendente não concede nada.
    if (!payment) return 'pending';
    return STATUS[payment.status] ?? 'pending';
  },
};
