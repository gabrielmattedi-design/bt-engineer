/**
 * Nenhum botão leva a um beco sem saída.
 *
 * `/resultado/<id>` redireciona para `/analise/<id>` quando não há entitlement — é a garantia do
 * §32, e está correta. Mas isso significa que QUALQUER link de "comprar" apontando para
 * `/resultado` vira um laço: o usuário clica, volta para a mesma página, e não existe caminho para
 * a compra.
 *
 * Foi exatamente o que aconteceu quando os entitlements deixaram de vir do query param: os botões
 * da página de análise continuaram apontando para `/resultado/<id>?plano=…`, um parâmetro que já
 * não fazia nada. A tela parecia funcionar e o funil estava morto.
 *
 * O caminho de compra é `/planos/<id>`, sempre.
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

function rendered(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

const UI = [...collect(join(ROOT, 'src', 'app')), ...collect(join(ROOT, 'src', 'components'))];

describe('o funil de compra não tem laço', () => {
  it('nenhum link usa o parâmetro morto ?plano=', () => {
    const offenders = UI.filter((f) => /\?plano=/.test(rendered(f))).map((f) => relative(ROOT, f));
    expect(offenders, 'entitlements vêm do banco; este parâmetro não faz nada').toEqual([]);
  });

  it('a página de análise leva ao CHECKOUT, não ao relatório', () => {
    const page = rendered(join(ROOT, 'src', 'app', 'analise', '[sessionId]', 'page.tsx'));

    // Sem compra, /resultado devolve para /analise — o usuário voltaria para onde estava.
    expect(page, 'link para /resultado antes da compra cria laço').not.toMatch(
      /href=\{`\/resultado\//,
    );
    expect(page).toMatch(/href=\{`\/planos\//);
  });

  it('todo destino de compra aponta para /planos', () => {
    const compras = UI.flatMap((file) => {
      const matches = rendered(file).matchAll(/href=\{`(\/[^`$]*(?:\$\{[^}]*\})?[^`]*)`\}/g);
      return [...matches]
        .map((m) => m[1] ?? '')
        .filter((href) => /produto=|plano=/.test(href))
        .map((href) => `${relative(ROOT, file)} → ${href}`);
    });

    for (const destino of compras) {
      expect(destino, 'compra deve passar por /planos').toContain('/planos/');
    }
  });
});
