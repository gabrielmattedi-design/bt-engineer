/**
 * Orçamento de atributos — nenhuma raquete é globalmente melhor que outra.
 *
 * ═══ A DECISÃO DE PRODUTO ════════════════════════════════════════════════════════════════════
 *
 * "Aqui não estamos elegendo melhor ou pior, e sim mais adequadas ao perfil." Se um frame pode
 * pontuar acima de outro em todos os eixos ao mesmo tempo, essa promessa é falsa: existe um
 * ranking absoluto por trás, e o perfil do jogador só escolhe onde parar nele.
 *
 * ═══ O DEFEITO MEDIDO ════════════════════════════════════════════════════════════════════════
 *
 * Somando os seis índices exibidos, o catálogo ia de 410 a 485 — e não por acaso. A massa entrava
 * com saldo POSITIVO de ~0.5 nos seis eixos (conforto +0.30 e estabilidade +0.50 contra potência
 * −0.15 e manobrabilidade −0.30), então frames de 305 g com viga fina apareciam fortes em quase
 * tudo, enquanto frames de controle e frames leves apareciam fracos em tudo. O custo real da massa
 * — carregar a raquete a partida inteira — mora em `physical_fit` e `demand_index`, fora destes
 * seis. Estava sendo cobrado uma vez e creditado duas.
 *
 * ═══ O QUE ESTE TESTE TRANCA ═════════════════════════════════════════════════════════════════
 *
 * Que os seis eixos sejam um ORÇAMENTO: mesmo total para todo frame, distribuição diferente. É a
 * regra que garante que toda raquete do catálogo tenha algum ponto forte — e portanto algum perfil
 * para o qual ela é a resposta certa.
 */

import { describe, expect, it } from 'vitest';

import { levelize, scoreRackets } from '@/recommendation/normalize/racket-attributes';
import { serializeRecommendation } from '@/payments/entitlements';
import { buildPlayerProfile } from '@/recommendation/profile/build-profile';
import { recommend } from '@/recommendation';
import { PERSONAS } from '@/data/personas';
import { TEST_DATASET_VERSION, TEST_MODE, testRackets, testStrings } from '../helpers/catalog';

const SIX = [
  'power_score',
  'control_score',
  'spin_score',
  'comfort_score',
  'stability_score',
  'maneuverability_score',
] as const;

/** 6 eixos × 50, o ponto neutro da escala 0–100. */
const RAW_BUDGET = 300;
/** 6 eixos × 75, o ponto médio da escala exibida 50–100. */
const DISPLAY_BUDGET = 450;

describe('orçamento dos atributos', () => {
  const rackets = scoreRackets(testRackets().map((r) => r.variant));

  it('toda raquete do catálogo soma o mesmo nos seis eixos crus', () => {
    for (const r of rackets) {
      const sum = SIX.reduce(
        (s, k) => s + (r.attributes as unknown as Record<string, number>)[k]!,
        0,
      );
      expect(sum, r.variant.product_name).toBeCloseTo(RAW_BUDGET, 6);
    }
  });

  /**
   * O nivelamento é ADITIVO, então as distâncias entre eixos precisam sobreviver intactas. Se ele
   * fosse multiplicativo, uma raquete de soma alta teria o contraste interno comprimido e outra de
   * soma baixa teria o contraste esticado — o nível seria corrigido às custas da informação.
   */
  it('o nivelamento preserva o contraste interno', () => {
    const antes = [70, 40, 55, 30, 60, 45];
    const depois = levelize(antes);

    for (let i = 1; i < antes.length; i += 1) {
      expect(depois[i]! - depois[0]!).toBeCloseTo(antes[i]! - antes[0]!, 6);
    }
  });

  /** Quando um eixo satura, o resto absorve — e o total continua batendo. */
  it('o nivelamento respeita piso e teto sem perder o total', () => {
    for (const caso of [
      [98, 97, 96, 95, 94, 93],
      [5, 4, 3, 2, 1, 0],
      [50, 50, 50, 50, 50, 50],
    ]) {
      const out = levelize(caso);
      expect(out.reduce((a, b) => a + b, 0)).toBeCloseTo(RAW_BUDGET, 6);
      for (const v of out) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });

  /**
   * O orçamento precisa sobreviver ao que o usuário LÊ.
   *
   * Os índices exibidos passam por um esticamento por eixo contra a faixa do catálogo, e faixas de
   * larguras diferentes desfaziam o nivelamento: a soma exibida voltava a variar de 405 a 465. O
   * arredondamento para múltiplos de 5 também precisa preservar o total, senão a promessa morre na
   * casa que dá para conferir com a calculadora.
   */
  it('os índices exibidos somam o mesmo para toda raquete do pódio', () => {
    for (const persona of PERSONAS) {
      const profile = buildPlayerProfile(persona.answers);
      const result = recommend({
        profile,
        rackets: testRackets(),
        strings: testStrings(),
        datasetVersion: TEST_DATASET_VERSION,
        mode: TEST_MODE,
        includeSetup: true,
      });
      const report = serializeRecommendation(result, profile, [
        'racket_report_access',
        'rank2_access',
        'rank3_access',
      ]);

      for (const entry of report.podium) {
        if (entry.locked) continue;
        const values = Object.values(entry.indices);
        expect(values.length).toBe(6);
        expect(
          values.reduce((a, b) => a + b, 0),
          `${persona.id}: ${entry.product_name} ${values.join('/')}`,
        ).toBe(DISPLAY_BUDGET);
        for (const v of values) expect(v % 5).toBe(0);
      }
    }
  });

  /**
   * O corolário que dá sentido ao orçamento: se todas somam igual, nenhuma pode ser fraca em tudo,
   * e toda raquete tem pelo menos um eixo em que se destaca.
   */
  it('nenhuma raquete fica abaixo da média em todos os seis eixos', () => {
    const means = SIX.map(
      (k) =>
        rackets.reduce((s, r) => s + (r.attributes as unknown as Record<string, number>)[k]!, 0) /
        rackets.length,
    );

    for (const r of rackets) {
      const acima = SIX.some(
        (k, i) => (r.attributes as unknown as Record<string, number>)[k]! > means[i]!,
      );
      expect(acima, `${r.variant.product_name} não se destaca em nada`).toBe(true);
    }
  });
});
