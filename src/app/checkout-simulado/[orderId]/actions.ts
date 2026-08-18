'use server';

import { headers } from 'next/headers';
import { randomUUID } from 'node:crypto';
import { signFakePayload } from '@/payments/adapters/fake';
import { checkoutOpen, INVITE_ONLY_MESSAGE } from '@/payments/mode';

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
  // A página some no modo convite, mas o Server Action é endereçável por conta própria.
  if (!(await checkoutOpen())) {
    return { error: INVITE_ONLY_MESSAGE };
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
  // Em produção o host só atende HTTPS — chamar http:// aqui derrubava o webhook simulado.
  const scheme = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  const response = await fetch(`${scheme}://${host}/api/webhooks/payment`, {
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
