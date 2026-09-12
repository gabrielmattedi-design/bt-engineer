import 'server-only';
import { createHash } from 'node:crypto';
import { and, eq, gte, sql } from 'drizzle-orm';
import { db, isDatabaseConfigured } from '../client';
import { visitorCampaigns } from '../schema/campaigns';
import { orders, recommendationSessions } from '../schema';
import { anonymousSessions } from '../schema/sessions';
import { funnelMarkers } from '../schema/funnel';
import { recorte, SEM_LIMITE } from '../recorte';
import type { Janela } from '@/lib/periodo';

/**
 * Gravação e leitura da origem do visitante — §15.
 *
 * Ver `schema/campaigns.ts` para o desenho e o porquê de cada decisão.
 */

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export type Campanha = {
  readonly utm_source?: string;
  readonly utm_medium?: string;
  readonly utm_campaign?: string;
  readonly utm_content?: string;
};

/**
 * Grava a origem. Idempotente por visitante — primeiro toque vence.
 *
 * Nunca lança, pelo mesmo motivo de `markFunnel`: medição não pode derrubar o produto. Perder uma
 * linha de atribuição é barato; impedir alguém de responder o questionário não é.
 */
export async function recordCampaign(visitorToken: string, campanha: Campanha): Promise<void> {
  if (!isDatabaseConfigured()) return;
  if (!campanha.utm_source) return;

  try {
    await db()
      .insert(visitorCampaigns)
      .values({
        visitorHash: hashToken(visitorToken),
        source: campanha.utm_source,
        medium: campanha.utm_medium ?? null,
        campaign: campanha.utm_campaign ?? null,
        content: campanha.utm_content ?? null,
      })
      .onConflictDoNothing();
  } catch (error) {
    console.error('[campanha] não foi possível gravar a origem', error);
  }
}

export type LinhaDeOrigem = {
  readonly source: string;
  readonly campaign: string | null;
  /**
   * `utm_content` — QUAL CRIATIVO. `null` quando o link do anúncio não trouxe o parâmetro.
   *
   * ═══ POR QUE ESTA COLUNA PRECISOU EXISTIR (08/09/2026) ═══════════════════════════════════
   *
   * O campo era gravado desde o primeiro dia e NUNCA era lido. O relatório agrupava por origem e
   * campanha, então quatro criativos da mesma campanha somavam numa linha só — e a pergunta que
   * um teste de criativo existe para responder ("qual dos quatro traz gente que termina?") não
   * tinha como ser respondida, mesmo com o dado inteiro no banco.
   *
   * É o pior tipo de lacuna: não dá erro, não some do painel, e a tabela parece completa. Só
   * quando alguém vai decidir qual anúncio desligar é que a coluna que falta aparece.
   */
  readonly content: string | null;
  readonly visitors: number;
  readonly finished: number;
  readonly paid: number;
  /** % de quem chegou por esta origem e pagou. É a única coluna que decide onde investir. */
  readonly conversion: number;

  /**
   * ═══ AS TRÊS COLUNAS DE DINHEIRO, E POR QUE ELAS NÃO VÊM DO FUNIL ══════════════════════════
   *
   * `paid` acima conta MARCOS de funil: um por visitante, para sempre. Serve para a taxa de
   * conversão e não serve para caixa — a pessoa que compra o relatório e depois o upgrade aparece
   * uma vez ali e duas na conta bancária.
   *
   * Estas três vêm de `orders`, que é o registro do dinheiro. `clientes` é o denominador do CAC,
   * `pedidos` é o do custo por venda, e `receita` é o que se divide pelo gasto para ter o ROAS.
   */
  readonly clientes: number;
  readonly pedidos: number;
  readonly receitaCentavos: number;
};

/**
 * Desempenho por origem: quantos vieram, quantos terminaram o questionário, quantos pagaram.
 *
 * ─── POR QUE AS TRÊS COLUNAS, E NÃO SÓ A CONVERSÃO ─────────────────────────────────────────
 *
 * Duas origens com a mesma conversão final podem estar falhando em lugares opostos. Uma traz gente
 * que abandona o questionário na primeira tela — anúncio que promete outra coisa. A outra traz
 * gente que termina e não compra — público certo, preço ou oferta errados. A conversão sozinha diz
 * que ambas vão mal; a coluna do meio diz o que consertar em cada uma.
 *
 * ─── POR QUE `LEFT JOIN`, E NÃO FILTRAR ────────────────────────────────────────────────────
 *
 * Uma origem que trouxe cem pessoas e zero pagantes precisa APARECER com zero. Sumir da tabela
 * por não ter conversão é o pior desfecho possível: o anúncio que só queima dinheiro é justamente
 * o que fica invisível.
 */
export async function campaignReport(janela: Janela = SEM_LIMITE): Promise<LinhaDeOrigem[]> {
  if (!isDatabaseConfigured()) return [];

  const filtros = recorte(visitorCampaigns.createdAt, janela);

  const rows = await db()
    .select({
      source: visitorCampaigns.source,
      campaign: visitorCampaigns.campaign,
      content: visitorCampaigns.content,
      visitors: sql<number>`count(distinct ${visitorCampaigns.visitorHash})::int`,
      finished: sql<number>`count(distinct ${funnelMarkers.visitorHash}) filter (where ${funnelMarkers.marker} = 'quiz:done')::int`,
      paid: sql<number>`count(distinct ${funnelMarkers.visitorHash}) filter (where ${funnelMarkers.marker} = 'paid')::int`,
    })
    .from(visitorCampaigns)
    /*
      ─── POR QUE A JUNÇÃO TEM RESTRIÇÃO DE TEMPO ─────────────────────────────────────────────

      Ligar só pelo visitante creditava ao criativo QUALQUER marcador daquela pessoa, inclusive os
      anteriores ao clique no anúncio.

      O caso real que revelou isto, em 09/09/2026: o dono fez uma compra de teste, e horas depois
      abriu o questionário por um link `utm_content=reel-3-erros`. A tabela mostrou o criativo com
      1 chegada, 1 conclusão e **1 venda** — uma venda que aconteceu antes de o anúncio existir.

      Na campanha isso não seria um caso de teste: é o cliente que já comprou, vê o anúncio, clica
      e começa outro questionário. A compra velha dele vai para a coluna do criativo. Com quatro
      criativos e poucas vendas, um ou dois desses elegem o vencedor errado — e o número vem bonito,
      que é o pior jeito de estar errado.

      `gte` e não `gt` porque o marcador `quiz:start` e a linha de campanha nascem na mesma ação
      (etapa 0), e podem gravar o mesmo instante.
    */
    .leftJoin(
      funnelMarkers,
      and(
        eq(funnelMarkers.visitorHash, visitorCampaigns.visitorHash),
        gte(funnelMarkers.createdAt, visitorCampaigns.createdAt),
      ),
    )
    .where(filtros.length > 0 ? and(...filtros) : undefined)
    .groupBy(visitorCampaigns.source, visitorCampaigns.campaign, visitorCampaigns.content);

  const dinheiro = await dinheiroPorOrigem(janela);

  return computeCampaigns(
    rows.map((r) => {
      const caixa = dinheiro.get(chave(r.source, r.campaign, r.content));
      return {
        source: r.source,
        campaign: r.campaign,
        content: r.content,
        visitors: Number(r.visitors),
        finished: Number(r.finished),
        paid: Number(r.paid),
        clientes: caixa?.clientes ?? 0,
        pedidos: caixa?.pedidos ?? 0,
        receitaCentavos: caixa?.receitaCentavos ?? 0,
      };
    }),
  );
}

function chave(source: string, campaign: string | null, content: string | null): string {
  return `${source}|${campaign ?? ''}|${content ?? ''}`;
}

/**
 * Clientes, pedidos e receita por origem — em consulta SEPARADA, e isso não é preferência.
 *
 * ═══ POR QUE NÃO ENTRA NA CONSULTA DE CIMA ═══════════════════════════════════════════════════
 *
 * Juntar marcos de funil E pedidos na mesma consulta produz um produto cartesiano: cada marco do
 * visitante multiplica cada pedido dele. `count(distinct …)` sobrevive a isso; **`sum` não.** A
 * receita sairia multiplicada pelo número de marcos da pessoa — um número maior, plausível, e
 * completamente inventado.
 *
 * Duas consultas e uma junção em memória custam um round-trip e eliminam a classe inteira.
 *
 * ═══ POR QUE ISTO PRECISOU EXISTIR (12/09/2026) ══════════════════════════════════════════════
 *
 * A tabela de origens dizia quantas PESSOAS pagaram e mais nada. O dono tinha o gasto do Meta por
 * dia e não conseguia fechar o CAC por origem: via um e-mail com três compras no dia e não tinha
 * como saber se aquela pessoa veio do anúncio ou do link da bio.
 *
 * ─── AS DUAS PONTAS DA CORRENTE ──────────────────────────────────────────────────────────────
 *
 * O pedido guarda a sessão do navegador que comprou; o funil e a campanha guardam o HASH do cookie.
 * `anonymous_sessions` liga os dois. E o dono do pedido é `coalesce(sessão da análise, sessão do
 * pedido)` — a mesma ordem de `processPaymentEvent`, porque a pessoa pode ter comprado de outro
 * aparelho e a identidade que vale é a de quem respondeu o questionário.
 */
async function dinheiroPorOrigem(
  janela: Janela,
): Promise<Map<string, { clientes: number; pedidos: number; receitaCentavos: number }>> {
  const vazio = new Map<string, { clientes: number; pedidos: number; receitaCentavos: number }>();
  if (!isDatabaseConfigured()) return vazio;

  /*
    O recorte do dinheiro é por `paid_at` — o dia em que a venda entrou —, enquanto o das colunas de
    cima é por data de CHEGADA. São relógios diferentes de propósito, e a tela diz isso: para casar
    com o gasto diário do Meta, o que importa é quando o dinheiro caiu.
  */
  const pagos = db()
    .select({
      dono: sql<string>`coalesce(${recommendationSessions.sessionId}, ${orders.sessionId})`.as(
        'dono',
      ),
      orderId: sql<string>`${orders.id}`.as('pedido_id'),
      valor: sql<number>`${orders.amountCents}`.as('valor'),
      pagoEm: sql<Date>`${orders.paidAt}`.as('pago_em'),
    })
    .from(orders)
    .leftJoin(recommendationSessions, eq(recommendationSessions.id, orders.recommendationSessionId))
    .where(and(eq(orders.status, 'paid'), ...recorte(orders.paidAt, janela)))
    .as('pagos');

  try {
    const linhas = await db()
      .select({
        source: visitorCampaigns.source,
        campaign: visitorCampaigns.campaign,
        content: visitorCampaigns.content,
        clientes: sql<number>`count(distinct ${pagos.dono})::int`,
        pedidos: sql<number>`count(distinct ${pagos.orderId})::int`,
        receitaCentavos: sql<number>`coalesce(sum(${pagos.valor}), 0)::int`,
      })
      .from(visitorCampaigns)
      .innerJoin(
        anonymousSessions,
        eq(anonymousSessions.cookieTokenHash, visitorCampaigns.visitorHash),
      )
      /*
        A MESMA trava de tempo da consulta de cima, e pelo mesmo motivo. Sem ela, o cliente antigo
        que clica no anúncio hoje faz a compra velha dele virar receita do criativo — e o número
        vem bonito, que é o pior jeito de estar errado.
      */
      .innerJoin(
        pagos,
        and(eq(pagos.dono, anonymousSessions.id), gte(pagos.pagoEm, visitorCampaigns.createdAt)),
      )
      .groupBy(visitorCampaigns.source, visitorCampaigns.campaign, visitorCampaigns.content);

    const mapa = new Map<string, { clientes: number; pedidos: number; receitaCentavos: number }>();
    for (const l of linhas) {
      mapa.set(chave(l.source, l.campaign, l.content), {
        clientes: Number(l.clientes),
        pedidos: Number(l.pedidos),
        receitaCentavos: Number(l.receitaCentavos),
      });
    }
    return mapa;
  } catch (error) {
    console.error('[campanha] não foi possível somar a receita por origem', error);
    return vazio;
  }
}

/** O cálculo, separado da consulta — mesmo motivo de `computeFunnel`: é onde mora a divisão por zero. */
export function computeCampaigns(
  rows: readonly {
    source: string;
    campaign: string | null;
    content: string | null;
    visitors: number;
    finished: number;
    paid: number;
    /*
      Opcionais porque esta função é pura e existe para a ARITMÉTICA da conversão — o teste dela
      monta linhas à mão e não tem por que inventar caixa. Ausente vira zero, que é o mesmo que a
      consulta devolve para a origem que não vendeu.
    */
    clientes?: number;
    pedidos?: number;
    receitaCentavos?: number;
  }[],
): LinhaDeOrigem[] {
  return rows
    .map((r) => ({
      ...r,
      clientes: r.clientes ?? 0,
      pedidos: r.pedidos ?? 0,
      receitaCentavos: r.receitaCentavos ?? 0,
      conversion: r.visitors > 0 ? (r.paid / r.visitors) * 100 : 0,
    }))
    /*
      Ordena por VOLUME de visitantes, não por conversão.

      Uma origem com 1 visitante e 1 pagante marca 100% e encabeçaria a lista, empurrando para
      baixo a que trouxe trezentas pessoas e converteu 4%. O número grande ali não é resultado, é
      ruído de amostra pequena — e ordenar por ele faria o painel recomendar exatamente a origem
      sobre a qual não se sabe nada.
    */
    .sort((a, b) => b.visitors - a.visitors);
}
