import { index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

/**
 * Marcos do funil — §16 da lista de lançamento.
 *
 * ═══ POR QUE NO PRÓPRIO POSTGRES, E NÃO NUM SCRIPT DE TERCEIRO ═══════════════════════════════
 *
 * Um Google Analytics da vida responderia parte disto sem código nenhum. Três razões para não:
 *
 *   1. Ele mede PAGEVIEWS, e a pergunta aqui é sobre PESSOAS que chegaram a um marco. As duas
 *      coisas divergem no momento em que alguém volta uma etapa ou recarrega — exatamente o
 *      comportamento de quem está em dúvida, que é quem mais interessa medir.
 *   2. Ele não conversa com `orders`. "Quantos dos que terminaram o questionário pagaram" exige
 *      cruzar o comportamento com a venda, e a venda mora aqui.
 *   3. Ele é um script de rastreamento de terceiro num produto que promete não fazer isso.
 *
 * ═══ O QUE ESTA TABELA DELIBERADAMENTE NÃO GUARDA ════════════════════════════════════════════
 *
 * Nenhum IP, nenhum user agent, nenhum referrer, nenhuma identificação. Só o hash do cookie
 * anônimo que já existe (`te_visitor`), o nome do marco e a hora. É o mínimo que responde às
 * perguntas do funil, e por construção não responde a nenhuma pergunta sobre uma pessoa.
 *
 * ═══ UM MARCO POR VISITANTE, NÃO UM POR VISITA ═══════════════════════════════════════════════
 *
 * `unique(visitor_hash, marker)` com `onConflictDoNothing` é o coração do desenho. Sem ele, quem
 * recarrega a página três vezes aparece como três pessoas, e toda taxa de conversão fica errada
 * para baixo — o denominador cresce sozinho. Com ele, a tabela responde "quantos ALCANÇARAM este
 * ponto", que é a única pergunta que um funil precisa responder.
 *
 * O efeito colateral é aceito de propósito: não dá para contar quantas vezes alguém voltou a uma
 * etapa. Se isso virar pergunta um dia, é outra tabela — não vale corromper esta.
 */
export const funnelMarkers = pgTable(
  'funnel_markers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /**
     * SHA-256 do cookie `te_visitor` — o MESMO valor de `anonymous_sessions.cookie_token_hash`.
     *
     * Sem chave estrangeira de propósito: a sessão anônima só nasce quando há algo a persistir, e
     * o marco mais importante deste funil (abriu o questionário e foi embora) acontece antes
     * disso. Exigir a linha em `anonymous_sessions` perderia justamente o abandono que se quer
     * medir. O JOIN por hash continua funcionando quando as duas existem.
     */
    visitorHash: text('visitor_hash').notNull(),
    /**
     * O marco alcançado. Texto e não enum, porque a lista vai mudar mais que o esquema — e uma
     * migração de enum para renomear uma etapa do questionário seria custo sem contrapartida.
     * Os valores canônicos vivem em `funnel-repo.ts`.
     */
    marker: text('marker').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    /** Um marco por visitante. Ver a nota do cabeçalho — é o que faz a conversão ser verdade. */
    once: unique('funnel_markers_visitor_marker_key').on(t.visitorHash, t.marker),
    /** As duas consultas do painel são "contar por marco" e "recortar por período". */
    byMarker: index('funnel_markers_marker_idx').on(t.marker, t.createdAt),
  }),
);
