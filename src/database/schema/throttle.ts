import { index, integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

/**
 * Contador de tentativas — a trava que faltava nas duas portas que dão acesso.
 *
 * ═══ O QUE ESTAVA ABERTO ═════════════════════════════════════════════════════════════════════
 *
 * Duas telas aceitavam palpites ilimitados, sem custo nenhum para quem tentasse:
 *
 *   • O login do painel. Errar a senha não custava nada, e acertar dá o painel inteiro — criar
 *     cupom de acesso total, mexer no modo de pagamento, rodar migração no banco. É o caminho mais
 *     curto entre um desconhecido e o controle do produto.
 *
 *   • O campo de código de convite. Errar não custava nada, e acertar dá um relatório pago. Os
 *     códigos são palavras (`MAITE`), não cadeias aleatórias — um dicionário de nomes próprios
 *     chega lá em minutos, e cada acerto é receita que não entra.
 *
 * Nenhuma das duas deixava rastro de tentativa, então nem depois daria para saber que aconteceu.
 *
 * ═══ POR QUE NO BANCO, E NÃO EM MEMÓRIA ══════════════════════════════════════════════════════
 *
 * O site roda em funções que sobem e descem sob demanda, e cada uma tem a própria memória. Um
 * contador em variável protege apenas contra quem tiver o azar de cair sempre na mesma instância —
 * ou seja, protege contra ninguém. No banco, o contador é um só para o site inteiro.
 *
 * O custo é uma escrita por tentativa. Numa porta que deveria ser usada uma vez por pessoa, isso
 * não é volume; e se virar volume, o volume é exatamente o ataque que se quer barrar.
 *
 * ═══ POR QUE A CHAVE NÃO É O IP ══════════════════════════════════════════════════════════════
 *
 * Porque este produto não guarda IP, e começar a guardar para contar tentativa contradiria a
 * política de privacidade por uma proteção que o identificador anônimo já dá. A chave é o cookie do
 * visitante para o cupom, e o próprio nome da porta para o painel — um teto global, aceitando o
 * custo de que uma rajada trave o dono junto com o atacante por alguns minutos.
 */
export const attemptCounters = pgTable(
  'attempt_counters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Qual porta: `admin-login`, `coupon:<hash do visitante>`. */
    scope: text('scope').notNull(),
    /** Início da janela de contagem. Uma linha por janela, e não uma por tentativa. */
    windowStart: timestamp('window_start', { withTimezone: true }).notNull().defaultNow(),
    attempts: integer('attempts').notNull().default(0),
  },
  (t) => ({
    /*
      Uma linha por (porta, janela).

      É o que permite contar com um único `INSERT … ON CONFLICT DO UPDATE`, sem ler antes de
      escrever — duas requisições simultâneas incrementam o mesmo contador em vez de criarem duas
      linhas com contagem 1 cada, que é como um limitador ingênuo deixa passar o dobro.
    */
    once: unique('attempt_counters_scope_window_key').on(t.scope, t.windowStart),
    byScope: index('attempt_counters_scope_idx').on(t.scope, t.windowStart),
  }),
);
