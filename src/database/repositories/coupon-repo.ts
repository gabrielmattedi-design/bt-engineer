import { and, eq, isNull, or, sql, gte} from 'drizzle-orm';
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
  /** Teto de resgates nas últimas 24 h. `null` = sem teto diário. */
  readonly dailyLimit: number | null;
  /** Quantos resgates nas últimas 24 h — o número que denuncia um vazamento em curso. */
  readonly usedToday: number;
};

export type RedeemOutcome =
  | { kind: 'granted'; entitlements: readonly Entitlement[] }
  | { kind: 'exhausted' }
  /**
   * O código existe e ainda tem usos, mas já bateu o teto DAS ÚLTIMAS 24 HORAS.
   *
   * Separado de `exhausted` porque a ação de quem lê é oposta: esgotado pede um código novo,
   * enquanto o teto diário passa sozinho — e mandar alguém pedir outro código quando bastaria
   * voltar amanhã é fazer o convidado gastar o seu tempo e o dele.
   */
  | { kind: 'daily_limit'; limit: number }
  /** O código não existe. */
  | { kind: 'unknown_code' }
  /** A análise não existe no banco — link velho, ou banco trocado desde que ela foi gerada. */
  | { kind: 'unknown_analysis' }
  | { kind: 'empty' };

/** Normalização única: o código é sempre comparado e gravado em maiúsculas, sem espaços. */
export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export async function listCoupons(): Promise<CouponSummary[]> {
  const conn = db();
  const rows = await conn.select().from(accessCoupons).orderBy(accessCoupons.createdAt);

  /*
    Os resgates das últimas 24 h, contados de uma vez para todos os códigos.

    Uma consulta por código faria o painel crescer em ida ao banco a cada convite criado — e é a
    tela que o dono abre justamente quando desconfia de alguma coisa, ou seja, quando ela precisa
    responder rápido.
  */
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const hoje = await conn
    .select({ code: couponRedemptions.code, n: sql<number>`count(*)::int` })
    .from(couponRedemptions)
    .where(gte(couponRedemptions.redeemedAt, desde))
    .groupBy(couponRedemptions.code);

  const porCodigo = new Map(hoje.map((h) => [h.code, Number(h.n)]));

  return rows.map((r) => ({
    code: r.code,
    grants: r.grants,
    maxUses: r.maxUses,
    usedCount: r.usedCount,
    active: r.active,
    note: r.note,
    dailyLimit: r.dailyLimit,
    usedToday: porCodigo.get(r.code) ?? 0,
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
  if (code.length === 0) return { kind: 'empty' };

  const conn = db();

  const recRows = await conn
    .select({ id: recommendationSessions.id })
    .from(recommendationSessions)
    .where(eq(recommendationSessions.publicId, input.publicId))
    .limit(1);

  const recommendationSessionId = recRows[0]?.id;
  if (!recommendationSessionId) return { kind: 'unknown_analysis' };

  const existing = await conn
    .select({ grants: accessCoupons.grants, dailyLimit: accessCoupons.dailyLimit })
    .from(accessCoupons)
    .where(eq(accessCoupons.code, code))
    .limit(1);

  if (!existing[0]) return { kind: 'unknown_code' };

  // Registro do resgate ANTES do consumo: é ele que torna a operação idempotente por análise.
  const claimed = await conn
    .insert(couponRedemptions)
    .values({ code, sessionId: input.sessionId, recommendationSessionId })
    .onConflictDoNothing()
    .returning({ id: couponRedemptions.id });

  /**
   * Já resgatado nesta análise: RECONCEDE em vez de assumir que deu certo antes.
   *
   * ─── O BURACO QUE ISTO FECHA ───────────────────────────────────────────────────────────────
   *
   * O registro do resgate é gravado antes da concessão dos entitlements. Se qualquer coisa
   * falhasse entre os dois — timeout, deploy no meio, erro transitório do banco —, a marca de
   * "já usou" ficava e o acesso não. E aí a pessoa entrava num beco permanente: toda nova
   * tentativa via o registro, devolvia "já resgatado", era mandada ao relatório, o relatório não
   * encontrava entitlement e a devolvia para a página de planos. Um laço, indistinguível de
   * "o cupom não funciona".
   *
   * Reconceder é seguro porque a concessão é idempotente (índice único de sessão + análise +
   * entitlement) e porque nenhum uso novo é consumido aqui — o contador só avança no UPDATE
   * abaixo, que esta ramificação não alcança.
   */
  if (!claimed[0]) {
    const granted = await grantEntitlements(
      input.sessionId,
      recommendationSessionId,
      existing[0].grants,
    );
    return { kind: 'granted', entitlements: granted };
  }

  /*
    ═══ O TETO DIÁRIO, CONFERIDO CONTRA OS RESGATES REAIS ═════════════════════════════════════

    A contagem sai de `coupon_redemptions` nas últimas 24 horas, e não de um contador guardado na
    própria linha do cupom. Um contador diário exigiria zerar em algum instante — e o instante do
    zeramento é uma brecha: um script paciente pega o fim de um dia e o começo do outro, e leva dois
    tetos cheios em poucos minutos.

    A janela móvel não tem esse instante. O custo é uma consulta a mais por resgate, num caminho que
    acontece algumas vezes por dia.

    A conferência vem DEPOIS do registro do resgate e ANTES do consumo, no mesmo lugar em que o teto
    total é conferido — assim uma reaplicação do mesmo código na mesma análise (a ramificação acima)
    continua não gastando nada, nem do total nem do dia.
  */
  const teto = existing[0].dailyLimit;
  if (teto !== null && teto !== undefined) {
    const desde = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const hoje = await conn
      .select({ n: sql<number>`count(*)::int` })
      .from(couponRedemptions)
      .where(and(eq(couponRedemptions.code, code), gte(couponRedemptions.redeemedAt, desde)));

    // `> teto` e não `>=`: o registro DESTA tentativa já está gravado e conta na soma.
    if ((hoje[0]?.n ?? 0) > teto) {
      await conn.delete(couponRedemptions).where(eq(couponRedemptions.id, claimed[0].id));
      return { kind: 'daily_limit', limit: teto };
    }
  }

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
    await conn.delete(couponRedemptions).where(eq(couponRedemptions.id, claimed[0].id));
    return { kind: 'exhausted' };
  }

  const granted = await grantEntitlements(
    input.sessionId,
    recommendationSessionId,
    consumed[0].grants,
  );

  return { kind: 'granted', entitlements: granted };
}

/** Concessão idempotente. Nomes desconhecidos são descartados em silêncio, nunca concedidos. */
async function grantEntitlements(
  sessionId: string,
  recommendationSessionId: string,
  grants: readonly string[],
): Promise<readonly Entitlement[]> {
  const valid = grants.filter((g): g is Entitlement =>
    (ALL_ENTITLEMENTS as readonly string[]).includes(g),
  );
  if (valid.length === 0) return [];

  await db()
    .insert(entitlements)
    .values(
      valid.map((entitlement) => ({ sessionId, recommendationSessionId, entitlement })),
    )
    .onConflictDoNothing();

  return valid;
}

/**
 * Acrescenta usos a um código já existente — a "recarga".
 *
 * ─── POR QUE SOMAR AO TETO, E NÃO ZERAR O CONTADOR ───────────────────────────────────────────
 *
 * Zerar `usedCount` apagaria o histórico: `coupon_redemptions` continuaria com os resgates antigos
 * e o contador diria outra coisa, então as duas fontes passariam a discordar sobre o mesmo fato.
 * Somar ao teto preserva "foram 20 usos, e agora cabem mais 20" — que é a frase verdadeira.
 *
 * O `GREATEST` existe para o caso de um código ilimitado que virou limitado no meio do caminho, ou
 * de um teto abaixo do já consumido: sem ele, recarregar um código nessa situação devolveria um
 * limite ainda esgotado, e a recarga pareceria não ter funcionado.
 */
export async function addCouponUses(code: string, amount: number): Promise<CouponSummary | null> {
  if (!Number.isInteger(amount) || amount < 1) return null;

  const rows = await db()
    .update(accessCoupons)
    .set({
      maxUses: sql`GREATEST(COALESCE(${accessCoupons.maxUses}, 0), ${accessCoupons.usedCount}) + ${amount}`,
      active: true,
    })
    .where(eq(accessCoupons.code, normalizeCode(code)))
    .returning();

  const r = rows[0];
  if (!r) return null;
  return {
    code: r.code,
    grants: r.grants,
    maxUses: r.maxUses,
    usedCount: r.usedCount,
    active: r.active,
    note: r.note,
    dailyLimit: r.dailyLimit,
    /*
      Zero, e não uma consulta.

      Este retorno descreve o cupom logo após a recarga, e quem chama redesenha a lista inteira em
      seguida — onde o número real é calculado. Uma consulta aqui seria uma ida ao banco cujo
      resultado é descartado no mesmo instante.
    */
    usedToday: 0,
  };
}

/**
 * Códigos da fase de convidados. Idempotente: NÃO mexe em código que já existe.
 *
 * `onConflictDoNothing` e não `upsert` — a semente roda a cada bootstrap, e um upsert restauraria
 * o teto original toda vez, recarregando o DJOKOINSS pelas costas do dono. Uma semente que desfaz
 * consumo em silêncio é pior que semente nenhuma.
 */
export async function seedInviteCoupons(): Promise<void> {
  await db()
    .insert(accessCoupons)
    .values([
      {
        code: 'MAITE',
        grants: [...ALL_ENTITLEMENTS],
        maxUses: null,
        /*
          Sem teto total, com teto DIÁRIO de 20.

          O código é uma palavra — um nome próprio comum — e por isso é o alvo mais fácil do
          sistema. Mantê-lo ilimitado deixava um vazamento render relatórios de graça para sempre,
          e o dono só descobriria pelo faturamento que não veio.

          Vinte por dia cobre o uso real de convite com folga e transforma o pior caso em algo
          visível e reversível: o vazamento gasta um dia, o contador do painel dispara, e sobra a
          chance de desativar antes do segundo.
        */
        dailyLimit: 20,
        note: 'Convite sem limite total, até 20 resgates por dia.',
        active: true,
      },
      {
        code: 'DJOKOINSS',
        grants: [...ALL_ENTITLEMENTS],
        maxUses: 20,
        note: 'Convite com 20 usos. Recarregável no painel.',
        active: true,
      },
    ])
    .onConflictDoNothing();
}
