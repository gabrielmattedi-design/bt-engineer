/**
 * "Nunca estouro corda" precisa PUXAR para a corda fina, não apenas deixar de empurrar para a grossa.
 *
 * ═══ A RECLAMAÇÃO ════════════════════════════════════════════════════════════════════════════
 *
 * "Sempre ponho que nunca estouro corda, em diversos testes, e sempre me recomendam 1.30 mm."
 *
 * A frequência de quebra ERA lida — ela alimenta o alvo de `durability`. O problema é que
 * `durability` é eixo de REQUISITO: cobra só a falta, nunca a sobra, porque ninguém é prejudicado
 * por uma corda durar mais do que precisava.
 *
 * Com alvo de durabilidade em 28, TODAS as espessuras entregam de sobra — 63 na mais fina, 75 na
 * mais grossa — e todas custam zero. A durabilidade para de discriminar; sobram potência (puxa para
 * fino) e spin (puxa para grosso), que quase se anulam, e a espessura inteira passa a se decidir
 * por cerca de 1 ponto de diferença.
 *
 * Medido no catálogo antes da correção, a espessura média indicada era:
 *
 *     nunca 1,206 · raramente 1,225 · a cada 2–3 meses 1,229 · mensalmente 1,242 · semanalmente 1,237
 *
 * Trinta e seis milésimos de amplitude em toda a escala, e "semanalmente" saindo mais FINO que
 * "mensalmente". Depois do eixo de espessura:
 *
 *     nunca 1,190 · raramente 1,219 · a cada 2–3 meses 1,246 · mensalmente 1,269 · semanalmente 1,271
 *
 * ═══ O QUE ESTE TESTE TRANCA ═════════════════════════════════════════════════════════════════
 *
 * A MONOTONICIDADE. Não um valor exato — calibração muda, e travar números seria travar o motor
 * onde ele deve poder evoluir. O que não pode voltar é a espessura deixar de responder a quem
 * responde a pergunta, ou responder ao contrário.
 */

import { describe, expect, it } from 'vitest';

import { buildPlayerProfile } from '@/recommendation/profile/build-profile';
import { emptyAnswers, type QuestionnaireAnswers } from '@/recommendation/profile/answers';
import { recommend } from '@/recommendation';
import { gaugePosition } from '@/recommendation/strings/select-string';
import { TEST_DATASET_VERSION, TEST_MODE, testRackets, testStrings } from '../helpers/catalog';

const BASE: QuestionnaireAnswers = {
  ...emptyAnswers(),
  age: 34,
  height_cm: 180,
  weight_kg: 82,
  dominant_hand: 'destro',
  perceived_strength: 'media',
  fitness_level: 'bom',
  experience_duration: 'mais_5a',
  frequency_per_week: 3,
  has_lessons: 'atualmente',
  plays_matches: 'sim',
  tournament_experience: 'amadores',
  perceived_level: 'intermediario',
  can_sustain_rally: 'sim',
  can_direct_ball: 'as_vezes',
  can_generate_spin: 'as_vezes',
  can_vary_depth: 'as_vezes',
  reliable_second_serve: 'as_vezes',
  play_style: ['dominar_fundo'],
  forehand_type: 'topspin_moderado',
  backhand_hands: 'duas_maos',
  swing_length: 'medio',
  swing_speed: 'moderada',
  depth_control: 'as_vezes',
  ball_tendency: ['caem_curtas'],
  objective: ['ganhar_potencia'],
};

/** Da menos exigente para a mais exigente em desgaste. */
const BREAKAGE = ['nunca', 'raramente', 'a_cada_2_3_meses', 'mensalmente', 'semanalmente'] as const;

const rackets = testRackets();
const strings = testStrings();

/** Espessura média indicada numa varredura de perfis, para um nível de quebra. */
function averageGauge(breakage: (typeof BREAKAGE)[number]): number {
  const gauges: number[] = [];

  for (const missing of [['power'], ['control'], ['spin'], ['comfort']]) {
    for (const swing of ['lenta', 'moderada', 'rapida'] as const) {
      const profile = buildPlayerProfile({
        ...BASE,
        string_breakage: breakage,
        missing_attributes: missing,
        swing_speed: swing,
      });
      const result = recommend({
        profile,
        rackets,
        strings,
        datasetVersion: TEST_DATASET_VERSION,
        mode: TEST_MODE,
        includeSetup: true,
      });
      const rec = result.string_recommendation;
      if (rec) gauges.push(rec.variant.variant.gauge_mm);
    }
  }

  expect(gauges.length, `${breakage}: nenhuma corda indicada`).toBeGreaterThan(5);
  return gauges.reduce((a, b) => a + b, 0) / gauges.length;
}

describe('a espessura da corda acompanha a frequência de quebra', () => {
  const averages = BREAKAGE.map((b) => ({ breakage: b, avg: averageGauge(b) }));

  /**
   * ─── POR QUE O ALVO, E NÃO A MÉDIA OBSERVADA ────────────────────────────────────────────────
   *
   * A média observada NÃO é estritamente monotônica, e não deveria ser: o motor escolhe o modelo
   * primeiro, e nem todo modelo existe em todas as espessuras. Em "semanalmente" com prioridade de
   * controle, ele indica HEAD Hawk Touch e Lynx Tour — que o catálogo só traz em 1.20 mm. A
   * espessura fina ali não é o alvo sendo ignorado, é o alvo esbarrando no que existe para comprar,
   * e inventar uma variante inexistente seria violar a Regra de Integridade.
   *
   * O que precisa ser monotônico é o ALVO, que é a parte que este eixo controla.
   */
  it('o alvo de espessura cresce com a frequência de quebra, sem inversão', () => {
    const targets = BREAKAGE.map((breakage) => {
      const profile = buildPlayerProfile({ ...BASE, string_breakage: breakage });
      const result = recommend({
        profile,
        rackets,
        strings,
        datasetVersion: TEST_DATASET_VERSION,
        mode: TEST_MODE,
        includeSetup: true,
      });
      return { breakage, gauge: result.string_recommendation!.target.gauge };
    });

    for (let i = 1; i < targets.length; i += 1) {
      const previous = targets[i - 1]!;
      const current = targets[i]!;
      expect(
        current.gauge,
        `${current.breakage} (${current.gauge.toFixed(1)}) pede corda mais fina que ` +
          `${previous.breakage} (${previous.gauge.toFixed(1)})`,
      ).toBeGreaterThan(previous.gauge);
    }
  });

  /**
   * O piso de amplitude é o que distingue "responde" de "responde de brincadeira". Antes da
   * correção a escala inteira valia 0,036 mm — tecnicamente monotônica em alguns trechos, e sem
   * efeito prático nenhum sobre o que a pessoa recebe.
   */
  it('a escala inteira move a espessura entregue de forma perceptível', () => {
    const first = averages[0]!.avg;
    const last = averages[averages.length - 1]!.avg;
    expect(last - first, `amplitude de apenas ${(last - first).toFixed(3)} mm`).toBeGreaterThan(0.04);
  });

  it('quem nunca estoura corda nunca recebe a espessura mais grossa do catálogo', () => {
    const thickest = Math.max(...strings.variants.map((v) => v.gauge_mm));

    for (const missing of [['power'], ['control'], ['spin'], ['comfort']]) {
      const profile = buildPlayerProfile({
        ...BASE,
        string_breakage: 'nunca',
        missing_attributes: missing,
      });
      const result = recommend({
        profile,
        rackets,
        strings,
        datasetVersion: TEST_DATASET_VERSION,
        mode: TEST_MODE,
        includeSetup: true,
      });
      const rec = result.string_recommendation;
      if (!rec) continue;

      expect(
        rec.variant.variant.gauge_mm,
        `${missing[0]}: ${rec.variant.model.model} ${rec.variant.variant.gauge_mm} mm`,
      ).toBeLessThan(thickest);
    }
  });

  /** A conversão milímetro → posição precisa ser monotônica e ancorada em medidas fixas. */
  it('a posição de espessura cresce com o milímetro e satura nas pontas', () => {
    expect(gaugePosition(1.15)).toBeLessThan(gaugePosition(1.2));
    expect(gaugePosition(1.2)).toBeLessThan(gaugePosition(1.3));
    expect(gaugePosition(0.9)).toBe(0);
    expect(gaugePosition(1.6)).toBe(100);
  });
});
