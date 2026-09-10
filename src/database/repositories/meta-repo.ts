import 'server-only';
import { eq } from 'drizzle-orm';
import { db, isDatabaseConfigured } from '../client';
import { metaConversionContext } from '../schema/meta';
import { orders } from '../schema/commerce';
import type { ConsentState } from '@/lib/consent';

/**
 * Leitura e gravação do contexto da API de Conversões — ver `schema/meta.ts` para o desenho.
 *
 * As duas funções aqui nunca lançam, pelo mesmo motivo de `markFunnel`: elas ficam no caminho da
 * compra e do webhook, e perder uma linha de medição é muito mais barato que derrubar qualquer um
 * dos dois.
 */

export async function guardarContextoDeCompra(input: {
  orderId: string;
  consent: ConsentState;
  fbc: string | null;
  fbp: string | null;
  sourceUrl: string | null;
}): Promise<void> {
  if (!isDatabaseConfigured()) return;

  try {
    await db()
      .insert(metaConversionContext)
      .values({
        orderId: input.orderId,
        consent: input.consent,
        fbc: input.fbc,
        fbp: input.fbp,
        sourceUrl: input.sourceUrl,
      })
      /*
        O checkout pode ser refeito para o mesmo pedido — a pessoa volta, tenta de novo, o gateway
        devolve. O primeiro contexto vale: é o que estava valendo quando a jornada começou, e é o
        `fbc` mais próximo do clique de verdade.
      */
      .onConflictDoNothing();
  } catch (error) {
    console.error('[capi] não foi possível guardar o contexto do pedido', input.orderId, error);
  }
}

export type ContextoGravado = {
  readonly consent: ConsentState;
  readonly fbc: string | null;
  readonly fbp: string | null;
  readonly sourceUrl: string | null;
  /** Centavos, do próprio pedido — nunca do produto, que pode ter mudado de preço desde então. */
  readonly amountCents: number;
};

/**
 * O contexto de um pedido, com o valor que ele de fato cobrou.
 *
 * O valor vem daqui e não do produto porque `orders.amount_cents` é o instantâneo do que a pessoa
 * pagou, já com cupom aplicado. Mandar o preço de tabela ao Meta inflaria o retorno de toda venda
 * com desconto — e o retorno é o número que decide escalar.
 */
export async function contextoDoPedido(orderId: string): Promise<ContextoGravado | null> {
  if (!isDatabaseConfigured()) return null;

  try {
    const linhas = await db()
      .select({
        consent: metaConversionContext.consent,
        fbc: metaConversionContext.fbc,
        fbp: metaConversionContext.fbp,
        sourceUrl: metaConversionContext.sourceUrl,
        amountCents: orders.amountCents,
      })
      .from(metaConversionContext)
      .innerJoin(orders, eq(orders.id, metaConversionContext.orderId))
      .where(eq(metaConversionContext.orderId, orderId))
      .limit(1);

    const linha = linhas[0];
    if (!linha) return null;

    return {
      consent: linha.consent as ConsentState,
      fbc: linha.fbc,
      fbp: linha.fbp,
      sourceUrl: linha.sourceUrl,
      amountCents: Number(linha.amountCents),
    };
  } catch (error) {
    console.error('[capi] não foi possível ler o contexto do pedido', orderId, error);
    return null;
  }
}
