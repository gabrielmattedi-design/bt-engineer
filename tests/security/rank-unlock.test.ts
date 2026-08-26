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
   * O upgrade de setup é vendido a quem JÁ tem o relatório da raquete, e passou a incluir a 2ª e a
   * 3ª colocadas.
   *
   * ─── O ARGUMENTO ANTERIOR NÃO FECHAVA A CONTA ──────────────────────────────────────────────
   *
   * A versão anterior deste teste travava o contrário, justificando: "senão sairia mais barato
   * comprar o upgrade do que as duas posições". A aritmética diz o oposto — o upgrade custa
   * R$ 39,99 e as duas posições avulsas somam R$ 19,98. Quem quer só as posições continua
   * comprando as posições, pela metade do preço; não havia incentivo perverso a evitar.
   *
   * O que a regra produzia de fato era punir quem decide em duas etapas: racket_report +
   * setup_upgrade = R$ 59,98 para receber MENOS do que os R$ 49,99 do pacote entregam, e mais
   * R$ 19,98 para empatar. Cobrar pelo parcelamento da decisão é legítimo; entregar menos por mais
   * dinheiro não é.
   */
  it('o upgrade de setup inclui a 2ª e a 3ª', () => {
    const granted = PRODUCT_ENTITLEMENTS.setup_upgrade!;
    expect(canSeeRank(granted, 2)).toBe(true);
    expect(canSeeRank(granted, 3)).toBe(true);
  });

  /**
   * E ele continua NÃO sendo atalho para o relatório: `serializeRecommendation` exige
   * `racket_report_access` na primeira linha, então o upgrade sozinho não serializa nada.
   */
  it('o upgrade sozinho não abre o relatório', () => {
    expect(PRODUCT_ENTITLEMENTS.setup_upgrade).not.toContain('racket_report_access');
  });

  it('cada desbloqueio concede exatamente a sua posição', () => {
    expect(PRODUCT_ENTITLEMENTS.unlock_rank_2).toEqual(['rank2_access']);
    expect(PRODUCT_ENTITLEMENTS.unlock_rank_3).toEqual(['rank3_access']);
  });
});
