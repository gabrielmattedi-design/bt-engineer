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

/**
 * ═══ PARÂMETROS QUE SÓ O libpq ENTENDE ═══════════════════════════════════════════════════════
 *
 * O Neon entrega a connection string terminando em:
 *
 *     ?sslmode=require&channel_binding=require
 *
 * `sslmode` o postgres-js reconhece e traduz. `channel_binding` NÃO — e o que ele faz com um
 * parâmetro desconhecido é REPASSÁ-LO AO SERVIDOR como parâmetro de sessão. O Postgres então
 * derruba a conexão inteira com:
 *
 *     unrecognized configuration parameter "channel_binding"
 *
 * (Verificado contra um Postgres 16 real, não deduzido: com o parâmetro a conexão falha, sem ele
 * conecta.)
 *
 * `channel_binding` é opção de CLIENTE do libpq — instrui o próprio libpq a exigir vínculo de canal
 * no SCRAM. Não existe do lado do servidor, e mandá-la para lá é sempre erro.
 *
 * ─── POR QUE LIMPAR NO CÓDIGO, E NÃO PEDIR PARA EDITAR A STRING ──────────────────────────────
 *
 * Porque a string é colada por uma pessoa, num painel, sob pressão de um deploy — e será colada de
 * novo a cada rotação de senha, a cada banco novo, a cada ambiente de staging. Uma instrução de
 * "lembre-se de apagar o final" é uma armadilha que dispara meses depois, e a falha aparece como
 * um erro de banco que não menciona a causa.
 *
 * A lista é EXPLÍCITA e curta de propósito: só opções documentadas do libpq que não existem como
 * parâmetro de servidor. Um filtro genérico ("remova o que o postgres-js não conhece") apagaria
 * silenciosamente parâmetros legítimos de sessão, como `search_path`.
 */
const LIBPQ_CLIENT_ONLY = new Set([
  'channel_binding',
  'gssencmode',
  'krbsrvname',
  'passfile',
  'requirepeer',
  'service',
  'sslcompression',
  'sslcrl',
  'sslcrldir',
]);

/**
 * Remove da query string os parâmetros que quebrariam a conexão.
 *
 * Opera por texto, sem passar por `new URL()`: a senha vive antes do `?` e pode conter caracteres
 * que uma volta pela API de URL re-codificaria. Aqui nada além da query é tocado.
 */
export function sanitizeDatabaseUrl(raw: string): string {
  const cut = raw.indexOf('?');
  if (cut === -1) return raw;

  const base = raw.slice(0, cut);
  const kept = raw
    .slice(cut + 1)
    .split('&')
    .filter((pair) => pair !== '' && !LIBPQ_CLIENT_ONLY.has(pair.split('=')[0]!.toLowerCase()));

  return kept.length > 0 ? `${base}?${kept.join('&')}` : base;
}

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

  cached = drizzle(postgres(sanitizeDatabaseUrl(url), { max: 1, prepare: false }), { schema });
  return cached;
}

export { schema };
