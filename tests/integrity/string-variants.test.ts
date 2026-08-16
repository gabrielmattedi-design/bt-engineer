/**
 * O TESTE MAIS IMPORTANTE DO PROJETO — Regra de Integridade (bloco final da especificação).
 *
 * "Um setup tecnicamente perfeito, mas inexistente no mercado, é uma recomendação errada."
 *
 * Roda 500 perfis sintéticos e verifica que NENHUMA recomendação de corda aponta para uma
 * combinação marca+modelo+gauge que não exista no catálogo.
 */

import { describe, expect, it } from 'vitest';
import { buildPlayerProfile } from '@/recommendation/profile/build-profile';
import { recommend } from '@/recommendation';
import { availableGauges } from '@/domain/string';
import { emptyAnswers, type QuestionnaireAnswers } from '@/recommendation/profile/answers';
import { TEST_DATASET_VERSION, TEST_MODE, testRackets, testStrings } from '../helpers/catalog';

/** Gerador determinístico (LCG) — perfis pseudoaleatórios reprodutíveis. */
function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function pick<T>(rng: () => number, options: readonly T[]): T {
  return options[Math.floor(rng() * options.length)] as T;
}

function syntheticAnswers(rng: () => number): QuestionnaireAnswers {
  const tri = ['sim', 'as_vezes', 'nao'] as const;
  return {
    ...emptyAnswers(),
    age: 12 + Math.floor(rng() * 65),
    height_cm: 150 + Math.floor(rng() * 55),
    weight_kg: 45 + Math.floor(rng() * 60),
    dominant_hand: pick(rng, ['destro', 'canhoto'] as const),
    perceived_strength: pick(rng, ['abaixo', 'media', 'acima', 'bem_acima'] as const),
    fitness_level: pick(rng, ['sedentario', 'moderado', 'bom', 'atletico'] as const),
    experience_duration: pick(rng, ['menos_6m', '6_12m', '1_2a', '2_5a', 'mais_5a'] as const),
    frequency_per_week: 1 + Math.floor(rng() * 5),
    has_lessons: pick(rng, ['nunca', 'ja_fiz', 'atualmente'] as const),
    plays_matches: pick(rng, ['sim', 'as_vezes', 'nao'] as const),
    tournament_experience: pick(rng, ['nunca', 'amadores', 'regionais', 'competitivo'] as const),
    perceived_level: pick(rng, [
      'iniciante',
      'iniciante_avancado',
      'intermediario',
      'intermediario_avancado',
      'avancado',
    ] as const),
    can_sustain_rally: pick(rng, tri),
    can_direct_ball: pick(rng, tri),
    can_generate_spin: pick(rng, tri),
    can_vary_depth: pick(rng, tri),
    reliable_second_serve: pick(rng, tri),
    play_style: [
      pick(rng, [
        'dominar_fundo',
        'muito_topspin',
        'mais_chapado',
        'atacar_cedo',
        'contra_atacar',
        'all_court',
        'subir_rede',
        'sem_estilo',
      ]),
    ],
    forehand_type: pick(rng, [
      'topspin_pesado',
      'topspin_moderado',
      'mais_chapado',
      'nao_sei',
    ] as const),
    backhand_hands: pick(rng, ['uma_mao', 'duas_maos'] as const),
    swing_length: pick(rng, ['curto', 'medio', 'longo', 'nao_sei'] as const),
    swing_speed: pick(rng, ['lenta', 'moderada', 'rapida', 'muito_rapida', 'nao_sei'] as const),
    depth_control: pick(rng, tri),
    missing_attributes: [
      pick(rng, ['power', 'control', 'spin', 'comfort', 'stability', 'maneuverability', 'precision']),
    ],
    current_tension_lbs: rng() > 0.4 ? 44 + Math.floor(rng() * 18) : null,
    current_tension_feeling: pick(rng, [
      'muito_solta',
      'um_pouco_solta',
      'ideal',
      'um_pouco_dura',
      'muito_dura',
      'nao_sei',
    ] as const),
    string_breakage: pick(rng, [
      'nunca',
      'raramente',
      'a_cada_2_3_meses',
      'mensalmente',
      'semanalmente',
    ] as const),
    discomfort_areas: rng() > 0.7 ? [pick(rng, ['cotovelo', 'ombro', 'punho'])] : ['nenhum'],
    objective: [
      pick(rng, [
        'potencializar',
        'ganhar_potencia',
        'ganhar_controle',
        'mais_spin',
        'atacar_mais',
        'mais_conforto',
        'mais_estabilidade',
        'mais_facil',
        'mais_exigente',
        'nao_sei',
      ]),
    ],
  };
}

const RUNS = 500;

describe('REGRA DE INTEGRIDADE — variantes de corda (500 perfis sintéticos)', () => {
  const strings = testStrings();
  const rackets = testRackets();
  const validVariantIds = new Set(strings.variants.map((v) => v.id));

  const results = Array.from({ length: RUNS }, (_, i) => {
    const rng = makeRng(i * 7919 + 13);
    const profile = buildPlayerProfile(syntheticAnswers(rng));
    return recommend({
      profile,
      rackets,
      strings,
      datasetVersion: TEST_DATASET_VERSION,
      mode: TEST_MODE,
      includeSetup: true,
    });
  });

  it(`produz recomendação de corda em todos os ${RUNS} perfis`, () => {
    const withString = results.filter((r) => r.string_recommendation !== null);
    expect(withString.length).toBe(RUNS);
  });

  it('(a) todo string_variant_id recomendado EXISTE no catálogo', () => {
    for (const result of results) {
      const id = result.string_recommendation!.variant.variant.id;
      expect(validVariantIds.has(id)).toBe(true);
    }
  });

  it('(b) o par (modelo, gauge) recomendado consta das variantes REAIS daquele modelo', () => {
    for (const result of results) {
      const rec = result.string_recommendation!.variant;
      const realGauges = availableGauges(strings.variants, rec.model.id);
      expect(realGauges).toContain(rec.variant.gauge_mm);
    }
  });

  it('(c) nunca recomenda variante indisponível no Brasil', () => {
    for (const result of results) {
      const status = result.string_recommendation!.variant.variant.brazil_availability_status;
      expect(status).not.toBe('not_found');
    }
  });

  it('(d) variante com disponibilidade limitada SEMPRE carrega aviso ao usuário', () => {
    for (const result of results) {
      const rec = result.string_recommendation!.variant;
      if (rec.variant.brazil_availability_status === 'limited') {
        expect(rec.availability_warning).toBeTruthy();
      }
    }
  });

  it('(e) a nota de gauge lista apenas espessuras que existem para aquele modelo', () => {
    for (const result of results) {
      const rec = result.string_recommendation!;
      expect(rec.gauge_note).toBeTruthy();
      const realGauges = availableGauges(strings.variants, rec.variant.model.id);
      // Toda espessura citada na nota precisa existir de verdade.
      const quoted = [...rec.gauge_note!.matchAll(/(\d\.\d{2}) mm/g)].map((m) =>
        Number.parseFloat(m[1] as string),
      );
      for (const g of quoted) expect(realGauges).toContain(g);
    }
  });

  /**
   * §37 — a proteção mudou de FORMA, e não de força.
   *
   * Antes: sensibilidade ≥ 70 eliminava o tipo poliéster inteiro. A regra binária tratava o Yonex
   * Poly Tour Pro (amigabilidade 47, dos mais macios que existem) e o Luxilon ALU Power
   * (amigabilidade 26, dos mais duros) como a mesma coisa — e é justamente a diferença entre eles
   * que decide o caso de quem quebra corda toda semana e também sente o braço.
   *
   * Agora a rigidez é um peso proporcional (`stiffnessPenalty`). O que este teste trava é a
   * consequência que importa de verdade, e ela é MAIS forte que a regra antiga: nenhum jogador
   * sensível recebe corda AGRESSIVA, seja ela de que tipo for. A regra velha permitia entregar um
   * multifilamento duro a quem tem dor; esta não permite.
   *
   * A trava de NÍVEL continua binária, porque o mecanismo é binário: um swing que não gera
   * velocidade não ativa o poliéster e recebe só o choque.
   */
  it('nunca recomenda corda agressiva ao braço para jogador sensível, nem poliéster para nível baixo (§37)', () => {
    const ARM_FLOOR = 45;

    for (let i = 0; i < RUNS; i += 1) {
      const rng = makeRng(i * 7919 + 13);
      const profile = buildPlayerProfile(syntheticAnswers(rng));
      const rec = results[i]!.string_recommendation!;

      if (profile.arm_sensitivity_score >= 70) {
        expect(
          rec.variant.attributes.arm_friendliness_score,
          `perfil ${i} (sensibilidade ${profile.arm_sensitivity_score.toFixed(0)}) recebeu ${rec.variant.model.brand} ${rec.variant.model.model}`,
        ).toBeGreaterThanOrEqual(ARM_FLOOR);
      }

      if (profile.player_level_score < 40) {
        expect(['polyester', 'co_polyester']).not.toContain(rec.variant.model.string_type);
      }
    }
  });

  /**
   * Toda exceção à regra de conforto precisa estar ESCRITA no relatório.
   *
   * Um poliéster indicado a quem relatou dor é defensável, mas nunca silencioso: sem a frase, o
   * relatório se contradiz aos olhos de quem paga por ele.
   */
  it('explica sempre que entrega poliéster a quem relatou desconforto', () => {
    for (let i = 0; i < RUNS; i += 1) {
      const rng = makeRng(i * 7919 + 13);
      const profile = buildPlayerProfile(syntheticAnswers(rng));
      const rec = results[i]!.string_recommendation!;
      const isStiff = ['polyester', 'co_polyester'].includes(rec.variant.model.string_type);

      if (isStiff && profile.arm_sensitivity_score >= 50) {
        expect(
          rec.rationale.some((r) => r.toLowerCase().includes('poliéster')),
          `perfil ${i} recebeu poliéster com sensibilidade ${profile.arm_sensitivity_score.toFixed(0)} e nenhuma explicação`,
        ).toBe(true);
      }
    }
  });

  it('a tensão está sempre dentro dos limites do tipo de corda e do frame', () => {
    for (const result of results) {
      const t = result.tension!;
      expect(t.lbs).toBeGreaterThanOrEqual(40);
      expect(t.lbs).toBeLessThanOrEqual(66);

      const specs = result.podium[0]?.racket.variant.specs ?? result.full_ranking[0]!.racket.variant.specs;
      if (specs.recommended_tension_min_lbs !== null && specs.recommended_tension_max_lbs !== null) {
        expect(t.lbs).toBeGreaterThanOrEqual(specs.recommended_tension_min_lbs);
        expect(t.lbs).toBeLessThanOrEqual(specs.recommended_tension_max_lbs);
      }
      expect(t.range_lbs[0]).toBeLessThanOrEqual(t.lbs);
      expect(t.range_lbs[1]).toBeGreaterThanOrEqual(t.lbs);
    }
  });
});

describe('REGRA DE INTEGRIDADE — modelo com gauge único', () => {
  it('modelo disponível em uma só espessura nunca é recomendado em outra', () => {
    const strings = testStrings();
    // Rexis Comfort e Multifeel existem em um único gauge no catálogo.
    const singleGaugeModels = strings.models.filter(
      (m) => availableGauges(strings.variants, m.id).length === 1,
    );
    expect(singleGaugeModels.length).toBeGreaterThan(0);

    for (const model of singleGaugeModels) {
      const variants = strings.variants.filter((v) => v.string_id === model.id);
      expect(variants.length).toBe(1);
      // Não existe nenhum outro objeto para esse modelo — é estruturalmente impossível
      // o motor retornar outra espessura.
    }
  });
});
