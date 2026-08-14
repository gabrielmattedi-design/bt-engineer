/**
 * Guard anti-alucinação — docs/TEST_STRATEGY.md §6.
 *
 * Este teste é a prova de que §4 ("a IA jamais poderá inventar peso, swingweight, rigidez…") é
 * uma propriedade do sistema, não uma instrução de prompt.
 */

import { describe, expect, it } from 'vitest';
import { guardExplanation, guardFactualClaims, guardTone } from '@/ai/guard';
import type { FactSheet } from '@/recommendation/explain/fact-sheet';

const SHEET: FactSheet = {
  product_name: 'Wilson Blade 98 16x19 v9 (2024)',
  facts: [
    { label: 'Compatibilidade', value: '91%' },
    { label: 'Marca', value: 'Wilson' },
    { label: 'Tamanho da cabeça', value: '98 sq in' },
    { label: 'Peso (não encordoada)', value: '305 g' },
    { label: 'Balanço', value: '320 mm' },
    { label: 'Padrão de cordas', value: '16×19' },
    { label: 'Índice de controle', value: '75' },
  ],
  profile_notes: ['O swing declarado é longo.'],
  attention_points: [],
  unknown_fields: ['swingweight, rigidez (RA)'],
};

describe('guardFactualClaims', () => {
  it('aceita texto que cita apenas números autorizados', () => {
    const text =
      'A Wilson Blade 98 pesa 305 g, tem cabeça de 98 sq in e padrão 16×19, ' +
      'com 91% de compatibilidade e índice de controle 75.';
    expect(guardFactualClaims(text, SHEET).ok).toBe(true);
  });

  it('REJEITA um swingweight inventado — o caso do R-03', () => {
    const text = 'A Wilson Blade 98 pesa 305 g e tem swingweight 325, o que a torna estável.';
    const result = guardFactualClaims(text, SHEET);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.violations).toContain('325');
  });

  it('REJEITA uma rigidez RA inventada', () => {
    const text = 'Com RA 62, é um frame flexível.';
    const result = guardFactualClaims(text, SHEET);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.violations).toContain('62');
  });

  it('REJEITA uma tensão inventada', () => {
    const text = 'Recomendamos encordoar a 54 lbs.';
    expect(guardFactualClaims(text, SHEET).ok).toBe(false);
  });

  it('REJEITA um peso alterado, mesmo próximo do real', () => {
    const text = 'A raquete pesa 310 g.';
    const result = guardFactualClaims(text, SHEET);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.violations).toContain('310');
  });

  it('tolera números pequenos de prosa', () => {
    const text = 'As 2 primeiras opções ficaram empatadas; considere 3 semanas de adaptação.';
    expect(guardFactualClaims(text, SHEET).ok).toBe(true);
  });

  it('aceita decimais equivalentes (22,7 vs 22.7)', () => {
    const sheet: FactSheet = {
      ...SHEET,
      facts: [{ label: 'Tensão', value: '50 lbs (22,7 kg)' }],
    };
    expect(guardFactualClaims('Comece em 50 lbs, ou 22.7 kg.', sheet).ok).toBe(true);
  });
});

describe('guardTone (§55, §62)', () => {
  it('rejeita promessas de certeza absoluta', () => {
    expect(guardTone('Esta é definitivamente a melhor raquete para você.').ok).toBe(false);
    expect(guardTone('É a única raquete que serve para o seu jogo.').ok).toBe(false);
    expect(guardTone('Garantimos que você vai jogar melhor.').ok).toBe(false);
  });

  it('aceita a formulação honesta recomendada pela especificação', () => {
    const text =
      'Esta foi a raquete que apresentou maior compatibilidade com o perfil informado.';
    expect(guardTone(text).ok).toBe(true);
  });
});

describe('guardExplanation — as duas checagens em conjunto', () => {
  it('só aprova texto que passa em ambas', () => {
    expect(
      guardExplanation('A Wilson Blade 98 de 305 g apresentou 91% de compatibilidade.', SHEET).ok,
    ).toBe(true);

    // Números corretos, tom errado.
    expect(
      guardExplanation('A Wilson Blade 98 de 305 g é perfeita para você.', SHEET).ok,
    ).toBe(false);

    // Tom correto, número inventado.
    expect(
      guardExplanation('Esta raquete apresentou boa compatibilidade e swingweight 331.', SHEET).ok,
    ).toBe(false);
  });
});
