import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  CheckoutSession,
  CreateCheckoutInput,
  PaymentEvent,
  PaymentProvider,
  PaymentStatus,
} from '../provider';

/**
 * Adapter simulado — para desenvolvimento e testes E2E.
 *
 * Ele exercita o MESMO caminho de um gateway real: cria um pagamento, redireciona para uma tela de
 * checkout, e a confirmação só chega por webhook assinado. Isso importa — se o adapter de
 * desenvolvimento concedesse o acesso direto, o fluxo de produção seria o único nunca testado, e o
 * primeiro pagamento real seria o primeiro teste do webhook.
 *
 * ⚠️ NUNCA em produção. `assertNotProduction()` lança, e o webhook recusa eventos deste provedor
 * quando `NODE_ENV=production`. Um adapter que concede acesso sem cobrar não pode depender de
 * alguém lembrar de trocar uma variável de ambiente no deploy.
 */

function assertNotProduction(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'O provedor de pagamento "fake" não pode ser usado em produção: ele concede acesso sem ' +
        'cobrar. Configure PAYMENT_PROVIDER com um gateway real.',
    );
  }
}

/** Segredo de assinatura do webhook simulado. Fixo, porque nada aqui protege dinheiro real. */
const FAKE_SECRET = 'fake-provider-webhook-secret';

export function signFakePayload(body: string): string {
  return createHmac('sha256', FAKE_SECRET).update(body).digest('hex');
}

export const fakeProvider: PaymentProvider = {
  id: 'fake',

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    assertNotProduction();
    const providerPaymentId = `fake_${input.orderId}`;
    return {
      providerPaymentId,
      // Tela local que imita o checkout do gateway, inclusive a espera do PIX.
      redirectUrl: `/checkout-simulado/${input.orderId}?retorno=${encodeURIComponent(input.returnUrl)}`,
    };
  },

  async parseWebhook(request: Request): Promise<PaymentEvent | null> {
    assertNotProduction();

    const body = await request.text();
    const signature = request.headers.get('x-fake-signature') ?? '';

    // Mesma validação de assinatura de um gateway real: sem isto, qualquer pessoa que descobrisse a
    // URL do webhook concederia entitlements a si mesma com um curl.
    const expected = Buffer.from(signFakePayload(body));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

    try {
      const parsed = JSON.parse(body) as {
        event_id?: string;
        order_id?: string;
        status?: PaymentStatus;
        method?: string;
      };
      if (!parsed.event_id || !parsed.order_id || !parsed.status) return null;

      return {
        providerEventId: parsed.event_id,
        eventType: `payment.${parsed.status}`,
        providerPaymentId: `fake_${parsed.order_id}`,
        orderId: parsed.order_id,
        status: parsed.status,
        method: parsed.method ?? 'pix',
        raw: parsed,
      };
    } catch {
      return null;
    }
  },

  async getPaymentStatus(): Promise<PaymentStatus> {
    assertNotProduction();
    return 'pending';
  },
};
