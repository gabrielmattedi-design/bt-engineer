'use server';

import { headers } from 'next/headers';
import { randomUUID } from 'node:crypto';
import { signFakePayload } from '@/payments/adapters/fake';

/**
 * Dispara um evento de pagamento assinado contra o próprio webhook.
 *
 * Faz uma requisição HTTP de verdade em vez de chamar `processPaymentEvent` diretamente: assim o
 * teste cobre a rota, a validação de assinatura e a desserialização — que é onde os bugs de webhook
 * de fato moram.
 */
export async function simulatePayment(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: true; body: string } | { error: string }> {
  if (process.env.NODE_ENV === 'production') {
    return { error: 'Indisponível em produção.' };
  }

  const orderId = String(formData.get('order_id') ?? '');
  const status = String(formData.get('status') ?? 'paid');
  // `event_id` novo a cada disparo: reenviar o MESMO id é justamente o que testa a idempotência.
  const eventId = String(formData.get('event_id') || `evt_${randomUUID()}`);

  const body = JSON.stringify({
    event_id: eventId,
    order_id: orderId,
    status,
    method: 'pix',
  });

  const host = (await headers()).get('host') ?? 'localhost:3000';
  const response = await fetch(`http://${host}/api/webhooks/payment`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-fake-signature': signFakePayload(body),
    },
    body,
  });

  const text = await response.text();
  if (!response.ok) return { error: `webhook respondeu ${response.status}: ${text}` };
  return { ok: true, body: text };
}
