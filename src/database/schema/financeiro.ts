import { date, integer, pgTable, timestamp } from 'drizzle-orm/pg-core';

/**
 * O gasto de anúncio por dia, digitado à mão — o único número da gestão financeira que o sistema
 * não tem como saber sozinho.
 *
 * ═══ POR QUE ESTA TABELA EXISTE (17/09/2026) ═════════════════════════════════════════════════
 *
 * O dono pediu uma visão de gestão financeira: *"venda total, custo com meta, consequentemente
 * lucro total, dia após dia"*. Faturamento e pedidos saem de `orders`. O gasto **não sai de
 * lugar nenhum daqui** — ele vive no Gerenciador de Anúncios do Meta, e o projeto não integra com
 * a API de marketing dele.
 *
 * A alternativa era ele digitar o gasto a cada leitura, todo dia, e perder ao fechar a aba. Com a
 * tabela, digita uma vez por dia e a série se acumula sozinha — que é o que transforma "consultar
 * um dia" em "ver o mês".
 *
 * ─── POR QUE A CHAVE É UM `date`, E NÃO UM `timestamp` ───────────────────────────────────────
 *
 * O Gerenciador reporta gasto por DIA DE CALENDÁRIO. Guardar instante convidaria a pergunta
 * "instante de quê?" e abriria espaço para dois registros do mesmo dia. `date` como chave
 * primária torna "um gasto por dia" uma garantia do banco, não uma disciplina de quem escreve.
 *
 * ⚠️ **O dia aqui é o dia de BRASÍLIA**, o mesmo que o Gerenciador usa e o mesmo que
 * `faturamentoPorDia` produz ao agrupar `paid_at`. Gravar o dia em UTC jogaria toda venda
 * depois das 21h para o dia seguinte — e 59% das vendas desta conta acontecem depois das 15h30
 * (medido em 13/09), então o erro não seria de borda, seria de metade do movimento.
 */
export const dailyAdSpend = pgTable('daily_ad_spend', {
  dia: date('dia').primaryKey(),
  centavos: integer('centavos').notNull(),
  atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
});
