import { sql } from 'drizzle-orm';
import { db, isDatabaseConfigured } from './client';
import { products } from './schema';
import { BOOTSTRAP_STATEMENTS } from './bootstrap-sql';
import { PRODUCT_SEED as CATALOGO } from '@/payments/catalogo';

/**
 * Preparação do banco executável pelo painel — sem terminal.
 *
 * O caminho normal de um time é rodar `drizzle-kit migrate` na linha de comando. Este produto tem
 * um dono não-técnico, e exigir terminal para colocá-lo no ar seria transformar uma etapa de 30
 * segundos numa barreira real.
 *
 * As duas operações abaixo são IDEMPOTENTES por construção: a DDL é toda `IF NOT EXISTS`, e o seed
 * casa por SKU. Clicar duas vezes não duplica nada.
 */

/*
  A lista vive em `payments/catalogo.ts`, sem dependência de banco, para que uma tela possa ler o
  preço sem importar o Postgres. Re-exportada aqui porque este módulo era o endereço dela.
*/
export { PRODUCT_SEED } from '@/payments/catalogo';

export type SetupStatus = {
  readonly databaseConfigured: boolean;
  readonly tablesReady: boolean;
  readonly productCount: number;
  /** Produtos cujo preço no banco não é o do código. Vazio = a loja cobra o que o site anuncia. */
  readonly precosDesatualizados: readonly PrecoDivergente[];
  readonly error: string | null;
};

export async function setupStatus(): Promise<SetupStatus> {
  if (!isDatabaseConfigured()) {
    return {
      databaseConfigured: false,
      tablesReady: false,
      productCount: 0,
      precosDesatualizados: [],
      error: 'DATABASE_URL não configurada.',
    };
  }

  try {
    const rows = await db().select({ sku: products.sku }).from(products);
    return {
      databaseConfigured: true,
      tablesReady: true,
      productCount: rows.length,
      precosDesatualizados: await precosDivergentes(),
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
      precosDesatualizados: [],
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

/**
 * Sincroniza a tabela `products` com o catálogo do código.
 *
 * ═══ POR QUE ELE ATUALIZA, E NÃO SÓ INSERE ═══════════════════════════════════════════════════
 *
 * Era `onConflictDoNothing`: uma SKU já existente ficava intocada para sempre. A intenção original
 * era proteger um preço ajustado à mão no banco — só que NÃO EXISTE onde ajustar preço à mão. O
 * `/admin/precos` previsto pelo §34 nunca foi construído.
 *
 * Na prática, então, o que aquela linha protegia era o preço ANTIGO. Trocar o número no código e
 * publicar não mudava nada em produção: a loja continuava cobrando o valor semeado no primeiro dia,
 * enquanto as telas passavam a anunciar o novo. Anunciar um preço e cobrar outro é a falha mais cara
 * que este arquivo poderia produzir, e ela seria silenciosa.
 *
 * Com o catálogo do código como única fonte (ver `payments/catalogo.ts`), reconciliar é o
 * comportamento correto — e continua idempotente: rodar de novo sem mudar o código não escreve nada
 * diferente.
 *
 * `active` fica DE FORA do update de propósito: aposentar um produto é uma decisão operacional, não
 * uma consequência de rodar o seed. Um produto desativado à mão precisa continuar desativado.
 */
export async function seedProducts(): Promise<number> {
  for (const product of CATALOGO) {
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
      .onConflictDoUpdate({
        target: products.sku,
        set: {
          name: product.name,
          description: product.description,
          priceCents: product.priceCents,
          grantsEntitlements: [...product.grantsEntitlements],
        },
      });
  }
  const rows = await db().select({ sku: products.sku }).from(products);
  return rows.length;
}

/**
 * Onde o banco diverge do catálogo do código — para o painel poder MOSTRAR isso.
 *
 * Sem esta leitura, "os preços já foram aplicados?" só se responde comprando. Com ela, `/admin/setup`
 * exibe "no banco: R$ 19,99 · no código: R$ 29,99" e o botão de sincronizar deixa de ser um ato de fé.
 */
export type PrecoDivergente = {
  readonly sku: string;
  readonly noBanco: number | null;
  readonly noCodigo: number;
};

export async function precosDivergentes(): Promise<readonly PrecoDivergente[]> {
  const rows = await db()
    .select({ sku: products.sku, priceCents: products.priceCents })
    .from(products);
  const banco = new Map(rows.map((r) => [r.sku, r.priceCents]));

  const fora: PrecoDivergente[] = [];
  for (const product of CATALOGO) {
    const atual = banco.get(product.sku) ?? null;
    if (atual !== product.priceCents) {
      fora.push({ sku: product.sku, noBanco: atual, noCodigo: product.priceCents });
    }
  }
  return fora;
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
