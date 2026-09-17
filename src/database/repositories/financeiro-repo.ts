import 'server-only';
import { and, eq, gte, sql } from 'drizzle-orm';
import { db, isDatabaseConfigured } from '../client';
import { dailyAdSpend } from '../schema/financeiro';
import { orders } from '../schema/commerce';

/**
 * A gestão financeira: faturamento de TODAS as origens por dia, contra o gasto digitado.
 *
 * ═══ POR QUE A FONTE É `orders`, E NÃO O FUNIL ═══════════════════════════════════════════════
 *
 * O dono foi direto ao ponto ao pedir esta tela:
 *
 * > *"o funil, por alguns quesitos que até hoje não estão tão claros para mim, às vezes apresenta
 * > menos vendas do que no painel vendas dentro de administrador. E o vendas, eu checando com o
 * > Mercado Pago, é o correto."*
 *
 * Ele está certo, e o motivo está documentado em `commerce-repo.ts`: `funnel_markers` tem restrição
 * única em (visitante, marco), então **um visitante só tem um marco `paid` na vida**. Segunda compra
 * da mesma pessoa, upsell e compra repetida de outro dia não geram marco novo — de propósito, senão
 * a taxa de conversão do funil deixaria de significar algo.
 *
 * Para conversão, o funil está certo. Para DINHEIRO, `orders` é a fonte, e é a que bate com o
 * extrato. Uma tela financeira alimentada pelo funil subestimaria faturamento em silêncio.
 */

export type FaturamentoDoDia = {
  readonly dia: string;
  readonly pedidos: number;
  readonly centavos: number;
};

/**
 * Faturamento e pedidos pagos, agrupados por dia de calendário de BRASÍLIA.
 *
 * ⚠️ ═══ O FUSO AQUI NÃO É DETALHE, É METADE DO MOVIMENTO ═════════════════════════════════════
 *
 * `paid_at` é `timestamptz`, guardado em UTC. Agrupar por dia UTC jogaria toda venda a partir das
 * 21h de Brasília para o dia seguinte — e foi medido em 13/09 que **59% das vendas acontecem
 * depois das 15h30**. O erro não seria de borda: dias inteiros sairiam trocados, e o gasto do
 * Gerenciador (que é por dia de Brasília) deixaria de casar com a receita ao lado dele.
 *
 * `AT TIME ZONE` converte o `timestamptz` para hora local e `::date` corta o dia certo.
 */
export async function faturamentoPorDia(desde: Date): Promise<FaturamentoDoDia[]> {
  if (!isDatabaseConfigured()) return [];

  const diaLocal = sql<string>`(${orders.paidAt} AT TIME ZONE 'America/Sao_Paulo')::date`;

  try {
    const rows = await db()
      .select({
        dia: sql<string>`to_char(${diaLocal}, 'YYYY-MM-DD')`,
        pedidos: sql<number>`count(*)::int`,
        centavos: sql<number>`coalesce(sum(${orders.amountCents}), 0)::bigint`,
      })
      .from(orders)
      .where(and(eq(orders.status, 'paid'), gte(orders.paidAt, desde)))
      .groupBy(diaLocal)
      .orderBy(diaLocal);

    return rows.map((r) => ({
      dia: r.dia,
      pedidos: Number(r.pedidos),
      // `::bigint` volta como string no driver; `Number` aqui e não no SQL para não estourar int32.
      centavos: Number(r.centavos),
    }));
  } catch (error) {
    console.error('[financeiro] não foi possível agrupar o faturamento por dia', error);
    return [];
  }
}

/** Todos os gastos informados, como mapa `AAAA-MM-DD` → centavos. */
export async function gastosPorDia(): Promise<Map<string, number>> {
  if (!isDatabaseConfigured()) return new Map();

  try {
    const rows = await db()
      .select({ dia: dailyAdSpend.dia, centavos: dailyAdSpend.centavos })
      .from(dailyAdSpend);
    return new Map(rows.map((r) => [r.dia, Number(r.centavos)]));
  } catch (error) {
    console.error('[financeiro] não foi possível ler os gastos', error);
    return new Map();
  }
}

/**
 * Grava ou substitui o gasto de um dia.
 *
 * `onConflictDoUpdate` e não `insert` puro: corrigir o gasto de ontem é operação normal — o
 * Gerenciador de Anúncios ainda ajusta o valor de um dia depois dele fechar. Um insert que falha na
 * segunda vez obrigaria a apagar antes de corrigir, e ninguém faz isso pelo painel.
 *
 * Gasto **zero é valor legítimo** (dia com a campanha pausada) e é diferente de ausente. Apagar é
 * explícito: `centavos === null` remove a linha.
 */
export async function salvarGasto(dia: string, centavos: number | null): Promise<void> {
  if (!isDatabaseConfigured()) return;

  if (centavos === null) {
    await db().delete(dailyAdSpend).where(eq(dailyAdSpend.dia, dia));
    return;
  }

  await db()
    .insert(dailyAdSpend)
    .values({ dia, centavos, atualizadoEm: new Date() })
    .onConflictDoUpdate({
      target: dailyAdSpend.dia,
      set: { centavos, atualizadoEm: new Date() },
    });
}
