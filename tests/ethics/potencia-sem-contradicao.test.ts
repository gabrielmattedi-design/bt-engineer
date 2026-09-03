/**
 * UMA RAQUETE NÃO PODE ENTREGAR A POTÊNCIA QUE FALTA E, TRÊS BLOCOS ABAIXO, NÃO ENTREGAR POTÊNCIA.
 *
 * ═══ O QUE O RELATÓRIO DIZIA ═════════════════════════════════════════════════════════════════
 *
 * Relato do usuário sobre o perfil de teste 06, com a Babolat Pure Aero 98 na tela:
 *
 *   "Por que combina com você?"     → Este frame complementa a potência que seu swing ainda não
 *                                     entrega, ajudando a bola a chegar ao fundo da quadra.
 *   "O que você deve perceber?"     → Potência: frame contido: a potência vem mais de você do que
 *                                     da raquete.
 *
 * As duas frases estão na mesma página, sobre a mesma raquete, separadas por dois blocos.
 *
 * ═══ POR QUE ACONTECIA ═══════════════════════════════════════════════════════════════════════
 *
 * 1. Réguas diferentes. A primeira era relativa ao JOGADOR (`100 − potência natural`, zona morta
 *    de ±12); a segunda é absoluta contra o CATÁLOGO. Cada uma podia ser verdadeira sozinha.
 *
 * 2. E o gatilho da primeira não media potência. Era `swing_fit >= 75`, e `swing_fit` é
 *    `0.65 × potência + 0.35 × comprimento de swing` — o termo de comprimento carregava para cima
 *    frames cuja potência estava inteiramente errada para a pessoa.
 *
 * Medido sobre 202 cenários (22 personas + uma grade de idade × preparo × swing × objetivo), antes
 * do conserto: 105 cards de pódio traziam as duas frases que se desmentem. Não era um caso raro.
 *
 * ═══ O QUE ESTE TESTE TRANCA ═════════════════════════════════════════════════════════════════
 *
 * Não a redação — ela pode mudar. O que fica trancado é que as duas leituras não coexistam, e que
 * a frase sobre potência seja liberada por uma medida de POTÊNCIA.
 */

import { describe, expect, it } from 'vitest';
import { recommend, enrichProfileWithCatalog } from '@/recommendation';
import { buildPlayerProfile } from '@/recommendation/profile/build-profile';
import { serializeRecommendation, type Entitlement } from '@/payments/entitlements';
import { emptyAnswers, type QuestionnaireAnswers } from '@/recommendation/profile/answers';
import { PERSONAS } from '@/data/personas';
import { TEST_DATASET_VERSION, TEST_MODE, testRackets, testStrings } from '../helpers/catalog';

const RACKETS = testRackets();
const STRINGS = testStrings();
const TUDO: Entitlement[] = [
  'racket_report_access', 'full_setup_access', 'rank2_access', 'rank3_access',
];

/** A raquete gera potência para mim. */
const COMPLEMENTA = /complementa a potência que seu swing ainda não entrega/;
/** Eu gero a potência, a raquete não. */
const CONTIDO_ABSOLUTO = /a potência vem mais de você do que da raquete/;
const CONTIDO_RELATIVO = /escolhemos um frame mais contido/;
const MAIS_POTENTES = /entre as mais potentes do catálogo/;

type Card = {
  readonly locked: boolean;
  readonly product_name: string;
  readonly why?: readonly string[];
  readonly expectations?: readonly string[];
};

const BASE: Partial<QuestionnaireAnswers> = {
  dominant_hand: 'destro', has_lessons: 'nunca', plays_matches: 'as_vezes',
  tournament_experience: 'nunca', backhand_hands: 'uma_mao', discomfort_areas: ['nenhum'],
  height_cm: 175, weight_kg: 78, sex: 'masculino', perceived_strength: 'media',
  frequency_per_week: 2, experience_duration: 'mais_5a', perceived_level: 'intermediario',
  can_sustain_rally: 'sim', can_direct_ball: 'as_vezes', can_generate_spin: 'as_vezes',
  can_vary_depth: 'as_vezes', reliable_second_serve: 'as_vezes',
  play_style: ['all_court'], forehand_type: 'topspin_moderado', depth_control: 'as_vezes',
  no_current_racket: true,
};

/**
 * A varredura precisa ser LARGA de propósito.
 *
 * O defeito não aparecia numa persona específica: ele dependia da combinação entre o que a pessoa
 * gera de potência e onde o frame vencedor cai no catálogo. Uma amostra estreita passaria limpa
 * exatamente como o produto passou até o usuário ler o relatório dele.
 */
function cenarios(): Array<{ nome: string; answers: QuestionnaireAnswers }> {
  const out = PERSONAS.map((p) => ({
    nome: `persona:${p.id}`,
    answers: p.answers as QuestionnaireAnswers,
  }));

  for (const age of [16, 25, 45, 62, 72]) {
    for (const fitness of ['sedentario', 'moderado', 'bom', 'atletico'] as const) {
      for (const speed of ['lenta', 'moderada', 'rapida'] as const) {
        for (const objective of ['ganhar_potencia', 'mais_controle', 'mais_conforto'] as const) {
          out.push({
            nome: `${age}a/${fitness}/${speed}/${objective}`,
            answers: {
              ...emptyAnswers(), ...BASE,
              age, fitness_level: fitness, swing_speed: speed,
              swing_length: speed === 'lenta' ? 'curto' : speed === 'moderada' ? 'medio' : 'longo',
              missing_attributes: [
                objective === 'ganhar_potencia' ? 'power'
                  : objective === 'mais_controle' ? 'control' : 'comfort',
              ],
              objective: [objective],
            } as QuestionnaireAnswers,
          });
        }
      }
    }
  }
  return out;
}

function cards(answers: QuestionnaireAnswers): Card[] {
  const profile = enrichProfileWithCatalog(buildPlayerProfile(answers), RACKETS, STRINGS);
  const result = recommend({
    profile, rackets: RACKETS, strings: STRINGS,
    datasetVersion: TEST_DATASET_VERSION, mode: TEST_MODE, includeSetup: true,
  });
  return serializeRecommendation(result, profile, TUDO).podium as unknown as Card[];
}

describe('as duas leituras de potência', () => {
  it('nunca aparecem juntas na mesma raquete', () => {
    const achados: string[] = [];
    let conferidos = 0;

    for (const { nome, answers } of cenarios()) {
      for (const card of cards(answers)) {
        if (card.locked) continue;
        conferidos += 1;
        const why = (card.why ?? []).join('\n');
        const exp = (card.expectations ?? []).join('\n');

        // "a raquete me dá potência" + "a raquete não dá potência"
        if (COMPLEMENTA.test(why) && CONTIDO_ABSOLUTO.test(exp)) {
          achados.push(`${nome} · ${card.product_name}: complementa + contido`);
        }
        // "escolhemos um frame contido" + "entre as mais potentes do catálogo"
        if (CONTIDO_RELATIVO.test(why) && MAIS_POTENTES.test(exp)) {
          achados.push(`${nome} · ${card.product_name}: contido + entre as mais potentes`);
        }
      }
    }

    expect(conferidos, 'a varredura não conferiu card nenhum — o teste não prova nada')
      .toBeGreaterThan(100);
    expect(achados, `${achados.length} cards se desmentem sobre potência`).toEqual([]);
  });

  /**
   * O gatilho tem de medir POTÊNCIA.
   *
   * Era `swing_fit >= 75`, que é 65% potência e 35% comprimento de swing. Este teste falha se
   * alguém voltar a liberar a frase por um número que não é o da potência: ele exige que, sempre
   * que a frase aparecer, o termo de potência daquele encaixe esteja de fato alto.
   */
  it('a frase de complemento só sai quando o termo de POTÊNCIA sustenta', () => {
    let vezes = 0;

    for (const { nome, answers } of cenarios()) {
      const profile = enrichProfileWithCatalog(buildPlayerProfile(answers), RACKETS, STRINGS);
      const result = recommend({
        profile, rackets: RACKETS, strings: STRINGS,
        datasetVersion: TEST_DATASET_VERSION, mode: TEST_MODE, includeSetup: true,
      });
      const payload = serializeRecommendation(result, profile, TUDO);

      payload.podium.forEach((card, i) => {
        const c = card as unknown as Card;
        if (c.locked || !COMPLEMENTA.test((c.why ?? []).join('\n'))) return;
        vezes += 1;

        const swing = result.podium[i]?.breakdown.components.find((x) => x.key === 'swing_fit');
        const termo = swing?.terms.find((t) => t.label === 'power_complement')?.value;
        expect(termo, `${nome} · ${c.product_name}: frase de potência sem termo de potência`)
          .not.toBeUndefined();
        expect(
          termo!,
          `${nome} · ${c.product_name}: prometeu complemento de potência com o termo em ${termo}`,
        ).toBeGreaterThanOrEqual(0.75);
      });
    }

    expect(vezes, 'a frase nunca apareceu — o teste não prova nada').toBeGreaterThan(0);
  });
});
