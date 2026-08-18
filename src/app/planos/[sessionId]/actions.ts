'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createOrder, attachPayment } from '@/database/repositories/commerce-repo';
import { ensureAnonymousSession } from '@/database/repositories/session-repo';
import { redeemCoupon } from '@/database/repositories/coupon-repo';
import { withAutoBootstrap } from '@/database/setup';
import { paymentProvider } from '@/payments/adapters';
import { describeCheckoutFailure } from '@/payments/checkout-errors';
import { checkoutOpen, INVITE_ONLY_MESSAGE } from '@/payments/mode';

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

  /*
    A recusa vem ANTES de qualquer escrita.

    A página já esconde os botões no modo convite, mas esconder é decisão de tela e tela é o que
    menos protege: um POST direto ao Server Action não passa por ela. Aqui nenhum pedido chega a
    existir, então não há o que pagar nem pedido órfão para limpar depois.
  */
  if (!(await checkoutOpen())) return { error: INVITE_ONLY_MESSAGE };

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


/**
 * Resgata um código de acesso e libera o relatório sem passar pelo pagamento.
 *
 * ─── POR QUE ISTO NÃO É UM FURO NO §32 ───────────────────────────────────────────────────────
 *
 * O §32 exige que nenhum caminho entregue conteúdo pago sem autorização — e o webhook de pagamento
 * era a única origem de entitlement justamente para que não houvesse porta lateral esquecida.
 *
 * O código de acesso é uma segunda origem, e ela é legítima por três motivos que a porta lateral
 * não teria: é criada deliberadamente por quem é dono do produto, dentro do painel protegido por
 * senha; tem lastro no banco, com limite de usos e histórico de quem resgatou; e o entitlement que
 * ela concede é o mesmo objeto, com os mesmos nomes, que o pagamento concederia. Não existe estado
 * novo no sistema — existe uma segunda forma de chegar ao mesmo estado, auditável.
 *
 * O que continua PROIBIDO é o que sempre foi: o cliente pedir um entitlement. O código é validado
 * no servidor contra a tabela, e um código inexistente não concede nada.
 */
export async function redeemAccessCode(
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string } | void> {
  const publicId = String(formData.get('session_id') ?? '');
  const code = String(formData.get('code') ?? '');

  if (code.trim().length === 0) return { error: 'Digite o código para continuar.' };

  try {
    const jar = await cookies();
    const token = jar.get('te_visitor')?.value;
    if (!token) return { error: 'Sessão expirada. Refaça o questionário para continuar.' };

    const outcome = await withAutoBootstrap(async () => {
      const sessionId = await ensureAnonymousSession(token);
      return redeemCoupon({ code, publicId, sessionId });
    });

    /**
     * Cada recusa diz o que aconteceu, e são coisas diferentes.
     *
     * "Código inválido" para tudo era o pior de dois mundos: quem digitou errado não sabia se
     * errou a digitação ou se o código tinha acabado, e quem estava com um link velho procurava
     * problema no código quando o problema era a análise. Reaplicar o mesmo código na mesma
     * análise não é erro nenhum — leva ao relatório, porque o acesso já está lá.
     */
    switch (outcome.kind) {
      case 'granted':
        break;
      case 'exhausted':
        return { error: 'Este código já atingiu o limite de usos.' };
      case 'unknown_code':
        return { error: 'Não encontramos este código. Confira se digitou exatamente como recebeu.' };
      case 'unknown_analysis':
        return {
          error:
            'Não encontramos esta análise. Refaça o questionário e aplique o código na tela de ' +
            'planos.',
        };
      case 'empty':
        return { error: 'Digite o código para continuar.' };
    }
  } catch (error) {
    console.error('[coupon] falha ao resgatar código', error);
    return { error: describeCheckoutFailure(error) };
  }

  redirect(`/resultado/${publicId}`);
}
