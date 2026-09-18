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

/**
 * Registra o que o provedor respondeu ao envio.
 *
 * ═══ POR QUE ISTO NÃO PODE FALTAR ════════════════════════════════════════════════════════════
 *
 * A linha existir significa "foi tentado". Sem esta chamada, um e-mail recusado deixa exatamente a
 * mesma marca de um aceito — e como a linha também é a trava que impede reenvio, a falha não atrasa
 * a pesquisa daquele cliente: elimina. Ele nunca mais entra na fila, e ninguém fica sabendo.
 *
 * ⚠️ "Aceito" NÃO é "entregue". O que se grava aqui é a resposta do provedor à requisição — chave
 * válida, remetente autorizado, destinatário bem formado. Se a mensagem depois quicou na caixa do
 * destino, ou caiu no spam dele, isso não chega por este caminho: viria de um webhook do Resend,
 * que não existe neste projeto. A coluna diz "saiu daqui", e é o máximo que ela pode dizer.
 */
export async function registrarEnvio(
  token: string,
  resultado: { ok: true; id: string | null } | { ok: false; motivo: string },
): Promise<void> {
  if (!isDatabaseConfigured()) return;

  await db()
    .update(satisfactionSurveys)
    .set(
      resultado.ok
        ? { envioOk: true, envioId: resultado.id, envioErro: null }
        : { envioOk: false, envioErro: resultado.motivo.slice(0, 300) },
    )
    .where(eq(satisfactionSurveys.token, token));
}

export type EnvioFalho = {
  readonly id: string;
  readonly token: string;
  readonly email: string;
};

/**
 * Os envios que o provedor recusou — os candidatos a uma segunda tentativa.
 *
 * Só `envioOk = false`, nunca `null`. `false` é uma recusa explícita: a mensagem não saiu, e mandar
 * de novo não corre risco de duplicar. `null` é desconhecido — pode ter saído —, e reenviar por via
 * das dúvidas é o caminho para mandar a mesma pesquisa duas vezes para o mesmo cliente, que é o
 * defeito que esta tabela inteira existe para evitar.
 */
export async function enviosFalhos(): Promise<EnvioFalho[]> {
  if (!isDatabaseConfigured()) return [];

  const rows = await db()
    .select({
      id: satisfactionSurveys.id,
      token: satisfactionSurveys.token,
      email: users.email,
    })
    .from(satisfactionSurveys)
    .innerJoin(orders, eq(orders.id, satisfactionSurveys.orderId))
    .leftJoin(users, eq(users.id, orders.userId))
    .where(eq(satisfactionSurveys.envioOk, false))
    .orderBy(satisfactionSurveys.sentAt);

  return rows.flatMap((r) => (r.email === null ? [] : [{ ...r, email: r.email }]));
}

/** Uma pesquisa pelo id da linha — para reenviar exatamente aquela, sem recalcular fila. */
export async function pesquisaPorId(id: string): Promise<EnvioFalho | null> {
  if (!isDatabaseConfigured()) return null;

  const rows = await db()
    .select({
      id: satisfactionSurveys.id,
      token: satisfactionSurveys.token,
      email: users.email,
      envioOk: satisfactionSurveys.envioOk,
    })
    .from(satisfactionSurveys)
    .innerJoin(orders, eq(orders.id, satisfactionSurveys.orderId))
    .leftJoin(users, eq(users.id, orders.userId))
    .where(eq(satisfactionSurveys.id, id))
    .limit(1);

  const r = rows[0];
  /*
    O reenvio só vale para a recusa explícita. A checagem fica AQUI, e não só no botão da tela: um
    POST direto não passa pelo botão, e a regra que protege o cliente de receber duas vezes não pode
    morar na camada que qualquer um pode pular.
  */
  if (r === undefined || r.email === null || r.envioOk !== false) return null;
  return { id: r.id, token: r.token, email: r.email };
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

export type EnvioListado = {
  readonly id: string;
  readonly email: string | null;
  readonly sentAt: Date;
  readonly envioOk: boolean | null;
  readonly envioErro: string | null;
  readonly respondeu: boolean;
};

export async function lerPesquisas(): Promise<{
  enviadas: number;
  respostas: RespostaListada[];
  envios: EnvioListado[];
}> {
  if (!isDatabaseConfigured()) return { enviadas: 0, respostas: [], envios: [] };

  const [contagem, rows, envios] = await Promise.all([
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
    /*
      A lista de envios é a resposta para "quais foram e quais não foram". Vem completa, do mais
      recente para o mais antigo, sem filtro: uma lista que escondesse os que deram certo obrigaria
      a confiar que o que não aparece está bem — e é exatamente essa confiança que faltava.
    */
    db()
      .select({
        id: satisfactionSurveys.id,
        email: users.email,
        sentAt: satisfactionSurveys.sentAt,
        envioOk: satisfactionSurveys.envioOk,
        envioErro: satisfactionSurveys.envioErro,
        answeredAt: satisfactionSurveys.answeredAt,
      })
      .from(satisfactionSurveys)
      .innerJoin(orders, eq(orders.id, satisfactionSurveys.orderId))
      .leftJoin(users, eq(users.id, orders.userId))
      .orderBy(desc(satisfactionSurveys.sentAt)),
  ]);

  return {
    enviadas: Number(contagem[0]?.n ?? 0),
    respostas: rows.flatMap((r) =>
      r.dia === null ? [] : [{ ...r, dia: r.dia, notaLaudo: r.notaLaudo ?? null }],
    ),
    envios: envios.map((e) => ({
      id: e.id,
      email: e.email,
      sentAt: e.sentAt,
      envioOk: e.envioOk,
      envioErro: e.envioErro,
      respondeu: e.answeredAt !== null,
    })),
  };
}
