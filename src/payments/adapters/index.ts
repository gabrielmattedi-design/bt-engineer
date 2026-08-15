import type { PaymentProvider } from '../provider';
import { fakeProvider } from './fake';

/**
 * Seleção do gateway por ambiente — docs/MONETIZATION.md §5.
 *
 * `mercadopago` e `stripe` ainda não têm adapter. O erro abaixo é deliberadamente explícito: é
 * melhor um deploy falhar dizendo exatamente o que falta do que cair silenciosamente no provedor
 * simulado e passar a entregar relatórios pagos de graça.
 */
export function paymentProvider(): PaymentProvider {
  const id = process.env.PAYMENT_PROVIDER ?? 'fake';

  switch (id) {
    case 'fake':
      return fakeProvider;
    case 'mercadopago':
    case 'stripe':
      throw new Error(
        `O adapter "${id}" ainda não foi implementado. Implemente PaymentProvider em ` +
          `src/payments/adapters/${id}.ts e registre-o aqui.`,
      );
    default:
      throw new Error(`PAYMENT_PROVIDER desconhecido: "${id}".`);
  }
}
