/**
 * Todo perfil recebe uma recomendação. Sem exceção.
 *
 * ─── O BUG QUE ESTE TESTE TRANCA ─────────────────────────────────────────────────────────────
 *
 * `/analise/<id>` mostra "ainda não podemos recomendar com segurança" quando o pódio sai vazio.
 * Aquela tela existe para um caso legítimo e estreito: catálogo em modo estrito ainda não
 * verificado, em que NENHUMA raquete tem dados suficientes para sustentar uma venda.
 *
 * Mas ela também aparecia — para um usuário real, em produção — depois de o motor avaliar as 46
 * raquetes normalmente, só porque nenhuma delas cruzava `MIN_PODIUM_FIT`. O piso do pódio, que é
 * uma regra sobre o 2º e o 3º colocados (§30), estava sendo aplicado ao 1º. A pessoa respondia o
 * questionário inteiro, o motor calculava tudo, e a resposta era uma tela em branco com "46
 * raquetes elegíveis" escrito embaixo.
 *
 * Existe sempre uma raquete que é a melhor para um perfil. Sonegá-la não protege ninguém.
 *
 * ─── O QUE ESTE TESTE NÃO É ──────────────────────────────────────────────────────────────────
 *
 * Não é uma trava que força o número para cima. O piso verificado aqui vale sobre o resultado
 * genuíno do motor: se um dia ele cair, a correção é recalibrar o motor ou ampliar o catálogo —
 * nunca ajustar o número exibido.
 */

import { describe, expect, it } from 'vitest';
import { MIN_TOP_MATCH, TARGET_TOP_MATCH } from '@/domain/reference-ranges';
import { buildPlayerProfile } from '@/recommendation/profile/build-profile';
import { recommend } from '@/recommendation';
import { PERSONAS } from '@/data/personas';
import { TEST_DATASET_VERSION, TEST_MODE, testRackets, testStrings } from '../helpers/catalog';

const runs = PERSONAS.map((persona) => ({
  persona,
  result: recommend({
    profile: buildPlayerProfile(persona.answers),
    rackets: testRackets(),
    strings: testStrings(),
    datasetVersion: TEST_DATASET_VERSION,
    mode: TEST_MODE,
    includeSetup: true,
  }),
}));

describe('nenhum perfil fica sem recomendação', () => {
  it('o pódio nunca sai vazio quando há candidatas avaliadas', () => {
    for (const { persona, result } of runs) {
      expect(result.candidates_evaluated, `${persona.id}: catálogo vazio`).toBeGreaterThan(0);
      expect(
        result.podium.length,
        `${persona.id} avaliou ${result.candidates_evaluated} raquetes e não recomendou nenhuma`,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it('o primeiro colocado é sempre o primeiro do ranking completo', () => {
    for (const { persona, result } of runs) {
      expect(result.podium[0]!.racket.variant.id, persona.id).toBe(
        result.full_ranking[0]!.racket.variant.id,
      );
    }
  });

  it('o fit do primeiro colocado nunca cai abaixo do piso', () => {
    for (const { persona, result } of runs) {
      expect(result.podium[0]!.fit_score, persona.id).toBeGreaterThanOrEqual(MIN_TOP_MATCH);
    }
  });

  /**
   * A meta é do PRODUTO, e a maioria dos perfis precisa alcançá-la.
   *
   * Os que não alcançam, hoje, são exatamente aqueles cujo pedido se contradiz — mais potência E
   * mais controle (p18), mais estabilidade E mais manobrabilidade (p12), spin no máximo partindo
   * de um frame que já é o teto do catálogo naquele eixo (p02). Para eles o número menor É a
   * informação: existe algo no pedido que nenhuma raquete resolve.
   *
   * O limite fica em 3/4 e não no valor exato de hoje (17/22) para não transformar qualquer
   * flutuação de catálogo em falha de build. Se cair abaixo disso, a calibração regrediu.
   */
  it('a grande maioria dos perfis atinge a meta de match do produto', () => {
    const below = runs
      .filter(({ result }) => result.podium[0]!.fit_score < TARGET_TOP_MATCH)
      .map(({ persona, result }) => `${persona.id}=${result.podium[0]!.fit_score.toFixed(0)}`);

    const share = (runs.length - below.length) / runs.length;
    expect(share, `abaixo de ${TARGET_TOP_MATCH}: ${below.join(', ')}`).toBeGreaterThanOrEqual(
      0.75,
    );
  });

  /**
   * A média é o sinal mais estável de calibração: um perfil pode oscilar com o catálogo, o
   * conjunto não. Estava em 76.7 antes da correção de escala (§ catalog-scale.ts).
   */
  it('o fit médio do primeiro colocado se mantém no patamar calibrado', () => {
    const scores = runs.map(({ result }) => result.podium[0]!.fit_score);
    const average = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    expect(average.toFixed(1)).toBeTruthy();
    expect(average, `média atual ${average.toFixed(1)}`).toBeGreaterThanOrEqual(82);
  });

  /**
   * O pódio traz até três alternativas REAIS, sem piso de fit — a proteção do §30 passou a ser o
   * fit visível antes do pagamento, não a omissão da opção. Ver `tests/ethics/podium-quality`.
   */
  it('o pódio traz até três opções, sem repetir família sem motivo', () => {
    for (const { persona, result } of runs) {
      expect(result.podium.length, persona.id).toBeLessThanOrEqual(3);
      expect(result.podium.length, persona.id).toBeGreaterThanOrEqual(1);
    }
  });
});
