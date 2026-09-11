import 'server-only';
import { gte, lt, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import type { Janela } from '@/lib/periodo';

/**
 * A janela de tempo traduzida em condições de consulta.
 *
 * Existe separado de `lib/periodo.ts` para que aquele arquivo continue puro — ele decide QUAL é a
 * janela, com fuso e calendário, e é testável sem banco nenhum. Aqui só se transforma a decisão em
 * SQL.
 *
 * ═══ O FIM É EXCLUSIVO, E ISSO NÃO É DETALHE ═════════════════════════════════════════════════
 *
 * `lt` e não `lte`. "Ontem" vai da meia-noite de ontem à meia-noite de hoje, SEM incluir a segunda —
 * senão uma venda feita exatamente às 00:00:00 de hoje contaria nos dois dias, e a soma dos dias
 * ficaria maior que o total. Um funil que não fecha é um funil em que ninguém confia.
 */

export const SEM_LIMITE: Janela = { desde: null, ate: null };

export function recorte(coluna: AnyPgColumn, janela: Janela): SQL[] {
  const filtros: SQL[] = [];
  if (janela.desde) filtros.push(gte(coluna, janela.desde));
  if (janela.ate) filtros.push(lt(coluna, janela.ate));
  return filtros;
}
