import 'server-only';
import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { db, isDatabaseConfigured } from '../client';
import { metaConversionContext } from '../schema/meta';
import { orders } from '../schema/commerce';
import { recorte, SEM_LIMITE } from '../recorte';
import type { Janela } from '@/lib/periodo';
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

/**
 * Grava o desfecho do envio ao lado do contexto — ver `schema/meta.ts` para o porquê.
 *
 * Chamada de dentro do webhook, logo depois de `enviarCompra`, e por isso também não lança: já
 * perdemos o envio, perder o webhook junto seria trocar um problema de medição por um de produto.
 */
export async function registrarEnvio(
  orderId: string,
  resultado: { enviado: boolean; motivo?: string },
): Promise<void> {
  if (!isDatabaseConfigured()) return;

  try {
    await db()
      .update(metaConversionContext)
      .set(
        resultado.enviado
          ? { enviadoEm: new Date(), motivoDoEnvio: null }
          : { enviadoEm: null, motivoDoEnvio: resultado.motivo ?? 'desconhecido' },
      )
      .where(eq(metaConversionContext.orderId, orderId));
  } catch (error) {
    console.error('[capi] não foi possível registrar o desfecho do envio', orderId, error);
  }
}

export type EnvioDeCompras = {
  /** Compras que o Meta aceitou. É o número que responde "a API está funcionando?". */
  readonly aceitas: number;
  /** Compras que não foram, agrupadas por motivo e já ordenadas da mais comum para a menos. */
  readonly recusadas: readonly { readonly motivo: string; readonly quantidade: number }[];
  /**
   * Pedidos com contexto e SEM desfecho: nem data de envio, nem motivo.
   *
   * São, quase sempre, checkouts abandonados — a pessoa chegou ao pagamento e não pagou, então o
   * webhook nunca rodou. Aparecem separados porque contá-los como falha faria a taxa de sucesso
   * parecer péssima num sistema saudável.
   */
  readonly semDesfecho: number;
};

/**
 * Quantas compras chegaram ao Meta na janela, e por que as outras não chegaram.
 *
 * ═══ O QUE ESTE NÚMERO RESPONDE, E O QUE NÃO ═════════════════════════════════════════════════
 *
 * Responde: **o nosso lado está mandando?** Uma linha em `aceitas` significa que o Meta respondeu
 * 200 para aquele evento.
 *
 * NÃO responde se o Meta vai ATRIBUIR a compra ao anúncio. Atribuição depende de a pessoa ter
 * clicado num anúncio dentro da janela dele, e disso só o Gerenciador de Anúncios sabe. Confundir
 * os dois é o erro mais fácil de cometer nesta tela: `aceitas` maior que o número do Gerenciador
 * de Anúncios é o estado NORMAL, não um defeito.
 *
 * A janela corta pela data do CONTEXTO — o instante do checkout —, e não pela do envio. É o mesmo
 * corte de "De onde vieram", para que as duas tabelas do painel contem a mesma coisa quando o
 * filtro é o mesmo.
 */
export async function envioDeCompras(janela: Janela = SEM_LIMITE): Promise<EnvioDeCompras> {
  const vazio: EnvioDeCompras = { aceitas: 0, recusadas: [], semDesfecho: 0 };
  if (!isDatabaseConfigured()) return vazio;

  const filtros = recorte(metaConversionContext.createdAt, janela);
  const dentroDaJanela = filtros.length > 0 ? and(...filtros) : undefined;

  try {
    const [aceitas, recusadas, semDesfecho] = await Promise.all([
      db()
        .select({ n: sql<number>`count(*)::int` })
        .from(metaConversionContext)
        .where(and(isNotNull(metaConversionContext.enviadoEm), dentroDaJanela)),

      db()
        .select({
          motivo: metaConversionContext.motivoDoEnvio,
          quantidade: sql<number>`count(*)::int`,
        })
        .from(metaConversionContext)
        .where(and(isNotNull(metaConversionContext.motivoDoEnvio), dentroDaJanela))
        .groupBy(metaConversionContext.motivoDoEnvio),

      db()
        .select({ n: sql<number>`count(*)::int` })
        .from(metaConversionContext)
        .where(
          and(
            isNull(metaConversionContext.enviadoEm),
            isNull(metaConversionContext.motivoDoEnvio),
            dentroDaJanela,
          ),
        ),
    ]);

    return {
      aceitas: Number(aceitas[0]?.n ?? 0),
      recusadas: recusadas
        .map((r) => ({ motivo: r.motivo ?? 'desconhecido', quantidade: Number(r.quantidade) }))
        .sort((a, b) => b.quantidade - a.quantidade),
      semDesfecho: Number(semDesfecho[0]?.n ?? 0),
    };
  } catch (error) {
    console.error('[capi] não foi possível ler o desfecho dos envios', error);
    return vazio;
  }
}
