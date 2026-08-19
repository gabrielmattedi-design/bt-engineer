import { foreignKey, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { recommendationSessions } from './sessions';

/**
 * Registro de consultas do suporte — §51 (LGPD).
 *
 * ─── POR QUE UMA BUSCA PRECISA DEIXAR RASTRO ─────────────────────────────────────────────────
 *
 * `/admin/analises` existe para resolver um caso concreto: alguém pagou, digitou o e-mail errado e
 * perdeu o acesso. Para resolver isso, o operador lê o relatório de OUTRA PESSOA — dados de saúde
 * aproximados (idade, altura, peso, condicionamento), estilo de jogo e histórico de compra.
 *
 * Acesso a dado de titular sem rastro é o tipo de coisa que não incomoda ninguém até o dia em que
 * incomoda muito. Esta tabela responde "quem abriu o quê, quando" — hoje com um operador só, e sem
 * mudança de esquema no dia em que forem três.
 *
 * ─── O QUE ELA NÃO GUARDA, E POR QUÊ ─────────────────────────────────────────────────────────
 *
 * NÃO guarda o termo buscado. Registrar `joao@gmail.com` aqui criaria uma segunda tabela com
 * e-mail, contrariando o §8 ("`users` é a única"), e transformaria o log de auditoria — feito para
 * proteger — numa cópia do dado que ele protege.
 *
 * Guarda o TIPO da busca e o RESULTADO, que é o fato relevante para auditoria: "às 14h32 o suporte
 * abriu a análise X". Quem procura às cegas também aparece: uma sequência de buscas por e-mail com
 * `matched_count = 0` é exatamente o desenho de quem está tentando adivinhar.
 */
export const supportLookups = pgTable(
  'support_lookups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** `analise` | `pedido` | `pagamento` | `email` — ver `classifyQuery()`. */
    queryKind: text('query_kind').notNull(),
    matchedCount: integer('matched_count').notNull(),
    /**
     * A análise encontrada, quando a busca resultou em exatamente uma.
     *
     * `ON DELETE SET NULL`, e não `CASCADE`: se a pessoa exercer o direito de exclusão, o relatório
     * dela some e o registro de que uma consulta ACONTECEU permanece. Um log de auditoria que é
     * apagado junto com o dado auditado não audita nada.
     */
    recommendationSessionId: uuid('recommendation_session_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Ver a nota em `racketRankings`: o nome gerado passaria dos 63 caracteres do Postgres.
    foreignKey({
      columns: [t.recommendationSessionId],
      foreignColumns: [recommendationSessions.id],
      name: 'support_lookups_rec_session_fk',
    }).onDelete('set null'),
  ],
);
