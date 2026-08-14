import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Conexão com o Postgres.
 *
 * ─── AJUSTES PARA SERVERLESS (Vercel + Neon/Supabase) ────────────────────────────────────────
 *
 * `max: 1` — cada invocação de função é um processo isolado e efêmero. Um pool grande por
 * invocação multiplica conexões até estourar o limite do banco. Quem faz o pooling de verdade é o
 * pooler do provedor (PgBouncer no Supabase, o pooler do Neon), não a aplicação.
 *
 * `prepare: false` — obrigatório atrás de um pooler em modo transaction. Prepared statements vivem
 * na conexão do servidor; com o pooler reciclando conexões entre transações, um statement preparado
 * numa conexão não existe na próxima. Isso falha de forma intermitente e confusa em produção, e é
 * exatamente o tipo de bug que só aparece sob carga.
 */

let cached: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function isDatabaseConfigured(): boolean {
  return !!process.env.DATABASE_URL;
}

export function db() {
  if (cached) return cached;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL não configurada. Em produção o banco é obrigatório; em desenvolvimento, ' +
        'sem ela o sistema cai para o armazenamento em arquivo (ver session-store.ts).',
    );
  }

  cached = drizzle(postgres(url, { max: 1, prepare: false }), { schema });
  return cached;
}

export { schema };
