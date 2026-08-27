'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createOrder, attachPayment } from '@/database/repositories/commerce-repo';
import { ensureAnonymousSession } from '@/database/repositories/session-repo';
import { redeemCoupon } from '@/database/repositories/coupon-repo';
import { withAutoBootstrap } from '@/database/setup';
import { markFunnel } from '@/database/repositories/funnel-repo';
import { paymentProvider } from '@/payments/adapters';
import { describeCheckoutFailure } from '@/payments/checkout-errors';
import { checkoutOpen, INVITE_ONLY_MESSAGE } from '@/payments/mode';
import { claimAnalysis, ensureUser } from '@/database/repositories/auth-repo';
import { sendEmail } from '@/email/send';
import { reportReadyEmail } from '@/email/templates';
import { SITE_URL } from '@/lib/site';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Guarda o e-mail e amarra a análise à pessoa.
 *
 * ─── POR QUE ISTO NÃO PODE DERRUBAR O FLUXO ──────────────────────────────────────────────────
 *
 * A identificação é um serviço ao cliente, não uma condição da compra. Se o banco engasgar ao
 * gravar o usuário, a alternativa "recusar o pagamento" seria trocar um problema pequeno — a
 * pessoa fica sem o e-mail de recuperação — por um grande: ela não recebe o que veio comprar.
 *
 * Então a falha é registrada e engolida, e devolve `null`. Quem chama segue adiante.
 */
async function identify(email: string, publicId: string): Promise<string | null> {
  try {
    const userId = await ensureUser(email);
    await claimAnalysis(publicId, userId);
    return userId;
  } catch (error) {
    console.error('[identificacao] falha ao vincular e-mail à análise:', error);
    return null;
  }
}

/** Manda o link do relatório para quem acabou de ganhar acesso. Silencioso quando não configurado. */
async function sendReportEmail(input: {
  email: string;
  publicId: string;
  productName: string;
  amountCents: number;
}): Promise<void> {
  const mail = reportReadyEmail({
    url: `${SITE_URL}/resultado/${input.publicId}`,
    productName: input.productName,
    amountCents: input.amountCents,
  });
  await sendEmail({ to: input.email, ...mail });
}

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
  const email = String(formData.get('email') ?? '').trim();

  /*
    O e-mail é exigido ANTES de qualquer escrita, e a recusa é sobre o formato, não sobre existir.

    Ele não é burocracia de cadastro: é o único caminho de volta ao relatório depois que a pessoa
    fecha o navegador. Sem ele, a análise fica presa a um cookie — e a primeira limpeza de cache
    apaga o que ela pagou.
  */
  if (!EMAIL.test(email)) {
    return { error: 'Confira seu e-mail: é para lá que enviamos o link da sua análise.' };
  }

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
      const userId = await identify(email, publicId);
      return createOrder({ sessionId, publicId, sku, userId });
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
      /*
        A volta é para `/retorno`, e NÃO direto para `/resultado`.

        Apontar para o relatório parece o destino óbvio e é o errado: quando o comprador volta pelo
        navegador antes de a confirmação do gateway chegar ao nosso servidor — e não há ordem
        garantida entre as duas coisas —, `/resultado` não acha entitlement e devolve a pessoa à
        página de planos, oferecendo com preço e botão exatamente o que ela acabou de comprar.

        `/retorno` espera a confirmação e só então encaminha. Ver `src/app/retorno/[sessionId]`.
      */
      returnUrl: `${scheme}://${host}/retorno/${publicId}`,
      failureUrl: `${scheme}://${host}/planos/${publicId}`,
      notificationUrl: `${scheme}://${host}/api/webhooks/payment`,
    });

    await attachPayment({
      orderId: order.orderId,
      provider: provider.id,
      providerPaymentId: checkout.providerPaymentId,
      amountCents: order.product.priceCents,
    });

    /*
      Marcado quando o gateway ACEITOU criar o checkout, não quando o botão foi clicado.

      Entre as duas coisas existe a criação do pedido e uma chamada de rede que pode falhar; contar
      o clique faria uma falha de integração aparecer no painel como desistência do cliente, que é
      o diagnóstico oposto do certo.
    */
    await markFunnel(token, 'checkout');

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
  const email = String(formData.get('email') ?? '').trim();

  if (code.trim().length === 0) return { error: 'Digite o código para continuar.' };

  /*
    Aqui o e-mail é OPCIONAL, ao contrário do checkout.

    Quem entra por convite normalmente é alguém testando a pedido do dono, muitas vezes de um
    aparelho emprestado, e exigir cadastro para um teste é atrito sem contrapartida. Quem informar
    ganha o link por e-mail e a lista em /minhas-analises; quem não informar continua com o
    relatório na tela, como sempre.

    Formato inválido recusa, porque um endereço digitado errado é pior que endereço nenhum: cria a
    expectativa de um e-mail que nunca chega.
  */
  if (email.length > 0 && !EMAIL.test(email)) {
    return { error: 'Confira o e-mail — ou deixe em branco para seguir sem ele.' };
  }

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
        /*
          A identificação vem DEPOIS da concessão, e nunca antes.

          Se viesse antes, uma falha ao gravar o usuário impediria o acesso que o código já
          autorizava — trocar o produto por um cadastro. Aqui o relatório já está liberado; o
          e-mail é o extra que permite voltar a ele depois.
        */
        if (email.length > 0) {
          const userId = await identify(email, publicId);
          if (userId) {
            await sendReportEmail({
              email,
              publicId,
              productName: 'Acesso por convite',
              amountCents: 0,
            });
          }
        }
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
