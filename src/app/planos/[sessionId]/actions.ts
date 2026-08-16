'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createOrder, attachPayment } from '@/database/repositories/commerce-repo';
import { ensureAnonymousSession } from '@/database/repositories/session-repo';
import { withAutoBootstrap } from '@/database/setup';
import { paymentProvider } from '@/payments/adapters';
import { describeCheckoutFailure } from '@/payments/checkout-errors';

/**
 * Inicia o checkout — §33.
 *
 * Cria o pedido em `pending` e delega o resto ao gateway. Nenhum entitlement é concedido aqui: o
 * acesso só nasce quando o webhook confirma o pagamento. Esta função pode ser chamada mil vezes e
 * não libera nada.
 *
 * ─── POR QUE TUDO É CAPTURADO ────────────────────────────────────────────────────────────────
 *
 * Um Server Action que lança devolve ao navegador "Application error: a server-side exception has
 * occurred" e um número de digest. Para quem está usando o site, isso é indistinguível de "quebrou
 * tudo" — e para quem MANTÉM o site, é indistinguível de qualquer outra falha: o digest só faz
 * sentido cruzado com o log da Vercel, que o dono não-técnico deste produto não vai abrir.
 *
 * Foi exatamente o que aconteceu aqui: o provedor simulado recusava rodar em produção, uma decisão
 * CORRETA e com mensagem clara escrita, e essa mensagem morria no servidor. A tela dizia apenas
 * "digest: 1191712468".
 *
 * Este handler já tinha um canal de erro legível — `{ error }`, renderizado pelo botão. O que
 * faltava era usá-lo para tudo. Agora toda falha esperada chega ao usuário como frase em
 * português, e o erro técnico continua indo para o log do servidor, onde ele é útil.
 */
export async function startCheckout(
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string } | void> {
  const publicId = String(formData.get('session_id') ?? '');
  const sku = String(formData.get('sku') ?? '');

  /**
   * O destino é calculado dentro do `try`, mas o `redirect()` acontece FORA dele.
   *
   * `redirect()` sinaliza sucesso lançando uma exceção que o Next intercepta. Chamá-lo dentro de
   * um `try/catch` faria o próprio catch engolir o sucesso e devolver "não foi possível iniciar o
   * pagamento" logo depois de o pedido ter sido criado — o pior desfecho possível, porque cobra e
   * diz que falhou. Dá para reconhecer esse throw pelo digest interno do Next, mas depender da
   * forma interna de outra biblioteca para distinguir sucesso de falha é frágil demais para um
   * caminho de pagamento.
   */
  let destination: string;

  try {
    const jar = await cookies();
    const token = jar.get('te_visitor')?.value;
    if (!token) {
      return { error: 'Sessão expirada. Refaça o questionário para continuar.' };
    }

    // `withAutoBootstrap` cobre o caso de o banco estar vazio na primeira compra da vida do
    // sistema — mesma proteção que a gravação da análise já tinha.
    const order = await withAutoBootstrap(async () => {
      const sessionId = await ensureAnonymousSession(token);
      return createOrder({ sessionId, publicId, sku });
    });

    if (!order) {
      return {
        error:
          'Não encontramos este produto no banco. Abra /admin/setup e clique em "Criar produtos".',
      };
    }

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

    destination = checkout.redirectUrl;
  } catch (error) {
    console.error('[checkout] falha ao iniciar pagamento', error);
    return { error: describeCheckoutFailure(error) };
  }

  redirect(destination);
}

