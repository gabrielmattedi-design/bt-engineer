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
  /**
   * O TETO precisa variar de eixo para eixo.
   *
   * Ele já foi uma constante 100, e o usuário matou a ideia com uma frase: "de acordo com a linha
   * laranja, meu jogo pede o máximo de tudo, não tem inteligência nenhuma por trás". Estava certo —
   * uma linha constante na borda é um círculo, e um círculo não diz nada. Esta asserção impede que
   * ela volte a ser plana.
   */
  it('todo eixo está em adequação 0–100, e o teto varia entre os eixos', () => {
    for (const { persona, report } of runs) {
      expect(report.radar.length, persona.id).toBeGreaterThanOrEqual(8);

      const tetos = new Set(report.radar.map((a) => a.profile));
      expect(tetos.size, `${persona.id}: teto constante em ${[...tetos][0]}`).toBeGreaterThan(1);

      for (const axis of report.radar) {
        expect(axis.profile, `${persona.id}/${axis.key}`).toBeLessThanOrEqual(100);
        // O teto é, por definição, o melhor entre as viáveis — a recomendada nunca o ultrapassa.
        expect(axis.recommended, `${persona.id}/${axis.key}`).toBeLessThanOrEqual(axis.profile);
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

/**
 * Nenhum critério pode decidir sozinho.
 *
 * ═══ O QUE ISTO MEDE ═════════════════════════════════════════════════════════════════════════
 *
 * Pedido do usuário, depois de olhar o gráfico: "faça um check de cada peso de forma que nenhum
 * isoladamente determine uma raquete específica". Ele estava vendo `Peso e manejo` marcar 98 contra
 * 66 e concluiu, corretamente, que aquele eixo mandava sozinho.
 *
 * Influência real não é o peso escrito: é peso × DISPERSÃO. Um critério que separa as candidatas
 * por 12 pontos decide muito mais que um que as separa por 3, com o mesmo peso na fórmula. Medido
 * antes da correção, sobre 864 perfis:
 *
 *     physical_fit   peso 19.5%  →  influência 29.5%  (1.51×)
 *     playstyle_fit  peso 15.2%  →  influência  5.8%  (0.38×)
 *
 * Depois de equalizar a dispersão e alargar as zonas mortas das réguas amplificadas, todos os
 * componentes ficam entre 0.76× e 1.15× do peso declarado.
 *
 * A razão é aferida sobre as candidatas que DISPUTAM, não sobre o catálogo inteiro: a decisão
 * acontece entre as primeiras colocadas, e medir na cauda de baixo esconde exatamente o desequilíbrio
 * que importa.
 */
describe('nenhum critério decide sozinho', () => {
  const AMOSTRA = PERSONAS.slice(0, 12);

  it('a influência real de cada componente respeita o peso declarado', () => {
    const infl = new Map<string, number[]>();
    const pesos = new Map<string, number[]>();

    for (const persona of AMOSTRA) {
      const profile = buildPlayerProfile(persona.answers);
      const result = recommend({
        profile,
        rackets: testRackets(),
        strings: testStrings(),
        datasetVersion: TEST_DATASET_VERSION,
        mode: TEST_MODE,
        includeSetup: false,
      });

      const disputam = result.full_ranking.slice(0, 12);
      if (disputam.length < 6) continue;

      for (const c of disputam[0]!.breakdown.components) {
        if (c.weight <= 0.05) continue;
        const vals = disputam.map(
          (r) => r.breakdown.components.find((x) => x.key === c.key)?.raw ?? 0,
        );
        const m = vals.reduce((s, v) => s + v, 0) / vals.length;
        const sd = Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / vals.length);
        infl.set(c.key, [...(infl.get(c.key) ?? []), sd * c.weight]);
        pesos.set(c.key, [...(pesos.get(c.key) ?? []), c.weight]);
      }
    }

    const media = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
    const total = [...infl.values()].reduce((s, v) => s + media(v), 0);

    for (const [key, valores] of infl) {
      const peso = media(pesos.get(key)!);
      const razao = media(valores) / total / peso;
      expect(
        razao,
        `${key}: peso ${(peso * 100).toFixed(1)}% mas influência ${(razao * peso * 100).toFixed(1)}% (${razao.toFixed(2)}×)`,
      ).toBeLessThanOrEqual(1.6);
      expect(razao, `${key}: influência muito abaixo do peso (${razao.toFixed(2)}×)`).toBeGreaterThanOrEqual(0.45);
    }
  });
});
