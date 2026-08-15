'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createOrder, attachPayment } from '@/database/repositories/commerce-repo';
import { ensureAnonymousSession } from '@/database/repositories/session-repo';
import { paymentProvider } from '@/payments/adapters';

/**
 * Inicia o checkout — §33.
 *
 * Cria o pedido em `pending` e delega o resto ao gateway. Nenhum entitlement é concedido aqui: o
 * acesso só nasce quando o webhook confirma o pagamento. Esta função pode ser chamada mil vezes e
 * não libera nada.
 */
export async function startCheckout(
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string } | void> {
  const publicId = String(formData.get('session_id') ?? '');
  const sku = String(formData.get('sku') ?? '');

  const jar = await cookies();
  const token = jar.get('te_visitor')?.value;
  if (!token) {
    return { error: 'Sessão expirada. Refaça o questionário para continuar.' };
  }

  const sessionId = await ensureAnonymousSession(token);
  const order = await createOrder({ sessionId, publicId, sku });
  if (!order) return { error: 'Produto ou análise não encontrados.' };

  const provider = paymentProvider();
  const host = (await headers()).get('host') ?? 'localhost:3000';
  const scheme = process.env.NODE_ENV === 'production' ? 'https' : 'http';

  const checkout = await provider.createCheckout({
    orderId: order.orderId,
    sku: order.product.sku,
    productName: order.product.name,
    amountCents: order.product.priceCents,
    currency: order.product.currency,
    returnUrl: `${scheme}://${host}/resultado/${publicId}`,
  });

  await attachPayment({
    orderId: order.orderId,
    provider: provider.id,
    providerPaymentId: checkout.providerPaymentId,
    amountCents: order.product.priceCents,
  });

  redirect(checkout.redirectUrl);
}
