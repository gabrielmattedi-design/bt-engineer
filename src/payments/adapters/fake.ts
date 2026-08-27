import { createHmac, timingSafeEqual } from 'node:crypto';
import { simulatedPaymentsAllowed, SIMULATED_PAYMENTS_BLOCKED } from '../mode';
import type {
  CheckoutSession,
  CreateCheckoutInput,
  PaymentProvider,
  PaymentStatus,
  WebhookOutcome,
} from '../provider';

/**
 * Adapter simulado — para desenvolvimento e testes E2E.
 *
 * Ele exercita o MESMO caminho de um gateway real: cria um pagamento, redireciona para uma tela de
 * checkout, e a confirmação só chega por webhook assinado. Isso importa — se o adapter de
 * desenvolvimento concedesse o acesso direto, o fluxo de produção seria o único nunca testado, e o
 * primeiro pagamento real seria o primeiro teste do webhook.
 *
 * ⚠️ Em produção só roda com `ALLOW_FAKE_PAYMENTS=true` — ver `src/payments/mode.ts` para o
 * desenho do interruptor. Sem ele, `assertAllowed()` lança e o webhook recusa eventos deste
 * provedor. Um adapter que concede acesso sem cobrar não pode ficar ligado por descuido.
 */

async function assertAllowed(): Promise<void> {
  if (!(await simulatedPaymentsAllowed())) throw new Error(SIMULATED_PAYMENTS_BLOCKED);
}

/** Segredo de assinatura do webhook simulado. Fixo, porque nada aqui protege dinheiro real. */
const FAKE_SECRET = 'fake-provider-webhook-secret';

export function signFakePayload(body: string): string {
  return createHmac('sha256', FAKE_SECRET).update(body).digest('hex');
}

export const fakeProvider: PaymentProvider = {
  id: 'fake',

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    await assertAllowed();
    const providerPaymentId = `fake_${input.orderId}`;
    return {
      providerPaymentId,
      // Tela local que imita o checkout do gateway, inclusive a espera do PIX.
      redirectUrl: `/checkout-simulado/${input.orderId}?retorno=${encodeURIComponent(input.returnUrl)}`,
    };
  },

  async parseWebhook(request: Request): Promise<WebhookOutcome> {
    await assertAllowed();

    const body = await request.text();
    const signature = request.headers.get('x-fake-signature') ?? '';

    // Mesma validação de assinatura de um gateway real: sem isto, qualquer pessoa que descobrisse a
    // URL do webhook concederia entitlements a si mesma com um curl.
    const expected = Buffer.from(signFakePayload(body));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      return { kind: 'invalid', reason: 'assinatura não confere' };
    }

    try {
      const parsed = JSON.parse(body) as {
        event_id?: string;
        order_id?: string;
        status?: PaymentStatus;
        method?: string;
      };
      if (!parsed.event_id || !parsed.order_id || !parsed.status) {
        return { kind: 'invalid', reason: 'campos obrigatórios ausentes' };
      }

      return {
        kind: 'event',
        event: {
          providerEventId: parsed.event_id,
          eventType: `payment.${parsed.status}`,
          providerPaymentId: `fake_${parsed.order_id}`,
          orderId: parsed.order_id,
          status: parsed.status,
          method: parsed.method ?? 'pix',
          raw: parsed,
        },
      };
    } catch {
      return { kind: 'invalid', reason: 'corpo não é JSON' };
    }
  },

  async getPaymentStatus(): Promise<PaymentStatus> {
    await assertAllowed();
    return 'pending';
  },
};
