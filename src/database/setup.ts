import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { join } from 'node:path';
import { db, isDatabaseConfigured } from './client';
import { products } from './schema';

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
    grantsEntitlements: ['racket_report_access', 'full_setup_access'],
  },
  {
    sku: 'top3_unlock',
    name: 'Desbloquear Top 3',
    description: 'As outras duas melhores opções, com a comparação técnica completa entre as três.',
    priceCents: 999,
    grantsEntitlements: ['top3_access'],
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

export async function runMigrations(): Promise<void> {
  await migrate(db(), { migrationsFolder: join(process.cwd(), 'src', 'database', 'migrations') });
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

/** Percorre a cadeia de `cause` — o Drizzle embrulha o erro original do driver. */
function isMissingTable(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    if (typeof current === 'object' && current !== null) {
      // 42P01 = undefined_table, o código do Postgres para "relação não existe".
      if ((current as { code?: string }).code === '42P01') return true;
      const message = (current as { message?: string }).message ?? '';
      if (/relation .* does not exist/i.test(message)) return true;
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
