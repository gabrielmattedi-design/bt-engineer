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
import { inSimulatedPaymentMode, simulatedPaymentsAllowedByEnv } from '@/payments/mode';

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

/**
 * O provedor simulado concede acesso sem cobrar. Ele só pode rodar em produção por decisão
 * EXPLÍCITA — e, quando roda, o visitante precisa ser avisado. As duas metades são testadas aqui,
 * porque cada uma sozinha é uma armadilha: bloquear sempre trava o dono fora do próprio funil
 * antes de existir gateway; liberar sem aviso transforma o site numa loja que exibe preços e não
 * cobra nada, sem que ninguém perceba.
 */
describe('o provedor simulado em produção', () => {
  async function checkout() {
    return fakeProvider.createCheckout({
      orderId: 'ord_1',
      sku: 'racket_report',
      productName: 'x',
      amountCents: 1999,
      currency: 'BRL',
      returnUrl: 'https://exemplo.com',
      failureUrl: 'https://exemplo.com/planos/x',
      notificationUrl: 'https://exemplo.com/api/webhooks/payment',
    });
  }

  function withEnv(
    env: { NODE_ENV?: string; ALLOW_FAKE_PAYMENTS?: string; PAYMENT_PROVIDER?: string },
    run: () => Promise<void> | void,
  ) {
    const previous = {
      NODE_ENV: process.env.NODE_ENV,
      ALLOW_FAKE_PAYMENTS: process.env.ALLOW_FAKE_PAYMENTS,
      PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER,
    };
    Object.assign(process.env, env);
    return Promise.resolve(run()).finally(() => {
      Object.assign(process.env, previous);
      for (const key of ['ALLOW_FAKE_PAYMENTS', 'PAYMENT_PROVIDER'] as const) {
        if (previous[key] === undefined) delete process.env[key];
      }
    });
  }

  it('recusa por padrão quando NODE_ENV=production', async () => {
    await withEnv({ NODE_ENV: 'production' }, async () => {
      await expect(checkout()).rejects.toThrow(/produção/);
    });
  });

  it('a mensagem de recusa diz como liberar o modo demonstração', async () => {
    await withEnv({ NODE_ENV: 'production' }, async () => {
      await expect(checkout()).rejects.toThrow(/ALLOW_FAKE_PAYMENTS/);
    });
  });

  it('roda quando ALLOW_FAKE_PAYMENTS=true', async () => {
    await withEnv({ NODE_ENV: 'production', ALLOW_FAKE_PAYMENTS: 'true' }, async () => {
      await expect(checkout()).resolves.toMatchObject({ providerPaymentId: 'fake_ord_1' });
    });
  });

  it('qualquer valor diferente de "true" continua bloqueando', async () => {
    await withEnv({ NODE_ENV: 'production', ALLOW_FAKE_PAYMENTS: '1' }, async () => {
      await expect(checkout()).rejects.toThrow(/produção/);
    });
  });

  it('o aviso ao visitante só liga junto com o modo simulado', async () => {
    await withEnv({ NODE_ENV: 'production' }, async () => {
      expect(await inSimulatedPaymentMode()).toBe(false);
    });
    await withEnv({ NODE_ENV: 'production', ALLOW_FAKE_PAYMENTS: 'true' }, async () => {
      expect(await inSimulatedPaymentMode()).toBe(true);
    });
  });

  /**
   * O interruptor do painel é a SEGUNDA chave da mesma fechadura, e a decisão sobre o ambiente
   * continua valendo antes dela: fora de produção o simulado já roda, e um gateway real não pode
   * ser substituído pelo simulado por nenhum caminho.
   */
  it('um gateway real não pode ser substituído pelo simulado', async () => {
    await withEnv(
      { NODE_ENV: 'production', ALLOW_FAKE_PAYMENTS: 'true', PAYMENT_PROVIDER: 'mercadopago' },
      async () => {
        expect(await inSimulatedPaymentMode()).toBe(false);
      },
    );
  });

  it('fora de produção o ambiente decide sozinho, sem consultar o banco', () => {
    expect(simulatedPaymentsAllowedByEnv()).toBe(true);
  });
});
