import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type {
  CheckoutSession,
  CreateCheckoutInput,
  PaymentProvider,
  PaymentStatus,
  WebhookOutcome,
} from '../provider';

/**
 * Adapter do Mercado Pago — Checkout Pro.
 *
 * ═══ POR QUE CHECKOUT PRO, E NÃO CAMPOS DE CARTÃO NO SITE ════════════════════════════════════
 *
 * No Checkout Pro o cliente sai daqui, paga numa tela do Mercado Pago e volta. Nenhum dado de
 * cartão passa por este servidor, o que tira o produto inteiro do escopo de PCI-DSS — a diferença
 * entre uma integração que uma pessoa mantém e um projeto de conformidade.
 *
 * Ele também entrega PIX, cartão e boleto na mesma tela sem nenhum código a mais, e é a tela que o
 * comprador brasileiro reconhece. Para um produto de R$ 29,99 a R$ 49,99, reconhecimento na hora
 * de pagar vale mais do que qualquer customização de checkout.
 *
 * ═══ AS TRÊS COISAS QUE ESTE ARQUIVO PRECISA ACERTAR ═════════════════════════════════════════
 *
 * 1. O `external_reference` carrega o NOSSO `orderId`. É por ele que o webhook reencontra o
 *    pedido — o id do pagamento é do Mercado Pago e não significa nada do lado de cá.
 *
 * 2. A notificação NÃO traz o status. Ela traz só o id do pagamento, e é obrigatório ir buscar o
 *    estado na API. Confiar no corpo da notificação seria confiar em quem a enviou.
 *
 * 3. A assinatura é validada antes de qualquer coisa. Sem isso, quem descobrisse a URL do webhook
 *    concederia acesso a si mesmo com um `curl` — que é exatamente o buraco que o adapter fake já
 *    fecha, e seria absurdo fechar no simulado e deixar aberto no que movimenta dinheiro.
 */

const API = 'https://api.mercadopago.com';

/**
 * As duas credenciais, lidas em CHAMADA e não no topo do módulo.
 *
 * Lidas no topo, elas congelam no build. O deploy que roda `next build` sem as variáveis
 * publicaria um adapter permanentemente quebrado, e o sintoma apareceria só no primeiro pagamento
 * — depois do anúncio, com o cliente na tela.
 */
function accessToken(): string {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      'MERCADOPAGO_ACCESS_TOKEN não configurado. Pegue o Access Token em Suas integrações → sua ' +
        'aplicação → Credenciais, e defina a variável na hospedagem.',
    );
  }
  return token;
}

function webhookSecret(): string {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      'MERCADOPAGO_WEBHOOK_SECRET não configurado. Ele aparece em Suas integrações → sua ' +
        'aplicação → Webhooks → Configurar notificação, junto com a URL que você cadastrar.',
    );
  }
  /*
    `trim()` — e não é preciosismo.

    Este valor é copiado à mão de um painel e colado num formulário de hospedagem. Um espaço ou uma
    quebra de linha invisível no fim entra no HMAC e muda o hash inteiro, produzindo o sintoma mais
    caro que existe: assinatura que nunca confere, com o valor visualmente idêntico ao correto nos
    dois lados. Ninguém encontra isso olhando.

    Nenhum segredo do Mercado Pago tem espaço nas pontas, então recortar não pode quebrar um valor
    legítimo.
  */
  return secret.trim();
}

/**
 * Estados do Mercado Pago traduzidos para os nossos.
 *
 * A lista é EXPLÍCITA e sem `default` permissivo de propósito: um estado novo do gateway não pode
 * virar `paid` por omissão. Se aparecer algo fora desta tabela, o pagamento fica pendente e o
 * acesso não é concedido — o erro caro é conceder sem receber, não o contrário.
 *
 * `in_process` e `authorized` são pendentes de verdade: o dinheiro ainda não é seu. `authorized`
 * é cartão com valor reservado e não capturado; `in_process` é análise antifraude.
 */
const STATUS: Readonly<Record<string, PaymentStatus>> = {
  approved: 'paid',
  pending: 'pending',
  in_process: 'pending',
  authorized: 'pending',
  in_mediation: 'pending',
  rejected: 'failed',
  cancelled: 'cancelled',
  refunded: 'refunded',
  charged_back: 'refunded',
};

/**
 * Faz a falha de REDE se identificar como sendo do Mercado Pago.
 *
 * ─── O DEFEITO QUE ISTO FECHA ──────────────────────────────────────────────────────────────
 *
 * Quando o `fetch` não chega ao destino — DNS, firewall de saída, gateway fora do ar — o erro que
 * o Node lança tem a mensagem `fetch failed`, e mais nada. Duas palavras sem sujeito.
 *
 * Esse erro sobe até `describeCheckoutFailure`, que não tem como saber de onde veio e cai no texto
 * genérico: "confira DATABASE_URL e PAYMENT_PROVIDER". Aí está o prejuízo — a frase manda procurar
 * exatamente onde o problema NÃO está, e quem for atrás vai conferir duas variáveis corretas antes
 * de suspeitar do gateway.
 *
 * Foi um caso real, não hipótese: a primeira tentativa de falar com a API a partir do ambiente de
 * desenvolvimento morreu no proxy com 403, e o que apareceu foi `fetch failed`.
 *
 * O `cause` preserva o erro original inteiro para o log do servidor, que é onde ele serve.
 */
async function comGateway(chamada: () => Promise<Response>): Promise<Response> {
  try {
    return await chamada();
  } catch (causa) {
    throw new Error('Mercado Pago inacessível a partir do servidor.', { cause: causa });
  }
}

type MercadoPagoPayment = {
  readonly id: number | string;
  readonly status: string;
  readonly external_reference?: string | null;
  readonly payment_method_id?: string | null;
};

async function fetchPayment(paymentId: string): Promise<MercadoPagoPayment | null> {
  const response = await fetch(`${API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken()}` },
    cache: 'no-store',
  });
  if (!response.ok) return null;
  return (await response.json()) as MercadoPagoPayment;
}

/**
 * Valida a assinatura `x-signature`.
 *
 * O cabeçalho chega como `ts=1742505638683,v1=<hex>`, e o que é assinado não é o corpo: é um
 * manifesto montado a partir do id do pagamento, do `x-request-id` e do timestamp, no formato
 * `id:<id>;request-id:<req>;ts:<ts>;`.
 *
 * Isso surpreende quem vem de outros gateways — em quase todos assina-se o corpo cru. Assinar o
 * corpo aqui produz uma comparação que nunca bate, e o sintoma é um webhook que rejeita 100% das
 * notificações legítimas silenciosamente.
 */
/**
 * Por que a assinatura não conferiu — as quatro causas, que exigem consertos diferentes.
 *
 * Sem separá-las, "assinatura inválida" cobre desde "o cabeçalho nem veio" até "o segredo está
 * errado", e as duas se investigam em lugares opostos. Isto é o que o log precisa dizer.
 */
type FalhaDeAssinatura =
  | 'sem-cabecalho'
  | 'cabecalho-ilegivel'
  | 'hash-nao-confere'
  | null;

function assinaturaConfere(
  signature: string | null,
  requestId: string | null,
  dataId: string,
): FalhaDeAssinatura {
  if (!signature) return 'sem-cabecalho';

  let ts: string | null = null;
  let v1: string | null = null;
  for (const parte of signature.split(',')) {
    const [chave, valor] = parte.split('=', 2);
    if (!chave || !valor) continue;
    if (chave.trim() === 'ts') ts = valor.trim();
    if (chave.trim() === 'v1') v1 = valor.trim();
  }
  if (!ts || !v1) return 'cabecalho-ilegivel';

  /*
    Os campos ausentes SAEM do manifesto — não entram vazios.

    A documentação é explícita nisso, e é a diferença entre `request-id:;` e a ausência da chave.
    Notificações de teste do painel costumam vir sem `x-request-id`, então o caminho sem ele é o
    primeiro que qualquer pessoa exercita.
  */
  const manifesto =
    `id:${dataId};` + (requestId ? `request-id:${requestId};` : '') + `ts:${ts};`;

  const esperado = createHmac('sha256', webhookSecret()).update(manifesto).digest('hex');

  // Comparação em tempo constante: comparar hash com `===` vaza o prefixo correto pelo tempo.
  const a = Buffer.from(esperado);
  const b = Buffer.from(v1);
  if (a.length === b.length && timingSafeEqual(a, b)) return null;

  /*
    O manifesto vai para o log; o segredo e os hashes NÃO.

    Ele contém só o id do pagamento, o id da requisição e o timestamp — os três já visíveis no
    painel do Mercado Pago, e nenhum deles secreto. É o que permite ver, de fora, se o que estamos
    assinando tem a forma certa: um `id:` diferente do que o painel mostra aponta um problema de
    leitura do corpo, e um manifesto idêntico ao esperado deixa uma causa só de pé, o segredo.

    Publicar o hash esperado seria outra história: ele é derivado do segredo, e um oráculo que
    devolve o hash correto para qualquer manifesto dispensa conhecer o segredo para forjar.
  */
  /*
    O TAMANHO do segredo vai junto, e é a informação que fecha o caso mais comum.

    A assinatura secreta do Mercado Pago tem 64 caracteres hexadecimais. Se o log mostrar outro
    número, o problema não é o algoritmo nem a configuração do painel — é o valor colado na
    hospedagem: truncado, com espaço, com aspas em volta, ou com o token de acesso no lugar do
    segredo. Todos esses parecem iguais na tela e produzem o mesmo `hash-nao-confere`.

    O tamanho não revela o segredo: ele já é público na prática (64 é o formato documentado), e
    saber que um segredo tem 64 caracteres não ajuda ninguém a adivinhá-lo.
  */
  /*
    ═══ O QUE VAI PARA O LOG, E POR QUE ESTA COMBINAÇÃO ═════════════════════════════════════════

    Manifesto, tamanho do segredo e o `v1` RECEBIDO. Com os três — mais o segredo, que quem
    investiga já tem — dá para reproduzir o cálculo fora do servidor e descobrir qual variante do
    algoritmo o gateway usou: chave como texto ou como hexadecimal decodificado, com ou sem o ponto
    e vírgula final, `ts` em segundos ou milissegundos. Sem o `v1` não há o que comparar, e a
    investigação fica em "não confere" para sempre.

    O `v1` recebido é seguro de registrar porque não é NOSSO: é o valor que o remetente mandou.
    Publicá-lo não conta nada sobre o segredo — ele já veio pela rede.

    O hash ESPERADO continua fora daqui, e a diferença é toda. Ele é derivado do segredo, e um log
    que devolve o hash correto para qualquer manifesto é um oráculo: dispensa conhecer o segredo
    para forjar uma assinatura válida.
  */
  /*
    A impressão digital é o que responde "o valor certo chegou até aqui?" sem revelar o valor.

    Contar caracteres provou pouco: o segredo errado tinha exatamente 64, como o certo. Já os
    primeiros 8 hexadecimais do SHA-256 identificam o valor sem permitir voltar a ele — quem
    investiga calcula a mesma impressão do segredo que tem em mãos e compara com a do log.

    É a diferença entre "tem o tamanho certo" e "é o valor certo", e foi ela que faltou.
  */
  const digital = createHash('sha256').update(webhookSecret()).digest('hex').slice(0, 8);

  console.error(
    `[mercadopago] assinatura não confere para o manifesto "${manifesto}" ` +
      `— v1 recebido: ${v1} · segredo configurado: ${webhookSecret().length} caracteres, ` +
      `impressão ${digital}`,
  );
  return 'hash-nao-confere';
}

export const mercadoPagoProvider: PaymentProvider = {
  id: 'mercadopago',

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    /*
      O token é lido AQUI, fora de `comGateway`, e não lá dentro no cabeçalho.

      Dentro, a exceção de "variável não configurada" seria capturada pelo `catch` do wrapper e
      sairia rotulada como falha de rede — mandando conferir o gateway quando o que falta é uma
      variável de ambiente. Foi exatamente o que aconteceu na primeira versão disto, e quem apontou
      foi o teste "sem access token, o checkout não é criado em silêncio".
    */
    const token = accessToken();

    const response = await comGateway(() => fetch(`${API}/checkout/preferences`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [
          {
            id: input.sku,
            title: input.productName,
            /*
              `description` e `category_id` não são enfeite de painel.

              O Mercado Pago documenta a QUALIDADE dos dados enviados como fator na aprovação: a
              análise de risco pontua pior o que chega sem descrição e sem categoria, porque é o
              formato de quem integrou às pressas. `services` é a categoria correta — o que se
              vende aqui é uma análise, não mercadoria física, e declarar produto físico pediria
              endereço de entrega que não existe.
            */
            description: input.productName,
            category_id: 'services',
            quantity: 1,
            currency_id: input.currency,
            // O Mercado Pago trabalha em unidades, não em centavos.
            unit_price: input.amountCents / 100,
          },
        ],
        /*
          ═══ O PAGADOR — O CAMPO QUE FALTAVA ══════════════════════════════════════════════════

          Ver `payerEmail` em `provider.ts` para o caso que revelou a ausência: relatório aprovado,
          upgrade recusado minutos depois, mesmo cartão. Sem pagador, as duas compras chegam ao
          antifraude como dois desconhecidos, e a segunda em poucos minutos é o desenho de uma
          regra de velocidade.

          Só vai o que existe de verdade. Um `payer` com campos vazios é pior que nenhum: o gateway
          o lê como dado ruim, que é justamente o que se quer evitar.
        */
        ...(input.payerEmail !== null || input.payerName !== null
          ? {
              payer: {
                ...(input.payerEmail !== null ? { email: input.payerEmail } : {}),
                ...(input.payerName !== null ? { name: input.payerName } : {}),
              },
            }
          : {}),
        /*
          A ponte entre os dois sistemas.

          O webhook devolve o id do PAGAMENTO, que não existe do nosso lado. Sem o
          `external_reference`, não haveria como saber qual pedido foi pago.
        */
        external_reference: input.orderId,
        back_urls: {
          success: input.returnUrl,
          /*
            `pending` vai para a MESMA tela de espera do sucesso, de propósito.

            Em PIX e boleto o pagamento fica pendente por minutos ou dias, e a tela de espera já diz
            a coisa certa para esse caso: que a confirmação pode demorar e que o link chega por
            e-mail sozinho. Mandar para os planos aqui sugeriria que a compra não aconteceu.
          */
          pending: input.returnUrl,
          failure: input.failureUrl,
        },
        /*
          Volta sozinho só quando aprovado.

          Em PIX e boleto o pagamento fica pendente por minutos ou dias, e devolver a pessoa ao
          relatório nesse estado a faria ver a tela de "ainda não liberado" achando que pagou por
          nada. Nesses casos ela fica na tela do Mercado Pago, que explica o que falta.
        */
        auto_return: 'approved',
        notification_url: input.notificationUrl,
        statement_descriptor: 'TENNISENGINEER',
        /*
          ═══ O CAMPO QUE NÃO ESTÁ AQUI: `purpose` ══════════════════════════════════════════════

          A AUSÊNCIA dele é a decisão. Sem `purpose`, o Checkout Pro aceita pagamento de VISITANTE:
          a pessoa paga com cartão, PIX ou boleto sem criar conta e sem fazer login em lugar nenhum.

          Com `purpose: 'wallet_purchase'`, o Mercado Pago passa a exigir que o comprador entre
          numa conta antes de pagar. Para um produto de R$ 29,99 comprado por impulso logo depois
          de ver a prévia da análise, isso é uma tela de cadastro entre a vontade e o pagamento —
          o lugar mais caro possível para colocar atrito.

          Está escrito aqui porque o defeito seria SILENCIOSO: acrescentar uma linha que parece
          inofensiva não quebra teste nenhum, não gera erro, e o sintoma é uma queda de conversão
          que ninguém liga à causa. O teste "não exige login do comprador" tranca isto.
        */
      }),
    }));

    if (!response.ok) {
      const detalhe = await response.text();
      throw new Error(
        `O Mercado Pago recusou a criação do checkout (HTTP ${response.status}). ${detalhe.slice(0, 300)}`,
      );
    }

    const pref = (await response.json()) as {
      id: string;
      init_point?: string;
      sandbox_init_point?: string;
    };

    /*
      Qual das duas URLs usar — e por que a escolha é pelo que veio, não por variável de ambiente.

      A preferência pode devolver `init_point`, `sandbox_init_point` ou as duas. Ler o que chegou
      elimina a combinação que dói: apontar para a URL do ambiente errado manda o cliente para uma
      tela que recusa o pagamento dele sem explicar por quê.

      ─── O QUE APRENDEMOS COM O SUPORTE (chamado WCS-47938, ago/2026) ────────────────────────
      O par TEST-/sandbox NÃO é como se testa Checkout Pro. A resposta oficial: "se a sua
      integração for Checkout Pro ou Assinaturas, o teste deve ser feito com a conta vendedora de
      teste e as credenciais APP_USR desse usuário de teste". Ou seja, o ambiente de teste é uma
      CONTA inteira de mentira — vendedor de teste e comprador de teste, com dinheiro de mentira —
      e não uma credencial especial dentro da conta real. As credenciais dessa conta têm o mesmo
      prefixo `APP_USR-` da produção, e a preferência criada com elas devolve `init_point`.

      Consequência para este código: nenhuma. Ele não olha o prefixo do token nem decide por
      ambiente — usa a URL que a resposta trouxe, e por isso funciona igual nos dois casos. Está
      escrito aqui porque a leitura ingênua do `??` sugere um "se for teste" que não existe, e
      alguém iria acrescentar a variável de ambiente que este comentário torna desnecessária.
    */
    const redirectUrl = pref.init_point ?? pref.sandbox_init_point;
    if (!redirectUrl) {
      throw new Error('O Mercado Pago não devolveu a URL de checkout na preferência criada.');
    }

    return { providerPaymentId: pref.id, redirectUrl };
  },

  async parseWebhook(request: Request): Promise<WebhookOutcome> {
    /*
      ═══ CADA SAÍDA DIZ O QUE É, E O CÓDIGO DE STATUS SEGUE DISSO ════════════════════════════

      Sete caminhos saem daqui sem evento, e antes todos viravam a mesma resposta: `400 assinatura
      inválida`. Era mentira em seis deles, e cara caro em um: as notificações de `merchant_order`,
      que o Mercado Pago manda junto de CADA pagamento, recebiam 400 e eram reenviadas para sempre.
      Daí o `0% de notificações entregues` no painel — com o webhook funcionando.

      E a leitura óbvia de `400` em tudo é "minha assinatura está errada". A investigação inteira foi
      por esse caminho por causa de um código de status mal escolhido.
    */
    const body = await request.text();

    let payload: { type?: string; action?: string; data?: { id?: string | number } };
    try {
      payload = JSON.parse(body) as typeof payload;
    } catch {
      console.error('[mercadopago] notificação recusada: corpo não é JSON');
      return { kind: 'invalid', reason: 'corpo não é JSON' };
    }

    /*
      Só notificação de pagamento interessa. As de `merchant_order` chegam junto e são ruído aqui —
      e as de `application` (vinculação de aplicações) e `fraud_alert` também, quando esses eventos
      estão marcados no painel. Ignorá-las é o comportamento certo, mas não é erro nenhum e não
      pode aparecer no log com a mesma cara de uma falha.
    */
    const tipo = payload.type ?? payload.action?.split('.')[0];
    if (tipo !== 'payment') {
      const motivo = `tipo "${tipo ?? 'ausente'}" não é pagamento`;
      console.info(`[mercadopago] notificação ignorada: ${motivo}`);
      return { kind: 'ignored', reason: motivo };
    }

    /*
      ═══ DE ONDE SAI O ID QUE ENTRA NO MANIFESTO ══════════════════════════════════════════════

      Da QUERY STRING da notificação, e não do corpo. A documentação do Mercado Pago descreve o
      manifesto como `id:[data.id_url];…` — o `data.id` que vem na URL.

      Nós usávamos o do corpo. Nas notificações de pagamento os dois valores coincidem, então
      funcionava; mas coincidir não é a mesma coisa que estar certo, e a diferença aparece
      justamente onde ninguém procura — num formato de notificação em que eles divergem, com o
      webhook rejeitando tudo e nenhuma pista do motivo.

      A regra do minúsculo vem da mesma página: ids alfanuméricos entram no manifesto em caixa
      baixa. Ids de pagamento são numéricos e não são afetados, o que torna esta a espécie de linha
      que nunca é exercitada até o dia em que é.

      O corpo continua sendo a origem de tudo o mais — inclusive de qual pagamento consultar na API.
    */
    const url = new URL(request.url);
    const idDaUrl = url.searchParams.get('data.id') ?? url.searchParams.get('id');

    const dataId = payload.data?.id ?? idDaUrl;
    if (dataId === undefined || dataId === null) {
      console.error('[mercadopago] notificação recusada: sem data.id no corpo nem na URL');
      return { kind: 'invalid', reason: 'sem data.id' };
    }

    const idAssinado = (idDaUrl ?? String(dataId)).toLowerCase();

    const falha = assinaturaConfere(
      request.headers.get('x-signature'),
      request.headers.get('x-request-id'),
      idAssinado,
    );
    if (falha) {
      /*
        Cada causa se conserta num lugar diferente, e o log precisa dizer em qual:

          sem-cabecalho ....... o Mercado Pago não assinou. Acontece quando a URL foi definida só na
                                preferência e não existe notificação configurada no painel — ali é
                                que a assinatura secreta é criada.
          cabecalho-ilegivel .. veio um `x-signature` sem `ts` ou sem `v1`. Formato mudou.
          hash-nao-confere .... o segredo configurado não é o da aplicação que enviou.
      */
      console.error(`[mercadopago] notificação recusada: ${falha} (pagamento ${String(dataId)})`);
      return { kind: 'invalid', reason: falha };
    }

    /*
      O ESTADO VEM DA API, NUNCA DO CORPO DA NOTIFICAÇÃO.

      A notificação diz apenas "o pagamento X mudou". Quem tem autoridade sobre o estado é a API,
      e buscar lá fecha a janela em que um payload forjado — ainda que assinado por engano —
      pudesse declarar `approved`.
    */
    const payment = await fetchPayment(String(dataId));
    if (!payment) {
      // Assinatura VÁLIDA e API que não respondeu. Nada a ver com segurança: ou o token não lê
      // este pagamento, ou a API está fora. Confundir isto com assinatura inválida foi o que quase
      // mandou a investigação para o lado errado.
      console.error(
        `[mercadopago] assinatura ok, mas a API não devolveu o pagamento ${String(dataId)} — ` +
          'confira o MERCADOPAGO_ACCESS_TOKEN da mesma aplicação',
      );
      return { kind: 'invalid', reason: 'a API não devolveu o pagamento' };
    }

    const orderId = payment.external_reference;
    if (!orderId) {
      console.error(
        `[mercadopago] pagamento ${payment.id} sem external_reference — não dá para saber o pedido`,
      );
      return { kind: 'ignored', reason: 'pagamento sem external_reference' };
    }

    const status = STATUS[payment.status];
    if (!status) {
      console.error(`[mercadopago] estado desconhecido "${payment.status}" — nada concedido`);
      return { kind: 'ignored', reason: `estado desconhecido "${payment.status}"` };
    }

    return {
      kind: 'event',
      event: {
        /*
          Idempotência por PAGAMENTO + ESTADO, não por notificação.

          O Mercado Pago reenvia a mesma notificação quando não recebe 200, e manda várias ao longo
          da vida de um pagamento (pendente → aprovado). Usar o id da notificação deixaria os
          reenvios passarem como eventos novos; usar só o id do pagamento bloquearia a transição
          legítima de pendente para aprovado. O par resolve os dois.
        */
        providerEventId: `mp:${payment.id}:${payment.status}`,
        eventType: payload.action ?? `payment.${payment.status}`,
        providerPaymentId: String(payment.id),
        orderId,
        status,
        method: payment.payment_method_id ?? null,
        raw: payment,
      },
    };
  },

  async getPaymentStatus(providerPaymentId: string): Promise<PaymentStatus> {
    const payment = await fetchPayment(providerPaymentId);
    // Sem resposta da API, o honesto é "ainda não sei" — e pendente não concede nada.
    if (!payment) return 'pending';
    return STATUS[payment.status] ?? 'pending';
  },
};
