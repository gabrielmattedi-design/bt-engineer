import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Pessoas identificadas — docs/DATA_MODEL.md §8.
 *
 * ─── A ÚNICA TABELA COM DADO PESSOAL ─────────────────────────────────────────────────────────
 *
 * O §8 é explícito: `users` é a única tabela que guarda e-mail, e ela só nasce no checkout. Todo o
 * resto do sistema — perfis, recomendações, rankings — referencia a SESSÃO ANÔNIMA, nunca a pessoa.
 *
 * Isso não é preciosismo de arquitetura, é o que faz `deleteSubject()` ser uma operação de uma
 * linha. Se o e-mail estivesse copiado em `orders`, apagar uma pessoa significaria varrer todas as
 * tabelas que um dia o tocaram, e a primeira que alguém esquecesse viraria o vazamento.
 *
 * ─── POR QUE ELA EXISTE ANTES DE HAVER CADASTRO ──────────────────────────────────────────────
 *
 * Nenhuma tela grava aqui ainda: o checkout não pede e-mail, e a decisão sobre login (magic link,
 * senha, OAuth) não foi tomada. A tabela existe porque `/admin/analises` precisa de um lugar REAL
 * para procurar — uma busca por e-mail sobre uma coluna inexistente seria um formulário de mentira,
 * que pareceria funcionar e nunca acharia nada.
 *
 * Deliberadamente NÃO tem: nome, senha, hash de senha, token de magic link, nem `email_verified`.
 * Cada um desses campos é uma decisão de autenticação que ainda não foi tomada, e criá-los agora
 * seria decidir por antecipação e no escuro.
 *
 * ─── NORMALIZAÇÃO ────────────────────────────────────────────────────────────────────────────
 *
 * `UNIQUE` no Postgres compara byte a byte: `Joao@Gmail.com` e `joao@gmail.com` passariam como duas
 * pessoas diferentes, e a busca por uma não acharia a outra. O e-mail é gravado e consultado SEMPRE
 * por `normalizeEmail()` — minúsculas e sem espaços nas pontas. A garantia é de código, não do
 * banco, e é por isso que ela mora numa função exportada em vez de estar espalhada em cada `insert`.
 */

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Sempre em minúsculas e sem espaços — ver `normalizeEmail()`. */
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Forma canônica de um e-mail para gravação e busca.
 *
 * Só `trim` + `toLowerCase`. Nada de remover pontos do Gmail ou cortar sufixos `+tag`: são
 * convenções de UM provedor, e aplicá-las a todos transformaria endereços legítimos de outros
 * domínios em outra pessoa. Quem digitou `joao+te@dominio.com` recebe em `joao+te@dominio.com`.
 */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}
