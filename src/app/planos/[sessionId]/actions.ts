'use server';

import { createHash } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createOrder, attachPayment } from '@/database/repositories/commerce-repo';
import {
  ensureAnonymousSession,
  grantedEntitlements,
  loadRecommendation,
} from '@/database/repositories/session-repo';
import { redeemCoupon } from '@/database/repositories/coupon-repo';
import { withAutoBootstrap } from '@/database/setup';
import { contarTentativa, LIMITE_JANELA_MINUTOS } from '@/database/repositories/throttle-repo';
import { markFunnel } from '@/database/repositories/funnel-repo';
import { paymentProvider } from '@/payments/adapters';
import { describeCheckoutFailure } from '@/payments/checkout-errors';
import { checkoutOpen, INVITE_ONLY_MESSAGE } from '@/payments/mode';
import { PRODUCT_ENTITLEMENTS } from '@/payments/entitlements';
import { claimAnalysis, ensureUser } from '@/database/repositories/auth-repo';
import { sendEmail } from '@/email/send';
import { reportReadyEmail } from '@/email/templates';
import { SITE_URL } from '@/lib/site';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * O nome do jogador, para identificar o pagador no gateway — e nunca a um custo que derrube a compra.
 *
 * O nome é opcional no questionário, então costuma não existir. Ele acrescenta pouco perto do
 * e-mail, que é o sinal que de fato importa para o antifraude (ver `payerEmail` em `provider.ts`),
 * e por isso qualquer tropeço aqui é engolido: uma leitura lenta ou um banco engasgado não podem
 * custar uma venda por causa de um campo acessório. Mesmo princípio de `identify`.
 */
async function nomeDoPagador(publicId: string): Promise<string | null> {
  try {
    const stored = await loadRecommendation(publicId);
    const nome = stored?.profile.player_name?.trim();
    return nome !== undefined && nome.length > 0 ? nome : null;
  } catch (error) {
    console.error(`[checkout] não consegui ler o nome do jogador de ${publicId}`, error);
    return null;
  }
}

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

  /*
    ═══ A MESMA REGRA DA VITRINE, DO LADO QUE NÃO SE CONTORNA ═════════════════════════════════

    `page.tsx` deixou de listar upgrade para quem não comprou o relatório. Isso resolve o que se vê
    e não resolve o que se pode fazer: o comentário quinze linhas acima já diz por quê — esconder é
    decisão de tela, e um POST direto neste Server Action não passa por tela nenhuma.

    Sem esta guarda, `unlock_rank_2` continuava comprável por quem não tem a 1ª colocada. A pessoa
    pagaria R$ 8,99 por um pedaço de um relatório que ela não consegue abrir, e o estorno seria
    trabalho manual para os dois lados.

    A recusa vem ANTES de criar o pedido, pelo mesmo motivo do bloco acima: assim não existe pedido
    órfão para limpar depois.
  */
  const ENTRADAS = new Set(['racket_report', 'full_setup']);
  {
    const jaTem = await withAutoBootstrap(() => grantedEntitlements(publicId));
    const temRelatorio = jaTem.includes('racket_report_access');

    if (!ENTRADAS.has(sku) && !temRelatorio) {
      return {
        error:
          'Este complemento só existe para quem já tem o relatório da raquete. ' +
          'Comece pela raquete recomendada — os upgrades aparecem depois, dentro do relatório.',
      };
    }

    /*
      A porta de entrada fecha depois de atravessada — e aqui ela custa dinheiro de verdade.

      `full_setup` inclui o relatório da raquete. Vendê-lo a quem já comprou `racket_report` cobra o
      relatório duas vezes: R$ 74,98 pelo conteúdo que o upgrade entrega por R$ 59,98. A tela já
      deixou de oferecer; esta guarda é a que vale contra um POST direto.
    */
    if (ENTRADAS.has(sku) && temRelatorio) {
      return {
        error:
          'Você já tem o relatório da raquete. Para completar, use "Completar com corda e tensão" ' +
          '— comprar o pacote inteiro de novo cobraria duas vezes pelo que você já tem.',
      };
    }

    /* E o que já foi comprado não pode ser comprado de novo. */
    const concede = PRODUCT_ENTITLEMENTS[sku] ?? [];
    if (concede.length > 0 && concede.every((e) => jaTem.includes(e))) {
      return { error: 'Você já tem este item liberado nesta análise.' };
    }
  }

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
      /*
        O valor vem do PEDIDO, não do produto.

        Eram a mesma coisa até existir cupom de desconto; agora divergem, e mandar o preço do
        produto ao gateway cobraria o cheio de quem viu o valor com desconto na tela. O pedido é a
        única fonte que já passou pelo desconto e ficou gravada.
      */
      amountCents: order.amountCents,
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
      /*
        ═══ A VOLTA PRESERVA O `?produto=`, E ISSO NÃO É DETALHE ═══════════════════════════════

        Relato do dono, com o print na mão: "ponho pra pagar, volto, e ele volta pra essa página,
        não faz sentido. Deveria voltar para a mesma opção que estava antes de eu clicar."

        Ele está certo, e a causa é esta linha. O caminho real é:

            /analise/<id>  →  /planos/<id>?produto=racket_report  →  gateway

        ou seja, quem clica está numa página que mostra UM produto. A URL de falha apontava para
        `/planos/<id>` sem o parâmetro, e a página sem `produto` lista o catálogo inteiro — as duas
        opções de entrada mais os três upgrades. Desistir do pagamento devolvia a pessoa a uma tela
        que ela nunca tinha visto, oferecendo "Desbloquear a 2ª colocada" a quem não comprou nada.

        Um sintoma, duas causas, e as duas precisavam de conserto: esta linha traz a pessoa de volta
        ao lugar de onde ela saiu, e `page.tsx` deixa de oferecer upgrade a quem não tem o que
        atualizar — porque a lista completa continua alcançável por outros caminhos.
      */
      failureUrl: `${scheme}://${host}/planos/${publicId}?produto=${encodeURIComponent(sku)}`,
      notificationUrl: `${scheme}://${host}/api/webhooks/payment`,
      /*
        ═══ O E-MAIL JÁ ESTAVA AQUI — E PARAVA AQUI ══════════════════════════════════════════

        Ele é obrigatório neste fluxo, já foi validado acima, e servia para criar a conta, mandar o
        link e alimentar /minhas-analises. Ao gateway não ia nada: toda compra chegava lá sem
        pagador, como um desconhecido.

        O sintoma apareceu num teste do dono — relatório aprovado, upgrade recusado minutos depois
        com o mesmo cartão. Ver `payerEmail` em `provider.ts`: sem pagador, o antifraude não tem
        como ligar a segunda compra à primeira, e duas transações do mesmo cartão em poucos minutos
        de um comprador anônimo é exatamente o que uma regra de velocidade procura.

        O nome vem do questionário e é opcional lá, então pode não existir. Vai só quando existe —
        campo vazio conta como dado ruim, que é o oposto do que se quer.
      */
      payerEmail: email,
      payerName: await nomeDoPagador(publicId),
    });

    await attachPayment({
      orderId: order.orderId,
      provider: provider.id,
      providerPaymentId: checkout.providerPaymentId,
      amountCents: order.amountCents,
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
/** Palpites de código por visitante, em 15 minutos. Ver a nota dentro da função. */
const MAX_TENTATIVAS_CUPOM = 12;

/** Teto do SITE INTEIRO por janela. Ver a nota dentro da função. */
const MAX_TENTATIVAS_CUPOM_GLOBAL = 200;

/**
 * O token do visitante NÃO entra no contador em claro.
 *
 * O escopo é uma coluna de texto que qualquer consulta ao banco lê. Guardar ali o valor que dá
 * acesso à sessão de alguém seria criar uma segunda cópia do segredo, num lugar em que ninguém
 * espera encontrá-lo — o mesmo motivo pelo qual `anonymous_sessions` guarda só o hash.
 */
function hashVisitante(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 32);
}

/**
 * Aplica um código — de acesso ou de desconto.
 *
 * Os dois desfechos são opostos e a função precisa dos dois: o de ACESSO leva ao relatório, porque
 * a entrega já aconteceu; o de DESCONTO fica nesta tela, porque o passo que falta é pagar.
 */
export async function redeemAccessCode(
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string } | { ok: string } | undefined> {
  /*
    `undefined` no lugar de `void` no tipo de retorno.

    `void` faz o React tipar o estado da ação como podendo ser `void`, e `void` não é renderizável —
    a tela que mostra a mensagem deixa de compilar. O caminho de sucesso do código de acesso nunca
    retorna de verdade: ele termina em `redirect`, que lança.
  */
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

    /*
      ═══ O CAMPO DE CÓDIGO ACEITAVA PALPITES INFINITOS ═════════════════════════════════════════

      Errar um código não custava nada, e acertar dá um relatório pago. Pior: os códigos são
      PALAVRAS, não cadeias aleatórias — um dicionário de nomes próprios e termos de tênis chega
      lá em minutos, e cada acerto é uma venda que não acontece.

      Nem rastro ficava. Sem contador, nem depois daria para saber que alguém tentou.

      Doze por 15 minutos: quem recebeu um convite digita uma vez, no máximo erra e corrige. Doze
      cobre o dedo gordo com folga e derruba a viabilidade de varredura.

      A chave é o VISITANTE, e não a porta como no painel: aqui o tráfego legítimo é de muitas
      pessoas ao mesmo tempo, e um teto global transformaria um ataque num bloqueio de todos os
      clientes reais — que é o objetivo do atacante, não o nosso.
    */
    /*
      DOIS tetos, e cada um cobre o furo do outro.

      O por visitante barra quem chuta no formulário. Ele NÃO barra um script: o visitante é um
      cookie que o atacante controla, e limpar o cookie devolve doze tentativas. Sozinho, ele
      protege contra distração, não contra intenção.

      O teto global fecha isso. Duzentas tentativas em 15 minutos é muito acima de qualquer tráfego
      real — quem recebeu um convite digita uma vez — e muito abaixo do que uma varredura de
      dicionário precisa. Um script chega lá no primeiro minuto e para.

      O preço é conhecido e aceito: durante um ataque, clientes legítimos com código na mão ficam
      sem resgatar por até 15 minutos. É um incômodo raro contra um vazamento permanente, e a
      mensagem manda tentar de novo em vez de dizer que o código não vale.
    */
    const veredito = await withAutoBootstrap(async () => {
      const global = await contarTentativa('coupon-global', MAX_TENTATIVAS_CUPOM_GLOBAL);
      if (!global.permitido) return global;
      return contarTentativa(`coupon:${hashVisitante(token)}`, MAX_TENTATIVAS_CUPOM);
    });
    if (!veredito.permitido) {
      return {
        error: `Muitas tentativas. Aguarde ${LIMITE_JANELA_MINUTOS} minutos e tente de novo.`,
      };
    }

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
      case 'discount': {
        /*
          Nada foi entregue, então nada de e-mail e nada de redirecionar.

          O código ficou guardado na análise; o que muda é o PREÇO desta tela. `revalidatePath`
          existe para que ela remonte com os valores novos — sem isso o cupom seria aceito e a
          pessoa continuaria olhando o preço cheio, o que lê como "não funcionou".
        */
        revalidatePath(`/planos/${publicId}`);
        /*
          A frase não diz onde os valores estão.

          Ela dizia "os valores abaixo", e no celular os cards ficam ACIMA do formulário — fora da
          tela no instante em que a mensagem aparece. Quem lia "abaixo" olhava para baixo, não via
          preço nenhum e concluía que o cupom não tinha pegado. Quem leva o olho até os preços é a
          rolagem que o formulário dispara, não a palavra.
        */
        return { ok: `Cupom aplicado: ${outcome.percent}% de desconto nos preços.` };
      }
      case 'exhausted':
        return { error: 'Este código já atingiu o limite de usos.' };
      case 'daily_limit':
        /*
          A frase diz que PASSA, e é a diferença que importa.

          "Limite atingido" faria o convidado concluir que o código morreu e pedir outro — gastando
          o tempo dele e o do dono por algo que se resolve sozinho em algumas horas.
        */
        return {
          error:
            `Este código já foi usado ${outcome.limit} vezes nas últimas 24 horas, que é o limite ` +
            'diário dele. Tente de novo amanhã, ou peça um código novo a quem te convidou.',
        };
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
