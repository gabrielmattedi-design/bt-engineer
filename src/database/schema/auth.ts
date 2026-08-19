import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Links de acesso por e-mail — o "magic link".
 *
 * ═══ POR QUE SEM SENHA ═══════════════════════════════════════════════════════════════════════
 *
 * O produto é comprado uma vez e revisitado duas ou três vezes por ano. Uma senha nesse ritmo é
 * uma senha esquecida: o caminho real de todo retorno seria o "esqueci minha senha", que é um link
 * por e-mail. Este sistema é aquele caminho, sem o teatro da senha na frente.
 *
 * E o que ele protege não é uma conta — é o acesso a relatórios já comprados. Quem controla a
 * caixa de entrada é a pessoa; quem não controla, não abre o link. A mesma prova que um "esqueci
 * minha senha" usaria.
 *
 * ═══ TRÊS PROPRIEDADES, E O MOTIVO DE CADA UMA ═══════════════════════════════════════════════
 *
 * 1. GUARDAMOS O HASH, NUNCA O TOKEN
 *
 *    O token vai no e-mail e no link. Se guardássemos o valor bruto, qualquer leitura do banco —
 *    um dump, um log de query, um backup mal guardado — entregaria acesso imediato a todas as
 *    contas com link pendente. Com o hash, o que está no banco não abre nada: é preciso ter o
 *    e-mail original.
 *
 *    É a mesma decisão de `anonymous_sessions.cookie_token_hash`, pelo mesmo motivo.
 *
 * 2. VALIDADE CURTA
 *
 *    E-mail fica na caixa de entrada para sempre. Um link sem prazo é uma chave permanente
 *    circulando num canal que não é seguro — encaminhado sem querer, lido num computador
 *    compartilhado, exposto num vazamento do provedor de e-mail anos depois.
 *
 * 3. USO ÚNICO
 *
 *    `consumed_at` fecha o link no primeiro uso. Sem isso, o mesmo e-mail encaminhado a outra
 *    pessoa continuaria abrindo a conta indefinidamente.
 *
 * ═══ O QUE ESTA TABELA NÃO É ═════════════════════════════════════════════════════════════════
 *
 * Não é sessão. Ela autentica UMA vez; a permanência depois disso é um cookie assinado, com prazo
 * próprio. Misturar as duas coisas faria a sessão herdar o prazo do link — ou o link herdar o da
 * sessão, que é o erro pior.
 */
export const loginTokens = pgTable(
  'login_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** SHA-256 do token entregue no e-mail. O valor bruto nunca toca o banco. */
    tokenHash: text('token_hash').notNull().unique(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    /** Preenchido no primeiro uso. Um link consumido não volta a valer. */
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
  },
  (t) => [
    /*
      Índice por usuário: é como se conta quantos links foram pedidos numa janela de tempo, que é a
      defesa contra alguém usar o formulário para inundar a caixa de entrada de terceiros.
    */
    index('login_tokens_user_idx').on(t.userId, t.createdAt),
  ],
);
