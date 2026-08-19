import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/database/client';
import {
  entitlements,
  normalizeEmail,
  orders,
  payments,
  recommendationSessions,
  supportLookups,
  users,
} from '@/database/schema';

/**
 * Busca de suporte — o caminho de volta para quem perdeu o acesso.
 *
 * ═══ O CASO QUE ISTO RESOLVE ═════════════════════════════════════════════════════════════════
 *
 * Alguém paga, digita o e-mail errado e some. O relatório está inteiro no banco — resultado
 * completo em `recommendation_sessions.result`, ranking das 46 raquetes em `racket_rankings` —, o
 * pagamento consta no extrato do gateway, e não havia NENHUMA forma de ligar um ao outro sem abrir
 * o Postgres de produção na mão. Abrir o banco de produção para uma tarefa rotineira é como
 * acidentes acontecem: uma vez por mês vira `UPDATE` sem `WHERE`.
 *
 * ═══ BUSCA EXATA, NUNCA PARCIAL ══════════════════════════════════════════════════════════════
 *
 * Toda consulta aqui é por igualdade. Não existe `LIKE`, não existe busca por nome, não existe
 * listagem de "análises recentes". Isso é deliberado e é a principal proteção da tela: quem usa
 * precisa JÁ SABER de quem está falando — ter o e-mail inteiro, o ID do pagamento ou o ID da
 * análise em mãos, vindos de um pedido de suporte real.
 *
 * Uma busca parcial transformaria uma ferramenta de atendimento numa janela para folhear os dados
 * de todo mundo, e a diferença entre as duas coisas é uma linha de código.
 *
 * ═══ SOBRE O E-MAIL, QUE AINDA NÃO EXISTE ════════════════════════════════════════════════════
 *
 * `orders.user_id` é nulo em toda compra feita hoje, porque o checkout ainda não pede e-mail. A
 * busca por e-mail portanto não acha nada — e a tela DIZ isso, em vez de devolver "não encontrado"
 * como se o endereço estivesse errado. A consulta é real e passa a funcionar sozinha no dia em que
 * o checkout gravar `users`, sem nenhuma alteração aqui.
 */

/** Como o termo foi interpretado. É isto — e não o termo — que vai para a auditoria. */
export type LookupKind = 'analise' | 'pedido' | 'pagamento' | 'email';

export type ClassifiedQuery =
  | { readonly kind: 'email'; readonly value: string }
  | { readonly kind: 'uuid'; readonly value: string }
  | { readonly kind: 'pagamento'; readonly value: string }
  | { readonly error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Tamanho mínimo do termo — o piso contra pesca.
 *
 * Não protege contra quem tem um identificador legítimo (UUIDs têm 36 caracteres, IDs de gateway
 * passam de 20, e-mails reais raramente têm menos de 8). Protege contra `a`, `@`, `1` — tentativas
 * de descobrir o formato da busca chutando.
 */
const MIN_LENGTH = 6;

/**
 * Decide o que o operador digitou, sem perguntar.
 *
 * Três formatos que não se confundem: com `@` é e-mail; no formato UUID é um identificador nosso
 * (análise ou pedido — só o banco sabe qual, e `findAnalyses` descobre tentando); qualquer outra
 * coisa é ID do gateway, que cada provedor formata do seu jeito (`pi_3Abc…`, `pay_01H…`) e sobre o
 * qual não dá para assumir nada.
 *
 * Um seletor manual de tipo daria o mesmo resultado com um passo a mais e uma chance a mais de
 * errar — colar o ID do pagamento no campo marcado "análise" e concluir que o pagamento sumiu.
 */
export function classifyQuery(raw: string): ClassifiedQuery {
  const value = raw.trim();

  if (value.length === 0) return { error: 'Digite um e-mail, um ID de análise ou um ID de pagamento.' };
  if (value.length < MIN_LENGTH) {
    return { error: `Termo curto demais — a busca é exata e precisa de ao menos ${MIN_LENGTH} caracteres.` };
  }

  if (value.includes('@')) {
    if (!EMAIL.test(value)) return { error: 'Esse e-mail não parece completo. A busca é exata, não parcial.' };
    return { kind: 'email', value: normalizeEmail(value) };
  }

  if (UUID.test(value)) return { kind: 'uuid', value: value.toLowerCase() };

  return { kind: 'pagamento', value };
}

export type SupportOrder = {
  readonly id: string;
  readonly sku: string;
  readonly amountCents: number;
  readonly status: string;
  readonly createdAt: Date;
  readonly paidAt: Date | null;
  readonly provider: string | null;
  readonly providerPaymentId: string | null;
};

export type SupportMatch = {
  readonly publicId: string;
  readonly createdAt: Date;
  readonly engineVersion: string;
  readonly datasetVersion: string;
  readonly confidenceLevel: string;
  readonly email: string | null;
  readonly orders: readonly SupportOrder[];
  readonly entitlements: readonly string[];
};

export type LookupResult = {
  readonly kind: LookupKind;
  readonly matches: readonly SupportMatch[];
  /** Verdadeiro quando o termo era e-mail e o checkout ainda não grava e-mail nenhum. */
  readonly emailNotCollectedYet: boolean;
};

/**
 * Teto de resultados.
 *
 * Uma pessoa com muitas análises é plausível — refez o questionário cinco vezes. Cem não é: seria
 * uma consulta larga demais para um pedido de suporte, e devolvê-la em silêncio esconderia que a
 * busca deixou de ser pontual.
 */
const MAX_MATCHES = 25;

export async function findAnalyses(raw: string): Promise<LookupResult | { error: string }> {
  const query = classifyQuery(raw);
  if ('error' in query) return query;

  const conn = db();
  let kind: LookupKind;
  let ids: string[];

  if (query.kind === 'email') {
    kind = 'email';
    const rows = await conn
      .select({ id: orders.recommendationSessionId })
      .from(orders)
      .innerJoin(users, eq(users.id, orders.userId))
      .where(eq(users.email, query.value));
    ids = unique(rows);
  } else if (query.kind === 'pagamento') {
    kind = 'pagamento';
    const rows = await conn
      .select({ id: orders.recommendationSessionId })
      .from(payments)
      .innerJoin(orders, eq(orders.id, payments.orderId))
      .where(eq(payments.providerPaymentId, query.value));
    ids = unique(rows);
  } else {
    /*
      UUID é ambíguo: pode ser o `public_id` que a pessoa tem na URL do relatório, ou o `id` do
      pedido que aparece no painel do gateway. Tentamos a análise primeiro porque é o que a PESSOA
      manda ("meu link não abre"), e o pedido depois porque é o que VOCÊ tem em mãos quando ela não
      manda nada. Errar a ordem só custaria uma consulta a mais; perguntar qual dos dois é custaria
      um passo a cada atendimento.
    */
    const direct = await conn
      .select({ id: recommendationSessions.id })
      .from(recommendationSessions)
      .where(eq(recommendationSessions.publicId, query.value))
      .limit(1);

    if (direct[0]) {
      kind = 'analise';
      ids = [direct[0].id];
    } else {
      kind = 'pedido';
      const rows = await conn
        .select({ id: orders.recommendationSessionId })
        .from(orders)
        .where(eq(orders.id, query.value));
      ids = unique(rows);
    }
  }

  const matches = ids.length === 0 ? [] : await loadMatches(ids.slice(0, MAX_MATCHES));

  await recordLookup({
    queryKind: kind,
    matchedCount: matches.length,
    recommendationSessionId: matches.length === 1 ? ids[0]! : null,
  });

  return {
    kind,
    matches,
    emailNotCollectedYet: kind === 'email' && matches.length === 0 && !(await anyEmailStored()),
  };
}

function unique(rows: readonly { id: string | null }[]): string[] {
  return [...new Set(rows.map((r) => r.id).filter((id): id is string => id !== null))];
}

async function loadMatches(ids: readonly string[]): Promise<SupportMatch[]> {
  const conn = db();

  const sessions = await conn
    .select({
      id: recommendationSessions.id,
      publicId: recommendationSessions.publicId,
      createdAt: recommendationSessions.createdAt,
      engineVersion: recommendationSessions.engineVersion,
      datasetVersion: recommendationSessions.datasetVersion,
      confidenceLevel: recommendationSessions.confidenceLevel,
    })
    .from(recommendationSessions)
    .where(inArray(recommendationSessions.id, [...ids]))
    .orderBy(desc(recommendationSessions.createdAt));

  /*
    Pedidos e entitlements vêm em DUAS consultas para o conjunto inteiro, não em duas por análise.
    Com 25 resultados a diferença é entre 3 consultas e 51 — e o padrão N+1 só se manifesta quando
    o caso real chega, que aqui é justamente o cliente mais complicado de atender.
  */
  const orderRows =
    sessions.length === 0
      ? []
      : await conn
          .select({
            recId: orders.recommendationSessionId,
            id: orders.id,
            sku: orders.productSku,
            amountCents: orders.amountCents,
            status: orders.status,
            createdAt: orders.createdAt,
            paidAt: orders.paidAt,
            email: users.email,
            provider: payments.provider,
            providerPaymentId: payments.providerPaymentId,
          })
          .from(orders)
          .leftJoin(users, eq(users.id, orders.userId))
          .leftJoin(payments, eq(payments.orderId, orders.id))
          .where(inArray(orders.recommendationSessionId, [...ids]))
          .orderBy(desc(orders.createdAt));

  const grantRows =
    sessions.length === 0
      ? []
      : await conn
          .select({
            recId: entitlements.recommendationSessionId,
            entitlement: entitlements.entitlement,
          })
          .from(entitlements)
          .where(
            and(inArray(entitlements.recommendationSessionId, [...ids]), isNull(entitlements.revokedAt)),
          );

  return sessions.map((s) => {
    const mine = orderRows.filter((o) => o.recId === s.id);
    return {
      publicId: s.publicId,
      createdAt: s.createdAt,
      engineVersion: s.engineVersion,
      datasetVersion: s.datasetVersion,
      confidenceLevel: s.confidenceLevel,
      /* O e-mail COMO ESTÁ GRAVADO — inclusive com o erro de digitação, que é o que se veio ver. */
      email: mine.find((o) => o.email !== null)?.email ?? null,
      orders: mine.map((o) => ({
        id: o.id,
        sku: o.sku,
        amountCents: o.amountCents,
        status: o.status,
        createdAt: o.createdAt,
        paidAt: o.paidAt,
        provider: o.provider,
        providerPaymentId: o.providerPaymentId,
      })),
      entitlements: grantRows.filter((g) => g.recId === s.id).map((g) => g.entitlement),
    };
  });
}

/**
 * Existe algum e-mail gravado no sistema?
 *
 * Serve a dois lugares, pelo mesmo motivo. Na BUSCA, separa dois "não encontrei" que pedem
 * respostas opostas: "esse endereço não comprou" (procure outro) e "nenhum endereço foi coletado
 * ainda" (o checkout não pede e-mail; procure pelo ID do pagamento). Dizer o primeiro quando o
 * certo é o segundo manda o operador caçar um dado que não existe em lugar nenhum.
 *
 * Na PÁGINA, decide se o aviso de rodapé aparece. Escrito como texto fixo, esse aviso viraria
 * mentira no dia em que o checkout começasse a gravar e-mail — e ninguém se lembraria de apagá-lo.
 *
 * Devolve só um booleano: não conta, não lista, não expõe endereço nenhum.
 */
export async function anyEmailStored(): Promise<boolean> {
  const any = await db().select({ id: users.id }).from(users).limit(1);
  return any.length > 0;
}

/** Auditoria — ver o cabeçalho de `schema/support.ts`. Nunca grava o termo buscado. */
async function recordLookup(input: {
  queryKind: LookupKind;
  matchedCount: number;
  recommendationSessionId: string | null;
}): Promise<void> {
  await db().insert(supportLookups).values(input);
}

export type LookupLogEntry = {
  readonly queryKind: string;
  readonly matchedCount: number;
  readonly createdAt: Date;
};

/** As últimas consultas, para que o próprio registro fique visível a quem o gera. */
export async function recentLookups(limit = 12): Promise<LookupLogEntry[]> {
  return db()
    .select({
      queryKind: supportLookups.queryKind,
      matchedCount: supportLookups.matchedCount,
      createdAt: supportLookups.createdAt,
    })
    .from(supportLookups)
    .orderBy(desc(supportLookups.createdAt))
    .limit(limit);
}
