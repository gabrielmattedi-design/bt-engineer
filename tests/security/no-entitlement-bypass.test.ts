/**
 * Não existe caminho para dados premium sem entitlement — §32.
 *
 * Até a introdução do banco, a página de resultado derivava os entitlements do query param
 * (`/resultado/<id>?plano=full_setup`), o que significava que qualquer pessoa lia o relatório
 * completo editando a URL. Este teste existe para que aquilo não volte por descuido.
 */

import { readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
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

describe('a concessão de entitlement tem origens conhecidas', () => {
  it('nenhuma página ou componente escreve na tabela de entitlements', () => {
    // A escrita pertence à camada de repositório. Uma página que concede acesso é um caminho
    // paralelo — foi exatamente o defeito do `?plano=` que este arquivo existe para impedir.
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

  /*
    ═══ POR QUE ESTE TESTE PRECISOU EXISTIR ═════════════════════════════════════════════════════

    O teste acima varria `src/app` e `src/components` — e mais nada. A escrita real de entitlement
    mora em `src/database/repositories`, que ficava inteiramente fora da varredura. Resultado: dois
    comentários no código afirmavam "só o webhook escreve aqui" e "a ÚNICA origem de entitlement em
    todo o sistema", com um teste supostamente garantindo isso, enquanto `coupon-repo` concedia
    acesso completo por cupom desde sempre.

    Nada disso era brecha — o cupom é intencional, tem teto diário e throttle. O defeito era o
    código MENTIR sobre a própria invariante, no comentário que alguém leria antes de decidir se
    "tem acesso" significa "pagou". Não significa.

    Este teste fixa a lista das origens. Uma terceira só passa se alguém a escrever aqui — que é
    onde a decisão fica visível.
  */
  it('a lista de origens de concessão é exatamente a conhecida', () => {
    const esperadas = [
      '/src/database/repositories/commerce-repo.ts', // webhook de pagamento confirmado
      '/src/database/repositories/coupon-repo.ts', // cupom de acesso, sem pedido
    ];

    const encontradas = walk(join(ROOT, 'src'))
      .filter((file) => /insert\s*\(\s*entitlements/.test(sourceWithoutComments(file)))
      .map((file) => file.replace(ROOT, '').split(sep).join('/'))
      .sort();

    expect(encontradas).toEqual(esperadas);
  });

  /*
    O cupom concede SEM pedido, e é isso que o distingue no funil e em qualquer pergunta futura
    sobre receita. Se um dia ele passar a preencher `grantedByOrderId`, um convidado vira comprador
    em todo relatório do painel — sem que nada quebre e sem que ninguém perceba.
  */
  it('o cupom não se disfarça de compra', () => {
    const cupom = sourceWithoutComments(
      join(ROOT, 'src', 'database', 'repositories', 'coupon-repo.ts'),
    );
    expect(cupom).not.toContain('grantedByOrderId');
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
