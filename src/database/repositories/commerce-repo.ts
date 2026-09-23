import { and, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { db, isDatabaseConfigured } from '@/database/client';
import { recorte, SEM_LIMITE } from '@/database/recorte';
import type { Janela } from '@/lib/periodo';
import {
  entitlements,
  orders,
  paymentEvents,
  payments,
  products,
  recommendationSessions,
  users,
} from '@/database/schema';
import { anonymousSessions } from '@/database/schema/sessions';
import { visitorCampaigns } from '@/database/schema/campaigns';
import { PRODUCT_SEED } from '@/database/setup';
import { canTransition, type PaymentEvent, type PaymentStatus } from '@/payments/provider';
import { markFunnelBySessionId } from './funnel-repo';
import { PRODUCT_ENTITLEMENTS } from '@/payments/entitlements';
import { comDesconto, consumirCupomDoPedido, descontoDaAnalise } from './coupon-repo';

export type Product = {
  readonly sku: string;
  readonly name: string;
  readonly description: string | null;
  readonly priceCents: number;
  readonly currency: string;
  readonly grantsEntitlements: readonly string[];
};

/** Preços vêm SEMPRE do banco (§34). Nenhum valor em reais existe hardcoded no código. */
export async function activeProducts(): Promise<Product[]> {
  const rows = await db()
    .select()
    .from(products)
    .where(eq(products.active, true))
    .orderBy(products.priceCents);

  return rows.map((r) => ({
    sku: r.sku,
    name: r.name,
    description: r.description,
    priceCents: r.priceCents,
    currency: r.currency,
    grantsEntitlements: r.grantsEntitlements,
  }));
}

/**
 * Grava a tabela de preços inteira, numa transação só.
 *
 * ═══ POR QUE TRANSAÇÃO ═══════════════════════════════════════════════════════════════════════
 *
 * Cinco `UPDATE` soltos têm quatro instantes entre eles em que a escada está meio velha e meio
 * nova — e é justamente nesses instantes que ela pode estar incoerente: a raquete já a R$ 29,99 e o
 * pacote ainda a R$ 24,99, por exemplo. Uma visita que caia ali vê, e pode comprar, uma combinação
 * que ninguém aprovou.
 *
 * A janela é de milissegundos, o que a torna rara e não a torna aceitável: o produto inteiro é
 * escrito em torno de nunca cobrar mais por menos, e "quase nunca" é outra coisa.
 *
 * O preço COBRADO de quem já comprou não muda — `orders.amount_cents` guarda a cópia do instante da
 * compra. Isto reprecifica a vitrine, não o passado.
 */
export async function atualizarPrecos(precos: Readonly<Record<string, number>>): Promise<void> {
  await db().transaction(async (tx) => {
    for (const [sku, priceCents] of Object.entries(precos)) {
      await tx
        .update(products)
        .set({ priceCents, updatedAt: new Date() })
        .where(eq(products.sku, sku));
    }
  });
}

export async function productBySku(sku: string): Promise<Product | null> {
  const rows = await db()
    .select()
    .from(products)
    .where(and(eq(products.sku, sku), eq(products.active, true)))
    .limit(1);

  const r = rows[0];
  if (!r) return null;
  return {
    sku: r.sku,
    name: r.name,
    description: r.description,
    priceCents: r.priceCents,
    currency: r.currency,
    grantsEntitlements: r.grantsEntitlements,
  };
}

/**
 * Cria o pedido com o preço COPIADO do catálogo no instante da compra.
 *
 * A cópia é deliberadamente redundante: quando o preço do relatório sobe, o histórico de quem pagou
 * o valor antigo continua dizendo o valor antigo. Ler o preço de `products` na hora de emitir a nota
 * reescreveria o passado.
 *
 * Deixou de ser hipótese em set/2026: a raquete avulsa foi de R$ 19,99 para R$ 29,99. Os pedidos
 * anteriores continuam registrando R$ 19,99 porque o valor foi copiado no instante da compra — é
 * exatamente para isso que esta coluna existe.
 */
export async function createOrder(input: {
  sessionId: string;
  publicId: string;
  sku: string;
  /** Quem comprou, quando o e-mail foi informado. Nulo não impede a compra — ver `identify()`. */
  userId?: string | null;
}): Promise<{ orderId: string; product: Product; amountCents: number } | null> {
  const product = await productBySku(input.sku);
  if (!product) return null;

  const conn = db();
  const rec = await conn
    .select({ id: recommendationSessions.id })
    .from(recommendationSessions)
    .where(eq(recommendationSessions.publicId, input.publicId))
    .limit(1);

  if (!rec[0]) return null;

  /*
    ═══ O DESCONTO É RESOLVIDO AQUI, NO SERVIDOR, NO INSTANTE DA COMPRA ═══════════════════════

    A tela de planos já mostrou um valor com desconto, e ele NÃO é reaproveitado: nada que passou
    pelo navegador decide quanto alguém paga. O cupom é relido do banco agora, com as mesmas
    conferências — ativo, dentro do limite —, e um cupom que morreu no meio do caminho
    simplesmente não vale.

    O sentido do erro é o certo: a divergência possível é o cliente ver um preço com desconto e
    pagar o cheio, nunca o contrário. Quando isso acontece, ele vê o valor real na tela do gateway
    antes de confirmar.
  */
  const desconto = await descontoDaAnalise(input.publicId);
  const amountCents = desconto
    ? comDesconto(product.priceCents, desconto.percent)
    : product.priceCents;

  const inserted = await conn
    .insert(orders)
    .values({
      sessionId: input.sessionId,
      recommendationSessionId: rec[0].id,
      userId: input.userId ?? null,
      productSku: product.sku,
      amountCents,
      couponCode: desconto?.code ?? null,
      discountPercent: desconto?.percent ?? null,
      currency: product.currency,
      status: 'pending',
    })
    .returning({ id: orders.id });

  return { orderId: inserted[0]!.id, product, amountCents };
}

export async function attachPayment(input: {
  orderId: string;
  provider: string;
  providerPaymentId: string;
  amountCents: number;
}): Promise<void> {
  await db()
    .insert(payments)
    .values({
      orderId: input.orderId,
      provider: input.provider,
      providerPaymentId: input.providerPaymentId,
      status: 'pending',
      amountCents: input.amountCents,
    })
    .onConflictDoNothing();
}

/**
 * Dados para o recibo, quando há pagamento confirmado e alguém identificado para recebê-lo.
 *
 * Sai daqui, e não de uma segunda consulta na rota, porque o webhook já leu essas linhas para
 * conceder o acesso. Buscar de novo custaria três consultas para reconstruir o que estava em mãos.
 */
export type Receipt = {
  readonly email: string;
  readonly publicId: string;
  readonly productName: string;
  readonly amountCents: number;
};

export type WebhookOutcome =
  | { kind: 'duplicate' }
  | { kind: 'unknown_order' }
  | { kind: 'illegal_transition'; from: PaymentStatus; to: PaymentStatus }
  | { kind: 'processed'; granted: readonly string[]; receipt?: Receipt };

/**
 * Processa um evento de pagamento — docs/MONETIZATION.md §5.
 *
 * ─── IDEMPOTÊNCIA ────────────────────────────────────────────────────────────────────────────
 *
 * Gateways garantem entrega AT-LEAST-ONCE: se não recebem 200 a tempo, reenviam. Sem proteção, um
 * reenvio concederia o entitlement duas vezes e poluiria o histórico.
 *
 * A proteção é o índice único em (provider, provider_event_id) com `ON CONFLICT DO NOTHING
 * RETURNING id`: a segunda entrega não devolve linha e o processamento para imediatamente. É o
 * BANCO garantindo, não um `if` no código — dois webhooks simultâneos, em duas invocações
 * serverless diferentes, passariam pelo `if` ao mesmo tempo, mas só um vence a constraint.
 *
 * A concessão do entitlement tem a mesma proteção em segundo nível, pelo índice único de
 * (session_id, recommendation_session_id, entitlement).
 */
export async function processPaymentEvent(
  provider: string,
  event: PaymentEvent,
): Promise<WebhookOutcome> {
  const conn = db();

  const claimed = await conn
    .insert(paymentEvents)
    .values({
      provider,
      providerEventId: event.providerEventId,
      eventType: event.eventType,
      payload: event.raw as object,
    })
    .onConflictDoNothing()
    .returning({ id: paymentEvents.id });

  /**
   * ═══ RESERVA NÃO É CONCLUSÃO — O DEFEITO DE 21/09/2026 ═════════════════════════════════════
   *
   * A linha acima RESERVA o evento; `processed_at` só é gravado lá embaixo, depois de conceder. Se
   * qualquer coisa falhar no meio — banco oscilando, timeout, a função serverless sendo encerrada —
   * a reserva fica, o trabalho não acontece, e TODA tentativa seguinte bate na restrição única e
   * devolve "duplicate".
   *
   * O pagamento vira irrecuperável. Não pelo webhook, que reenvia e recebe "duplicate"; não pela
   * recuperação manual, que recebe a mesma coisa. O dinheiro entrou, o cliente não recebeu nada, e
   * o sistema inteiro responde "isso já foi processado".
   *
   * Foi o que aconteceu com o pagamento 179878109696: o cliente reclamou, o botão de recuperar
   * respondeu "já tinha sido processado", e a venda continuou sem existir.
   *
   * `processed_at` nulo é a assinatura exata desse estado, e é o que distingue a reserva abandonada
   * da entrega concluída. Reserva abandonada é retomada; entrega concluída é `duplicate` de verdade.
   *
   * ─── POR QUE REFAZER É SEGURO ────────────────────────────────────────────────────────────
   *
   * Tudo daqui para baixo absorve repetição: a atualização do pedido é idempotente, o marco do
   * funil tem `unique(visitor_hash, marker)`, e os entitlements entram com `onConflictDoNothing`.
   * A única exceção é o cupom — ver `reprocessando` abaixo.
   */
  let reservaId = claimed[0]?.id ?? null;
  let reprocessando = false;

  if (reservaId === null) {
    const anterior = await conn
      .select({ id: paymentEvents.id, processedAt: paymentEvents.processedAt })
      .from(paymentEvents)
      .where(
        and(
          eq(paymentEvents.provider, provider),
          eq(paymentEvents.providerEventId, event.providerEventId),
        ),
      )
      .limit(1);

    const linha = anterior[0];
    if (!linha || linha.processedAt !== null) return { kind: 'duplicate' };

    console.warn(
      `[pagamento] reserva abandonada em ${event.providerEventId} — retomando o processamento`,
    );
    reservaId = linha.id;
    reprocessando = true;
  }

  /*
    `const` depois do estreitamento: o `let` acima admite `null`, e o TypeScript não consegue
    carregar essa garantia para dentro do fecho abaixo. Uma cópia imutável resolve sem asserção.
  */
  const claimId: string = reservaId;

  /*
    ═══ A RESERVA É DESFEITA SE O TRABALHO FALHAR ═════════════════════════════════════════════

    Sem isto, cada falha no meio deixa para trás uma reserva que bloqueia o pagamento para sempre —
    que é exatamente o defeito acima, criando novos casos enquanto a retomada limpa os antigos.

    Não é transação porque duas etapas (marco do funil e cupom) usam conexão própria, e enfiá-las
    numa transação daqui seria um refactor de três módulos no meio de um incidente. Desfazer a
    reserva fecha o mesmo buraco: o gateway reenvia, ou o botão de recuperar reprocessa, e desta vez
    a reserva está livre.
  */
  try {
    return await concluirEvento();
  } catch (erro) {
    if (!reprocessando) {
      await conn.delete(paymentEvents).where(eq(paymentEvents.id, claimId));
    }
    console.error(`[pagamento] falha ao processar ${event.providerEventId}; reserva liberada`, erro);
    throw erro;
  }

  async function concluirEvento(): Promise<WebhookOutcome> {
  const orderRows = await conn
    .select({
      id: orders.id,
      status: orders.status,
      sessionId: orders.sessionId,
      recommendationSessionId: orders.recommendationSessionId,
      sku: orders.productSku,
      amountCents: orders.amountCents,
      couponCode: orders.couponCode,
      // `left join`: pedido sem e-mail é normal e não pode sumir da consulta que concede o acesso.
      email: users.email,
      publicId: recommendationSessions.publicId,
      /** A sessão que criou a ANÁLISE — a identidade do funil. Ver o marco `paid` abaixo. */
      donoDaAnalise: recommendationSessions.sessionId,
    })
    .from(orders)
    .leftJoin(users, eq(users.id, orders.userId))
    .leftJoin(
      recommendationSessions,
      eq(recommendationSessions.id, orders.recommendationSessionId),
    )
    .where(eq(orders.id, event.orderId))
    .limit(1);

  const order = orderRows[0];
  if (!order) return { kind: 'unknown_order' };

  const from = order.status as PaymentStatus;
  if (!canTransition(from, event.status)) {
    return { kind: 'illegal_transition', from, to: event.status };
  }

  await conn
    .update(orders)
    .set({
      status: event.status,
      paidAt: event.status === 'paid' ? new Date() : null,
    })
    .where(eq(orders.id, order.id));

  await conn
    .update(payments)
    .set({ status: event.status, method: event.method, raw: event.raw as object })
    .where(eq(payments.providerPaymentId, event.providerPaymentId));

  // Só pagamento CONFIRMADO concede acesso (§33). `pending` de PIX não libera nada.
  if (event.status !== 'paid') {
    await conn
      .update(paymentEvents)
      .set({ processedAt: new Date() })
      .where(eq(paymentEvents.id, claimId));
    return { kind: 'processed', granted: [] };
  }

  /*
    ═══ O MARCO É DA ANÁLISE, NÃO DO PEDIDO ═══════════════════════════════════════════════════

    Aqui ia `order.sessionId` — a sessão anônima do navegador que fez ESTE pedido. Um comprador é
    contado uma vez enquanto compra tudo no mesmo aparelho, porque `unique(visitor_hash, marker)`
    absorve o segundo marco. Ele vira dois no dia em que compra o pacote simples no computador e o
    upgrade pelo celular: dois cookies, duas sessões, dois hashes, dois "Pagou".

    O comprador é a pessoa, e a pessoa aqui é quem respondeu o questionário — uma só, por análise,
    em qualquer aparelho. `donoDaAnalise` é essa sessão.

    O `??` cobre o pedido sem `recommendation_session_id`, que o esquema permite. Nesse caso a
    sessão do pedido é a melhor identidade que existe, e é melhor contar por ela do que perder o
    marco: um `paid` faltando esconderia uma venda no painel, que é pior que contar uma a mais.
  */
  await markFunnelBySessionId(order.donoDaAnalise ?? order.sessionId, 'paid');

  /*
    ═══ O CUPOM DE DESCONTO É CONSUMIDO AQUI, E EM NENHUM OUTRO LUGAR ═════════════════════════

    "Este cupom foi usado" só vira verdade quando o dinheiro entra. Consumir quando a pessoa digita
    faria um checkout abandonado gastar o uso de outra — e abandonar checkout é o comportamento mais
    comum de todos.

    Falhar aqui não pode doer: `consumirCupomDoPedido` nunca lança e nunca revoga nada. Se o último
    uso tiver sido levado por outra pessoa entre o checkout e a confirmação, quem pagou já pagou o
    valor com desconto — e cobrar a diferença por causa de uma corrida de milissegundos seria punir
    o cliente por um problema nosso. O pedido guarda o código e o percentual, então o caso fica
    registrado.

    Vem ANTES da concessão de propósito: a concessão é o que a pessoa comprou, e nada relacionado a
    contabilidade de cupom pode se interpor entre o pagamento e o acesso.
  */
  /*
    ⚠️ PULADO NA RETOMADA. `consumirCupomDoPedido` incrementa `used_count` sem trava de repetição,
    então refazer uma reserva abandonada gastaria um uso duas vezes — e num cupom com limite isso
    tira a vaga de outra pessoa.

    Entre contar de menos e cobrar de mais de um estranho, o erro barato é o primeiro: o pedido já
    guarda o código e o percentual aplicados, então o caso continua auditável, e o que a retomada
    existe para entregar é o produto que alguém pagou — não a contabilidade do cupom.
  */
  if (!reprocessando && order.couponCode && order.recommendationSessionId) {
    await consumirCupomDoPedido({
      code: order.couponCode,
      sessionId: order.sessionId,
      recommendationSessionId: order.recommendationSessionId,
    });
  }

  const grants = PRODUCT_ENTITLEMENTS[order.sku] ?? [];
  if (grants.length > 0) {
    await conn
      .insert(entitlements)
      .values(
        grants.map((entitlement) => ({
          sessionId: order.sessionId,
          recommendationSessionId: order.recommendationSessionId,
          entitlement,
          grantedByOrderId: order.id,
        })),
      )
      .onConflictDoNothing();
  }

  await conn
    .update(paymentEvents)
    .set({ processedAt: new Date() })
    .where(eq(paymentEvents.id, claimId));

  /*
    O recibo só existe quando há e-mail E análise. Falta de e-mail é o caso normal de quem comprou
    antes de o cadastro existir, e não pode virar erro nem impedir a concessão — o acesso já foi
    dado acima, e é ele que a pessoa comprou.
  */
  const receipt: Receipt | undefined =
    order.email && order.publicId
      ? {
          email: order.email,
          publicId: order.publicId,
          productName: PRODUCT_SEED.find((p) => p.sku === order.sku)?.name ?? order.sku,
          amountCents: order.amountCents,
        }
      : undefined;

  return { kind: 'processed', granted: grants, receipt };
  }
}

/** Revoga os entitlements de um pedido reembolsado (§7 do MONETIZATION). */
/**
 * Quanto foi pago por esta análise, em reais — para o evento de compra do pixel.
 *
 * ═══ POR QUE O VALOR REAL, E NÃO O TICKET MÉDIO ══════════════════════════════════════════════
 *
 * O Meta calcula retorno sobre o número que recebe. Mandar R$ 48 (a média) em toda compra faria o
 * painel dele exibir um retorno que não existe em pedido nenhum: quem comprou o relatório simples
 * apareceria valendo mais do que pagou, e quem comprou o setup completo, menos.
 *
 * Pior que impreciso, seria autoconfirmatório — a decisão de escalar sairia de uma média que a
 * própria campanha não teria como mover.
 *
 * ═══ SOMA, PORQUE UMA ANÁLISE PODE TER MAIS DE UM PEDIDO ═════════════════════════════════════
 *
 * Existem upsells (desbloquear 2ª, 3ª, completar com corda e tensão). Quem compra o relatório e
 * depois o upgrade fez dois pedidos pagos para a mesma análise. O valor da conversão é o total, e
 * não o do primeiro.
 */
export async function valorPagoEmReais(publicId: string): Promise<number | null> {
  if (!isDatabaseConfigured()) return null;

  const rows = await db()
    .select({ amountCents: orders.amountCents })
    .from(orders)
    .innerJoin(recommendationSessions, eq(recommendationSessions.id, orders.recommendationSessionId))
    .where(and(eq(recommendationSessions.publicId, publicId), eq(orders.status, 'paid')));

  if (rows.length === 0) return null;

  const centavos = rows.reduce((total, r) => total + r.amountCents, 0);
  return Number((centavos / 100).toFixed(2));
}

export async function revokeForOrder(orderId: string): Promise<void> {
  await db()
    .update(entitlements)
    .set({ revokedAt: new Date() })
    .where(and(eq(entitlements.grantedByOrderId, orderId), sql`${entitlements.revokedAt} IS NULL`));
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 * VENDAS — a lista que `/admin/vendas` mostra.
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * ═══ POR QUE ELA NÃO EXISTIA, E POR QUE PASSA A EXISTIR ══════════════════════════════════════
 *
 * `/admin/analises` recusa listar de propósito, e o comentário de lá explica: uma busca exata é
 * ferramenta de atendimento, uma lista é janela para folhear os dados de todos os clientes, e a
 * diferença entre as duas é uma linha de código. Aquela recusa continua valendo PARA AQUELA TELA.
 *
 * Esta função existe porque a pergunta é outra. "Quem perdeu o link?" é atendimento e se responde
 * com busca. "Como estão as vendas?" é gestão, não tem termo de busca possível, e o dono não pode
 * depender de abrir o Postgres para saber quanto vendeu.
 *
 * A separação em duas telas não é organização: é o que impede que a conveniência da gestão relaxe
 * a regra do atendimento sem ninguém decidir isso.
 */
export const LANCAMENTO = new Date('2026-09-03T18:00:00-03:00');

export type Venda = {
  readonly orderId: string;
  readonly paidAt: Date;
  readonly email: string | null;
  readonly sku: string;
  readonly amountCents: number;
  readonly couponCode: string | null;
  /** `null` no pedido sem análise ligada — o esquema permite. Sem ele não há relatório a abrir. */
  readonly publicId: string | null;
  /**
   * De onde essa pessoa veio, quando deu para saber — ver `origemDaVenda` abaixo.
   *
   * `null` significa "chegou sem link marcado", e não "não sei se veio de algum lugar": a origem
   * só existe se alguém a escreveu no link. É a MESMA ausência que a linha "sem marcação" da tela
   * de funil conta, vista pedido a pedido.
   */
  readonly origem: {
    readonly source: string;
    readonly campaign: string | null;
    readonly content: string | null;
  } | null;
};

export type Vendas = {
  readonly desde: Date;
  readonly itens: readonly Venda[];
  /**
   * Quantos pedidos pagos ficaram DE FORA do corte.
   *
   * Uma lista filtrada que não diz o que escondeu mente por omissão: o dono somaria a coluna,
   * compararia com o extrato do Mercado Pago, veria a diferença e não teria como saber se falta
   * dinheiro ou se falta linha. Este número responde isso sem precisar de investigação.
   */
  readonly anterioresAoCorte: number;
};

/**
 * As vendas a partir de `desde`, da mais recente para a mais antiga.
 *
 * ─── POR QUE O CORTE, E POR QUE ELE É UMA DATA E NÃO UM "ÚLTIMOS N DIAS" ─────────────────────
 *
 * Tudo que foi pago antes do lançamento é o próprio dono testando — compras reais, com dinheiro
 * real, e nenhuma delas é cliente. Misturá-las à lista não infla só a contagem: infla a receita, e
 * uma receita inflada é o número que faz decidir errado sobre preço e sobre anúncio.
 *
 * "Últimos 30 dias" resolveria hoje e voltaria a errar em outubro, quando os testes saírem da
 * janela sozinhos. O lançamento é um instante fixo no passado, então a constante é a forma
 * honesta — e fica visível na tela, com a contagem do que ficou de fora ao lado.
 *
 * ─── STATUS `paid`, E NÃO "TEM ENTITLEMENT" ──────────────────────────────────────────────────
 *
 * Acesso concedido por cupom não é venda. Se esta lista contasse entitlement, o cupom MAITE
 * apareceria como receita de R$ 0,00 e o dono veria clientes onde tem convidados. O cupom tem
 * contador próprio em `/admin/codigos`.
 */
/**
 * Quantos PEDIDOS pagos existem na janela. Não é o mesmo número do funil, e a diferença importa.
 *
 * ═══ O DEFEITO QUE ISTO CONSERTA (12/09/2026) ════════════════════════════════════════════════
 *
 * O dono abriu o `/admin/funil` com o filtro "Hoje", leu **5** em "Pagou", abriu a lista de vendas
 * e contou **7**. Perguntou qual estava errada. Nenhuma: elas contam coisas diferentes, e a tela
 * não dizia isso em lugar nenhum.
 *
 * `funnel_markers` tem restrição única em (visitante, marco). Um visitante só pode ter UM marco
 * `paid` na vida. Então o funil conta **pessoas que pagaram pela primeira vez** dentro da janela —
 * e some inteiramente com:
 *
 *   - quem já tinha comprado antes e comprou de novo hoje (o marco é de outro dia);
 *   - quem comprou duas vezes hoje (um marco, dois pedidos);
 *   - o upsell, que é pedido novo do mesmo dono de análise.
 *
 * ─── POR QUE ISSO ERA CARO, E NÃO SÓ CONFUSO ─────────────────────────────────────────────────
 *
 * `docs/COMO_SUBIR_A_CAMPANHA.md` mandava, por escrito, calcular o CAC com as compras do funil,
 * chamando-o de "o registro completo". Ele não é: o registro completo de venda é `orders`. Dividir
 * o gasto do dia por um número de vendas MENOR que o real infla o CAC — e CAC inflado é
 * exatamente o sinal que manda reduzir orçamento numa campanha que está indo bem.
 *
 * O funil continua certo para o que ele existe: medir CONVERSÃO de pessoas ao longo das etapas.
 * Contar a mesma pessoa duas vezes ali é que estragaria a taxa. As duas contas são necessárias, e
 * agora as duas aparecem na tela, com o nome do que cada uma mede.
 */
export async function contarVendas(janela: Janela = SEM_LIMITE): Promise<number> {
  if (!isDatabaseConfigured()) return 0;

  /*
    A janela corta por `paid_at`, o instante do pagamento — e não por `created_at` do pedido.

    Um pedido criado às 23h50 e pago às 00h05 pertence ao dia do PAGAMENTO, que é o dia em que o
    dinheiro entrou e o mesmo critério do funil (`paid` é gravado quando o webhook confirma).
  */
  const filtros = recorte(orders.paidAt, janela);

  try {
    const rows = await db()
      .select({ n: sql<number>`count(*)::int` })
      .from(orders)
      .where(and(eq(orders.status, 'paid'), ...filtros));

    return Number(rows[0]?.n ?? 0);
  } catch (error) {
    console.error('[vendas] não foi possível contar os pedidos pagos', error);
    return 0;
  }
}

/**
 * Quantas PESSOAS DISTINTAS estão por trás dos pedidos pagos da janela.
 *
 * ═══ POR QUE ESTE TERCEIRO NÚMERO PRECISOU EXISTIR (12/09/2026) ══════════════════════════════
 *
 * O funil mostrou **5** e a lista **7**, e o extrato do Mercado Pago confirmou que **7 é o real**.
 * Restava a pergunta que decide se há bug: os 7 pedidos são de 7 pessoas ou de 5?
 *
 *   - **5 pessoas** → o funil está certo no que ele mede. Duas pessoas fizeram dois pedidos
 *     (upsell, ou segunda análise), e o marco `paid` é único por visitante de propósito. O
 *     problema é só de rótulo.
 *   - **7 pessoas** → o funil PERDEU dois marcos. Aí é defeito, e o suspeito está em
 *     `markFunnelBySessionId`: quando a sessão anônima não é encontrada, ele desiste em silêncio.
 *
 * Eu tinha respondido isso por dedução, sem dado, e errei o motivo. Este número existe para que a
 * próxima vez que os dois divergirem a resposta esteja na tela, e não numa hipótese minha.
 *
 * ─── POR QUE `coalesce`, E NA MESMA ORDEM DO MARCO ───────────────────────────────────────────
 *
 * A comparação só vale se contar a MESMA chave que o funil usa. `processPaymentEvent` marca por
 * `donoDaAnalise ?? sessionId`, onde `donoDaAnalise` é a sessão dona da análise — a pessoa pode
 * ter comprado de outro aparelho. Contar por `orders.session_id` puro daria um número maior e
 * inventaria uma divergência que não existe.
 */
export async function contarCompradoresDistintos(janela: Janela = SEM_LIMITE): Promise<number> {
  if (!isDatabaseConfigured()) return 0;

  const filtros = recorte(orders.paidAt, janela);

  try {
    const rows = await db()
      .select({
        n: sql<number>`count(distinct coalesce(${recommendationSessions.sessionId}, ${orders.sessionId}))::int`,
      })
      .from(orders)
      .leftJoin(
        recommendationSessions,
        eq(recommendationSessions.id, orders.recommendationSessionId),
      )
      .where(and(eq(orders.status, 'paid'), ...filtros));

    return Number(rows[0]?.n ?? 0);
  } catch (error) {
    console.error('[vendas] não foi possível contar os compradores distintos', error);
    return 0;
  }
}

/**
 * A receita paga da janela, em centavos — TODAS as origens.
 *
 * ═══ POR QUE ELA PRECISOU EXISTIR (17/09/2026) ═══════════════════════════════════════════════
 *
 * O dono pediu o lucro do dia e apontou o furo: *"só estou te passando as informações das chegadas
 * via meta"*. A tabela "De onde vieram" tem receita POR ORIGEM, e era a única receita que o painel
 * sabia somar. Só que o gasto é de um canal e a receita vem de vários — lucro do dia calculado com
 * a receita de uma origem só subestima, e subestima justamente o número que decide escalar.
 *
 * O caso real: em 15/09 o fluxo Meta fez R$ 429,91 e o total foi R$ 529,89. Os R$ 99,98 de
 * diferença vieram do link da bio. Ler só a origem paga jogaria fora 19% do resultado do dia.
 *
 * Corta por `paid_at`, igual `contarVendas` — o dia do dinheiro, não o dia do pedido.
 */
export async function somarReceita(janela: Janela = SEM_LIMITE): Promise<number> {
  if (!isDatabaseConfigured()) return 0;

  try {
    const rows = await db()
      .select({ total: sql<number>`coalesce(sum(${orders.amountCents}), 0)::bigint` })
      .from(orders)
      .where(and(eq(orders.status, 'paid'), ...recorte(orders.paidAt, janela)));

    /*
      `::bigint` e `Number(...)` e não `::int`: a soma de centavos estoura o int de 32 bits em
      R$ 21.474.836,47. Está longe, mas um overflow silencioso num número que decide orçamento é
      caro o suficiente para não valer a economia de um cast.
    */
    return Number(rows[0]?.total ?? 0);
  } catch (error) {
    console.error('[vendas] não foi possível somar a receita', error);
    return 0;
  }
}

export async function vendasDesde(desde: Date = LANCAMENTO): Promise<Vendas> {
  const conn = db();

  const itens = await conn
    .select({
      orderId: orders.id,
      paidAt: orders.paidAt,
      email: users.email,
      sku: orders.productSku,
      amountCents: orders.amountCents,
      couponCode: orders.couponCode,
      publicId: recommendationSessions.publicId,
      origemSource: visitorCampaigns.source,
      origemCampaign: visitorCampaigns.campaign,
      origemContent: visitorCampaigns.content,
    })
    .from(orders)
    // `left join` nos dois: pedido sem e-mail e pedido sem análise são casos reais e não podem
    // sumir da lista — some justamente o pedido estranho, que é o que mais interessa ver.
    .leftJoin(users, eq(users.id, orders.userId))
    .leftJoin(recommendationSessions, eq(recommendationSessions.id, orders.recommendationSessionId))
    /*
      ═══ A ORIGEM DE CADA VENDA — A CORRENTE, E POR QUE ELA TEM TRÊS ELOS ══════════════════════

      O pedido guarda a SESSÃO do navegador; a campanha guarda o HASH do cookie. `anonymous_sessions`
      liga os dois. É a mesma corrente de `dinheiroPorOrigem`, e o dono do pedido é
      `coalesce(sessão da análise, sessão do pedido)` — a mesma ordem de `processPaymentEvent`,
      porque a pessoa pode ter comprado de outro aparelho e a identidade que vale é a de quem
      respondeu o questionário.

      ─── POR QUE UM `leftJoin` SIMPLES BASTA ──────────────────────────────────────────────────

      `visitor_campaigns` tem `unique(visitor_hash)`: primeiro toque vence e o visitante carrega UMA
      origem para sempre (ver o cabeçalho de `schema/campaigns.ts`). Não há último toque a escolher
      nem linha duplicada a desempatar — cada pedido casa com no máximo uma origem, e o join não
      multiplica a lista.

      ─── E POR QUE A TRAVA DE TEMPO CONTINUA NECESSÁRIA ───────────────────────────────────────

      `gte(paidAt, campanha.createdAt)` impede creditar ao anúncio uma compra ANTERIOR ao clique.
      O caso real é o cliente que já comprou, vê o anúncio depois e clica: sem a trava, a compra
      velha dele viraria receita do criativo — e o número vem bonito, que é o pior jeito de estar
      errado. É a mesma trava de `campaignReport`, pelo mesmo motivo.
    */
    .leftJoin(
      anonymousSessions,
      eq(
        anonymousSessions.id,
        sql`coalesce(${recommendationSessions.sessionId}, ${orders.sessionId})`,
      ),
    )
    .leftJoin(
      visitorCampaigns,
      and(
        eq(visitorCampaigns.visitorHash, anonymousSessions.cookieTokenHash),
        gte(orders.paidAt, visitorCampaigns.createdAt),
      ),
    )
    /*
      `gte`/`desc` e NÃO um template `sql` cru.

      As duas formas geram o mesmo SQL e mandam parâmetros diferentes: o operador tipado aplica o
      `mapToDriverValue` da coluna e envia a data como string ISO, que é o que o driver espera de
      um `timestamptz`; o template cru pula esse mapeamento e entrega um objeto `Date` solto.

      A primeira versão desta tela usava o template e quebrou em produção com "server-side
      exception" — sem sintoma nenhum no build, no typecheck ou nos testes, porque nada disso
      chega a executar a consulta. Todas as outras comparações de data do projeto
      (`funnel-repo`, `coupon-repo`) já usavam o operador tipado; esta era a única exceção, e foi
      a única que falhou.
    */
    .where(and(eq(orders.status, 'paid'), gte(orders.paidAt, desde)))
    .orderBy(desc(orders.paidAt));

  const fora = await conn
    .select({ n: sql<number>`count(*)::int` })
    .from(orders)
    .where(and(eq(orders.status, 'paid'), lt(orders.paidAt, desde)));

  return {
    desde,
    // `paidAt` é não-nulo por construção em pedido `paid` — o webhook grava os dois juntos —, mas o
    // TIPO permite nulo, e o filtro já garantiu a condição. O descarte mantém o tipo honesto.
    itens: itens
      .filter((v) => v.paidAt !== null)
      .map(
        ({ origemSource, origemCampaign, origemContent, ...resto }): Venda => ({
          ...(resto as Omit<Venda, 'origem'>),
          /*
            `source` é `notNull` no esquema, então a ausência dele é a ausência da LINHA inteira —
            o pedido de quem chegou sem link marcado. Montar o objeto só quando ele existe mantém
            a distinção visível no tipo, em vez de virar três campos nulos soltos.
          */
          origem:
            origemSource === null
              ? null
              : { source: origemSource, campaign: origemCampaign, content: origemContent },
        }),
      ),
    anterioresAoCorte: fora[0]?.n ?? 0,
  };
}

export type SituacaoDoPedido = {
  readonly id: string;
  readonly status: string;
  readonly amountCents: number;
  readonly email: string | null;
};

/**
 * A situação, do NOSSO lado, de uma lista de pedidos que o gateway diz estarem pagos.
 *
 * ═══ POR QUE ISTO EXISTE ═════════════════════════════════════════════════════════════════════
 *
 * Em 19/09/2026 um cliente pagou, recebeu comprovante, e nada aconteceu aqui — a notificação do
 * Mercado Pago se perdeu no caminho. Ele reclamou, e foi assim que se descobriu.
 *
 * A pergunta seguinte é a que importa: **e os que não reclamaram?** Uma venda perdida é invisível
 * por construção — não existe pedido, não existe linha em lugar nenhum, e o sintoma é a ausência
 * de alguma coisa que ninguém sabe que deveria existir. Do lado de cá é indistinguível de um
 * checkout abandonado.
 *
 * A única saída é perguntar a quem sabe. O gateway tem a lista do que foi aprovado; esta função
 * responde o outro lado da conta — o que, dessa lista, chegou até aqui.
 *
 * Devolve só o que EXISTE. Pedido ausente é o caso mais grave e aparece pela ausência: quem
 * comparar a lista do gateway com esta descobre os dois tipos de falha de uma vez — o pedido que
 * ficou pendente e o pedido que nunca foi criado.
 */
export async function situacaoDosPedidos(
  ids: readonly string[],
): Promise<readonly SituacaoDoPedido[]> {
  if (!isDatabaseConfigured() || ids.length === 0) return [];

  const rows = await db()
    .select({
      id: orders.id,
      status: orders.status,
      amountCents: orders.amountCents,
      email: users.email,
    })
    .from(orders)
    .leftJoin(users, eq(users.id, orders.userId))
    .where(inArray(orders.id, [...ids]));

  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    amountCents: r.amountCents,
    email: r.email,
  }));
}

export type ComprasDeTeste = {
  readonly pedidos: number;
  readonly receitaCentavos: number;
};

/**
 * Quanto das vendas de uma janela é compra de TESTE do dono, anterior ao lançamento.
 *
 * ═══ A DÚVIDA QUE ISTO RESPONDE NA TELA, EM VEZ DE NA CONVERSA (23/09/2026) ══════════════════
 *
 * O dono comparou as duas telas no mesmo minuto e não fechou:
 *
 *   Funil (30 dias)   284 vendas   R$ 13.502,16
 *   Vendas            274 pedidos  R$ 13.072,26
 *
 * A diferença — 10 pedidos, R$ 429,90 — são as compras de teste que ele mesmo fez antes de
 * 03/09 às 18h. `/admin/vendas` corta no lançamento e explica isso num rodapé; o Funil corta pelo
 * seletor de período, e "30 dias" alcança o pré-lançamento.
 *
 * ⚠️ **E a legenda do Funil dizia "o mesmo corte de Vendas", o que é falso.** É o mesmo RELÓGIO —
 * data do pagamento — e não a mesma JANELA. A frase era minha, e foi ela que transformou uma
 * diferença explicável numa suspeita de defeito.
 *
 * Nenhum dos dois números estava errado. O que faltava era a subtração escrita na tela — o mesmo
 * problema da linha "sem marcação", e a mesma correção.
 */
export async function comprasDeTesteNaJanela(janela: Janela = SEM_LIMITE): Promise<ComprasDeTeste> {
  const vazio: ComprasDeTeste = { pedidos: 0, receitaCentavos: 0 };
  if (!isDatabaseConfigured()) return vazio;

  try {
    const rows = await db()
      .select({
        pedidos: sql<number>`count(*)::int`,
        centavos: sql<number>`coalesce(sum(${orders.amountCents}), 0)::bigint`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.status, 'paid'),
          /* O mesmo corte de `vendasDesde`, do outro lado: o que ELA deixa de fora. */
          lt(orders.paidAt, LANCAMENTO),
          ...recorte(orders.paidAt, janela),
        ),
      );

    const r = rows[0];
    return {
      pedidos: Number(r?.pedidos ?? 0),
      receitaCentavos: Number(r?.centavos ?? 0),
    };
  } catch (error) {
    console.error('[vendas] não foi possível contar as compras anteriores ao lançamento', error);
    return vazio;
  }
}
