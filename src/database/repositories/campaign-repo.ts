import 'server-only';
import { createHash } from 'node:crypto';
import { and, eq, gte, sql } from 'drizzle-orm';
import { db, isDatabaseConfigured } from '../client';
import { visitorCampaigns } from '../schema/campaigns';
import { funnelMarkers } from '../schema/funnel';

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
  readonly visitors: number;
  readonly finished: number;
  readonly paid: number;
  /** % de quem chegou por esta origem e pagou. É a única coluna que decide onde investir. */
  readonly conversion: number;
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
export async function campaignReport(sinceDays: number | null = null): Promise<LinhaDeOrigem[]> {
  if (!isDatabaseConfigured()) return [];

  const filtros = [];
  if (sinceDays !== null) {
    const desde = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
    filtros.push(gte(visitorCampaigns.createdAt, desde));
  }

  const rows = await db()
    .select({
      source: visitorCampaigns.source,
      campaign: visitorCampaigns.campaign,
      visitors: sql<number>`count(distinct ${visitorCampaigns.visitorHash})::int`,
      finished: sql<number>`count(distinct ${funnelMarkers.visitorHash}) filter (where ${funnelMarkers.marker} = 'quiz:done')::int`,
      paid: sql<number>`count(distinct ${funnelMarkers.visitorHash}) filter (where ${funnelMarkers.marker} = 'paid')::int`,
    })
    .from(visitorCampaigns)
    .leftJoin(funnelMarkers, eq(funnelMarkers.visitorHash, visitorCampaigns.visitorHash))
    .where(filtros.length > 0 ? and(...filtros) : undefined)
    .groupBy(visitorCampaigns.source, visitorCampaigns.campaign);

  return computeCampaigns(
    rows.map((r) => ({
      source: r.source,
      campaign: r.campaign,
      visitors: Number(r.visitors),
      finished: Number(r.finished),
      paid: Number(r.paid),
    })),
  );
}

/** O cálculo, separado da consulta — mesmo motivo de `computeFunnel`: é onde mora a divisão por zero. */
export function computeCampaigns(
  rows: readonly { source: string; campaign: string | null; visitors: number; finished: number; paid: number }[],
): LinhaDeOrigem[] {
  return rows
    .map((r) => ({
      ...r,
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
