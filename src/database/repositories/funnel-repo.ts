import 'server-only';
import { createHash } from 'node:crypto';
import { and, eq, gte, sql } from 'drizzle-orm';
import { db, isDatabaseConfigured } from '../client';
import { funnelMarkers } from '../schema/funnel';
import { anonymousSessions } from '../schema/sessions';

/**
 * Registro e leitura do funil — §16 da lista de lançamento.
 *
 * ═══ A PERGUNTA QUE ISTO EXISTE PARA RESPONDER ═══════════════════════════════════════════════
 *
 * "De cada cem pessoas que abrem o questionário, quantas pagam — e onde as outras noventa e tantas
 * desistem?" Sem isso, comprar tráfego é comprar no escuro: o gasto aparece na fatura e o motivo
 * de não converter não aparece em lugar nenhum.
 *
 * E é um dado que NÃO dá para reconstruir depois. Quem abandonou o questionário ontem sem deixar
 * marco não deixou rastro nenhum — o abandono é, por natureza, ausência de dado. Ou se grava no
 * momento, ou se perde para sempre. É por isso que vale instrumentar antes do primeiro anúncio, e
 * não depois de estranhar o resultado.
 */

/**
 * Os marcos, na ordem do funil.
 *
 * As etapas do questionário entram como `quiz:N` e não com o nome da etapa: os rótulos mudam
 * quando o questionário é reescrito, e um funil cujo histórico se renomeia sozinho perde a
 * comparação entre antes e depois da mudança — que é justamente a medida que interessa.
 */
export const FUNNEL_STEPS = [
  { marker: 'quiz:start', label: 'Abriu o questionário' },
  { marker: 'quiz:done', label: 'Terminou o questionário' },
  { marker: 'analysis', label: 'Viu a prévia da análise' },
  { marker: 'plans', label: 'Abriu os planos' },
  { marker: 'checkout', label: 'Iniciou o pagamento' },
  { marker: 'paid', label: 'Pagou' },
  { marker: 'report', label: 'Abriu o relatório' },
] as const;

export type FunnelMarker = string;

/** Mesmo hash de `session-repo`, pelo mesmo motivo: o banco nunca guarda o token em claro. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Grava um marco. Idempotente por (visitante, marco).
 *
 * ─── POR QUE ELE NUNCA LANÇA ───────────────────────────────────────────────────────────────
 *
 * Medição não pode derrubar o produto. Se o banco estiver fora do ar, a pessoa ainda precisa
 * conseguir responder o questionário e ver o relatório — perder uma linha de métrica é barato,
 * perder uma venda não é. O erro vai para o log e o fluxo segue.
 */
export async function markFunnel(visitorToken: string, marker: FunnelMarker): Promise<void> {
  if (!isDatabaseConfigured()) return;

  try {
    await db()
      .insert(funnelMarkers)
      .values({ visitorHash: hashToken(visitorToken), marker })
      .onConflictDoNothing();
  } catch (error) {
    console.error('[funil] não foi possível gravar o marco', marker, error);
  }
}

/**
 * Marca um ponto a partir do id da sessão anônima, e não do cookie.
 *
 * O webhook de pagamento é uma chamada SERVIDOR A SERVIDOR: quem bate na URL é o gateway, que não
 * tem cookie nenhum do comprador. O elo é o pedido, que guarda `session_id` — e a sessão anônima
 * guarda o mesmo hash que este funil usa como chave.
 *
 * É o único marco que atravessa essa fronteira, e é justamente o que interessa mais: sem ele o
 * funil terminaria em "iniciou o pagamento" e nunca saberia quem chegou a pagar.
 */
export async function markFunnelBySessionId(sessionId: string, marker: FunnelMarker): Promise<void> {
  if (!isDatabaseConfigured()) return;

  try {
    const rows = await db()
      .select({ hash: anonymousSessions.cookieTokenHash })
      .from(anonymousSessions)
      .where(eq(anonymousSessions.id, sessionId))
      .limit(1);

    const hash = rows[0]?.hash;
    if (!hash) return;

    await db().insert(funnelMarkers).values({ visitorHash: hash, marker }).onConflictDoNothing();
  } catch (error) {
    console.error('[funil] não foi possível gravar o marco por sessão', marker, error);
  }
}

export type FunnelRow = {
  readonly marker: string;
  readonly label: string;
  readonly visitors: number;
  /** % de quem chegou ao PRIMEIRO marco do funil. */
  readonly ofStart: number;
  /** % de quem chegou ao marco ANTERIOR — onde a perda acontece. */
  readonly ofPrevious: number;
};

/**
 * O funil inteiro, opcionalmente recortado por período.
 *
 * ─── POR QUE AS DUAS PERCENTAGENS ──────────────────────────────────────────────────────────
 *
 * `ofStart` responde "quanto do topo sobrou aqui" — é a régua do negócio. `ofPrevious` responde
 * "quanto se perdeu NESTA etapa" — é a régua do conserto. Só a primeira esconde onde está o
 * vazamento: uma etapa que retém 95% parece ótima em `ofStart` se as anteriores já derrubaram
 * tudo, e uma que derruba metade some no meio de percentuais pequenos.
 */
/**
 * O cálculo, separado da consulta.
 *
 * Puro de propósito: é aqui que moram as decisões que podem estar erradas em silêncio — divisão
 * por zero num funil vazio, percentual que passa de 100 quando uma etapa posterior tem mais gente
 * que a anterior, marco ausente contado como zero em vez de sumir. Nada disso precisa de banco
 * para ser testado, e um cálculo de conversão que só é exercitado em produção é um cálculo que
 * ninguém conferiu.
 */
export function computeFunnel(contagem: ReadonlyMap<string, number>): FunnelRow[] {
  const inicio = contagem.get(FUNNEL_STEPS[0].marker) ?? 0;

  let anterior = inicio;
  return FUNNEL_STEPS.map((step) => {
    const visitors = contagem.get(step.marker) ?? 0;
    const linha: FunnelRow = {
      marker: step.marker,
      label: step.label,
      visitors,
      ofStart: inicio > 0 ? (visitors / inicio) * 100 : 0,
      ofPrevious: anterior > 0 ? (visitors / anterior) * 100 : 0,
    };
    anterior = visitors;
    return linha;
  });
}

export async function funnelReport(sinceDays: number | null = null): Promise<FunnelRow[]> {
  if (!isDatabaseConfigured()) return [];

  const filtros = [];
  if (sinceDays !== null) {
    const desde = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
    filtros.push(gte(funnelMarkers.createdAt, desde));
  }

  const rows = await db()
    .select({
      marker: funnelMarkers.marker,
      visitors: sql<number>`count(distinct ${funnelMarkers.visitorHash})::int`,
    })
    .from(funnelMarkers)
    .where(filtros.length > 0 ? and(...filtros) : undefined)
    .groupBy(funnelMarkers.marker);

  return computeFunnel(new Map(rows.map((r) => [r.marker, Number(r.visitors)])));
}

/**
 * Quando a medição de fato começou — a data do marco mais antigo que existe.
 *
 * ═══ POR QUE ISTO PRECISOU EXISTIR ═══════════════════════════════════════════════════════════
 *
 * A tabela deste funil nasceu DEPOIS do código que a alimenta. Entre um e outro, `markFunnel`
 * engoliu todos os erros — como deve, porque medição não pode derrubar o produto — e cada marco
 * daquele período foi descartado em silêncio.
 *
 * O efeito no painel é uma leitura que parece defeito de cálculo: quem abriu o questionário antes
 * da tabela existir não tem `quiz:start`, mas chegou aos planos e pagou depois, e ESSES marcos
 * foram gravados. O resultado é uma etapa do meio com mais gente que o topo.
 *
 * O mesmo acontece toda vez que a instrumentação mudar: um marco novo começa a contar hoje, e as
 * etapas ao redor dele carregam meses de histórico. Sem a data na tela, a única saída de quem lê é
 * desconfiar do número — e um painel em que não se confia é um painel que não se usa.
 */
export async function funnelStartedAt(): Promise<Date | null> {
  if (!isDatabaseConfigured()) return null;

  try {
    const rows = await db()
      .select({ primeiro: sql<Date | null>`min(${funnelMarkers.createdAt})` })
      .from(funnelMarkers);
    return rows[0]?.primeiro ? new Date(rows[0].primeiro) : null;
  } catch {
    return null;
  }
}

export type QuizDropoff = {
  readonly step: number;
  readonly reached: number;
  readonly lostHere: number;
};

/**
 * Em QUAL etapa do questionário as pessoas param.
 *
 * É a medida mais acionável do conjunto: um questionário de sete etapas perde gente em todas, mas
 * quase sempre há uma que perde muito mais que as vizinhas — e essa é uma pergunta específica que
 * dá para reescrever, encurtar ou explicar melhor. Sem o recorte por etapa, o que sobra é o número
 * agregado de abandono, que diz que existe um problema e não diz onde.
 */
export async function quizDropoff(sinceDays: number | null = null): Promise<QuizDropoff[]> {
  if (!isDatabaseConfigured()) return [];

  const filtros = [sql`${funnelMarkers.marker} like 'quiz:%'`];
  if (sinceDays !== null) {
    const desde = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
    filtros.push(gte(funnelMarkers.createdAt, desde));
  }

  const rows = await db()
    .select({
      marker: funnelMarkers.marker,
      visitors: sql<number>`count(distinct ${funnelMarkers.visitorHash})::int`,
    })
    .from(funnelMarkers)
    .where(and(...filtros))
    .groupBy(funnelMarkers.marker);

  return computeQuizDropoff(rows.map((r) => ({ marker: r.marker, visitors: Number(r.visitors) })));
}

/** O cálculo do abandono por etapa, separado da consulta pelo mesmo motivo de `computeFunnel`. */
export function computeQuizDropoff(
  rows: readonly { marker: string; visitors: number }[],
): QuizDropoff[] {
  const porEtapa = new Map<number, number>();
  for (const r of rows) {
    const sufixo = r.marker.split(':')[1];
    /*
      `quiz:start` É a etapa zero — a abertura. Sem esta linha ela cairia no `NaN` junto com
      `quiz:done` e o painel mostraria a queda a partir da segunda etapa, escondendo justamente a
      maior perda de qualquer questionário: a que acontece na primeira tela.
    */
    const n = sufixo === 'start' ? 0 : Number(sufixo);
    if (Number.isFinite(n)) porEtapa.set(n, Number(r.visitors));
  }

  const etapas = [...porEtapa.keys()].sort((a, b) => a - b);
  return etapas.map((step, i) => {
    const reached = porEtapa.get(step) ?? 0;
    const proxima = etapas[i + 1] !== undefined ? (porEtapa.get(etapas[i + 1]!) ?? 0) : null;
    return {
      step,
      reached,
      // Na última etapa conhecida não há "próxima" para comparar — a perda ali é desconhecida,
      // não zero. Zero seria afirmar que ninguém desistiu no fim.
      lostHere: proxima === null ? 0 : Math.max(0, reached - proxima),
    };
  });
}
