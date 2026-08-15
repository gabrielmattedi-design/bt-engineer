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
  /** Para onde o gateway devolve o usuário depois de pagar. */
  readonly returnUrl: string;
};

export type CheckoutSession = {
  readonly providerPaymentId: string;
  /** URL do checkout hospedado pelo gateway. */
  readonly redirectUrl: string;
};

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
  parseWebhook(request: Request): Promise<PaymentEvent | null>;
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
