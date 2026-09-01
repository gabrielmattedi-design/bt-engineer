/**
 * O preço anunciado é o preço cobrado — e o plano anuncia tudo o que entrega.
 *
 * ═══ AS DUAS FALHAS QUE ISTO TRANCA ══════════════════════════════════════════════════════════
 *
 * Descobertas juntas, ao subir a raquete avulsa de R$ 19,99 para R$ 29,99 (set/2026):
 *
 * 1. O NÚMERO PODIA DIVERGIR DO COBRADO. Os preços da home e do comparativo de `/analise` estavam
 *    escritos no JSX, enquanto o checkout lia da tabela `products`. E `seedProducts` era
 *    `onConflictDoNothing`: uma SKU já existente NUNCA era atualizada. Trocar o número no código e
 *    publicar deixaria o site anunciando R$ 29,99 e a loja cobrando R$ 19,99, sem erro em lugar
 *    nenhum. O §34 ("zero preço hardcoded") existe exatamente por isso e estava sendo violado em
 *    três arquivos.
 *
 * 2. O PLANO COMPLETO NÃO ANUNCIAVA METADE DO QUE DÁ. `full_setup` concede `rank2_access` e
 *    `rank3_access` desde sempre, e nenhuma das três descrições dizia isso — nem a home, nem o
 *    comparativo (que é A tela de decisão), nem o texto do banco. Duas das quatro entregas só
 *    apareciam depois de pagar, enquanto o upgrade mais barato anunciava esse mesmo benefício com
 *    todas as letras.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { PRODUCT_SEED } from '@/payments/catalogo';

const ROOT = join(__dirname, '..', '..');
const fonte = (...p: string[]): string => readFileSync(join(ROOT, ...p), 'utf8');

/**
 * O arquivo sem comentários.
 *
 * Comentário CITA preço de propósito — é assim que este repositório registra a decisão que produziu
 * o número, e um `R$ 19,99` numa explicação histórica não cobra nada de ninguém. Sem esta separação
 * o teste acusaria a própria documentação que ele existe para preservar.
 */
function semComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/**
 * Telas que exibem preço ao visitante. `/planos` fica FORA de propósito: ela antecede o checkout e
 * precisa mostrar o que `createOrder` vai copiar, então lê do banco, não do catálogo.
 */
const TELAS = [
  ['src', 'app', 'page.tsx'],
  ['src', 'app', 'analise', '[sessionId]', 'page.tsx'],
  ['src', 'app', 'resultado', '[sessionId]', 'page.tsx'],
];

describe('nenhum preço escrito à mão nas telas', () => {
  it.each(TELAS)('%s/%s/%s não tem valor em reais no JSX', (...partes) => {
    const achados = semComentarios(fonte(...partes)).match(/R\$\s?\d/g) ?? [];
    expect(
      achados,
      'preço no JSX volta a poder divergir do que a loja cobra (§34)',
    ).toEqual([]);
  });

  it('as telas leem o preço do catálogo', () => {
    for (const partes of TELAS) {
      expect(fonte(...partes), `${partes.join('/')} não importa o catálogo`).toContain(
        "from '@/payments/catalogo'",
      );
    }
  });
});

describe('o banco recebe o preço do catálogo', () => {
  const setup = fonte('src', 'database', 'setup.ts');

  /**
   * `onConflictDoNothing` aqui significa "o preço em produção é o do primeiro dia, para sempre".
   * Era o estado real até set/2026, e nada na tela denunciava.
   */
  it('o seed ATUALIZA a linha existente, não a ignora', () => {
    const codigo = semComentarios(setup);
    expect(codigo, 'o seed voltou a ignorar produtos já cadastrados').toContain(
      'onConflictDoUpdate',
    );
    expect(codigo).not.toContain('onConflictDoNothing');
  });

  it('o painel consegue mostrar quando a loja está atrasada', () => {
    // Sem isso, "os preços já foram aplicados?" só se responde comprando.
    expect(setup).toContain('precosDivergentes');
    expect(fonte('src', 'app', 'admin', 'setup', 'panel.tsx')).toContain('precosDesatualizados');
  });
});

describe('o plano completo anuncia o que concede', () => {
  const completo = PRODUCT_SEED.find((p) => p.sku === 'full_setup')!;

  /**
   * A regra geral, e não só o caso de hoje: quem vende as DUAS posições de uma vez precisa dizer
   * isso no texto. É o que evita o defeito voltar por outro produto.
   *
   * `unlock_rank_2` e `unlock_rank_3` ficam de fora porque cada um vende UMA posição, e a descrição
   * deles já nomeia qual — exigir a frase "a 2ª e a 3ª" ali seria exigir uma promessa falsa.
   */
  it.each(
    PRODUCT_SEED.filter(
      (p) =>
        p.grantsEntitlements.some((e) => e === 'rank2_access') &&
        p.grantsEntitlements.some((e) => e === 'rank3_access'),
    ).map((p) => p.sku),
  )('a descrição de %s cita as outras colocadas', (sku) => {
    const produto = PRODUCT_SEED.find((p) => p.sku === sku)!;
    expect(
      produto.description,
      `${sku} abre a 2ª e a 3ª sem dizer — o cliente só descobre depois de pagar`,
    ).toMatch(/2ª e a 3ª/);
  });

  it('a home e o comparativo listam as outras colocadas no plano completo', () => {
    expect(completo.grantsEntitlements).toContain('rank2_access');

    for (const partes of [
      ['src', 'app', 'page.tsx'],
      ['src', 'app', 'analise', '[sessionId]', 'page.tsx'],
    ]) {
      expect(fonte(...partes), `${partes.join('/')} não lista a 2ª e a 3ª`).toMatch(
        /A 2ª e a 3ª colocadas/,
      );
    }
  });
});
