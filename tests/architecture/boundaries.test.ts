/**
 * Fronteiras arquiteturais — docs/ARCHITECTURE.md §2.
 *
 * "Separar completamente UI da lógica de recomendação" (§44).
 *
 * O motor precisa rodar num teste, num script de CLI e num worker sem modificação. É isso que faz o
 * simulador do admin (§47) usar exatamente o mesmo código de produção, sem mocks nem caminho paralelo.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');

function collectFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...collectFiles(full));
    else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) out.push(full);
  }
  return out;
}

function importsOf(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const matches = source.matchAll(/from\s+['"]([^'"]+)['"]/g);
  return [...matches].map((m) => m[1] as string);
}

const FORBIDDEN_IN_ENGINE = [
  { pattern: /^react$|^react\//, label: 'react' },
  { pattern: /^next$|^next\//, label: 'next' },
  { pattern: /^@\/app\//, label: 'src/app' },
  { pattern: /^@\/components\//, label: 'src/components' },
  { pattern: /^@\/database\//, label: 'src/database' },
  { pattern: /^@\/ai\//, label: 'src/ai' },
  { pattern: /^@\/payments\//, label: 'src/payments' },
];

describe('o motor de recomendação é puro', () => {
  /*
    `src/motor` é o motor do beach tennis, que convive com o de tênis até as telas migrarem. Ele
    entra na mesma trava desde o primeiro arquivo: é mais barato nascer puro do que ser limpo depois.
  */
  const engineFiles = [
    ...collectFiles(join(ROOT, 'src', 'recommendation')),
    ...collectFiles(join(ROOT, 'src', 'motor')),
  ];

  it('encontra os arquivos do motor', () => {
    expect(engineFiles.length).toBeGreaterThan(8);
  });

  it.each(FORBIDDEN_IN_ENGINE.map((f) => [f.label, f.pattern] as const))(
    'o motor nunca importa %s',
    (label, pattern) => {
      const offenders: string[] = [];
      for (const file of engineFiles) {
        for (const imp of importsOf(file)) {
          if (pattern.test(imp)) offenders.push(`${relative(ROOT, file)} → ${imp}`);
        }
      }
      expect(offenders, `importação proibida de ${label}`).toEqual([]);
    },
  );

  it('src/domain não importa NADA fora de si mesmo', () => {
    const domainFiles = collectFiles(join(ROOT, 'src', 'domain'));
    const offenders: string[] = [];
    for (const file of domainFiles) {
      for (const imp of importsOf(file)) {
        const isRelative = imp.startsWith('.');
        const isDomain = imp.startsWith('@/domain/');
        if (!isRelative && !isDomain) offenders.push(`${relative(ROOT, file)} → ${imp}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('o motor não usa fontes de não-determinismo', () => {
    const offenders: string[] = [];
    for (const file of engineFiles) {
      // Remove comentários antes de varrer: a própria documentação do módulo cita
      // "sem Math.random()", e um scanner ingênuo acusaria a documentação como violação.
      const source = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      if (/Math\.random\s*\(/.test(source)) offenders.push(`${relative(ROOT, file)}: Math.random`);
      if (/Date\.now\s*\(/.test(source)) offenders.push(`${relative(ROOT, file)}: Date.now`);
      if (/new Date\s*\(\s*\)/.test(source)) offenders.push(`${relative(ROOT, file)}: new Date()`);
      if (/\bfetch\s*\(/.test(source)) offenders.push(`${relative(ROOT, file)}: fetch`);
    }
    expect(offenders).toEqual([]);
  });
});
