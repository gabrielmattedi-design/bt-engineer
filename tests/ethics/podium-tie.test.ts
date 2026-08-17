/**
 * Empate no pódio — três cards com o mesmo número não podem sair sem explicação.
 *
 * ─── O QUE ESTAVA ERRADO ─────────────────────────────────────────────────────────────────────
 *
 * Um relatório real trouxe as três primeiras marcando 88%, com um rótulo de "empate técnico" que
 * dizia que não havia diferença sem dizer o que havia no lugar dela. A pergunta que sobra para quem
 * pagou é direta: se as três são 88, por que esta é a primeira?
 *
 * ─── O QUE ESTE TESTE TRANCA ─────────────────────────────────────────────────────────────────
 *
 * Duas coisas, e as duas são de honestidade, não de estética:
 *
 * 1. Quando existe empate no topo, ele é ANUNCIADO com a distância medida — a pessoa lê que a
 *    margem é de centésimos, em vez de deduzir que o motor não decidiu.
 * 2. Cada opção empatada e desbloqueada traz o que a separa das outras. Quando não há nada acima do
 *    ruído, o texto diz que são equivalentes e devolve a escolha para preço e disponibilidade — o
 *    que NÃO pode acontecer é o card ficar mudo, e não pode aparecer uma casa decimal inventando
 *    uma resolução que seis especificações publicadas não têm.
 */

import { describe, expect, it } from 'vitest';

import { buildPlayerProfile } from '@/recommendation/profile/build-profile';
import { recommend } from '@/recommendation';
import { serializeRecommendation } from '@/payments/entitlements';
import { buildDistinction, buildTieGroup } from '@/payments/podium-tie';
import { TECHNICAL_TIE_THRESHOLD } from '@/domain/reference-ranges';
import { PERSONAS } from '@/data/personas';
import { TEST_DATASET_VERSION, TEST_MODE, testRackets, testStrings } from '../helpers/catalog';

const ALL_ACCESS = ['racket_report_access', 'rank2_access', 'rank3_access', 'full_setup_access'] as const;

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
  return {
    persona,
    result,
    report: serializeRecommendation(result, profile, [...ALL_ACCESS]),
  };
});

describe('empate no pódio', () => {
  it('a varredura encontra pelo menos um empate — senão o teste não prova nada', () => {
    expect(runs.filter((r) => r.report.podium_tie !== null).length).toBeGreaterThan(0);
  });

  it('só anuncia empate quando ele existe de fato', () => {
    for (const { persona, result, report } of runs) {
      const first = result.podium[0]!;
      const second = result.podium[1];
      const tied =
        second !== undefined &&
        Math.abs(first.fit_score - second.fit_score) < TECHNICAL_TIE_THRESHOLD;

      expect(report.podium_tie !== null, persona.id).toBe(tied);
    }
  });

  it('o grupo anunciado só contém posições realmente dentro da faixa', () => {
    for (const { persona, result, report } of runs) {
      const tie = report.podium_tie;
      if (!tie) continue;

      expect(tie.ranks[0], persona.id).toBe(1);
      expect(tie.spread, persona.id).toBeLessThan(TECHNICAL_TIE_THRESHOLD);

      const first = result.podium[0]!;
      for (const rank of tie.ranks) {
        const entry = result.podium.find((e) => e.rank === rank)!;
        expect(
          Math.abs(first.fit_score - entry.fit_score),
          `${persona.id}: rank ${rank} fora da faixa`,
        ).toBeLessThan(TECHNICAL_TIE_THRESHOLD);
      }
    }
  });

  /**
   * O card não pode ficar mudo. É o ponto inteiro da mudança: sem uma frase ali, o empate volta a
   * parecer indecisão do motor.
   */
  it('toda posição empatada e desbloqueada explica o que a separa das outras', () => {
    for (const { persona, report } of runs) {
      const tie = report.podium_tie;
      if (!tie) continue;

      for (const rank of tie.ranks) {
        const entry = report.podium.find((e) => e.rank === rank);
        if (!entry || entry.locked) continue;

        expect(entry.distinction, `${persona.id}: rank ${rank} sem distinção`).not.toBeNull();
        expect(
          entry.distinction!.headline.length,
          `${persona.id}: rank ${rank} com frase vazia`,
        ).toBeGreaterThan(20);
      }
    }
  });

  it('posição fora de empate não recebe frase de empate', () => {
    for (const { persona, result } of runs) {
      const tie = buildTieGroup(result.podium);
      const ranks = new Set(tie?.ranks ?? []);

      for (const entry of result.podium) {
        if (ranks.has(entry.rank)) continue;
        expect(buildDistinction(entry, result.podium), `${persona.id}: rank ${entry.rank}`).toBeNull();
      }
    }
  });

  /**
   * A casa decimal continua fora da tela.
   *
   * O caminho fácil para "diferenciar visualmente" seria imprimir 88.3 contra 88.1. O score sai de
   * seis medidas publicadas, nenhuma delas com tolerância de fabricação declarada — a variação
   * entre duas unidades da mesma raquete supera essas décimas. O número exibido continua inteiro, e
   * a diferenciação vem do motivo escrito ao lado.
   */
  it('o fit exibido continua sendo um inteiro', () => {
    for (const { persona, report } of runs) {
      for (const entry of report.podium) {
        expect(Number.isInteger(entry.fit_score), `${persona.id}: rank ${entry.rank}`).toBe(true);
      }
    }
  });

  /**
   * Gêmeas de especificação existem no catálogo e a resposta certa para elas é dizer que são
   * gêmeas. Quando o texto afirma isso, o vetor de atributos precisa de fato coincidir.
   */
  it('quando declara gêmea, as duas têm o mesmo vetor de atributos', () => {
    for (const { persona, result, report } of runs) {
      const tie = report.podium_tie;
      if (!tie) continue;

      for (const rank of tie.ranks) {
        const entry = report.podium.find((e) => e.rank === rank);
        if (!entry || entry.locked || !entry.distinction?.identical_twin) continue;

        const ranked = result.podium.find((e) => e.rank === rank)!;
        const twin = result.podium.find(
          (e) =>
            e.rank !== rank &&
            tie.ranks.includes(e.rank) &&
            e.racket.attributes.power_score === ranked.racket.attributes.power_score &&
            e.racket.attributes.control_score === ranked.racket.attributes.control_score &&
            e.racket.attributes.spin_score === ranked.racket.attributes.spin_score &&
            e.racket.attributes.comfort_score === ranked.racket.attributes.comfort_score &&
            e.racket.attributes.stability_score === ranked.racket.attributes.stability_score &&
            e.racket.attributes.maneuverability_score ===
              ranked.racket.attributes.maneuverability_score,
        );

        expect(twin, `${persona.id}: rank ${rank} declara gêmea inexistente`).toBeDefined();
      }
    }
  });
});
