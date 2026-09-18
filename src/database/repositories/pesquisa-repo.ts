import 'server-only';
import { randomBytes } from 'node:crypto';
import { and, desc, eq, gte, isNotNull, isNull, lte, sql } from 'drizzle-orm';
import { db, isDatabaseConfigured } from '../client';
import { satisfactionSurveys } from '../schema/pesquisa';
import { orders } from '../schema/commerce';
import { users } from '../schema/users';
import type { Resposta } from '@/lib/pesquisa';

/**
 * A fila e o registro da pesquisa de satisfação.
 *
 * ═══ A JANELA É UM INTERVALO, E NÃO UM DIA EXATO ═════════════════════════════════════════════
 *
 * O óbvio seria "pedidos pagos há exatamente 15 dias". É frágil: se o cron falhar num dia — deploy,
 * instabilidade, limite da Vercel —, aquela safra some para sempre e ninguém fica sabendo.
 *
 * Com um INTERVALO (de 15 a 45 dias) mais a trava de "ainda não tem linha de pesquisa", um dia
 * perdido é recuperado no dia seguinte sozinho. O sistema se conserta em vez de vazar em silêncio.
 *
 * ─── E POR QUE HÁ UM TETO DE 45 DIAS ─────────────────────────────────────────────────────────
 *
 * Perguntar "como foi?" para quem comprou há dois meses é estranho e tem resposta pior — a memória
 * já não é a mesma e a pessoa se pergunta por que só agora. O teto também impede que, num primeiro
 * deploy, a fila inteira de clientes antigos entre de uma vez.
 */

/** De quantos dias depois da compra a pesquisa sai. Gravado em cada linha, para leitura futura. */
export const DIAS_DEPOIS_DA_COMPRA = 15;
const TETO_DE_DIAS = 45;

export type PedidoParaPesquisar = {
  readonly orderId: string;
  readonly email: string;
  readonly pagoEm: Date;
};

const UM_DIA = 86_400_000;

/**
 * Quem deve receber a pesquisa agora, do mais antigo para o mais novo.
 *
 * ⚠️ ═══ O `limite` NÃO É OTIMIZAÇÃO — É PROTEÇÃO DE ENTREGA ══════════════════════════════════
 *
 * Um domínio que manda dez e-mails por dia e de repente manda cento e vinte apresenta exatamente o
 * padrão de volume que filtros tratam como disparo em massa. E o estrago não ficaria na pesquisa:
 * a mesma reputação entrega o RELATÓRIO, que é o produto. Perder a entrega da pesquisa é chato;
 * perder a do laudo é fatal.
 *
 * Com o limite, uma fila acumulada escoa em alguns dias em vez de estourar num minuto — que é
 * exatamente o aquecimento que se recomendaria fazer à mão.
 */
export async function pedidosParaPesquisar(limite: number): Promise<PedidoParaPesquisar[]> {
  if (!isDatabaseConfigured()) return [];

  const agora = Date.now();
  const maisNovoQue = new Date(agora - TETO_DE_DIAS * UM_DIA);
  const maisVelhoQue = new Date(agora - DIAS_DEPOIS_DA_COMPRA * UM_DIA);

  const rows = await db()
    .select({ orderId: orders.id, email: users.email, pagoEm: orders.paidAt })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.userId))
    .leftJoin(satisfactionSurveys, eq(satisfactionSurveys.orderId, orders.id))
    .where(
      and(
        eq(orders.status, 'paid'),
        isNotNull(orders.paidAt),
        lte(orders.paidAt, maisVelhoQue),
        gte(orders.paidAt, maisNovoQue),
        /* A ausência de linha é a trava de idempotência — ver o comentário do schema. */
        isNull(satisfactionSurveys.id),
      ),
    )
    .orderBy(orders.paidAt)
    .limit(limite);

  return rows.flatMap((r) =>
    r.email !== null && r.pagoEm !== null
      ? [{ orderId: r.orderId, email: r.email, pagoEm: r.pagoEm }]
      : [],
  );
}

/**
 * Cria a linha e devolve o token. Gravar ANTES de enviar é deliberado.
 *
 * Se o envio falhar depois da gravação, essa pessoa não recebe a pesquisa — perda pequena e
 * silenciosa. Se a ordem fosse a inversa e a gravação falhasse depois do envio, o pedido voltaria
 * para a fila e a pessoa receberia o mesmo e-mail todo dia até alguém perceber. Entre perder um
 * envio e virar spam para um cliente, o primeiro é incomparavelmente mais barato.
 */
export async function criarPesquisa(orderId: string): Promise<string | null> {
  if (!isDatabaseConfigured()) return null;

  const token = randomBytes(18).toString('base64url');
  try {
    await db().insert(satisfactionSurveys).values({
      orderId,
      token,
      diasDepoisDaCompra: DIAS_DEPOIS_DA_COMPRA,
    });
    return token;
  } catch (error) {
    /* Corrida entre duas execuções do cron cai aqui, na restrição única. Não é erro a tratar. */
    console.error('[pesquisa] não foi possível criar a linha do pedido', orderId, error);
    return null;
  }
}

export type PesquisaAberta = {
  readonly token: string;
  readonly email: string;
  readonly jaRespondida: boolean;
};

export async function pesquisaPorToken(token: string): Promise<PesquisaAberta | null> {
  if (!isDatabaseConfigured()) return null;

  const rows = await db()
    .select({
      token: satisfactionSurveys.token,
      email: users.email,
      answeredAt: satisfactionSurveys.answeredAt,
    })
    .from(satisfactionSurveys)
    .innerJoin(orders, eq(orders.id, satisfactionSurveys.orderId))
    .leftJoin(users, eq(users.id, orders.userId))
    .where(eq(satisfactionSurveys.token, token))
    .limit(1);

  const r = rows[0];
  if (r === undefined) return null;
  return { token: r.token, email: r.email ?? '', jaRespondida: r.answeredAt !== null };
}

/**
 * Grava a resposta. Reenvio do mesmo formulário SOBRESCREVE em vez de duplicar.
 *
 * Alguém que responde, relê a página e corrige uma frase está corrigindo, não respondendo de novo.
 * Duas linhas para o mesmo pedido inflariam a contagem de respostas e a taxa de resposta junto.
 */
export async function registrarResposta(token: string, r: Resposta): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;

  const feito = await db()
    .update(satisfactionSurveys)
    .set({
      answeredAt: new Date(),
      usou: r.usou,
      efeito: r.efeito,
      impedimento: r.impedimento,
      impedimentoOutro: r.impedimentoOutro,
      notaLaudo: r.notaLaudo,
      sugestao: r.sugestao,
      podeContatar: r.podeContatar,
    })
    .where(eq(satisfactionSurveys.token, token))
    .returning({ id: satisfactionSurveys.id });

  return feito.length > 0;
}

export type RespostaListada = {
  readonly dia: Date;
  readonly usou: string | null;
  readonly efeito: string | null;
  readonly impedimento: string | null;
  readonly impedimentoOutro: string | null;
  readonly notaLaudo: number | null;
  readonly sugestao: string | null;
  readonly podeContatar: boolean | null;
  readonly email: string | null;
};

export async function lerPesquisas(): Promise<{
  enviadas: number;
  respostas: RespostaListada[];
}> {
  if (!isDatabaseConfigured()) return { enviadas: 0, respostas: [] };

  const [contagem, rows] = await Promise.all([
    db().select({ n: sql<number>`count(*)::int` }).from(satisfactionSurveys),
    db()
      .select({
        dia: satisfactionSurveys.answeredAt,
        usou: satisfactionSurveys.usou,
        efeito: satisfactionSurveys.efeito,
        impedimento: satisfactionSurveys.impedimento,
        impedimentoOutro: satisfactionSurveys.impedimentoOutro,
        notaLaudo: satisfactionSurveys.notaLaudo,
        sugestao: satisfactionSurveys.sugestao,
        podeContatar: satisfactionSurveys.podeContatar,
        email: users.email,
      })
      .from(satisfactionSurveys)
      .innerJoin(orders, eq(orders.id, satisfactionSurveys.orderId))
      .leftJoin(users, eq(users.id, orders.userId))
      .where(isNotNull(satisfactionSurveys.answeredAt))
      .orderBy(desc(satisfactionSurveys.answeredAt)),
  ]);

  return {
    enviadas: Number(contagem[0]?.n ?? 0),
    respostas: rows.flatMap((r) =>
      r.dia === null ? [] : [{ ...r, dia: r.dia, notaLaudo: r.notaLaudo ?? null }],
    ),
  };
}
