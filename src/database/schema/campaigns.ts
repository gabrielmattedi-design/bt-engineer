import { index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

/**
 * De onde o visitante veio — §15, tráfego pago.
 *
 * ═══ A PERGUNTA QUE O FUNIL SOZINHO NÃO RESPONDE ═════════════════════════════════════════════
 *
 * O funil diz "5% de quem abre o questionário paga". Com dois anúncios no ar, esse número é a
 * média de dois resultados que podem ser 9% e 1% — e a decisão certa (desligar um, dobrar no
 * outro) fica escondida atrás da média. Sem separar por origem, comprar tráfego é comprar no
 * escuro com a luz acesa: há número, e ele não serve para decidir.
 *
 * É também um dado que NÃO dá para reconstruir depois. Quem clicou no anúncio ontem sem deixar
 * registro de origem não deixou rastro nenhum — a origem só existe no instante do clique. Ou se
 * grava então, ou se perde.
 *
 * ═══ SÓ O QUE O ANUNCIANTE ESCREVEU ══════════════════════════════════════════════════════════
 *
 * Guardamos exclusivamente os parâmetros `utm_*` que VOCÊ colocou no próprio link do anúncio.
 * Nenhum referrer, nenhum IP, nenhuma impressão digital de navegador — as mesmas ausências de
 * `funnel_markers`, pelo mesmo motivo.
 *
 * A distinção é real e não é formalidade: um referrer conta de onde a pessoa veio sem que ela ou
 * nós tenhamos escolhido isso; um `utm_source` conta apenas o que o próprio anunciante escreveu no
 * link que ele mesmo publicou. O segundo é dado sobre a CAMPANHA, não sobre a pessoa.
 *
 * ═══ PRIMEIRO TOQUE, E NÃO O ÚLTIMO ══════════════════════════════════════════════════════════
 *
 * `unique(visitor_hash)` grava uma origem por visitante e ignora as seguintes. Quem clica no
 * anúncio, sai, e volta depois pelo Google continua creditado ao anúncio — que é quem de fato
 * trouxe a pessoa. Com último toque, todo anúncio pareceria pior do que é, e a busca orgânica
 * levaria crédito por vendas que ela não originou.
 *
 * A escolha custa o caso oposto (quem descobre organicamente e só compra depois de ver um
 * anúncio), e é a troca certa para quem está decidindo se o anúncio se paga.
 */
export const visitorCampaigns = pgTable(
  'visitor_campaigns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** SHA-256 do cookie `te_visitor` — a mesma chave de `funnel_markers`, para poder cruzar. */
    visitorHash: text('visitor_hash').notNull(),
    /** `utm_source` — de onde: `instagram`, `google`, `grupo-do-clube`. */
    source: text('source').notNull(),
    /** `utm_medium` — como: `cpc`, `stories`, `email`. */
    medium: text('medium'),
    /** `utm_campaign` — qual campanha: `lancamento-agosto`. */
    campaign: text('campaign'),
    /** `utm_content` — qual criativo, quando a campanha testa mais de um. */
    content: text('content'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    /** Primeiro toque vence. Ver a nota do cabeçalho. */
    once: unique('visitor_campaigns_visitor_key').on(t.visitorHash),
    bySource: index('visitor_campaigns_source_idx').on(t.source, t.createdAt),
  }),
);
