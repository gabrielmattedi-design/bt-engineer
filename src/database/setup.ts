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
  /** O que o painel edita: cada produto com o preço que a loja está cobrando hoje. */
  readonly precos: readonly PrecoEditavel[];
  readonly error: string | null;
};

/**
 * Um produto como o painel precisa vê-lo: o que ele é e quanto está sendo cobrado por ele.
 *
 * Vem do BANCO, e não do catálogo, porque é o banco que manda no preço (§34) — mostrar o valor do
 * código faria a tela de edição exibir um número que ninguém está pagando.
 */
export type PrecoEditavel = {
  readonly sku: string;
  readonly name: string;
  readonly priceCents: number;
};

export async function precosAtuais(): Promise<readonly PrecoEditavel[]> {
  const rows = await db()
    .select({ sku: products.sku, name: products.name, priceCents: products.priceCents })
    .from(products);

  /*
    A ORDEM vem do catálogo, não do banco nem do preço.

    Ordenar por preço faria as linhas trocarem de lugar enquanto o dono digita — ele salva, a tela
    recarrega, e o campo que ele acabou de editar está em outra posição. A ordem do catálogo é a
    ordem da escada, que é como ele pensa nos produtos.
  */
  const porSku = new Map(rows.map((r) => [r.sku, r]));
  return CATALOGO.map((p) => porSku.get(p.sku)).filter((r): r is PrecoEditavel => r !== undefined);
}

export async function setupStatus(): Promise<SetupStatus> {
  if (!isDatabaseConfigured()) {
    return {
      databaseConfigured: false,
      tablesReady: false,
      productCount: 0,
      precos: [],
      error: 'DATABASE_URL não configurada.',
    };
  }

  try {
    const rows = await db().select({ sku: products.sku }).from(products);
    return {
      databaseConfigured: true,
      tablesReady: true,
      productCount: rows.length,
      precos: await precosAtuais(),
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
      precos: [],
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
 * Cria as linhas que faltam e mantém a DESCRIÇÃO dos produtos igual à do código.
 *
 * ═══ O QUE ELE ESCREVE, E O QUE ELE NÃO TOCA ═════════════════════════════════════════════════
 *
 * Escreve nome, descrição e entitlements: são a definição do produto, presa ao que o motor entrega.
 * Um deploy que muda o que o relatório contém precisa mudar o texto que o vende junto.
 *
 * NÃO toca em `priceCents` nem em `active` de linha que já existe. Os dois são operacionais e vivem
 * no painel (§34) — o dono ajusta preço em `/admin/setup` sem publicar nada.
 *
 * ─── E ISSO É UMA CORREÇÃO, NÃO UMA PREFERÊNCIA ──────────────────────────────────────────────
 *
 * Por um dia esta função reconciliou o preço também, e a consequência passou perto: quem chama esta
 * função com mais frequência não é o painel, é `withAutoBootstrap` — automaticamente, sempre que
 * falta uma tabela ou uma coluna. Qualquer migração futura teria revertido em silêncio todo preço
 * ajustado à mão, e o sintoma seria "o preço voltou sozinho", que é dos piores de diagnosticar.
 *
 * Idempotente dos dois jeitos: rodar de novo não duplica linha nem mexe em preço.
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
          grantsEntitlements: [...product.grantsEntitlements],
        },
      });
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
