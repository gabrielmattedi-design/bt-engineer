import { sql } from 'drizzle-orm';
import { db, isDatabaseConfigured } from './client';
import { products } from './schema';
import { BOOTSTRAP_STATEMENTS } from './bootstrap-sql';

/**
 * Preparação do banco executável pelo painel — sem terminal.
 *
 * O caminho normal de um time é rodar `drizzle-kit migrate` na linha de comando. Este produto tem
 * um dono não-técnico, e exigir terminal para colocá-lo no ar seria transformar uma etapa de 30
 * segundos numa barreira real.
 *
 * As duas operações abaixo são IDEMPOTENTES por construção: `migrate()` consulta a tabela de
 * controle do Drizzle e aplica apenas o que falta; o seed usa `onConflictDoNothing` na SKU. Clicar
 * duas vezes não duplica nada e não desfaz preço já ajustado.
 */

export const PRODUCT_SEED = [
  {
    sku: 'racket_report',
    name: 'Descubra sua raquete ideal',
    description:
      'A raquete com maior compatibilidade com o seu perfil, com a explicação técnica de por que ' +
      'ela foi escolhida e o que você deve sentir em quadra.',
    priceCents: 1999,
    grantsEntitlements: ['racket_report_access'],
  },
  {
    sku: 'full_setup',
    name: 'Descubra seu setup completo',
    description:
      'Raquete + corda + espessura + tensão inicial, com a faixa de ajuste e o motivo de cada escolha.',
    priceCents: 4999,
    grantsEntitlements: [
      'racket_report_access',
      'full_setup_access',
      'rank2_access',
      'rank3_access',
    ],
  },
  {
    sku: 'unlock_rank_2',
    name: 'Desbloquear a 2ª colocada',
    description:
      'A segunda raquete com maior compatibilidade, com marca, modelo e a leitura técnica completa.',
    priceCents: 999,
    grantsEntitlements: ['rank2_access'],
  },
  {
    sku: 'unlock_rank_3',
    name: 'Desbloquear a 3ª colocada',
    description:
      'A terceira raquete com maior compatibilidade, com marca, modelo e a leitura técnica completa.',
    priceCents: 999,
    grantsEntitlements: ['rank3_access'],
  },
  {
    sku: 'setup_upgrade',
    name: 'Completar com corda e tensão',
    description:
      'Corda, espessura e tensão inicial para a raquete que você escolher entre as do pódio, ' +
      'com a faixa de ajuste e o motivo de cada escolha. Inclui a 2ª e a 3ª colocadas.',
    priceCents: 3999,
    grantsEntitlements: ['full_setup_access', 'rank2_access', 'rank3_access'],
  },
] as const;

export type SetupStatus = {
  readonly databaseConfigured: boolean;
  readonly tablesReady: boolean;
  readonly productCount: number;
  readonly error: string | null;
};

export async function setupStatus(): Promise<SetupStatus> {
  if (!isDatabaseConfigured()) {
    return {
      databaseConfigured: false,
      tablesReady: false,
      productCount: 0,
      error: 'DATABASE_URL não configurada.',
    };
  }

  try {
    const rows = await db().select({ sku: products.sku }).from(products);
    return {
      databaseConfigured: true,
      tablesReady: true,
      productCount: rows.length,
      error: null,
    };
  } catch (error) {
    /**
     * Tabela inexistente é o estado ESPERADO antes da primeira migração, não uma falha.
     *
     * O Drizzle EMBRULHA o erro do Postgres: `error.message` vira "Failed query: select ...", e o
     * `relation ... does not exist` fica em `cause`. Testar só a mensagem de topo fazia a tela
     * mostrar um erro de SQL cru para quem acabou de criar o banco — assustador e errado, porque
     * nada estava quebrado.
     */
    return {
      databaseConfigured: true,
      tablesReady: false,
      productCount: 0,
      error: isMissingTable(error) ? null : describe(error),
    };
  }
}

/**
 * Cria a estrutura do banco.
 *
 * Executa a DDL embutida em `bootstrap-sql.ts`, comando a comando. Não lê nada do disco — ver a
 * explicação naquele arquivo. Como todos os comandos são idempotentes, rodar de novo é seguro.
 */
export async function runMigrations(): Promise<void> {
  const conn = db();
  for (const statement of BOOTSTRAP_STATEMENTS) {
    await conn.execute(sql.raw(statement));
  }
}

export async function seedProducts(): Promise<number> {
  for (const product of PRODUCT_SEED) {
    await db()
      .insert(products)
      .values({
        sku: product.sku,
        name: product.name,
        description: product.description,
        priceCents: product.priceCents,
        grantsEntitlements: [...product.grantsEntitlements],
        currency: 'BRL',
        active: true,
      })
      .onConflictDoNothing({ target: products.sku });
  }
  const rows = await db().select({ sku: products.sku }).from(products);
  return rows.length;
}

/**
 * O banco está atrás do código? Percorre a cadeia de `cause` — o Drizzle embrulha o erro do driver.
 *
 * ═══ POR QUE COLUNA CONTA, E NÃO SÓ TABELA ═══════════════════════════════════════════════════
 *
 * Esta função só reconhecia TABELA ausente, e o buraco derrubou o resgate de código de convite em
 * produção (ago/2026).
 *
 * O que aconteceu: uma coluna nova entrou em `access_coupons`. O SQL de bootstrap já trazia o
 * `ALTER TABLE … ADD COLUMN IF NOT EXISTS` correspondente — mas ele nunca rodou, porque quem o
 * dispara é `withAutoBootstrap`, e `withAutoBootstrap` só chama o bootstrap quando ESTA função diz
 * que sim. Faltando coluna, ela dizia não.
 *
 * O resultado era o pior formato de falha: o conserto existia, estava escrito, era idempotente, e
 * ficava a uma condição de distância de acontecer.
 *
 * A generalização certa não é "tabela" — é **o banco está desatualizado em relação ao código**.
 * Tabela ausente e coluna ausente são a mesma situação vista de dois ângulos, e as duas se
 * resolvem rodando o mesmo bootstrap.
 *
 * Índice ausente não entra na lista de propósito: ele não gera erro, só deixa a consulta lenta —
 * e disparar migração por lentidão seria confundir desempenho com estrutura.
 */
export function isMissingTable(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    if (typeof current === 'object' && current !== null) {
      const code = (current as { code?: string }).code;
      // 42P01 = undefined_table · 42703 = undefined_column. Os dois significam a mesma coisa aqui:
      // o esquema em produção é mais antigo que o código que está tentando usá-lo.
      if (code === '42P01' || code === '42703') return true;

      const message = (current as { message?: string }).message ?? '';
      if (/relation .* does not exist/i.test(message)) return true;
      if (/column .* does not exist/i.test(message)) return true;

      current = (current as { cause?: unknown }).cause;
    } else {
      break;
    }
  }
  return false;
}

function describe(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const cause = (error as { cause?: { message?: string } }).cause;
    if (cause?.message) return cause.message;
    const message = (error as { message?: string }).message;
    if (message) return message;
  }
  return String(error);
}

/**
 * Executa `run`; se o banco ainda não tiver as tabelas, cria a estrutura e tenta UMA vez mais.
 *
 * ─── POR QUE AUTO-BOOTSTRAP ──────────────────────────────────────────────────────────────────
 *
 * O produto ficou preso num erro que dependia do dono lembrar de abrir `/admin/setup` e clicar em
 * dois botões — um passo invisível, feito uma única vez na vida do sistema, cuja ausência derruba
 * o fluxo inteiro com uma mensagem que o VISITANTE vê. É a pior troca possível: risco alto,
 * benefício nenhum.
 *
 * Como toda a DDL é idempotente (ver `bootstrap-sql.ts`), criar a estrutura sob demanda é seguro.
 * `/admin/setup` continua existindo como diagnóstico e para quem quiser preparar antes do primeiro
 * acesso — mas deixou de ser obrigatório.
 *
 * A retentativa é ÚNICA e condicionada a "tabela não existe". Qualquer outro erro sobe: repetir
 * cegamente esconderia falhas reais, como credencial errada ou banco fora do ar.
 */
export async function withAutoBootstrap<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (!isMissingTable(error)) throw error;

    await runMigrations();
    await seedProducts();
    return run();
  }
}
