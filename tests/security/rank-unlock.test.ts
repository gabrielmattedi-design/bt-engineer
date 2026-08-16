/**
 * Cada posição do pódio é uma compra independente — e um acesso não empresta o outro.
 *
 * O desbloqueio era um só: `top3_access` abria a 2ª e a 3ª juntas. Passou a ser por posição, a
 * R$ 9,99 cada, e a mudança abre uma classe de erro nova: o gating por posição vira quatro
 * combinações em vez de duas, e a que interessa a um atacante é "comprei a 3ª, vejo a 2ª de
 * graça". Estes testes fixam as quatro.
 *
 * `top3_access` continua concedendo as duas porque ele existe gravado no banco de quem comprou
 * antes. Um entitlement é uma promessa cumprida; ela não expira porque o catálogo mudou de forma.
 */

import { describe, expect, it } from 'vitest';
import { canSeeRank, PRODUCT_ENTITLEMENTS, type Entitlement } from '@/payments/entitlements';

describe('desbloqueio por posição', () => {
  it('a 1ª colocada nunca depende de compra adicional', () => {
    expect(canSeeRank([], 1)).toBe(true);
    expect(canSeeRank(['racket_report_access'], 1)).toBe(true);
  });

  it('sem compra, 2ª e 3ª ficam bloqueadas', () => {
    for (const rank of [2, 3]) {
      expect(canSeeRank(['racket_report_access'], rank), `rank ${rank}`).toBe(false);
    }
  });

  it('comprar a 2ª NÃO libera a 3ª', () => {
    const granted: Entitlement[] = ['racket_report_access', 'rank2_access'];
    expect(canSeeRank(granted, 2)).toBe(true);
    expect(canSeeRank(granted, 3)).toBe(false);
  });

  it('comprar a 3ª NÃO libera a 2ª', () => {
    const granted: Entitlement[] = ['racket_report_access', 'rank3_access'];
    expect(canSeeRank(granted, 3)).toBe(true);
    expect(canSeeRank(granted, 2)).toBe(false);
  });

  it('o entitlement legado continua abrindo as duas', () => {
    const granted: Entitlement[] = ['racket_report_access', 'top3_access'];
    expect(canSeeRank(granted, 2)).toBe(true);
    expect(canSeeRank(granted, 3)).toBe(true);
  });

  it('o setup completo já inclui as três posições', () => {
    const granted = PRODUCT_ENTITLEMENTS.full_setup!;
    expect(canSeeRank(granted, 2)).toBe(true);
    expect(canSeeRank(granted, 3)).toBe(true);
  });

  /**
   * O upgrade de setup é vendido a quem JÁ tem o relatório da raquete. Ele não pode, sozinho,
   * abrir posições do pódio — senão sairia mais barato comprar o upgrade do que as duas posições.
   */
  it('o upgrade de setup não abre posições do pódio', () => {
    const granted = PRODUCT_ENTITLEMENTS.setup_upgrade!;
    expect(canSeeRank(granted, 2)).toBe(false);
    expect(canSeeRank(granted, 3)).toBe(false);
  });

  it('cada desbloqueio concede exatamente a sua posição', () => {
    expect(PRODUCT_ENTITLEMENTS.unlock_rank_2).toEqual(['rank2_access']);
    expect(PRODUCT_ENTITLEMENTS.unlock_rank_3).toEqual(['rank3_access']);
  });
});
