/**
 * Gera `src/database/bootstrap-sql.ts` a partir das migrações do Drizzle.
 *
 * Rode depois de `drizzle-kit generate`, sempre que o schema mudar:
 *
 *   npm run db:bootstrap-sql
 *
 * Converte cada comando para a forma idempotente — `IF NOT EXISTS` em tabelas e índices,
 * `DO $$ ... pg_constraint ...` em chaves estrangeiras — para que rodar duas vezes seja inofensivo.
 * Ver a explicação completa no cabeçalho do arquivo gerado.
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS = join(process.cwd(), 'src', 'database', 'migrations');
const OUT = join(process.cwd(), 'src', 'database', 'bootstrap-sql.ts');

function idempotent(statement: string): string {
  const s = statement.replace(/;\s*$/, '').trim();

  const fk = /^ALTER TABLE "(\w+)" ADD CONSTRAINT "([^"]+)" ([\s\S]*)$/.exec(s);
  if (fk) {
    const [, table, name, rest] = fk;
    return [
      'DO $$ BEGIN',
      `  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN`,
      `    ALTER TABLE "${table}" ADD CONSTRAINT "${name}" ${rest};`,
      '  END IF;',
      'END $$',
    ].join('\n');
  }

  return (
    s
      .replace(/^CREATE TABLE "/, 'CREATE TABLE IF NOT EXISTS "')
      .replace(/^CREATE UNIQUE INDEX "/, 'CREATE UNIQUE INDEX IF NOT EXISTS "')
      .replace(/^CREATE INDEX "/, 'CREATE INDEX IF NOT EXISTS "')
      /*
        `ADD COLUMN` também precisa de `IF NOT EXISTS`, e não tinha.

        Sem isso, rodar o bootstrap sobre um banco que já tem a coluna devolve
        "column already exists" e o botão "Criar tabelas" quebra — exatamente o cenário que a
        idempotência existe para cobrir, e exatamente com quem não tem como diagnosticar o erro.

        O sintoma estava mascarado porque a única `ADD COLUMN` do projeto tinha sido corrigida à mão
        no arquivo GERADO. A correção manual sobrevive até a próxima regeneração; esta regra
        sobrevive sempre.
      */
      .replace(/^(ALTER TABLE "\w+" ADD COLUMN )"/, '$1IF NOT EXISTS "')
  );
}

function main(): void {
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const statements = files.flatMap((file) =>
    readFileSync(join(MIGRATIONS, file), 'utf8')
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean)
      .map(idempotent),
  );

  const escaped = statements.map(
    (s) => '  `' + s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${') + '`',
  );

  const header = readFileSync(OUT, 'utf8').split('export const BOOTSTRAP_STATEMENTS')[0];
  writeFileSync(
    OUT,
    `${header}export const BOOTSTRAP_STATEMENTS: readonly string[] = [\n${escaped.join(',\n')},\n];\n`,
    'utf8',
  );

  console.log(`${statements.length} comandos gerados de ${files.length} migração(ões).`);
}

main();
