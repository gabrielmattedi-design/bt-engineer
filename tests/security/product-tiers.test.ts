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
 * continuasse certa: bastava alguém acrescentar `full_setup_access` ao produto de R$ 19,99 — por
 * engano, ou "para facilitar um teste" — e o vazamento entraria em produção sem nenhuma falha
 * visível. Os testes existentes verificam o que cada ENTITLEMENT libera; nenhum verificava quais
 * entitlements cada PREÇO concede.
 *
 * ═══ A ESCADA ════════════════════════════════════════════════════════════════════════════════
 *
 *     R$ 19,99  raquete            só a 1ª colocada, sem corda e sem tensão
 *     R$  9,99  2ª colocada        cada uma separadamente
 *     R$  9,99  3ª colocada
 *     R$ 39,99  completar setup    corda, espessura e tensão para uma das já desbloqueadas
 *     R$ 49,99  setup completo     tudo acima, de uma vez
 */

import { describe, expect, it } from 'vitest';

import { PRODUCT_SEED } from '@/database/setup';
import { PRODUCT_ENTITLEMENTS, type Entitlement } from '@/payments/entitlements';

/** A escada, escrita à mão. Se o código divergir daqui, um dos dois está errado — e o teste falha. */
const ESPERADO: Readonly<Record<string, { cents: number; grants: readonly Entitlement[] }>> = {
  racket_report: { cents: 1999, grants: ['racket_report_access'] },
  unlock_rank_2: { cents: 999, grants: ['rank2_access'] },
  unlock_rank_3: { cents: 999, grants: ['rank3_access'] },
  setup_upgrade: { cents: 3999, grants: ['full_setup_access'] },
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
   * O produto de R$ 19,99 é o que mais importa aqui: é o barato, é o que mais gente compra, e é o
   * único cuja contaminação seria invisível — quem pagou pouco e recebeu muito não reclama.
   */
  it('a raquete avulsa não abre corda, tensão nem as outras colocadas', () => {
    const grants = bySku.get('racket_report')!.grantsEntitlements as readonly string[];

    for (const proibido of ['full_setup_access', 'rank2_access', 'rank3_access', 'top3_access']) {
      expect(grants, `R$ 19,99 concedendo ${proibido}`).not.toContain(proibido);
    }
  });

  /**
   * A promessa comercial de que a compra fatiada CHEGA ao mesmo lugar.
   *
   * Quem entra por R$ 19,99 e depois compra a 2ª, a 3ª e o setup precisa terminar com exatamente o
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
