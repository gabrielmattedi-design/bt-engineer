/**
 * Propriedades do motor — docs/TEST_STRATEGY.md §3.
 *
 * Determinismo é uma promessa de produto (§4): "mesmas respostas + mesma versão do banco = mesmo
 * resultado". Sem isto, a auditoria e o versionamento de relatórios não valem nada.
 */

import { describe, expect, it } from 'vitest';
import { buildPlayerProfile } from '@/recommendation/profile/build-profile';
import { recommend } from '@/recommendation';
import { computeRacketAttributes } from '@/recommendation/normalize/racket-attributes';
import { RACKET_ATTRIBUTE_KEYS } from '@/domain/racket';
import { PERSONAS } from '@/data/personas';
import { TEST_DATASET_VERSION, TEST_MODE, testRackets, testStrings } from '../helpers/catalog';

function run(personaIndex: number) {
  const persona = PERSONAS[personaIndex % PERSONAS.length]!;
  const profile = buildPlayerProfile(persona.answers);
  return recommend({
    profile,
    rackets: testRackets(),
    strings: testStrings(),
    datasetVersion: TEST_DATASET_VERSION,
    mode: TEST_MODE,
    includeSetup: true,
  });
}

describe('determinismo', () => {
  it('duas execuções do mesmo perfil produzem ranking e scores idênticos', () => {
    for (let i = 0; i < PERSONAS.length; i += 1) {
      const a = run(i);
      const b = run(i);

      expect(a.full_ranking.length).toBe(b.full_ranking.length);
      for (let j = 0; j < a.full_ranking.length; j += 1) {
        expect(a.full_ranking[j]!.racket.variant.id).toBe(b.full_ranking[j]!.racket.variant.id);
        expect(a.full_ranking[j]!.fit_score).toBe(b.full_ranking[j]!.fit_score);
      }
      expect(a.confidence.score).toBe(b.confidence.score);
      expect(a.tension?.lbs).toBe(b.tension?.lbs);
      expect(a.string_recommendation?.variant.variant.id).toBe(
        b.string_recommendation?.variant.variant.id,
      );
    }
  });

  it('a ordem do catálogo de entrada não altera o resultado', () => {
    const persona = PERSONAS[4]!;
    const profile = buildPlayerProfile(persona.answers);
    const forward = testRackets();
    const reversed = [...forward].reverse();

    const a = recommend({
      profile,
      rackets: forward,
      strings: testStrings(),
      datasetVersion: TEST_DATASET_VERSION,
      mode: TEST_MODE,
    });
    const b = recommend({
      profile,
      rackets: reversed,
      strings: testStrings(),
      datasetVersion: TEST_DATASET_VERSION,
      mode: TEST_MODE,
    });

    expect(a.full_ranking.map((r) => r.racket.variant.id)).toEqual(
      b.full_ranking.map((r) => r.racket.variant.id),
    );
  });
});

describe('limites', () => {
  it('todo atributo derivado está em [0,100]', () => {
    for (const racket of testRackets()) {
      for (const key of RACKET_ATTRIBUTE_KEYS) {
        const value = racket.attributes[key];
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
      expect(racket.attributes.data_completeness).toBeGreaterThanOrEqual(0);
      expect(racket.attributes.data_completeness).toBeLessThanOrEqual(1);
    }
  });

  it('todo fit score está em [0,100] e o pódio vem ordenado', () => {
    for (let i = 0; i < PERSONAS.length; i += 1) {
      const result = run(i);
      for (const r of result.full_ranking) {
        expect(r.fit_score).toBeGreaterThanOrEqual(0);
        expect(r.fit_score).toBeLessThanOrEqual(100);
      }
      /**
       * O ranking é monotonicamente decrescente NA PRECISÃO QUE O PRODUTO EXIBE.
       *
       * A comparação é sobre o valor arredondado porque é ele que o motor usa para ordenar, e é
       * ele que o usuário lê. Dentro de um mesmo inteiro a ordem passa a ser decidida por chave
       * estável do perfil (ver `tie-break.ts`), o que faz raquetes tecnicamente empatadas
       * circularem entre jogadores em vez de uma delas vencer sempre por ordem alfabética.
       *
       * Exigir monotonia no valor CRU reintroduziria exatamente o defeito corrigido: uma diferença
       * de 0.26 ponto — que a tela mostra como dois números iguais — voltaria a decidir para sempre
       * quem aparece e quem nunca aparece. É precisão que o modelo não tem (R-04).
       */
      for (let j = 1; j < result.full_ranking.length; j += 1) {
        expect(Math.round(result.full_ranking[j]!.fit_score)).toBeLessThanOrEqual(
          Math.round(result.full_ranking[j - 1]!.fit_score),
        );
      }
    }
  });
});

describe('degradação graciosa (R-02)', () => {
  const base = testRackets()[0]!.variant.specs;

  it('remover um campo não zera os scores e reduz a completude', () => {
    // v2: todos os campos são publicados pelo fabricante, então uma variante bem cadastrada tem
    // completude 1.0. A degradação graciosa continua importando durante a curadoria, quando um
    // campo ainda não foi confirmado.
    const complete = computeRacketAttributes(base);
    const degraded = computeRacketAttributes({ ...base, beam_width_mm: null });

    expect(complete.data_completeness).toBe(1);

    expect(degraded.data_completeness).toBeLessThan(complete.data_completeness);
    for (const key of RACKET_ATTRIBUTE_KEYS) {
      expect(degraded[key]).toBeGreaterThan(0);
      // A ausência de UM campo não pode virar uma mudança radical de score.
      expect(Math.abs(degraded[key] - complete[key])).toBeLessThan(25);
    }
  });

  it('campo ausente é registrado com o nome do CAMPO, não do termo interno', () => {
    const attrs = computeRacketAttributes({ ...base, beam_width_mm: null, balance_mm: null });
    expect(attrs.missing_fields).toContain('beam_width_mm');
    expect(attrs.missing_fields).toContain('balance_mm');
    // Nomes internos de termo nunca podem vazar para o usuário.
    expect(attrs.missing_fields.some((f) => f.includes('_inverse'))).toBe(false);
  });
});

describe('monotonicidade', () => {
  it('aumentar a sensibilidade no braço nunca eleva um frame mais rígido', () => {
    const rackets = testRackets();
    const persona = PERSONAS[3]!;

    const lowSensitivity = buildPlayerProfile({
      ...persona.answers,
      discomfort_areas: ['nenhum'],
    });
    const highSensitivity = buildPlayerProfile({
      ...persona.answers,
      discomfort_areas: ['cotovelo', 'ombro'],
    });

    const a = recommend({
      profile: lowSensitivity,
      rackets,
      datasetVersion: TEST_DATASET_VERSION,
      mode: TEST_MODE,
    });
    const b = recommend({
      profile: highSensitivity,
      rackets,
      datasetVersion: TEST_DATASET_VERSION,
      mode: TEST_MODE,
    });

    const armFriendly = (r: typeof a.full_ranking): number =>
      r.slice(0, 5).reduce((s, x) => s + x.racket.attributes.arm_friendliness_score, 0) / 5;

    expect(armFriendly(b.full_ranking)).toBeGreaterThanOrEqual(armFriendly(a.full_ranking));
  });

  /**
   * Medimos o COMPONENTE e a POSIÇÃO relativa, não a média bruta do Top 5.
   *
   * A média do Top 5 é uma métrica ruim aqui: `skill_fit` e `physical_fit` somam 0.38 e já colocam
   * os frames de controle no topo para este perfil, então o CONJUNTO do Top 5 não muda — apenas a
   * ordem interna. Assertar sobre o conjunto testaria o catálogo, não o motor.
   */
  it('aumentar a necessidade de controle eleva o objective_fit dos frames de controle', () => {
    const rackets = testRackets();
    const persona = PERSONAS[1]!;

    const neutral = buildPlayerProfile({ ...persona.answers, missing_attributes: [], objective: [] });
    const wantsControl = buildPlayerProfile({
      ...persona.answers,
      missing_attributes: ['control'],
      objective: ['ganhar_controle'],
    });

    const a = recommend({ profile: neutral, rackets, datasetVersion: TEST_DATASET_VERSION, mode: TEST_MODE });
    const b = recommend({ profile: wantsControl, rackets, datasetVersion: TEST_DATASET_VERSION, mode: TEST_MODE });

    // O frame com maior control_score do catálogo precisa ganhar objective_fit.
    const target = [...rackets].sort(
      (x, y) => y.attributes.control_score - x.attributes.control_score,
    )[0]!;

    const objFit = (r: typeof a.full_ranking): number =>
      r.find((x) => x.racket.variant.id === target.variant.id)!.breakdown.components.find(
        (c) => c.key === 'objective_fit',
      )!.raw;

    expect(objFit(b.full_ranking)).toBeGreaterThan(objFit(a.full_ranking));
  });

  it('o objective_fit discrimina de fato — não colapsa numa faixa estreita', () => {
    const rackets = testRackets();
    const profile = buildPlayerProfile({
      ...PERSONAS[1]!.answers,
      missing_attributes: ['control'],
      objective: ['ganhar_controle'],
    });
    const result = recommend({
      profile,
      rackets,
      datasetVersion: TEST_DATASET_VERSION,
      mode: TEST_MODE,
    });

    const values = result.full_ranking.map(
      (r) => r.breakdown.components.find((c) => c.key === 'objective_fit')!.raw,
    );
    const spread = Math.max(...values) - Math.min(...values);
    // Regressão da calibração corrigida: com a fórmula antiga o spread era ~7 pontos.
    expect(spread).toBeGreaterThan(20);
  });
});
