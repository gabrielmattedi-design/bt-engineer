import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/database/client';
import { accessCoupons, couponRedemptions, entitlements, recommendationSessions } from '@/database/schema';
import { ALL_ENTITLEMENTS, type Entitlement } from '@/payments/entitlements';

/**
 * Códigos de acesso — criação, resgate e listagem.
 *
 * Ver `schema/coupons.ts` para o desenho. Este módulo concentra a única operação delicada:
 * consumir um uso sem que dois resgates simultâneos passem pelo mesmo.
 */

export type CouponSummary = {
  readonly code: string;
  readonly grants: readonly string[];
  readonly maxUses: number | null;
  readonly usedCount: number;
  readonly active: boolean;
  readonly note: string | null;
};

export type RedeemOutcome =
  | { kind: 'granted'; entitlements: readonly Entitlement[] }
  | { kind: 'already_redeemed' }
  | { kind: 'invalid' }
  | { kind: 'exhausted' };

/** Normalização única: o código é sempre comparado e gravado em maiúsculas, sem espaços. */
export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export async function listCoupons(): Promise<CouponSummary[]> {
  const rows = await db().select().from(accessCoupons).orderBy(accessCoupons.createdAt);
  return rows.map((r) => ({
    code: r.code,
    grants: r.grants,
    maxUses: r.maxUses,
    usedCount: r.usedCount,
    active: r.active,
    note: r.note,
  }));
}

export async function upsertCoupon(input: {
  code: string;
  grants: readonly string[];
  maxUses: number | null;
  note: string | null;
}): Promise<void> {
  const code = normalizeCode(input.code);
  await db()
    .insert(accessCoupons)
    .values({
      code,
      grants: [...input.grants],
      maxUses: input.maxUses,
      note: input.note,
      active: true,
    })
    .onConflictDoUpdate({
      target: accessCoupons.code,
      // O contador NÃO é zerado ao editar: quem já usou continua tendo usado.
      set: { grants: [...input.grants], maxUses: input.maxUses, note: input.note, active: true },
    });
}

export async function setCouponActive(code: string, active: boolean): Promise<void> {
  await db()
    .update(accessCoupons)
    .set({ active })
    .where(eq(accessCoupons.code, normalizeCode(code)));
}

/**
 * Resgata um código para uma sessão de recomendação.
 *
 * ─── A ORDEM DAS OPERAÇÕES É A PROTEÇÃO ──────────────────────────────────────────────────────
 *
 * 1. O uso é consumido primeiro, num UPDATE que carrega a condição de limite no próprio WHERE.
 *    Se o código acabou, o UPDATE não afeta linha alguma e nada mais acontece. Fazer `SELECT` e
 *    depois `UPDATE` deixaria uma janela em que dois resgates leem "19 de 20" e ambos gravam 20 —
 *    e "20 usos" viraria um número aproximado.
 *
 * 2. Só então os entitlements são concedidos, com `onConflictDoNothing` sobre o índice único de
 *    (sessão, recomendação, entitlement). Reenviar o mesmo código na mesma análise não concede
 *    nada de novo.
 *
 * O índice único de `coupon_redemptions` (código, recomendação) é o que impede a mesma pessoa de
 * gastar 20 usos recarregando a página: a segunda tentativa cai em `already_redeemed` ANTES de
 * qualquer consumo.
 */
export async function redeemCoupon(input: {
  code: string;
  publicId: string;
  sessionId: string;
}): Promise<RedeemOutcome> {
  const code = normalizeCode(input.code);
  if (code.length === 0) return { kind: 'invalid' };

  const conn = db();

  const recRows = await conn
    .select({ id: recommendationSessions.id })
    .from(recommendationSessions)
    .where(eq(recommendationSessions.publicId, input.publicId))
    .limit(1);

  const recommendationSessionId = recRows[0]?.id;
  if (!recommendationSessionId) return { kind: 'invalid' };

  // Registro do resgate ANTES do consumo: é ele que torna a operação idempotente por análise.
  const claimed = await conn
    .insert(couponRedemptions)
    .values({ code, sessionId: input.sessionId, recommendationSessionId })
    .onConflictDoNothing()
    .returning({ id: couponRedemptions.id });

  if (!claimed[0]) return { kind: 'already_redeemed' };

  const consumed = await conn
    .update(accessCoupons)
    .set({ usedCount: sql`${accessCoupons.usedCount} + 1` })
    .where(
      and(
        eq(accessCoupons.code, code),
        eq(accessCoupons.active, true),
        or(isNull(accessCoupons.maxUses), sql`${accessCoupons.usedCount} < ${accessCoupons.maxUses}`),
      ),
    )
    .returning({ grants: accessCoupons.grants });

  if (!consumed[0]) {
    // Desfaz o registro para que o código, se for reativado ou tiver o limite ampliado, ainda possa
    // ser usado por esta análise. Sem isso, uma tentativa com código esgotado queimaria a chance.
    await conn
      .delete(couponRedemptions)
      .where(eq(couponRedemptions.id, claimed[0].id));

    const exists = await conn
      .select({ code: accessCoupons.code })
      .from(accessCoupons)
      .where(eq(accessCoupons.code, code))
      .limit(1);

    return exists[0] ? { kind: 'exhausted' } : { kind: 'invalid' };
  }

  const granted = consumed[0].grants.filter((g): g is Entitlement =>
    (ALL_ENTITLEMENTS as readonly string[]).includes(g),
  );

  if (granted.length > 0) {
    await conn
      .insert(entitlements)
      .values(
        granted.map((entitlement) => ({
          sessionId: input.sessionId,
          recommendationSessionId,
          entitlement,
        })),
      )
      .onConflictDoNothing();
  }

  return { kind: 'granted', entitlements: granted };
}
