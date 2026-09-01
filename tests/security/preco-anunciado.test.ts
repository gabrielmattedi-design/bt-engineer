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
 *    A correção definitiva não foi sincronizar as duas fontes — foi eliminar uma. O banco manda no
 *    preço, o painel o edita, e as quatro telas leem de lá. Divergir deixa de ser algo que se evita
 *    com disciplina e passa a ser algo que não tem como acontecer.
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

  /**
   * Todas as telas leem da MESMA fonte, e essa fonte é o banco.
   *
   * É a propriedade que torna a divergência impossível por construção: `/planos` mostra o que
   * `createOrder` vai copiar para o pedido, e as outras três mostram exatamente o mesmo número.
   */
  it('as telas leem o preço do banco', () => {
    for (const partes of TELAS) {
      expect(fonte(...partes), `${partes.join('/')} não lê o preço publicado`).toContain(
        "from '@/payments/precos'",
      );
    }
  });
});

describe('o preço mora no banco, e o painel é quem o muda', () => {
  const setup = fonte('src', 'database', 'setup.ts');

  /**
   * O seed NÃO pode escrever preço em linha que já existe — e isto é o oposto do que ele fazia.
   *
   * Quem mais chama `seedProducts` não é o painel, é `withAutoBootstrap`, sozinho, sempre que falta
   * uma tabela ou uma coluna. Se ele reconciliasse o preço, a primeira migração futura reverteria
   * em silêncio tudo o que o dono tivesse ajustado — e o sintoma seria "o preço voltou sozinho".
   */
  it('o seed não sobrescreve preço de produto já cadastrado', () => {
    const corpo = /export async function seedProducts[\s\S]*?\n}/.exec(semComentarios(setup))?.[0] ?? '';
    expect(corpo, 'seedProducts sumiu ou mudou de forma').not.toBe('');

    const set = /onConflictDoUpdate\(\{[\s\S]*?\n      \}\)/.exec(corpo)?.[0] ?? '';
    expect(set, 'o bloco de atualização sumiu').not.toBe('');
    expect(set, 'o seed voltou a reescrever o preço ajustado no painel').not.toContain('priceCents');

    // Nome, descrição e entitlements CONTINUAM vindo do código: descrevem o que o motor entrega.
    expect(set).toContain('description');
    expect(set).toContain('grantsEntitlements');
  });

  it('existe uma tela para editar o preço', () => {
    const acoes = fonte('src', 'app', 'admin', 'setup', 'actions.ts');
    expect(acoes, 'a ação de salvar preços sumiu').toContain('salvarPrecos');
    expect(fonte('src', 'app', 'admin', 'setup', 'panel.tsx')).toContain('PrecosForm');
  });

  /**
   * Conferir DEPOIS de gravar deixaria a loja num estado misto quando a recusa acontecesse: alguns
   * preços novos, outros antigos, e uma escada que ninguém desenhou.
   */
  it('a escada é conferida antes de qualquer gravação', () => {
    /*
      Só o CORPO da função. Buscar no arquivo inteiro faz a linha de `import` contar como uso, e
      ela vem antes de tudo — o teste passaria a medir a ordem dos imports, não a da lógica.
    */
    const corpo =
      /export async function salvarPrecos[\s\S]*?\n}/.exec(
        semComentarios(fonte('src', 'app', 'admin', 'setup', 'actions.ts')),
      )?.[0] ?? '';
    expect(corpo, 'salvarPrecos sumiu ou mudou de forma').not.toBe('');

    const posConfere = corpo.indexOf('conferirEscada');
    const posGrava = corpo.indexOf('atualizarPrecos');

    expect(posConfere, 'a ação salva sem conferir a escada').toBeGreaterThan(-1);
    expect(posGrava, 'a ação não grava nada').toBeGreaterThan(-1);
    expect(posConfere).toBeLessThan(posGrava);
  });

  /**
   * Cinco `UPDATE` soltos têm quatro instantes entre eles em que metade da escada é nova e metade é
   * velha — e uma visita que caia ali pode comprar uma combinação que ninguém aprovou.
   */
  it('a gravação dos preços é uma transação só', () => {
    const repo = /export async function atualizarPrecos[\s\S]*?\n}/.exec(
      fonte('src', 'database', 'repositories', 'commerce-repo.ts'),
    )?.[0] ?? '';
    expect(repo, 'atualizarPrecos sumiu').not.toBe('');
    expect(repo, 'preços gravados um a um deixam a loja incoerente no meio').toContain(
      'transaction',
    );
  });

  /** Salvar precisa invalidar a home, que é servida de cache — senão ela anuncia o preço velho. */
  it('salvar um preço invalida as telas que o exibem', () => {
    const bloco = /export async function salvarPrecos[\s\S]*?\n}/.exec(
      fonte('src', 'app', 'admin', 'setup', 'actions.ts'),
    )?.[0] ?? '';
    expect(bloco).toContain("revalidatePath('/', 'layout')");
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
