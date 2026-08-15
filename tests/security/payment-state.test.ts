/**
 * Máquina de estados de pagamento e assinatura de webhook — §33, docs/MONETIZATION.md §5.
 *
 * A idempotência real é garantida pelo índice único do Postgres e está coberta pelo E2E contra
 * banco. Aqui ficam as invariantes que dão para provar sem banco — e que, se quebrarem, quebram
 * silenciosamente.
 */

import { describe, expect, it } from 'vitest';
import { canTransition, type PaymentStatus } from '@/payments/provider';
import { fakeProvider, signFakePayload } from '@/payments/adapters/fake';

describe('máquina de estados do pagamento', () => {
  it('permite o caminho feliz', () => {
    expect(canTransition('pending', 'paid')).toBe(true);
    expect(canTransition('paid', 'refunded')).toBe(true);
  });

  it('NÃO deixa um pedido pago regredir', () => {
    // Gateways reenviam eventos fora de ordem. Um `pending` atrasado chegando depois do `paid`
    // revogaria na prática o acesso de alguém que já pagou.
    expect(canTransition('paid', 'pending')).toBe(false);
    expect(canTransition('paid', 'failed')).toBe(false);
    expect(canTransition('paid', 'cancelled')).toBe(false);
  });

  it('reembolsado e cancelado são terminais', () => {
    const finals: PaymentStatus[] = ['refunded', 'cancelled'];
    for (const from of finals) {
      for (const to of ['pending', 'paid', 'failed'] as PaymentStatus[]) {
        expect(canTransition(from, to), `${from} → ${to}`).toBe(false);
      }
    }
  });

  it('reentrega do mesmo status é sempre aceita', () => {
    const all: PaymentStatus[] = ['pending', 'paid', 'failed', 'refunded', 'cancelled'];
    for (const s of all) expect(canTransition(s, s), `${s} → ${s}`).toBe(true);
  });
});

describe('webhook rejeita quem não é o gateway', () => {
  const body = JSON.stringify({ event_id: 'evt_1', order_id: 'ord_1', status: 'paid' });

  function request(signature: string): Request {
    return new Request('http://localhost/api/webhooks/payment', {
      method: 'POST',
      headers: { 'x-fake-signature': signature },
      body,
    });
  }

  it('aceita payload com assinatura válida', async () => {
    const event = await fakeProvider.parseWebhook(request(signFakePayload(body)));
    expect(event?.status).toBe('paid');
    expect(event?.orderId).toBe('ord_1');
  });

  it('REJEITA assinatura forjada', async () => {
    expect(await fakeProvider.parseWebhook(request('forjada'))).toBeNull();
  });

  it('REJEITA assinatura ausente', async () => {
    expect(await fakeProvider.parseWebhook(request(''))).toBeNull();
  });

  it('REJEITA payload adulterado depois de assinado', async () => {
    // Assinatura legítima de OUTRO corpo: é o ataque de trocar o valor mantendo a assinatura.
    const outro = JSON.stringify({ event_id: 'evt_1', order_id: 'ord_1', status: 'pending' });
    expect(await fakeProvider.parseWebhook(request(signFakePayload(outro)))).toBeNull();
  });
});

describe('o provedor simulado não pode rodar em produção', () => {
  it('lança ao criar checkout com NODE_ENV=production', async () => {
    const original = process.env.NODE_ENV;
    try {
      // @ts-expect-error — sobrescrita apenas para o teste
      process.env.NODE_ENV = 'production';
      await expect(
        fakeProvider.createCheckout({
          orderId: 'ord_1',
          sku: 'racket_report',
          productName: 'x',
          amountCents: 1999,
          currency: 'BRL',
          returnUrl: 'https://exemplo.com',
        }),
      ).rejects.toThrow(/produção/);
    } finally {
      // @ts-expect-error — restauração
      process.env.NODE_ENV = original;
    }
  });
});
