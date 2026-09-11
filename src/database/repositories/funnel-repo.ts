import 'server-only';
import { createHash } from 'node:crypto';
import { and, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import { db, isDatabaseConfigured } from '../client';
import { funnelMarkers } from '../schema/funnel';
import { anonymousSessions, recommendationSessions } from '../schema/sessions';
import { accessCoupons, couponRedemptions } from '../schema/coupons';
import { visitorCampaigns } from '../schema/campaigns';
import { recorte, SEM_LIMITE } from '../recorte';
import type { Janela } from '@/lib/periodo';

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

export async function funnelReport(janela: Janela = SEM_LIMITE): Promise<FunnelRow[]> {
  if (!isDatabaseConfigured()) return [];

  const filtros = recorte(funnelMarkers.createdAt, janela);

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
export async function quizDropoff(janela: Janela = SEM_LIMITE): Promise<QuizDropoff[]> {
  if (!isDatabaseConfigured()) return [];

  const filtros = [
    sql`${funnelMarkers.marker} like 'quiz:%'`,
    ...recorte(funnelMarkers.createdAt, janela),
  ];

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

/**
 * ZERA A MEDIÇÃO — e nada além dela.
 *
 * ═══ POR QUE ISTO EXISTE ═════════════════════════════════════════════════════════════════════
 *
 * Pedido do dono na véspera do lançamento: "consegue zerar agora o funil, para eu ter real ideia
 * do público quando lançar?"
 *
 * A razão é boa e a conta é simples. Todo marco gravado até aqui é dele mesmo testando — dezenas
 * de questionários respondidos, pagamentos aprovados e recusados, telas abertas e reabertas. Um
 * funil que soma o dono ao público não mede o público: ele mede os dois juntos, e a taxa de
 * conversão que sai daí não serve para decidir nada. Pior, ela ENGANA na direção otimista, porque
 * quem testa completa o fluxo inteiro muito mais do que um visitante real.
 *
 * ═══ O QUE ELA APAGA, E O QUE ELA NÃO ENCOSTA ════════════════════════════════════════════════
 *
 * Apaga `funnel_markers` e `visitor_campaigns` — as duas tabelas de MEDIÇÃO, e as duas juntas de
 * propósito: a origem do tráfego é lida ao lado do funil no mesmo painel, e zerar uma sem a outra
 * deixaria o painel comparando um período com outro na mesma tela.
 *
 * NÃO encosta em `orders`, `recommendation_sessions`, `entitlements`, `users` nem `coupons`. As
 * compras de teste continuam existindo, os relatórios continuam abrindo pelos links já enviados, e
 * quem tem acesso continua tendo. Zerar métrica não pode apagar venda — são coisas de natureza
 * diferente, e confundir as duas seria destruir o registro fiscal de uma operação para limpar um
 * gráfico.
 *
 * ═══ POR QUE NÃO TEM VOLTA, E O QUE ISSO EXIGE DE QUEM CHAMA ═════════════════════════════════
 *
 * O cabeçalho deste arquivo já diz: abandono é ausência de dado, "ou se grava no momento, ou se
 * perde para sempre". O mesmo vale ao contrário — apagado, não há de onde reconstruir. Não existe
 * backup destas linhas em lugar nenhum do produto.
 *
 * Por isso a tela que chama isto exige confirmação DIGITADA, e não um clique. Um botão vermelho
 * num painel que alguém abre todo dia é uma questão de tempo até ser clicado sem querer — e o
 * estrago só apareceria semanas depois, quando alguém procurasse a comparação com o mês anterior.
 *
 * Devolve quantas linhas saíram de cada tabela, para a tela poder dizer o que de fato aconteceu em
 * vez de um "pronto" que não prova nada.
 */
export async function resetFunnel(): Promise<{ marcos: number; origens: number }> {
  if (!isDatabaseConfigured()) return { marcos: 0, origens: 0 };

  const conn = db();
  const marcos = await conn.delete(funnelMarkers).returning({ id: funnelMarkers.id });
  const origens = await conn.delete(visitorCampaigns).returning({ id: visitorCampaigns.id });

  return { marcos: marcos.length, origens: origens.length };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 * RECONCILIAÇÃO — apagar o resíduo da instrumentação antiga, e só ele.
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * ═══ POR QUE ISTO PRECISOU EXISTIR ═══════════════════════════════════════════════════════════
 *
 * O marco `report` era gravado pelo cookie do navegador enquanto `paid` era gravado pela sessão do
 * pedido — duas identidades diferentes somadas na mesma coluna. O painel mostrou 1 pagamento e 2
 * relatórios, depois 3 e 4, e um funil que alarga no fim é impossível por construção.
 *
 * A instrumentação foi consertada: os dois marcos agora contam a sessão dona da análise. Só que
 * marco gravado não se reescreve sozinho, e o dono continuou olhando para uma linha final maior que
 * a anterior — que é justamente a leitura que faz alguém desconfiar de que houve acesso sem
 * pagamento.
 *
 * ═══ POR QUE NÃO É "AJUSTAR PARA TRÊS" ═══════════════════════════════════════════════════════
 *
 * O pedido foi "voltar o relatório pra três". Fazer isso literalmente — apagar linhas até a conta
 * fechar — resolveria a tela de hoje e deixaria um funil onde o número foi digitado, não medido.
 * O primeiro dia em que o novo total não batesse, ninguém saberia se o dado está errado ou se a
 * correção manual está velha.
 *
 * A regra aqui é derivada, e por isso repetível: depois do conserto, `report` só é gravado quando
 * existe entitlement vindo de PEDIDO, na mesma identidade que o `paid` usa. Logo, todo `report` sem
 * `paid` correspondente é, por construção, resíduo do defeito antigo — e nenhum outro é.
 *
 * A conta de quem sobra não é escolhida: ela cai onde tem de cair.
 *
 * ═══ POR QUE EM DUAS FUNÇÕES, E POR QUE NA MEMÓRIA ═══════════════════════════════════════════
 *
 * Contar e apagar são separados para a tela poder MOSTRAR quantos são antes de oferecer o botão —
 * um botão de apagar que não diz quanto vai apagar é um botão que se clica no escuro.
 *
 * A diferença é calculada em JavaScript e não com um `NOT IN` em SQL. São dezenas de linhas, o
 * ganho de fazer no banco é nulo, e o custo seria uma subconsulta correlacionada que ninguém relê
 * com confiança seis meses depois. A lição de ontem foi que a forma esperta e a forma da casa
 * geram o mesmo resultado até o dia em que não geram.
 */
async function hashesOrfaosDeRelatorio(): Promise<string[]> {
  const linhas = await db()
    .select({ hash: funnelMarkers.visitorHash, marker: funnelMarkers.marker })
    .from(funnelMarkers)
    .where(sql`${funnelMarkers.marker} in ('report', 'paid')`);

  const pagaram = new Set(linhas.filter((l) => l.marker === 'paid').map((l) => l.hash));
  return linhas.filter((l) => l.marker === 'report' && !pagaram.has(l.hash)).map((l) => l.hash);
}

/** Quantos marcos de relatório não têm pagamento correspondente. Zero quando o funil está coerente. */
export async function contarRelatoriosSemPagamento(): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  try {
    return (await hashesOrfaosDeRelatorio()).length;
  } catch (error) {
    console.error('[funil] não foi possível conferir a coerência do funil', error);
    return 0;
  }
}

/**
 * Apaga os marcos `report` sem `paid` correspondente. Devolve quantos saíram.
 *
 * Só toca no marco `report`. Os outros marcos daquele mesmo visitante — `quiz:start`, `analysis`,
 * `plans` — continuam existindo, porque aquela pessoa DE FATO passou por eles. O defeito era a
 * identidade do último marco, não a existência da visita.
 */
export async function removerRelatoriosSemPagamento(): Promise<number> {
  if (!isDatabaseConfigured()) return 0;

  const orfaos = await hashesOrfaosDeRelatorio();
  // `inArray` com lista vazia gera SQL inválido em vez de não apagar nada — a guarda é o conserto.
  if (orfaos.length === 0) return 0;

  const apagados = await db()
    .delete(funnelMarkers)
    .where(and(eq(funnelMarkers.marker, 'report'), inArray(funnelMarkers.visitorHash, orfaos)))
    .returning({ id: funnelMarkers.id });

  return apagados.length;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 * CONVIDADO NÃO É FUNIL — quem entra por cupom de acesso sai da medição.
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * ═══ POR QUE ═══════════════════════════════════════════════════════════════════════════════════
 *
 * Pedido do dono: "quem usar o cupom que dá acesso total de graça não fica registrado no funil".
 *
 * Metade disso já era verdade — `checkout`, `paid` e `report` só existem para quem passou pelo
 * pagamento. O que sobrava era o começo: `quiz:*`, `analysis` e `plans`. E é ali que o convidado
 * mais atrapalha, porque ele infla o TOPO. Um funil com dez visitantes reais e cinco convidados diz
 * que a conversão de planos para checkout é de 20% quando na verdade é de 30% — e o número que sai
 * daí decide preço e decide anúncio.
 *
 * O convidado não é ruído acidental: ele nunca esteve no caminho de compra. Contá-lo não mede um
 * público que existe; mede um público que foi convidado a não pagar.
 *
 * ═══ POR QUE APAGAR DEPOIS, E NÃO DEIXAR DE MARCAR ═══════════════════════════════════════════
 *
 * O cupom é digitado na TELA DE PLANOS, depois de a pessoa já ter respondido o questionário e visto
 * a prévia. Quando se descobre que ela é convidada, os marcos já existem. Não há como não marcar —
 * só há como remover.
 *
 * ═══ AS DUAS GUARDAS, E POR QUE CADA UMA ESTÁ AQUI ═══════════════════════════════════════════
 *
 * 1. Só o cupom de ACESSO. `coupon_redemptions` guarda os dois tipos de resgate: o acesso grátis e
 *    o desconto consumido no pagamento. Quem usou desconto PAGOU, é cliente, e apagá-lo do funil
 *    seria destruir a medição de uma venda real para limpar a de um convite. O discriminador é
 *    `discount_percent IS NULL` em `access_coupons`.
 *
 * 2. Nunca apaga quem tem `paid`. Uma pessoa pode ser convidada numa análise e COMPRAR em outra, do
 *    mesmo navegador — mesmo hash, duas jornadas. Apagar tudo naquele hash levaria junto a compra.
 *    Na dúvida, o convidado fica no funil: contar um convidado a mais distorce um pouco, apagar uma
 *    venda apaga a única coisa que o funil existe para medir.
 */
async function hashDaAnalise(recommendationSessionId: string): Promise<string | null> {
  const linhas = await db()
    .select({ hash: anonymousSessions.cookieTokenHash })
    .from(recommendationSessions)
    .innerJoin(anonymousSessions, eq(anonymousSessions.id, recommendationSessions.sessionId))
    .where(eq(recommendationSessions.id, recommendationSessionId))
    .limit(1);

  return linhas[0]?.hash ?? null;
}

/** Já tem venda registrada? Então este hash não sai do funil — ver a guarda 2. */
async function temPagamento(hash: string): Promise<boolean> {
  const linhas = await db()
    .select({ id: funnelMarkers.id })
    .from(funnelMarkers)
    .where(and(eq(funnelMarkers.visitorHash, hash), eq(funnelMarkers.marker, 'paid')))
    .limit(1);

  return linhas.length > 0;
}

/**
 * Tira do funil a jornada da análise liberada por cupom de acesso. Devolve quantos marcos saíram.
 *
 * NUNCA lança, pelo mesmo motivo de `markFunnel`: medição não pode derrubar o produto. Se isto
 * falhar, o convidado recebe o acesso que veio buscar e o funil fica com um registro a mais — o
 * erro barato dos dois.
 */
export async function removerDoFunilPelaAnalise(recommendationSessionId: string): Promise<number> {
  if (!isDatabaseConfigured()) return 0;

  try {
    const hash = await hashDaAnalise(recommendationSessionId);
    if (!hash) return 0;
    if (await temPagamento(hash)) return 0;

    const apagados = await db()
      .delete(funnelMarkers)
      .where(eq(funnelMarkers.visitorHash, hash))
      .returning({ id: funnelMarkers.id });

    return apagados.length;
  } catch (error) {
    console.error('[funil] não foi possível remover a jornada do convidado', error);
    return 0;
  }
}

/** As análises liberadas por cupom de ACESSO — nunca as de desconto. Ver a guarda 1. */
async function analisesLiberadasPorCupom(): Promise<string[]> {
  const linhas = await db()
    .select({ id: couponRedemptions.recommendationSessionId })
    .from(couponRedemptions)
    .innerJoin(accessCoupons, eq(accessCoupons.code, couponRedemptions.code))
    .where(isNull(accessCoupons.discountPercent));

  return [...new Set(linhas.map((l) => l.id))];
}

/**
 * Quantas jornadas de convidado ainda estão no funil.
 *
 * Existe para a tela poder oferecer a limpeza dos resgates ANTERIORES a esta mudança — a remoção
 * automática só vale dos próximos em diante, e quem já entrou de graça continuaria contado.
 */
export async function contarJornadasDeCupomNoFunil(): Promise<number> {
  if (!isDatabaseConfigured()) return 0;

  try {
    let n = 0;
    for (const analise of await analisesLiberadasPorCupom()) {
      const hash = await hashDaAnalise(analise);
      if (!hash || (await temPagamento(hash))) continue;

      const linhas = await db()
        .select({ id: funnelMarkers.id })
        .from(funnelMarkers)
        .where(eq(funnelMarkers.visitorHash, hash))
        .limit(1);
      if (linhas.length > 0) n += 1;
    }
    return n;
  } catch (error) {
    console.error('[funil] não foi possível contar as jornadas de convidado', error);
    return 0;
  }
}

/** Remove as jornadas de convidado que ficaram no funil. Devolve quantas análises foram limpas. */
export async function removerJornadasDeCupomDoFunil(): Promise<number> {
  if (!isDatabaseConfigured()) return 0;

  let limpas = 0;
  for (const analise of await analisesLiberadasPorCupom()) {
    if ((await removerDoFunilPelaAnalise(analise)) > 0) limpas += 1;
  }
  return limpas;
}
