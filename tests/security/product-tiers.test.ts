/**
 * A escada de produtos: cada preço abre exatamente o que promete, e nada além.
 *
 * ═══ A SUSPEITA QUE ORIGINOU ESTE TESTE ══════════════════════════════════════════════════════
 *
 * "Quem vai em 'ver minha raquete' tem as mesmas informações que quem paga mais e vai no 'ver meu
 * setup completo'."
 *
 * Medido, não era: com apenas `racket_report_access`, o payload sai com `setup: null`, comparação
 * nula e 2ª e 3ª bloqueadas. O que produzia o sintoma era o CÓDIGO DE CONVITE — MAITE e DJOKOINSS
 * concedem o conjunto inteiro, então quem entra por eles vê tudo independentemente do plano em que
 * clicou.
 *
 * O sintoma era falso alarme; a ausência de teste não era. Nada garantia que a matriz de produtos
 * continuasse certa: bastava alguém acrescentar `full_setup_access` à raquete avulsa — por
 * engano, ou "para facilitar um teste" — e o vazamento entraria em produção sem nenhuma falha
 * visível. Os testes existentes verificam o que cada ENTITLEMENT libera; nenhum verificava quais
 * entitlements cada PREÇO concede.
 *
 * ═══ A ESCADA ════════════════════════════════════════════════════════════════════════════════
 *
 *     R$ 29,99  raquete            só a 1ª colocada, sem corda e sem tensão
 *     R$  9,99  2ª colocada        cada uma separadamente
 *     R$  9,99  3ª colocada
 *     R$ 29,99  completar setup    corda, espessura e tensão + a 2ª e a 3ª
 *     R$ 49,99  setup completo     tudo acima, de uma vez
 *
 * ═══ POR QUE O UPGRADE PASSOU A INCLUIR A 2ª E A 3ª ══════════════════════════════════════════
 *
 * Ele concedia só `full_setup_access`, e a conta não fechava para quem decidia em duas etapas:
 *
 *     de uma vez     full_setup ................................... R$ 49,99  (tudo)
 *     em duas etapas racket_report + setup_upgrade ................ R$ 59,98  (sem a 2ª e a 3ª)
 *                    + unlock_rank_2 + unlock_rank_3 .............. R$ 79,96  (tudo)
 *
 * Pagava 20% a mais para receber MENOS, e precisava de mais R$ 19,98 para empatar. Cobrar pelo
 * parcelamento da decisão é legítimo; entregar menos por mais dinheiro não é — e o cliente só
 * descobre depois de pagar. Com a 2ª e a 3ª incluídas, os dois caminhos chegam ao mesmo conteúdo e
 * a diferença de R$ 9,99 vira o que sempre deveria ter sido: o preço de decidir em duas vezes.
 */

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { PRODUCT_SEED } from '@/database/setup';
import { PRODUCT_ENTITLEMENTS, type Entitlement } from '@/payments/entitlements';

/** A escada, escrita à mão. Se o código divergir daqui, um dos dois está errado — e o teste falha. */
const ESPERADO: Readonly<Record<string, { cents: number; grants: readonly Entitlement[] }>> = {
  racket_report: { cents: 2999, grants: ['racket_report_access'] },
  unlock_rank_2: { cents: 999, grants: ['rank2_access'] },
  unlock_rank_3: { cents: 999, grants: ['rank3_access'] },
  setup_upgrade: { cents: 2999, grants: ['full_setup_access', 'rank2_access', 'rank3_access'] },
  full_setup: {
    cents: 4999,
    grants: ['racket_report_access', 'full_setup_access', 'rank2_access', 'rank3_access'],
  },
};

/*
  Chave como `string`, e não como a união literal das SKUs do seed.

  Com a união, `bySku.get('racket_report')` só compila enquanto essa SKU existir — e o teste que
  deveria DENUNCIAR a remoção de um produto passaria a falhar na compilação, sem dizer o que
  aconteceu. Aqui a ausência vira asserção legível em vez de erro de tipo.
*/
const bySku = new Map<string, (typeof PRODUCT_SEED)[number]>(
  PRODUCT_SEED.map((p) => [p.sku, p]),
);

describe('escada de produtos', () => {
  it('o catálogo tem exatamente os produtos previstos', () => {
    expect([...bySku.keys()].sort()).toEqual(Object.keys(ESPERADO).sort());
  });

  it.each(Object.keys(ESPERADO))('%s concede exatamente o que foi vendido', (sku) => {
    const product = bySku.get(sku);
    expect(product, `${sku} não existe no catálogo`).toBeDefined();

    expect(product!.priceCents, `${sku}: preço`).toBe(ESPERADO[sku]!.cents);
    expect([...product!.grantsEntitlements].sort(), `${sku}: entitlements`).toEqual(
      [...ESPERADO[sku]!.grants].sort(),
    );
  });

  /**
   * A raquete avulsa é o que mais importa aqui: é a barata, é a que mais gente compra, e é a
   * único cuja contaminação seria invisível — quem pagou pouco e recebeu muito não reclama.
   */
  it('a raquete avulsa não abre corda, tensão nem as outras colocadas', () => {
    const grants = bySku.get('racket_report')!.grantsEntitlements as readonly string[];

    for (const proibido of ['full_setup_access', 'rank2_access', 'rank3_access', 'top3_access']) {
      expect(grants, `a raquete avulsa concedendo ${proibido}`).not.toContain(proibido);
    }
  });

  /**
   * A promessa comercial de que a compra fatiada CHEGA ao mesmo lugar.
   *
   * Quem entra pela raquete avulsa e depois compra a 2ª, a 3ª e o setup precisa terminar com o
   * mesmo acesso de quem pagou R$ 49,99 de uma vez. Um único entitlement de diferença criaria um
   * cliente que gastou mais e recebeu menos — e ele descobriria isso sozinho, comparando com um
   * amigo.
   */
  it('comprar em partes termina no mesmo acesso de comprar tudo de uma vez', () => {
    const fatiado = new Set<string>([
      ...bySku.get('racket_report')!.grantsEntitlements,
      ...bySku.get('unlock_rank_2')!.grantsEntitlements,
      ...bySku.get('unlock_rank_3')!.grantsEntitlements,
      ...bySku.get('setup_upgrade')!.grantsEntitlements,
    ]);
    const completo = new Set<string>(bySku.get('full_setup')!.grantsEntitlements);

    expect([...fatiado].sort()).toEqual([...completo].sort());
  });

  /**
   * O preço de decidir em duas vezes é R$ 9,99 — e continua sendo depois do reajuste.
   *
   * Set/2026: a raquete avulsa subiu R$ 10 e o upgrade desceu R$ 10, de propósito. O upgrade não
   * está visível na hora da primeira escolha (a pessoa descobre que ele existe depois de pagar),
   * então cobrar prêmio por ele seria punir alguém por uma informação que não foi dada.
   *
   * Este teste é o que trava essa intenção: qualquer mexida futura em UM dos dois preços sem a
   * contrapartida no outro alarga a diferença em silêncio.
   */
  it('decidir em duas etapas custa exatamente R$ 9,99 a mais', () => {
    const duasEtapas =
      bySku.get('racket_report')!.priceCents + bySku.get('setup_upgrade')!.priceCents;

    expect(duasEtapas - bySku.get('full_setup')!.priceCents).toBe(999);
  });

  /** A soma das partes é mais cara que o pacote — senão o pacote não é pacote. */
  it('o caminho fatiado custa mais que o pacote', () => {
    const partes =
      bySku.get('racket_report')!.priceCents +
      bySku.get('unlock_rank_2')!.priceCents +
      bySku.get('unlock_rank_3')!.priceCents +
      bySku.get('setup_upgrade')!.priceCents;

    expect(partes).toBeGreaterThan(bySku.get('full_setup')!.priceCents);
  });

  /**
   * `PRODUCT_ENTITLEMENTS` é o que o WEBHOOK consulta para conceder; `PRODUCT_SEED` é o que o
   * cliente vê e paga. São duas tabelas em arquivos diferentes, e divergir significaria cobrar uma
   * coisa e entregar outra.
   */
  it('o que o webhook concede é o que a loja vendeu', () => {
    for (const product of PRODUCT_SEED) {
      const doWebhook = PRODUCT_ENTITLEMENTS[product.sku];
      expect(doWebhook, `${product.sku} não existe em PRODUCT_ENTITLEMENTS`).toBeDefined();
      expect([...doWebhook!].sort(), `${product.sku}: webhook diverge da loja`).toEqual(
        [...product.grantsEntitlements].sort(),
      );
    }
  });
});

/**
 * ═══ UMA LISTA SÓ DE PRODUTOS ════════════════════════════════════════════════════════════════
 *
 * `scripts/seed-products.ts` tinha a PRÓPRIA cópia do catálogo, e ela apodreceu enquanto
 * `PRODUCT_SEED` evoluía. Divergiam em tudo o que importa:
 *
 *     no script     full_setup concedia racket_report + full_setup
 *     em PRODUCT_SEED                   + rank2 + rank3
 *     no script     existia top3_unlock, já aposentado do outro lado
 *     no script     NÃO existiam setup_upgrade, unlock_rank_2 nem unlock_rank_3
 *
 * Um banco semeado pelo script ficava sem os três produtos que a página de resultado oferece — o
 * botão "Completar meu setup" apontava para uma SKU que não existia. E qual lista valia dependia de
 * quem tinha semeado, o que é estado indefinido num sistema que cobra dinheiro. Medido: foi
 * exatamente o que aconteceu ao subir um banco local para conferir o relatório.
 *
 * O script passou a importar `PRODUCT_SEED`. Este teste garante que ninguém recrie a segunda lista.
 */
describe('não existe uma segunda lista de produtos', () => {
  it('o script de seed não declara SKUs por conta própria', () => {
    const fonte = readFileSync(
      new URL('../../scripts/seed-products.ts', import.meta.url),
      'utf8',
    );

    expect(
      fonte,
      'o script precisa importar PRODUCT_SEED em vez de manter a própria cópia',
    ).toContain('PRODUCT_SEED');

    /*
      `sku:` em literal de objeto é a assinatura de uma lista própria. Importar não produz essa
      linha; declarar produtos à mão produz uma por produto.
    */
    const declaracoes = fonte.match(/^\s*sku:\s*'/gm) ?? [];
    expect(
      declaracoes.length,
      `o script voltou a declarar ${declaracoes.length} SKU(s) — a divergência entra por aqui`,
    ).toBe(0);
  });

  it('todo produto que a página de resultado oferece existe no catálogo', () => {
    /*
      As SKUs citadas nos links de compra. Se a página oferecer algo que o seed não cria, o botão
      leva a um checkout de produto inexistente — falha que só aparece em produção, com o cliente
      dentro do fluxo de pagamento.
    */
    const pagina = readFileSync(
      new URL('../../src/app/resultado/[sessionId]/page.tsx', import.meta.url),
      'utf8',
    );
    const ofertadas = new Set<string>();
    for (const m of pagina.matchAll(/produto=([a-z0-9_]+)(\$\{[^}]+\})?/g)) {
      const base = m[1] as string;
      if (!m[2]) {
        ofertadas.add(base);
        continue;
      }
      /*
        SKU montada por interpolação — `unlock_rank_${entry.rank}`. As posições vendáveis do pódio
        são a 2ª e a 3ª (a 1ª nunca é bloqueada), então o teste confere as duas que o link pode
        produzir de verdade, em vez de desistir de verificar a linha.
      */
      for (const rank of [2, 3]) ofertadas.add(`${base}${rank}`);
    }

    expect(ofertadas.size, 'nenhuma oferta encontrada — o teste não verificou nada').toBeGreaterThan(0);
    for (const sku of ofertadas) {
      expect(bySku.has(sku), `a página vende "${sku}", que não existe no catálogo`).toBe(true);
    }
  });
});

