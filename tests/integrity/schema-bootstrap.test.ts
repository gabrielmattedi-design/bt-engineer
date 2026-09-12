/**
 * O botão "Criar tabelas" precisa poder ser apertado duas vezes.
 *
 * ═══ POR QUE ESTE ARQUIVO EXISTE ═════════════════════════════════════════════════════════════
 *
 * `bootstrap-sql.ts` é GERADO a partir das migrações, e é o que roda quando o dono do produto —
 * que não é técnico — aperta "Criar tabelas" no `/admin/setup`. Ele precisa ser inofensivo quando
 * rodado sobre um banco já criado, sobre um banco pela metade, ou duas vezes por engano.
 *
 * Três defeitos reais foram encontrados de uma vez, todos silenciosos, e todos do mesmo tipo: algo
 * que funcionava por causa de uma correção manual no arquivo GERADO, e que a próxima regeneração
 * apagaria.
 *
 *   1. `ALTER TABLE … ADD COLUMN` saía sem `IF NOT EXISTS`. A segunda execução morria com
 *      "column already exists". Estava mascarado por uma edição à mão no arquivo gerado.
 *
 *   2. `coupon_redemptions_unique_idx` só existia como linha escrita à mão no bootstrap, sem
 *      contrapartida no schema. Um banco criado por `drizzle-kit migrate` não o tinha — e sem ele o
 *      `onConflictDoNothing()` do resgate de cupom NUNCA conflitava: cada F5 na tela de código
 *      queimava mais um uso do cupom.
 *
 *   3. A FK de `coupon_redemptions` tinha nome automático de 74 caracteres. O Postgres corta em 63
 *      e grava o nome truncado; a guarda `WHERE conname = '<74 chars>'` nunca encontrava nada, e a
 *      segunda execução morria com "constraint already exists".
 *
 * Nenhum dos três aparecia em teste, em tipo ou em build. Os três aparecem aqui.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { BOOTSTRAP_STATEMENTS } from '@/database/bootstrap-sql';

const SCHEMA_DIR = join(__dirname, '..', '..', 'src', 'database', 'schema');

const SCHEMA_SOURCE = readdirSync(SCHEMA_DIR)
  .filter((f) => f.endsWith('.ts'))
  .map((f) => readFileSync(join(SCHEMA_DIR, f), 'utf8'))
  .join('\n');

/** Limite de identificador do Postgres. Nomes maiores são TRUNCADOS na criação, sem aviso. */
const PG_IDENTIFIER_LIMIT = 63;

describe('todo comando do bootstrap é idempotente', () => {
  it.each([
    ['CREATE TABLE', /^CREATE TABLE (?!IF NOT EXISTS)/],
    ['CREATE INDEX', /^CREATE (UNIQUE )?INDEX (?!IF NOT EXISTS)/],
    ['ADD COLUMN', /ADD COLUMN (?!IF NOT EXISTS)/],
  ])('nenhum %s roda sem IF NOT EXISTS', (_label, offender) => {
    const bad = BOOTSTRAP_STATEMENTS.filter((s) => offender.test(s));
    expect(bad, `comandos não idempotentes:\n${bad.join('\n')}`).toEqual([]);
  });

  /**
   * Constraint não aceita `IF NOT EXISTS` no Postgres — daí o `DO $$` consultando `pg_constraint`.
   * Um `ADD CONSTRAINT` solto seria a mesma falha na segunda execução.
   */
  it('todo ADD CONSTRAINT está protegido por uma consulta a pg_constraint', () => {
    for (const statement of BOOTSTRAP_STATEMENTS) {
      if (!statement.includes('ADD CONSTRAINT')) continue;
      expect(statement.startsWith('DO $$ BEGIN'), `sem guarda:\n${statement}`).toBe(true);
      expect(statement, `sem consulta a pg_constraint:\n${statement}`).toContain('pg_constraint');
    }
  });
});

describe('nomes de constraint cabem no que o Postgres guarda', () => {
  /**
   * A armadilha mais traiçoeira das três: o `CREATE` funciona, o banco fica certo, e só a GUARDA
   * fica errada — porque ela procura o nome inteiro e o Postgres guardou o nome cortado. O sintoma
   * aparece só na segunda execução do bootstrap, longe da causa.
   */
  it('nenhuma guarda procura um nome que o Postgres não conseguiria guardar', () => {
    const names = [...BOOTSTRAP_STATEMENTS.join('\n').matchAll(/conname = '([^']+)'/g)].map(
      (m) => m[1]!,
    );

    expect(names.length, 'nenhuma constraint encontrada — o teste está olhando no lugar errado').toBeGreaterThan(0);

    const truncated = names.filter((n) => n.length > PG_IDENTIFIER_LIMIT);
    expect(
      truncated,
      `nomes que o Postgres truncaria (dê um nome explícito no schema):\n${truncated
        .map((n) => `  ${n.length}  ${n}`)
        .join('\n')}`,
    ).toEqual([]);
  });
});

describe('o schema e o bootstrap contam a mesma história', () => {
  /**
   * A trava contra o defeito nº 2, e a mais importante do arquivo.
   *
   * Um índice escrito só no bootstrap existe para quem aperta o botão e não existe para quem roda
   * as migrações — e o ORM, que decide se um `onConflictDoNothing()` tem sentido, não sabe de
   * nenhum dos dois. Todo índice precisa nascer no schema.
   */
  it('todo índice declarado no schema chega ao bootstrap', () => {
    const declared = [...SCHEMA_SOURCE.matchAll(/uniqueIndex\('([^']+)'\)|index\('([^']+)'\)/g)]
      .map((m) => m[1] ?? m[2]!)
      .sort();

    expect(declared.length, 'nenhum índice declarado — o teste está olhando no lugar errado').toBeGreaterThan(0);

    const joined = BOOTSTRAP_STATEMENTS.join('\n');
    for (const name of declared) {
      expect(joined, `índice "${name}" está no schema e não chegou ao bootstrap`).toContain(
        `"${name}"`,
      );
    }
  });

  /**
   * ═══ TODA TABELA DO SCHEMA PRECISA CHEGAR AO BOOTSTRAP ═════════════════════════════════════
   *
   * O irmão do defeito nº 2, e ele aconteceu de verdade em 11/09/2026.
   *
   * `meta_conversion_context` — a tabela da API de Conversões — nasceu no schema, gerou a migração
   * `0008` normalmente, e **não entrou aqui**. Num projeto que roda `drizzle-kit migrate` isso
   * bastaria; neste não, porque o dono não tem terminal e o banco é preparado por esta lista.
   *
   * O sintoma teria sido cruel: nenhum erro visível, o checkout funcionando, e a compra nunca
   * chegando ao Meta — porque a gravação do contexto engole os próprios erros de propósito, para
   * não derrubar uma venda por causa de medição. Um recurso morto parecendo vivo.
   *
   * O teste de índice acima não pegava, porque a tabela não tem índice nenhum além da chave.
   */
  it('toda tabela declarada no schema chega ao bootstrap', () => {
    const declaradas = [...SCHEMA_SOURCE.matchAll(/pgTable\(\s*'([^']+)'/g)].map((m) => m[1]!);

    expect(declaradas.length, 'nenhuma tabela encontrada — o teste está olhando no lugar errado').toBeGreaterThan(0);

    const joined = BOOTSTRAP_STATEMENTS.join('\n');
    for (const nome of declaradas) {
      expect(
        joined,
        `a tabela "${nome}" existe no schema e não seria criada pelo botão do /admin/setup`,
      ).toContain(`CREATE TABLE IF NOT EXISTS "${nome}"`);
    }
  });

  /**
   * ═══ E TODA COLUNA TAMBÉM ══════════════════════════════════════════════════════════════════
   *
   * O mesmo defeito uma camada abaixo, e o mais provável de repetir: a tabela já existe em
   * produção, alguém acrescenta uma coluna no schema, e a migração sai certa — mas se o
   * `ALTER TABLE` não chegar a esta lista, o botão "Atualizar tabelas" não a cria.
   *
   * O sintoma seria pior que o da tabela faltando, porque metade funciona: o checkout grava o
   * contexto, o webhook tenta gravar o desfecho, a gravação falha, o erro é engolido de propósito
   * — e o painel mostra zero envios num sistema que está enviando. Um número errado e plausível,
   * que é a categoria de defeito que este projeto mais tenta evitar.
   *
   * A verificação é textual: basta o nome da coluna aparecer em algum comando. Não prova o tipo,
   * prova a PRESENÇA, que é o que falha na prática.
   */
  it('toda coluna declarada no schema chega ao bootstrap', () => {
    /*
      Casa `nome: tipo('nome_no_banco')` — a forma como o Drizzle nomeia colunas neste projeto.
      O nome do banco é o que importa: é ele que aparece no SQL.
    */
    const colunas = [
      ...SCHEMA_SOURCE.matchAll(
        /\b(?:text|uuid|integer|boolean|jsonb|timestamp|real|numeric)\(\s*'([a-z0-9_]+)'/g,
      ),
    ].map((m) => m[1]!);

    expect(colunas.length, 'nenhuma coluna encontrada — o teste está olhando no lugar errado').toBeGreaterThan(50);

    const joined = BOOTSTRAP_STATEMENTS.join('\n');
    for (const nome of new Set(colunas)) {
      expect(
        joined,
        `a coluna "${nome}" existe no schema e não seria criada pelo botão do /admin/setup`,
      ).toContain(`"${nome}"`);
    }
  });

  /** E o caminho inverso: um índice no bootstrap sem origem no schema é uma edição manual. */
  it('todo índice do bootstrap tem origem no schema', () => {
    const inBootstrap = [
      ...BOOTSTRAP_STATEMENTS.join('\n').matchAll(/CREATE (?:UNIQUE )?INDEX IF NOT EXISTS "([^"]+)"/g),
    ].map((m) => m[1]!);

    for (const name of inBootstrap) {
      expect(SCHEMA_SOURCE, `índice "${name}" existe no bootstrap e não no schema`).toContain(
        `'${name}'`,
      );
    }
  });
});

describe('a idempotência de que o resgate de cupom depende', () => {
  /**
   * `redeemCoupon()` grava o resgate com `onConflictDoNothing()` e lê "não voltou linha" como "já
   * resgatado nesta análise". Sem uma restrição única para o insert violar, o conflito nunca
   * acontece, todo resgate repetido passa e cada tentativa consome um uso do código.
   *
   * O teste amarra o código ao índice: se um dos dois sumir, ele falha.
   */
  it('coupon_redemptions tem a restrição única que o onConflictDoNothing exige', () => {
    const repo = readFileSync(
      join(__dirname, '..', '..', 'src', 'database', 'repositories', 'coupon-repo.ts'),
      'utf8',
    );
    expect(repo, 'o resgate deixou de usar onConflictDoNothing — reveja este teste').toContain(
      'onConflictDoNothing()',
    );

    expect(BOOTSTRAP_STATEMENTS.join('\n')).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "coupon_redemptions_unique_idx" ON "coupon_redemptions" ' +
        'USING btree ("code","recommendation_session_id")',
    );
  });
});

/**
 * O banco atrás do código se conserta sozinho — inclusive quando falta uma COLUNA.
 *
 * ═══ O DEFEITO QUE ISTO TRANCA ═══════════════════════════════════════════════════════════════
 *
 * `withAutoBootstrap` roda o SQL de bootstrap quando o banco está desatualizado, e quem decide
 * "está desatualizado" é `isMissingTable`. Ela só reconhecia TABELA ausente.
 *
 * Uma coluna nova em `access_coupons` derrubou o resgate de código de convite em produção
 * (ago/2026): o `ALTER TABLE … ADD COLUMN IF NOT EXISTS` existia no bootstrap, era idempotente, e
 * nunca rodava — porque a condição que o dispara respondia "não" para coluna faltando.
 *
 * É o pior formato de falha que existe: o conserto pronto, escrito, a uma condição de distância.
 */

import { isMissingTable } from '@/database/setup';

describe('reconhecer um banco desatualizado', () => {
  /** O formato real do erro do driver, embrulhado pelo Drizzle como acontece em produção. */
  function erroDoDriver(code: string, message: string): Error {
    const driver = Object.assign(new Error(message), { code });
    return Object.assign(new Error('Failed query'), { cause: driver });
  }

  it('tabela ausente conta', () => {
    expect(isMissingTable(erroDoDriver('42P01', 'relation "funnel_markers" does not exist'))).toBe(
      true,
    );
  });

  it('COLUNA ausente conta — foi o que quebrou o cupom', () => {
    expect(
      isMissingTable(erroDoDriver('42703', 'column "daily_limit" does not exist')),
      'sem isto, uma coluna nova nunca chega à produção',
    ).toBe(true);
  });

  it('reconhece pela mensagem quando o código do driver não vem', () => {
    // Nem todo caminho preserva `code` — o texto é a segunda rede.
    expect(isMissingTable(new Error('column "x" does not exist'))).toBe(true);
    expect(isMissingTable(new Error('relation "y" does not exist'))).toBe(true);
  });

  /**
   * O oposto importa tanto quanto: erro comum NÃO pode disparar migração.
   *
   * Rodar o bootstrap a cada falha transitória transformaria uma indisponibilidade momentânea numa
   * enxurrada de DDL contra um banco que já está sofrendo.
   */
  it('falha comum não dispara migração', () => {
    expect(isMissingTable(new Error('connection timeout'))).toBe(false);
    expect(isMissingTable(erroDoDriver('23505', 'duplicate key value'))).toBe(false);
    expect(isMissingTable(null)).toBe(false);
    expect(isMissingTable('texto solto')).toBe(false);
  });
});

/**
 * ═══ O BOTÃO QUE CRIA AS TABELAS NÃO PODE SUMIR ══════════════════════════════════════════════
 *
 * Em 11/09/2026 uma tabela nova chegou ao bootstrap e não chegou ao banco: o painel escondia o
 * botão porque `tablesReady` era verdadeiro — e `tablesReady` responde a uma pergunta só, "a
 * tabela `products` existe?". Tudo criado depois dela ficava invisível para essa checagem.
 *
 * O dono não tem terminal. Sem o botão, não havia caminho nenhum.
 *
 * Ensinar `tablesReady` a conhecer cada tabela nova quebraria de novo na próxima. A correção é o
 * botão existir sempre, o que a idempotência da DDL — garantida pelos testes acima — torna seguro.
 */
describe('o caminho de recuperação do dono não-técnico', () => {
  it('o painel oferece o botão mesmo com as tabelas prontas', () => {
    const panel = readFileSync(
      join(__dirname, '..', '..', 'src', 'app', 'admin', 'setup', 'panel.tsx'),
      'utf8',
    );

    const passo = panel.slice(panel.indexOf('title="Criar as tabelas"'), panel.indexOf('n={3}'));

    expect(
      passo.includes('!status.tablesReady && status.databaseConfigured'),
      'o botão voltou a sumir quando as tabelas existem — uma tabela nova vira beco sem saída',
    ).toBe(false);
    expect(passo, 'o botão sumiu do passo 2').toContain('action={prepareDatabase}');
  });
});
