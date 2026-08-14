/**
 * Não existe caminho para dados premium sem entitlement — §32.
 *
 * Até a introdução do banco, a página de resultado derivava os entitlements do query param
 * (`/resultado/<id>?plano=full_setup`), o que significava que qualquer pessoa lia o relatório
 * completo editando a URL. Este teste existe para que aquilo não volte por descuido.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const RESULT_PAGE = join(ROOT, 'src', 'app', 'resultado', '[sessionId]', 'page.tsx');

function sourceWithoutComments(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('a página de resultado não concede acesso por conta própria', () => {
  const source = sourceWithoutComments(RESULT_PAGE);

  it('não lê searchParams', () => {
    expect(source).not.toContain('searchParams');
  });

  it('não monta a lista de entitlements a partir de PRODUCT_ENTITLEMENTS', () => {
    // Esse mapa traduz produto → entitlements e pertence ao fluxo de PAGAMENTO. Se ele aparecer na
    // página, quase certamente é para conceder acesso sem passar pelo webhook.
    expect(source).not.toContain('PRODUCT_ENTITLEMENTS');
  });

  it('busca os entitlements no banco', () => {
    expect(source).toContain('grantedEntitlements');
  });
});

describe('a concessão de entitlement tem origem única', () => {
  it('nenhuma página ou componente escreve na tabela de entitlements', () => {
    // A escrita pertence exclusivamente ao webhook de pagamento confirmado (§33). Qualquer outro
    // ponto de escrita é um caminho paralelo de concessão.
    const offenders: string[] = [];
    const dirs = [join(ROOT, 'src', 'app'), join(ROOT, 'src', 'components')];

    for (const dir of dirs) {
      for (const file of walk(dir)) {
        if (file.includes(join('api', 'webhook'))) continue;
        const source = sourceWithoutComments(file);
        if (/insert\s*\(\s*entitlements/.test(source)) {
          offenders.push(file.replace(ROOT, ''));
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

function walk(dir: string): string[] {
  const { readdirSync, statSync, existsSync } = require('node:fs') as typeof import('node:fs');
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith('.ts') || full.endsWith('.tsx')) out.push(full);
  }
  return out;
}
