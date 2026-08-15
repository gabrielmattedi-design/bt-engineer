/**
 * A assinatura abreviada da marca é o MONOGRAMA, nunca as letras "TE" digitadas.
 *
 * Escrito como texto, "TE" é lido como uma tentativa de escrever "the" em inglês, e derruba a
 * sofisticação da marca. A regra vale para toda a família de selos — VERIFIED, MATCH ENGINE,
 * PLAYER PROFILE, SETUP SCORE — e para qualquer selo futuro.
 *
 * Uma regra de identidade que depende de alguém lembrar dela é uma regra que se perde no terceiro
 * componente novo. Este teste é o que a torna real.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');

function collect(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...collect(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/** Só o texto RENDERIZÁVEL: comentários explicam a regra citando "TE", e não a violam. */
function rendered(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

const UI_FILES = [...collect(join(ROOT, 'src', 'app')), ...collect(join(ROOT, 'src', 'components'))];

describe('a marca nunca é abreviada como as letras "TE"', () => {
  /**
   * Casa "TE" seguido de espaço e uma palavra em caixa alta — a forma de selo ("TE VERIFIED",
   * "TE MATCH ENGINE"). Deliberadamente NÃO casa "TE" dentro de palavras nem em identificadores
   * de código como `TENSION_BOUNDS`, que não são texto exibido.
   */
  const SEAL_PATTERN = /\bTE\s+[A-ZÀ-Ú]{3,}/;

  it.each([
    'VERIFIED',
    'MATCH ENGINE',
    'PLAYER PROFILE',
    'SETUP SCORE',
  ])('nenhum arquivo de UI escreve "TE %s"', (suffix) => {
    const offenders = UI_FILES.filter((file) => rendered(file).includes(`TE ${suffix}`)).map((f) =>
      relative(ROOT, f),
    );
    expect(offenders, `use <Seal label="${suffix}" />, que já assina com o monograma`).toEqual([]);
  });

  it('nenhum arquivo de UI usa a forma "TE <PALAVRA>" em nenhum selo', () => {
    const offenders = UI_FILES.filter((file) => SEAL_PATTERN.test(rendered(file))).map((f) =>
      relative(ROOT, f),
    );
    expect(offenders).toEqual([]);
  });
});

describe('o componente de selo assina com o monograma', () => {
  const seal = readFileSync(join(ROOT, 'src', 'components', 'marketing', 'seal.tsx'), 'utf8');

  it('renderiza o LogoMark, e não um prefixo de texto', () => {
    expect(seal).toContain('<LogoMark');
  });

  it('não expõe prop que permita trocar o monograma por texto', () => {
    // Se um dia existir `prefix`, a regra vira opcional — e regra opcional não é regra.
    expect(rendered(join(ROOT, 'src', 'components', 'marketing', 'seal.tsx'))).not.toMatch(
      /prefix\s*[?:]/,
    );
  });

  it('usa a versão simplificada do monograma, legível em tamanho de selo', () => {
    expect(seal).toContain('simplified');
  });
});
