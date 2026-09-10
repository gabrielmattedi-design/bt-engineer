import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { orders } from './commerce';

/**
 * O contexto que a API de Conversões precisa, capturado enquanto o navegador ainda está presente.
 *
 * ═══ POR QUE ESTA TABELA EXISTE ══════════════════════════════════════════════════════════════
 *
 * Quem confirma o pagamento é o Mercado Pago chamando o nosso servidor. Nesse instante não há
 * navegador, não há cookie, não há nada do comprador além do id do pedido. E é exatamente aí que
 * precisamos mandar a compra para o Meta.
 *
 * Então o que o envio vai precisar é guardado ANTES, no checkout — o último momento em que o
 * navegador da pessoa está do outro lado da linha.
 *
 * ═══ A MEDIÇÃO QUE MOTIVOU ISTO ══════════════════════════════════════════════════════════════
 *
 * Em 10/09/2026 o `/admin/funil` contava **16 compras** vindas da campanha e o Gerenciador de
 * Anúncios mostrava **2**. O pixel do navegador estava enxergando 12,5% das vendas.
 *
 * As causas possíveis eram três e exigem respostas diferentes: recusa de cookie (que a gente
 * respeita), bloqueador de anúncio (que o servidor contorna) e navegador fechado antes de voltar
 * do gateway (idem). A coluna `consent` existe para separar a primeira das outras duas — sem ela,
 * o buraco continua sendo um número sem explicação.
 *
 * ═══ POR QUE POR PEDIDO, E NÃO POR VISITANTE ═════════════════════════════════════════════════
 *
 * O webhook tem o id do PEDIDO na mão. Chavear por pedido dispensa junção, e — o que importa mais
 * — congela o estado no instante daquela compra. Alguém que aceita cookie hoje e recusa amanhã tem
 * duas compras com contextos diferentes, e cada uma precisa ser tratada como estava quando
 * aconteceu.
 *
 * ═══ O QUE NÃO ENTRA AQUI, E É DECISÃO ═══════════════════════════════════════════════════════
 *
 * **IP e user-agent não são guardados**, mesmo sendo aceitos pela API do Meta e mesmo melhorando a
 * correspondência. `schema/campaigns.ts` diz por escrito que esta medição não guarda IP nem
 * impressão digital, e a API de Conversões não é motivo para reabrir isso pela porta dos fundos.
 *
 * Sobram `fbc` e `fbp`, que são justamente os dois identificadores que ligam uma compra a um
 * CLIQUE DE ANÚNCIO — que é a única pergunta que este envio existe para responder.
 */
export const metaConversionContext = pgTable('meta_conversion_context', {
  /** O pedido. Um contexto por pedido; o webhook chega com este id na mão. */
  orderId: uuid('order_id')
    .primaryKey()
    .references(() => orders.id),

  /**
   * O estado do consentimento no instante do checkout: `aceito`, `recusado` ou `nao_decidido`.
   *
   * **É a trava do envio, e não um dado estatístico.** Só `aceito` autoriza mandar a compra para o
   * Meta. Mandar do servidor o que o navegador não teve permissão de mandar seria burlar por trás
   * a permissão que o banner pede na frente — e o banner deixaria de significar alguma coisa.
   */
  consent: text('consent').notNull(),

  /**
   * `fbc` — o clique no anúncio, no formato `fb.1.<timestamp>.<fbclid>`.
   *
   * Montado por nós a partir do `fbclid` que o middleware captura da URL, e NÃO lido do cookie que
   * o pixel escreve. A diferença importa: assim ele existe mesmo quando o pixel foi bloqueado por
   * extensão ou pela prevenção de rastreamento do navegador — que é um dos buracos que esta tabela
   * existe para tapar.
   */
  fbc: text('fbc'),

  /**
   * `fbp` — o identificador de navegador que o próprio pixel escreve no cookie `_fbp`.
   *
   * Nulo quando o pixel nunca rodou: cookie recusado, ou bloqueado. Nesse caso o `fbc` sozinho
   * ainda liga a compra ao anúncio, que é o essencial.
   */
  fbp: text('fbp'),

  /** A página onde a compra começou. A API pede, e ela ajuda a correspondência. */
  sourceUrl: text('source_url'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
