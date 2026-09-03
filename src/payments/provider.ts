/**
 * Abstração de gateway de pagamento — docs/MONETIZATION.md §5.
 *
 * Nenhuma regra de negócio importa um gateway diretamente. Trocar de provedor é escrever um adapter
 * e mudar `PAYMENT_PROVIDER` no ambiente — nada em `/planos`, no webhook ou nos entitlements muda.
 */

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'cancelled';

export type CreateCheckoutInput = {
  readonly orderId: string;
  readonly sku: string;
  readonly productName: string;
  readonly amountCents: number;
  readonly currency: string;
  /** Para onde o gateway devolve o usuário depois de pagar, ou com o pagamento em análise. */
  readonly returnUrl: string;
  /**
   * Para onde devolver quando o pagamento foi RECUSADO.
   *
   * Separado de `returnUrl` porque as duas telas dizem coisas opostas, e usar a mesma para os dois
   * casos garante que uma delas minta. O retorno de sucesso diz "pagamento recebido, estamos
   * liberando" — é a última frase que alguém com o cartão recusado deveria ler, e ela transformaria
   * uma recusa banal (limite, banco) numa reclamação de dinheiro sumido.
   *
   * A recusa volta para os planos, onde a pessoa pode tentar de novo por outro meio.
   */
  readonly failureUrl: string;
  /**
   * Para onde o gateway envia a confirmação, servidor a servidor.
   *
   * Separado de `returnUrl` porque são coisas diferentes: o retorno é o navegador do cliente
   * voltando, e ele pode nunca acontecer — a pessoa fecha a aba, o PIX cai vinte minutos depois,
   * o celular desliga. A confirmação que concede acesso é SEMPRE esta, e ela chega mesmo que o
   * cliente desapareça (§33).
   *
   * O adapter simulado ignora este campo: a tela local de checkout já sabe para onde postar.
   */
  readonly notificationUrl: string;
  /**
   * O e-mail de quem está comprando — identidade do pagador para o gateway.
   *
   * ═══ POR QUE ISTO EXISTE, E POR QUE NÃO É DETALHE ═══════════════════════════════════════════
   *
   * O checkout já pedia e validava o e-mail: ele cria a conta, manda o link do relatório e alimenta
   * /minhas-analises. Só que ele parava aqui — a preferência ia ao gateway SEM pagador nenhum, e
   * toda compra chegava lá como um desconhecido.
   *
   * O sintoma apareceu num teste real do dono: pagou o relatório, e minutos depois a compra do
   * upgrade foi recusada com o mesmo cartão que acabara de passar.
   *
   * Sem `payer`, o antifraude do gateway não tem como ligar a segunda transação à primeira. Duas
   * compras do mesmo cartão em poucos minutos, valores diferentes, vendedor novo, comprador anônimo
   * das duas vezes — é o desenho de uma regra de velocidade, e o antifraude reage à segunda. Com o
   * pagador identificado, as duas transações passam a ser da MESMA pessoa, que é o que de fato são.
   *
   * `null` só quando o fluxo não tem e-mail. O checkout sempre tem; o adapter simulado ignora.
   */
  readonly payerEmail: string | null;
  /** Nome do jogador, quando informado no questionário. Junto do e-mail, melhora a identificação. */
  readonly payerName: string | null;
};

export type CheckoutSession = {
  readonly providerPaymentId: string;
  /** URL do checkout hospedado pelo gateway. */
  readonly redirectUrl: string;
};

/**
 * O que uma notificação recebida é — e por que três casos, e não dois.
 *
 * ═══ O DEFEITO QUE ISTO CONSERTA ═════════════════════════════════════════════════════════════
 *
 * `parseWebhook` devolvia `PaymentEvent | null`, e a rota traduzia todo `null` para `400`. Isso
 * junta duas coisas opostas: "esta notificação não é para mim" e "esta notificação é inválida".
 *
 * O Mercado Pago manda `merchant_order` junto de cada pagamento — é o comportamento normal dele,
 * não um erro. Ignorá-la é certo; responder `400` a ela não é. Para o gateway, resposta fora da
 * faixa 2xx significa "falhei, tente de novo": ele reenfileira, reenvia, marca a entrega como
 * falha e, se persistir, desativa a notificação. Foi o que produziu `0% de notificações entregues`
 * no painel — com o webhook funcionando.
 *
 * Pior: o painel mostrava `400` em tudo, e a leitura óbvia disso é "minha assinatura está errada".
 * A investigação inteira foi por esse caminho por causa de um código de status mal escolhido.
 *
 * `ignored` responde 200 — recebi, decidi, não me mande de novo. `invalid` responde 400, e aí o
 * alarme é verdadeiro.
 */
export type WebhookOutcome =
  | { readonly kind: 'event'; readonly event: PaymentEvent }
  | { readonly kind: 'ignored'; readonly reason: string }
  | { readonly kind: 'invalid'; readonly reason: string };

export type PaymentEvent = {
  readonly providerEventId: string;
  readonly eventType: string;
  readonly providerPaymentId: string;
  readonly orderId: string;
  readonly status: PaymentStatus;
  readonly method: string | null;
  readonly raw: unknown;
};

export interface PaymentProvider {
  readonly id: string;
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>;
  /** Valida a assinatura e devolve o evento. `null` = assinatura inválida ou payload desconhecido. */
  parseWebhook(request: Request): Promise<WebhookOutcome>;
  getPaymentStatus(providerPaymentId: string): Promise<PaymentStatus>;
}

/**
 * Máquina de estados — docs/MONETIZATION.md §5.
 *
 * `paid` é terminal exceto por `refunded`. Um gateway pode reenviar eventos fora de ordem (um
 * `pending` atrasado chegando depois do `paid`), e sem esta trava o pedido voltaria para pendente
 * — revogando na prática o acesso de alguém que já pagou.
 */
const ALLOWED: Record<PaymentStatus, readonly PaymentStatus[]> = {
  pending: ['pending', 'paid', 'failed', 'cancelled'],
  paid: ['paid', 'refunded'],
  failed: ['failed', 'pending'],
  cancelled: ['cancelled'],
  refunded: ['refunded'],
};

export function canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  return ALLOWED[from].includes(to);
}
