import { describe, expect, it } from 'vitest';
import { explainTension } from '@/recommendation/explain/deterministic';
import type { TensionRecommendation } from '@/domain/recommendation';

/**
 * A CONTA DA TENSÃO PRECISA FECHAR NA TELA.
 *
 * ═══ O DEFEITO QUE ISTO TRANCA ═══════════════════════════════════════════════════════════════
 *
 * Reclamação do usuário, com o relatório aberto: base 55 lbs, ajustes listados de −3, −2,1 e −1,3,
 * e resultado final 50 lbs. Ele somou o que estava na tela, deu −6,4, e o resultado dizia −5.
 *
 * A causa era `slice(0, 3)`: a explicação mostrava os três maiores ajustes e calava sobre os
 * demais, sem dizer que existiam. Somavam-se ainda a ancoragem, os clamps de segurança — cuja nota
 * dizia "ajustamos" sem dizer de quanto para quanto — e o arredondamento final.
 *
 * Um relatório que mostra parcelas e um total que não bate com elas destrói a confiança em todo o
 * resto, e é justamente a auditabilidade da conta que este produto vende (§48). O teste garante
 * que nenhuma parcela volte a sumir em silêncio.
 */

function tension(over: Partial<TensionRecommendation> = {}): TensionRecommendation {
  return {
    lbs: 50,
    kg: 22.7,
    range_lbs: [48, 52],
    mains_lbs: null,
    crosses_lbs: null,
    base_lbs: 55,
    base_source: 'manufacturer_range',
    adjustments: [],
    clamped_by: null,
    pre_clamp_lbs: 50,
    anchored_to_current: false,
    anchor_weight: 0,
    guidance: 'Comece em 50 lbs.',
    notes: [],
    ...over,
  };
}

const adj = (delta: number, n: number) => ({
  factor: `f${n}`,
  delta_lbs: delta,
  rationale: `motivo ${n}`,
});

/** Todo número com uma casa que aparece seguido de "lbs" no texto. */
function libras(linhas: readonly string[]): number[] {
  return linhas.flatMap((l) => [...l.matchAll(/(-?\d+(?:[.,]\d+)?)\s*lbs/g)].map((m) => Number(m[1]!.replace(',', '.'))));
}

describe('a explicação da tensão fecha a própria conta', () => {
  it('quando há mais ajustes do que cabem na lista, o restante é somado e dito', () => {
    const adjustments = [adj(-3, 1), adj(-2.1, 2), adj(-1.3, 3), adj(-0.8, 4), adj(-0.6, 5)];
    const linhas = explainTension(
      tension({ adjustments, lbs: 47, pre_clamp_lbs: 47.2 }),
    );

    const restante = linhas.find((l) => l.includes('outros'));
    expect(restante, 'os ajustes omitidos da lista precisam aparecer somados').toBeDefined();
    // −0.8 + −0.6 = −1.4
    expect(restante).toContain('-1.4 lbs');
    expect(restante).toContain('2 ajustes menores');
  });

  it('o subtotal é exatamente base + soma de TODOS os ajustes', () => {
    const adjustments = [adj(-3, 1), adj(-2.1, 2), adj(-1.3, 3), adj(-0.8, 4)];
    const linhas = explainTension(tension({ adjustments, lbs: 48, pre_clamp_lbs: 47.8 }));

    const subtotal = linhas.find((l) => l.startsWith('Somados, os ajustes'));
    expect(subtotal).toBeDefined();
    // 55 − 7.2 = 47.8
    expect(subtotal).toContain('55 lbs para 47.8 lbs');
  });

  it('nenhum ajuste da lista fica de fora do que o leitor consegue somar', () => {
    const adjustments = [adj(-3, 1), adj(-2.1, 2), adj(-1.3, 3), adj(-0.9, 4), adj(0.5, 5)];
    const linhas = explainTension(tension({ adjustments, lbs: 48, pre_clamp_lbs: 48.2 }));

    const soma = adjustments.reduce((s, a) => s + a.delta_lbs, 0);
    const subtotal = linhas.find((l) => l.startsWith('Somados, os ajustes'))!;
    const valores = libras([subtotal]);
    expect(valores[valores.length - 1]).toBeCloseTo(55 + soma, 1);
  });

  it('sem ajuste nenhum, não inventa um subtotal', () => {
    const linhas = explainTension(tension({ adjustments: [] }));
    expect(linhas.some((l) => l.startsWith('Somados, os ajustes'))).toBe(false);
  });

  it('o arredondamento só é mencionado quando muda algo visível', () => {
    const semDiferenca = explainTension(tension({ lbs: 50, pre_clamp_lbs: 50 }));
    expect(semDiferenca.some((l) => l.includes('arredondamos'))).toBe(false);

    const comDiferenca = explainTension(tension({ lbs: 50, pre_clamp_lbs: 49.6 }));
    expect(comDiferenca.some((l) => l.includes('arredondamos'))).toBe(true);
  });

  it('quando um limite conteve o número, o arredondamento não reabre a conta', () => {
    /*
      A nota do clamp já diz de quanto para quanto. Repetir o arredondamento ali produziria duas
      frases discutindo o mesmo salto, e a segunda contradiria a primeira.
    */
    const linhas = explainTension(
      tension({
        lbs: 50,
        pre_clamp_lbs: 44.5,
        clamped_by: 'frame_range',
        notes: ['A conta dava 44.5 lbs; ajustamos para a faixa recomendada (50–60 lbs), o que levou a 50 lbs.'],
      }),
    );
    expect(linhas.some((l) => l.includes('arredondamos'))).toBe(false);
  });
});
