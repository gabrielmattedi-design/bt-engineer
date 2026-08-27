import { randomBytes, createHash } from 'node:crypto';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { db } from '@/database/client';
import {
  loginTokens,
  normalizeEmail,
  orders,
  playerProfiles,
  recommendationSessions,
  users,
} from '@/database/schema';

/**
 * Emissão e consumo dos links de acesso.
 *
 * Ver `schema/auth.ts` para o desenho e o porquê de cada propriedade. Este módulo concentra as
 * duas operações delicadas: criar um link sem virar ferramenta de spam, e consumi-lo sem deixar
 * brecha de reuso.
 */

/**
 * Validade do link.
 *
 * Quinze minutos é o equilíbrio entre dois incômodos reais. Curto demais e o link morre no tempo
 * que o e-mail leva para chegar mais o tempo que a pessoa leva para ver a notificação. Longo demais
 * e ele vira uma chave duradoura numa caixa de entrada — encaminhada sem querer, lida num
 * computador compartilhado, exposta num vazamento do provedor anos depois.
 */
export const TOKEN_MINUTES = 15;

/** Quantos links um mesmo endereço pode pedir numa janela, e qual janela. */
const MAX_PER_WINDOW = 5;
const WINDOW_MINUTES = 15;

/**
 * O token que vai no e-mail.
 *
 * 32 bytes de aleatoriedade criptográfica em base64url. O que importa aqui não é o tamanho e sim a
 * FONTE: `randomBytes` do Node, não `Math.random()` — que é previsível a partir de saídas
 * anteriores e transformaria o link num convite para adivinhação.
 *
 * base64url porque o valor viaja numa URL: sem `+`, `/` ou `=` para escapar, e sem risco de um
 * cliente de e-mail quebrar o link no meio.
 */
function newToken(): string {
  return randomBytes(32).toString('base64url');
}

function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export type IssueResult =
  | { kind: 'issued'; token: string; email: string }
  /** O endereço não comprou nada. Ver a nota sobre enumeração em `requestLoginLink`. */
  | { kind: 'unknown_email' }
  | { kind: 'rate_limited' };

/**
 * Cria um link para um e-mail que EXISTE.
 *
 * ─── POR QUE NÃO CRIAMOS O USUÁRIO AQUI ──────────────────────────────────────────────────────
 *
 * Seria conveniente: digitou o e-mail, ganhou conta. E transformaria um formulário público numa
 * porta para encher a tabela `users` com endereços de terceiros — cada um recebendo um e-mail
 * nosso que nunca pediu. A conta nasce na COMPRA, que é o único momento em que a pessoa
 * demonstrou querer o produto.
 *
 * ─── E POR QUE O CHAMADOR NÃO PODE CONTAR A DIFERENÇA ────────────────────────────────────────
 *
 * `unknown_email` existe para a lógica, não para a tela. Se a interface dissesse "esse e-mail não
 * tem conta", qualquer pessoa poderia descobrir, um endereço por vez, quem é cliente daqui. É
 * pouco para nós e pode ser muito para o titular do endereço. A tela responde a mesma frase nos
 * dois casos — ver `/entrar`.
 */
export async function requestLoginLink(rawEmail: string): Promise<IssueResult> {
  const email = normalizeEmail(rawEmail);
  const conn = db();

  const found = await conn
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const user = found[0];
  if (!user) return { kind: 'unknown_email' };

  /*
    O limite protege o DONO do endereço, não o servidor.

    Sem ele, um formulário público que dispara e-mail vira ferramenta de assédio: basta pedir o
    link mil vezes para o endereço de alguém. O teto é por usuário e por janela, contado no banco —
    não em memória, que não sobrevive entre invocações serverless.
  */
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000);
  const recent = await conn
    .select({ n: sql<number>`count(*)::int` })
    .from(loginTokens)
    .where(and(eq(loginTokens.userId, user.id), gt(loginTokens.createdAt, since)));

  if ((recent[0]?.n ?? 0) >= MAX_PER_WINDOW) return { kind: 'rate_limited' };

  const token = newToken();
  await conn.insert(loginTokens).values({
    tokenHash: hash(token),
    userId: user.id,
    expiresAt: new Date(Date.now() + TOKEN_MINUTES * 60_000),
  });

  return { kind: 'issued', token, email };
}

/**
 * Troca o token por um usuário, gastando-o.
 *
 * ─── A ORDEM DAS OPERAÇÕES É A SEGURANÇA ─────────────────────────────────────────────────────
 *
 * O consumo é um `UPDATE ... WHERE consumed_at IS NULL ... RETURNING`, e não um `SELECT` seguido de
 * `UPDATE`. Com duas consultas, dois cliques simultâneos no mesmo link — o que acontece de verdade
 * quando um pré-carregador de e-mail busca a URL antes da pessoa — passariam os dois pelo `SELECT`
 * antes de qualquer `UPDATE`, e o uso único deixaria de ser único.
 *
 * Numa instrução só, o banco serializa: a segunda não encontra linha para atualizar e volta vazia.
 */
export async function consumeLoginToken(token: string): Promise<{ userId: string; email: string } | null> {
  if (!token) return null;
  const conn = db();

  const claimed = await conn
    .update(loginTokens)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(loginTokens.tokenHash, hash(token)),
        isNull(loginTokens.consumedAt),
        gt(loginTokens.expiresAt, new Date()),
      ),
    )
    .returning({ userId: loginTokens.userId });

  const row = claimed[0];
  if (!row) return null;

  const found = await conn
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, row.userId))
    .limit(1);

  const email = found[0]?.email;
  return email ? { userId: row.userId, email } : null;
}

/** Garante o usuário do e-mail e devolve seu id. Chamado na COMPRA, nunca no formulário de acesso. */
export async function ensureUser(rawEmail: string): Promise<string> {
  const email = normalizeEmail(rawEmail);
  const conn = db();

  const inserted = await conn
    .insert(users)
    .values({ email })
    .onConflictDoNothing()
    .returning({ id: users.id });

  if (inserted[0]) return inserted[0].id;

  // Conflito: já existia. Buscar é o caminho normal para quem compra pela segunda vez.
  const found = await conn.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  return found[0]!.id;
}

/** Marca a análise como pertencente a alguém. Chamado quando a pessoa informa o e-mail. */
export async function claimAnalysis(publicId: string, userId: string): Promise<void> {
  await db()
    .update(recommendationSessions)
    .set({ userId })
    .where(eq(recommendationSessions.publicId, publicId));
}

export type OwnedAnalysis = {
  readonly publicId: string;
  readonly createdAt: Date;
  readonly paidCents: number;
  /**
   * O nome que a pessoa escolheu para ser chamada naquela análise, quando deu um.
   *
   * ─── POR QUE ELE FAZ FALTA NA LISTA ────────────────────────────────────────────────────────
   *
   * A lista mostrava só a data, sem hora. Duas análises feitas no mesmo dia ficavam com o MESMO
   * rótulo e o mesmo valor — indistinguíveis. E não é um caso raro: o uso natural do produto é
   * responder uma vez por si e outra pelo filho, pela esposa ou pelo parceiro de duplas, na mesma
   * tarde. A pessoa que mais volta a esta tela é justamente quem tem mais de uma.
   *
   * O nome resolve o que a data não resolve, porque é o que a pessoa realmente usa para lembrar
   * de qual análise é qual — "a da Maitê" e não "a das 15h47".
   */
  readonly playerName: string | null;
};

/**
 * As análises deste usuário.
 *
 * ─── PARTE DA POSSE, NÃO DA COMPRA ───────────────────────────────────────────────────────────
 *
 * A consulta sai de `recommendation_sessions.user_id`, e os pedidos entram só para somar o valor.
 * O caminho inverso — partir de `orders` — perderia todo relatório liberado por código de convite,
 * que não tem pedido nenhum: quem entrou por convite faria login e veria uma lista vazia,
 * exatamente a pessoa que mais precisa de um caminho de volta durante os testes.
 */
export async function analysesForUser(userId: string): Promise<OwnedAnalysis[]> {
  const conn = db();

  const sessions = await conn
    .select({
      id: recommendationSessions.id,
      publicId: recommendationSessions.publicId,
      createdAt: recommendationSessions.createdAt,
      /*
        O nome sai do PERFIL gravado, e não de uma coluna própria.

        `player_profiles.profile` é o `PlayerProfile` serializado — a mesma fonte que o card
        compartilhável usa. Ler dali significa que a lista mostra exatamente o nome que aparece no
        relatório daquela análise, sem uma segunda cópia que pode divergir da primeira.
      */
      playerName: sql<string | null>`${playerProfiles.profile}->>'player_name'`,
    })
    .from(recommendationSessions)
    .innerJoin(playerProfiles, eq(playerProfiles.id, recommendationSessions.playerProfileId))
    .where(eq(recommendationSessions.userId, userId))
    .orderBy(desc(recommendationSessions.createdAt));

  if (sessions.length === 0) return [];

  const paid = await conn
    .select({ recId: orders.recommendationSessionId, cents: orders.amountCents })
    .from(orders)
    .where(and(eq(orders.userId, userId), eq(orders.status, 'paid')));

  // Várias compras na mesma análise (raquete + 2ª colocada + setup) somam num item só.
  return sessions.map((s) => ({
    publicId: s.publicId,
    createdAt: s.createdAt,
    paidCents: paid.filter((p) => p.recId === s.id).reduce((sum, p) => sum + p.cents, 0),
    playerName: s.playerName?.trim() || null,
  }));
}
