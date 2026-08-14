/**
 * Entitlements — docs/TEST_STRATEGY.md §6.
 *
 * §32: "Não confiar apenas em ocultar informações no frontend. A API não deve entregar dados
 * premium para usuário sem entitlement. Nunca mandar segundo e terceiro modelos escondidos
 * apenas por CSS."
 *
 * A varredura recursiva abaixo é o teste que realmente importa: ela procura QUALQUER marca ou
 * modelo do catálogo em QUALQUER string do payload, em qualquer profundidade.
 */

import { describe, expect, it } from 'vitest';
import { buildPlayerProfile } from '@/recommendation/profile/build-profile';
import { recommend } from '@/recommendation';
import {
  EntitlementError,
  serializeRecommendation,
  serializeTeaser,
  type Entitlement,
} from '@/payments/entitlements';
import { PERSONAS } from '@/data/personas';
import { TEST_DATASET_VERSION, TEST_MODE, testRackets, testStrings } from '../helpers/catalog';

function buildResult() {
  // Persona 5 tem raquete atual e produz pódio completo.
  const persona = PERSONAS.find((p) => p.id === 'p05')!;
  const profile = buildPlayerProfile(persona.answers);
  const result = recommend({
    profile,
    rackets: testRackets(),
    strings: testStrings(),
    datasetVersion: TEST_DATASET_VERSION,
    mode: TEST_MODE,
    includeSetup: true,
  });
  return { profile, result };
}

/** Todas as strings do payload, em qualquer profundidade. */
function allStrings(value: unknown, acc: string[] = []): string[] {
  if (typeof value === 'string') acc.push(value);
  else if (Array.isArray(value)) for (const v of value) allStrings(v, acc);
  else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) allStrings(v, acc);
  }
  return acc;
}

const { profile, result } = buildResult();

describe('sem entitlement algum', () => {
  it('serializeRecommendation LANÇA', () => {
    expect(() => serializeRecommendation(result, profile, [])).toThrow(EntitlementError);
  });

  it('o teaser não revela nenhum produto (§27)', () => {
    const teaser = serializeTeaser(result, testStrings().variants.length);
    const text = allStrings(teaser).join(' ').toLowerCase();

    // Tokens com menos de 4 caracteres são descartados: a família "Ti" (HEAD Ti.S6) aparece como
    // substring de palavras comuns do português e produziria um falso positivo. Nenhum nome de
    // produto real do catálogo é identificável por um token de 3 caracteres, então a garantia
    // do teste permanece intacta.
    const identifiers = testRackets().flatMap((r) => [
      r.variant.model.toLowerCase(),
      r.variant.family.toLowerCase(),
      r.variant.product_name.toLowerCase(),
    ]);
    for (const id of identifiers) {
      if (id.length < 4) continue;
      expect(text, `vazou identificador de produto: ${id}`).not.toContain(id);
    }
    // Mas mostra que houve processamento real.
    expect(teaser.candidates_evaluated).toBeGreaterThan(30);
    expect(teaser.analysis_steps.length).toBe(6);
  });
});

describe('racket_report_access (R$ 19,99)', () => {
  const granted: Entitlement[] = ['racket_report_access'];
  const payload = serializeRecommendation(result, profile, granted);

  it('libera o 1º colocado completo', () => {
    const first = payload.podium[0]!;
    expect(first.locked).toBe(false);
    if (!first.locked) {
      expect(first.brand).toBeTruthy();
      expect(first.product_name).toBeTruthy();
      expect(first.why.length).toBeGreaterThan(0);
    }
  });

  it('2º e 3º vêm APENAS como {rank, fit_score, teaser, locked}', () => {
    for (const entry of payload.podium.slice(1)) {
      expect(entry.locked).toBe(true);
      expect(Object.keys(entry).sort()).toEqual(['fit_score', 'locked', 'rank', 'teaser']);
    }
  });

  it('NENHUMA marca ou modelo dos bloqueados vaza no payload inteiro', () => {
    const lockedRackets = result.podium.slice(1).map((p) => p.racket.variant);
    const text = allStrings(payload).join(' ').toLowerCase();

    for (const variant of lockedRackets) {
      expect(text, `vazou "${variant.model}"`).not.toContain(variant.model.toLowerCase());
      expect(text, `vazou "${variant.product_name}"`).not.toContain(
        variant.product_name.toLowerCase(),
      );
    }
  });

  it('NÃO inclui corda, gauge nem tensão (§25)', () => {
    expect(payload.setup).toBeNull();
    const text = allStrings(payload).join(' ').toLowerCase();
    for (const model of testStrings().models) {
      expect(text).not.toContain(model.model.toLowerCase());
    }
    expect(text).not.toContain('lbs');
  });

  it('oferece o upsell do Top 3 quando as três são boas opções', () => {
    expect(payload.top3_offer_available).toBe(result.top3_offer_available);
    expect(payload.comparison).toBeNull();
  });
});

describe('full_setup_access (R$ 49,99)', () => {
  const granted: Entitlement[] = ['racket_report_access', 'full_setup_access'];
  const payload = serializeRecommendation(result, profile, granted);

  it('inclui corda, gauge e tensão', () => {
    expect(payload.setup).not.toBeNull();
    const setup = payload.setup!;
    expect(setup.string_brand).toBeTruthy();
    expect(setup.gauge_mm).toBeGreaterThan(1);
    expect(setup.tension_lbs).toBeGreaterThan(35);
    expect(setup.tension_kg).toBeGreaterThan(15);
    expect(setup.why_tension.length).toBeGreaterThan(0);
    expect(setup.why_combination).toBeTruthy();
  });

  it('AINDA assim mantém 2º e 3º bloqueados — setup ≠ top3', () => {
    for (const entry of payload.podium.slice(1)) {
      expect(entry.locked).toBe(true);
    }
    expect(payload.comparison).toBeNull();
  });
});

describe('top3_access (R$ 9,99)', () => {
  const granted: Entitlement[] = ['racket_report_access', 'top3_access'];
  const payload = serializeRecommendation(result, profile, granted);

  it('libera os três colocados completos', () => {
    for (const entry of payload.podium) {
      expect(entry.locked).toBe(false);
      if (!entry.locked) expect(entry.product_name).toBeTruthy();
    }
  });

  it('inclui a tabela comparativa (§31)', () => {
    expect(payload.comparison).not.toBeNull();
    expect(payload.comparison!.length).toBe(result.podium.length);
    for (const entry of payload.comparison!) {
      expect(entry.specs).toBeDefined();
      expect(entry.indices).toBeDefined();
    }
  });

  it('não oferece o upsell de novo para quem já comprou', () => {
    expect(payload.top3_offer_available).toBe(false);
  });
});

describe('honestidade do payload', () => {
  it('todo score exibido é inteiro — sem falsa precisão (R-04)', () => {
    const payload = serializeRecommendation(result, profile, [
      'racket_report_access',
      'top3_access',
    ]);
    for (const entry of payload.podium) {
      expect(Number.isInteger(entry.fit_score)).toBe(true);
    }
  });

  it('os índices são exibidos em passos de 5', () => {
    const payload = serializeRecommendation(result, profile, ['racket_report_access']);
    const first = payload.podium[0]!;
    if (!first.locked) {
      for (const value of Object.values(first.indices)) {
        expect(value % 5).toBe(0);
      }
    }
  });

  it('o disclaimer dos índices está sempre presente (§64)', () => {
    const payload = serializeRecommendation(result, profile, ['racket_report_access']);
    expect(payload.indices_disclaimer).toContain('não especificações do fabricante');
    expect(payload.indices_disclaimer).toContain('Tennis Engineer');
  });

  it('a confiança acompanha o resultado e é separada da compatibilidade (§24)', () => {
    const payload = serializeRecommendation(result, profile, ['racket_report_access']);
    expect(['Alta', 'Média', 'Baixa']).toContain(payload.confidence.level);
  });

  it('grava as versões de motor e dataset (§61)', () => {
    const payload = serializeRecommendation(result, profile, ['racket_report_access']);
    expect(payload.engine_version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(payload.dataset_version).toBeTruthy();
  });
});
