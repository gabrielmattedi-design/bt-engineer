/**
 * O gráfico não pode contradizer a recomendação.
 *
 * ═══ O DEFEITO QUE ESTE TESTE TRANCA ═════════════════════════════════════════════════════════
 *
 * Reclamação do usuário, com o gráfico na mão: a linha da raquete que ele já usa estava mais perto
 * do "o que seu jogo pede" do que a raquete recomendada. Medido no caso:
 *
 *     distância média ao alvo — ATUAL 6.5  |  RECOMENDADA 11.7
 *     fit                     — ATUAL 78.3 |  RECOMENDADA 81.2
 *
 * As duas leituras estavam certas, e é isso que tornava o defeito grave. O radar tinha seis eixos,
 * todos de comportamento de bola, que juntos respondem por 9% do score final. Os 66% que decidem —
 * peso, nível técnico, swing, estilo e conforto — não apareciam. O gráfico mostrava um terço do
 * raciocínio, e o usuário concluía, corretamente para o que via, que a escolha estava errada.
 *
 * Um relatório que precisa ser acreditado não pode ter a peça mais visível argumentando contra a
 * própria conclusão. Este teste garante que ela argumente a favor.
 */

import { describe, expect, it } from 'vitest';
import { buildPlayerProfile } from '@/recommendation/profile/build-profile';
import { recommend } from '@/recommendation';
import { serializeRecommendation } from '@/payments/entitlements';
import { PERSONAS } from '@/data/personas';
import { TEST_DATASET_VERSION, TEST_MODE, testRackets, testStrings } from '../helpers/catalog';

const runs = PERSONAS.map((persona) => {
  const profile = buildPlayerProfile(persona.answers);
  const result = recommend({
    profile,
    rackets: testRackets(),
    strings: testStrings(),
    datasetVersion: TEST_DATASET_VERSION,
    mode: TEST_MODE,
    includeSetup: true,
  });
  return { persona, report: serializeRecommendation(result, profile, ['racket_report_access']) };
});

/**
 * Área ponderada — a mesma conta que decidiu o ranking, e a que o gráfico agora exibe.
 *
 * A área CRUA de um radar trata todos os vértices como iguais. O motor não trata: `Nível técnico`
 * pesa 0.20 e cada eixo de bola pesa um terço de 0.16. Comparar área crua com decisão ponderada
 * produziria uma falha em todo caso de quase-empate — e um teste que falha por ruído é um teste que
 * alguém vai silenciar.
 *
 * Por isso o peso de cada eixo agora vai IMPRESSO ao lado do rótulo, na tela: o leitor recebe a
 * mesma informação que este teste usa, em vez de precisar deduzir por que dois polígonos parecidos
 * levaram a conclusões diferentes.
 */
function area(axes: readonly { value: number; weight: number }[]): number {
  const total = axes.reduce((sum, a) => sum + a.weight, 0);
  if (total <= 0) return axes.reduce((sum, a) => sum + a.value, 0) / axes.length;
  return axes.reduce((sum, a) => sum + a.value * a.weight, 0) / total;
}

describe('coerência entre o radar e a recomendação', () => {
  it('todo eixo está em adequação: 0–100, com o ideal na borda', () => {
    for (const { persona, report } of runs) {
      expect(report.radar.length, persona.id).toBeGreaterThanOrEqual(8);
      for (const axis of report.radar) {
        expect(axis.profile, `${persona.id}/${axis.key}`).toBe(100);
        expect(axis.recommended).toBeGreaterThanOrEqual(0);
        expect(axis.recommended).toBeLessThanOrEqual(100);
        if (axis.current !== null) {
          expect(axis.current).toBeGreaterThanOrEqual(0);
          expect(axis.current).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  /**
   * Os eixos de ENCAIXE precisam estar lá — são eles que carregam a decisão.
   *
   * Sem esta asserção, alguém "simplificando" o gráfico no futuro poderia remover exatamente as
   * dimensões que o tornaram honesto, e o defeito voltaria sem barulho nenhum.
   */
  it('o gráfico mostra os eixos que realmente decidem, não só o comportamento de bola', () => {
    for (const { persona, report } of runs) {
      const keys = report.radar.map((a) => a.key);
      for (const required of ['physical_fit', 'skill_fit', 'swing_fit', 'comfort_fit']) {
        expect(keys, persona.id).toContain(required);
      }
      const voce = report.radar.filter((a) => a.group === 'voce').length;
      expect(voce / report.radar.length, `${persona.id}: eixos de encaixe`).toBeGreaterThanOrEqual(
        0.5,
      );
    }
  });

  /**
   * A recomendada tem que PARECER melhor que a atual, quando ela é melhor.
   *
   * A comparação é feita só quando o motor de fato colocou a recomendada à frente: se a raquete
   * atual do jogador é melhor, o gráfico deve mostrar isso, e o relatório recomenda ficar com ela
   * (ver `current_racket_standing`).
   */
  it('quando a recomendada vence no motor, ela também vence no gráfico', () => {
    for (const { persona, report } of runs) {
      const standing = report.current_racket_standing;
      if (!standing || standing.gap_to_first <= 0) continue;
      if (report.radar.some((a) => a.current === null)) continue;

      const areaRecommended = area(
        report.radar.map((a) => ({ value: a.recommended, weight: a.weight })),
      );
      const areaCurrent = area(
        report.radar.map((a) => ({ value: a.current as number, weight: a.weight })),
      );

      expect(
        areaRecommended,
        `${persona.id}: motor dá ${standing.gap_to_first} pontos de vantagem à recomendada, ` +
          `mas o gráfico mostra a atual maior (${areaCurrent.toFixed(1)} vs ${areaRecommended.toFixed(1)})`,
      ).toBeGreaterThanOrEqual(areaCurrent);
    }
  });
});
