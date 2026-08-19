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
