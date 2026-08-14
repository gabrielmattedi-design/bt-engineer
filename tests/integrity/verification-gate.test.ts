/**
 * A barreira de verificação — docs/DATA_SOURCING.md §3, ADMIN_SPEC §2.
 *
 * O botão desabilitado no formulário é conveniência para o curador. A garantia real é esta: a
 * Server Action chama `canMarkVerified` de novo, porque uma Server Action é um endpoint HTTP e
 * pode ser chamada sem passar por nenhuma renderização.
 */

import { describe, expect, it } from 'vitest';
import { canMarkVerified } from '@/data/write-verification';
import { loadRacketCatalog } from '@/data/load';
import type { RacketVerification } from '@/data/load';

const base: RacketVerification = {
  state: 'verified',
  verified_at: '2026-08-14',
  verified_by: 'curador',
  source_url: 'https://www.head.com/ficha',
  cross_check_url: null,
  brazil_availability_status: 'available',
  brazil_sources: [],
  image_url: null,
  image_verified: false,
  notes: null,
};

describe('não é possível marcar como verificada sem procedência', () => {
  it('aceita um bloco completo', () => {
    expect(canMarkVerified(base).ok).toBe(true);
  });

  it('REJEITA sem URL da fonte', () => {
    const result = canMarkVerified({ ...base, source_url: null });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('URL da ficha oficial');
  });

  it('REJEITA com disponibilidade no Brasil desconhecida', () => {
    // §69: "um setup tecnicamente perfeito, mas inexistente no mercado, é uma recomendação errada".
    const result = canMarkVerified({ ...base, brazil_availability_status: 'unknown' });
    expect(result.ok).toBe(false);
  });

  it('REJEITA sem data de verificação', () => {
    expect(canMarkVerified({ ...base, verified_at: null }).ok).toBe(false);
  });

  it('não interfere em estados que não sejam "verified"', () => {
    const pendente: RacketVerification = {
      ...base,
      state: 'pending_verification',
      source_url: null,
      verified_at: null,
      brazil_availability_status: 'unknown',
    };
    expect(canMarkVerified(pendente).ok).toBe(true);
  });
});

describe('o catálogo nunca nasce verificado por omissão', () => {
  it('toda variante sem bloco de verificação está pendente', () => {
    for (const variant of loadRacketCatalog()) {
      if (variant.last_verified_at === null) {
        expect(
          variant.verification_state,
          `${variant.product_name} sem data de verificação não pode estar "verified"`,
        ).not.toBe('verified');
      }
    }
  });

  it('toda variante marcada como verificada tem data', () => {
    for (const variant of loadRacketCatalog()) {
      if (variant.verification_state === 'verified') {
        expect(variant.last_verified_at, variant.product_name).not.toBeNull();
      }
    }
  });
});
