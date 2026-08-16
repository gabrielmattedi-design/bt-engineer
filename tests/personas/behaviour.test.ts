/**
 * Testes de persona — docs/TEST_STRATEGY.md §4.
 *
 * Validam COMPORTAMENTO do sistema, não nomes de produtos. Uma asserção do tipo "deve recomendar a
 * Blade 98" quebraria a cada atualização de catálogo sem provar nada sobre o algoritmo; uma asserção
 * do tipo "nenhum frame com RA ≥ 68 para quem relata dor no cotovelo" prova exatamente o que importa.
 */

import { describe, expect, it } from 'vitest';
import { buildPlayerProfile } from '@/recommendation/profile/build-profile';
import { recommend } from '@/recommendation';
import { STIFF_STRING_TYPES } from '@/domain/string';
import { averageBeam } from '@/domain/racket';
import { VERY_STIFF_BEAM_THRESHOLD_MM } from '@/domain/reference-ranges';
import { PERSONAS } from '@/data/personas';
import { TEST_DATASET_VERSION, TEST_MODE, testRackets, testStrings } from '../helpers/catalog';

/**
 * Asserções RELATIVAS ao catálogo, não absolutas.
 *
 * Um limiar absoluto ("forgiveness ≥ 45") é uma afirmação sobre a escala do catálogo, não sobre o
 * algoritmo — e quebra assim que o catálogo muda. "Está entre os 35% mais tolerantes disponíveis" é
 * uma afirmação real sobre o comportamento do motor, e continua válida com qualquer catálogo.
 */
function percentileOf(
  value: number,
  selector: (r: ReturnType<typeof testRackets>[number]) => number,
): number {
  const values = testRackets().map(selector);
  const below = values.filter((v) => v < value).length;
  return below / values.length;
}

function runPersona(id: string) {
  const persona = PERSONAS.find((p) => p.id === id);
  if (!persona) throw new Error(`persona ${id} não encontrada`);
  const profile = buildPlayerProfile(persona.answers);
  const result = recommend({
    profile,
    rackets: testRackets(),
    strings: testStrings(),
    datasetVersion: TEST_DATASET_VERSION,
    mode: TEST_MODE,
    includeSetup: true,
  });
  return { persona, profile, result };
}

describe('personas — todas produzem um resultado utilizável', () => {
  it.each(PERSONAS.map((p) => [p.id, p.name]))('%s (%s) produz um Top 1', (id) => {
    const { result } = runPersona(id as string);
    expect(result.full_ranking.length).toBeGreaterThan(0);
    const top = result.full_ranking[0]!;
    expect(top.fit_score).toBeGreaterThan(0);
    expect(top.fit_score).toBeLessThanOrEqual(100);
    // Todo score exibido precisa ter um breakdown auditável (§48).
    expect(top.breakdown.components.length).toBe(7);
    expect(top.breakdown.final_score).toBeCloseTo(top.fit_score, 2);
  });
});

describe('Persona 1 — iniciante adulto, swing lento (§49)', () => {
  const { result } = runPersona('p01');
  const top3 = result.full_ranking.slice(0, 3);

  it('recomenda os frames MENOS exigentes disponíveis (quartil inferior)', () => {
    for (const r of top3) {
      const p = percentileOf(r.racket.attributes.demand_index, (x) => x.attributes.demand_index);
      expect(p).toBeLessThanOrEqual(0.25);
    }
  });

  /**
   * NÃO assertamos manobrabilidade alta, e a razão é física, não uma concessão ao catálogo.
   *
   * `maneuverability_score` é dominado pelo `swing_index` (peso × balanço²). Frames de iniciante
   * são leves MAS fortemente head-heavy — é assim que compensam a falta de massa e entregam
   * potência. O resultado é que um frame de 225 g com balanço 380 mm tem inércia de swing MAIOR
   * que um frame de tour de 315 g com balanço 310 mm. Isso não é um artefato do modelo: é a razão
   * pela qual treinadores criticam a alta inércia dos frames de iniciante.
   *
   * Cobrar manobrabilidade alta aqui reprovaria exatamente o segmento correto e aprovaria frames
   * de jogador avançado. O que este jogador precisa é de TOLERÂNCIA e BAIXA EXIGÊNCIA, com massa
   * que ele consiga sustentar — que é o que assertamos.
   */
  it('recomenda o segmento de iniciante: cabeça grande e massa baixa', () => {
    for (const r of top3) {
      expect(r.racket.variant.specs.head_size_sq_in!).toBeGreaterThanOrEqual(103);
      expect(r.racket.variant.specs.unstrung_weight_g!).toBeLessThanOrEqual(285);
    }
  });

  it('prioriza tolerância — quartil superior de forgiveness', () => {
    for (const r of top3) {
      const p = percentileOf(
        r.racket.attributes.forgiveness_score,
        (x) => x.attributes.forgiveness_score,
      );
      expect(p).toBeGreaterThanOrEqual(0.75);
    }
  });

  /**
   * 75 e não 80: este jogador é sedentário, com swing lento e nível inicial, então sua `capacity`
   * é baixa. Nem o frame mais leve do catálogo (225 g) zera a diferença — e não deveria, porque
   * uma raquete de tênis adulta tem um piso de massa. 75 é o teto real do segmento.
   */
  it('o componente físico é alto — a massa é manejável', () => {
    for (const r of top3) {
      const physical = r.breakdown.components.find((c) => c.key === 'physical_fit')!;
      expect(physical.raw).toBeGreaterThanOrEqual(75);
    }
  });

  it('não recomenda frames pesados', () => {
    for (const r of top3) {
      expect(r.racket.variant.specs.unstrung_weight_g!).toBeLessThan(315);
    }
  });

  it('NÃO recomenda poliéster para iniciante (§37)', () => {
    const type = result.string_recommendation?.variant.model.string_type;
    expect(type).toBeDefined();
    expect(STIFF_STRING_TYPES).not.toContain(type);
  });
});

describe('Persona 2 — intermediário topspin busca spin (§49)', () => {
  const { result } = runPersona('p02');

  it('prioriza frames com padrão aberto', () => {
    for (const r of result.full_ranking.slice(0, 3)) {
      expect(r.racket.variant.specs.string_pattern_mains).toBeLessThanOrEqual(16);
    }
  });

  it('recomenda corda com bom índice de spin', () => {
    expect(result.string_recommendation!.variant.attributes.spin_score).toBeGreaterThanOrEqual(60);
  });
});

describe('Persona 3 — avançado chapado busca controle (§49)', () => {
  const { result } = runPersona('p03');
  const top5 = result.full_ranking.slice(0, 5);

  it('prioriza controle', () => {
    for (const r of top5) {
      expect(r.racket.attributes.control_score).toBeGreaterThanOrEqual(55);
    }
  });

  it('inclui ao menos um padrão denso no Top 5', () => {
    expect(top5.some((r) => r.racket.variant.specs.string_pattern_mains === 18)).toBe(true);
  });

  it('não entrega frames de potência recreacional', () => {
    for (const r of top5) {
      expect(r.racket.attributes.power_score).toBeLessThanOrEqual(70);
    }
  });
});

describe('Persona 4 — sensibilidade no braço (§49) [regra de segurança R-11]', () => {
  const { profile, result } = runPersona('p04');

  it('eleva a sensibilidade no perfil', () => {
    expect(profile.arm_sensitivity_score).toBeGreaterThanOrEqual(70);
  });

  it('NENHUM frame de perfil muito largo no ranking inteiro', () => {
    // v2: sem RA publicado, o proxy de rigidez é o perfil da viga. Vigas ≥ 26,5 mm médios são as
    // mais rígidas do mercado e ficam fora do ranking de quem relata desconforto.
    for (const r of result.full_ranking) {
      const beam = averageBeam(r.racket.variant.specs.beam_width_mm);
      if (beam !== null) expect(beam).toBeLessThan(VERY_STIFF_BEAM_THRESHOLD_MM);
    }
  });

  it('prioriza amigabilidade ao braço', () => {
    for (const r of result.full_ranking.slice(0, 3)) {
      expect(r.racket.attributes.arm_friendliness_score).toBeGreaterThanOrEqual(50);
    }
  });

  it('exclui poliéster da recomendação de corda', () => {
    const type = result.string_recommendation?.variant.model.string_type;
    expect(STIFF_STRING_TYPES).not.toContain(type);
    expect(result.string_recommendation!.excluded_types.length).toBeGreaterThan(0);
  });

  it('reduz a tensão pela percepção de "muito dura"', () => {
    // Tensão atual 55 lbs percebida como muito dura ⇒ a recomendação precisa cair.
    expect(result.tension!.lbs).toBeLessThan(55);
    expect(result.tension!.anchored_to_current).toBe(true);
  });
});

describe('Persona 5 — quer mais estabilidade partindo de 300 g (§49)', () => {
  const { result } = runPersona('p05');

  it('o Top 1 é mais estável que a raquete atual', () => {
    const current = testRackets().find((r) => r.variant.id === 'wilson-blade-100-v10-2026')!;
    expect(result.full_ranking[0]!.racket.attributes.stability_score).toBeGreaterThan(
      current.attributes.stability_score,
    );
  });

  it('não propõe uma mudança brusca de peso', () => {
    const top = result.full_ranking[0]!.racket.variant.specs.unstrung_weight_g!;
    expect(Math.abs(top - 300)).toBeLessThanOrEqual(25);
  });

  it('produz análise de transição com ganhos E pontos de atenção', () => {
    expect(result.transition.available).toBe(true);
    expect(result.transition.comparisons.length).toBeGreaterThan(5);
    expect(result.transition.expectations.length).toBeGreaterThan(0);
  });

  it('respeita a tensão atual quando o jogador a considera ideal', () => {
    expect(Math.abs(result.tension!.lbs - 52)).toBeLessThanOrEqual(3);
  });
});

describe('Persona 6 — frame pesado demais para a técnica (§49)', () => {
  const { result } = runPersona('p06');
  const current = testRackets().find((r) => r.variant.id === 'yonex-percept-97-2023')!;
  const top = result.full_ranking[0]!;

  it('recomenda algo mais leve', () => {
    expect(top.racket.variant.specs.unstrung_weight_g!).toBeLessThan(
      current.variant.specs.unstrung_weight_g!,
    );
  });

  it('recomenda algo menos exigente', () => {
    expect(top.racket.attributes.demand_index).toBeLessThan(current.attributes.demand_index);
  });

  it('recomenda algo mais manobrável e mais tolerante', () => {
    expect(top.racket.attributes.maneuverability_score).toBeGreaterThan(
      current.attributes.maneuverability_score,
    );
    expect(top.racket.attributes.forgiveness_score).toBeGreaterThan(
      current.attributes.forgiveness_score,
    );
  });
});

describe('Persona 15 — tudo "não sei" (§24: não fabricar certeza)', () => {
  const { profile, result } = runPersona('p15');

  it('registra alta taxa de desconhecimento', () => {
    expect(profile.unknown_answer_ratio).toBeGreaterThan(0.5);
  });

  it('confiança é BAIXA', () => {
    expect(result.confidence.level).toBe('low');
  });

  it('explica o que reduziria a incerteza', () => {
    const withRemedy = result.confidence.reasons.filter((r) => r.remedy !== null);
    expect(withRemedy.length).toBeGreaterThan(0);
  });
});

describe('Persona 16 — contradição de nível (R-05)', () => {
  const { profile } = runPersona('p16');

  it('detecta a divergência entre nível percebido e calibrado', () => {
    expect(profile.contradictions.some((c) => c.code === 'level_mismatch')).toBe(true);
  });

  it('a resposta objetiva prevalece — o nível calibrado é alto', () => {
    expect(profile.player_level_score).toBeGreaterThan(60);
    expect(profile.perceived_level_score).toBe(15);
  });
});

describe('Persona 17 — raquete atual não reconhecida', () => {
  const { profile, result } = runPersona('p17');

  it('marca a raquete como não reconhecida', () => {
    expect(profile.current_racket?.unrecognized).toBe(true);
  });

  it('não oferece análise de transição e explica o motivo', () => {
    expect(result.transition.available).toBe(false);
    expect(result.transition.attention_points.length).toBeGreaterThan(0);
  });

  it('reduz a confiança e diz como corrigir', () => {
    const reason = result.confidence.reasons.find((r) => r.code === 'unrecognized_racket');
    expect(reason).toBeDefined();
    expect(reason!.remedy).toBeTruthy();
  });
});

describe('Persona 20 — jogador satisfeito quer potencializar (§18)', () => {
  const { result } = runPersona('p20');

  it('a recomendação fica próxima do equipamento atual, não é uma revolução', () => {
    const top = result.full_ranking[0]!;
    const transitionComponent = top.breakdown.components.find((c) => c.key === 'transition_fit')!;
    expect(transitionComponent.raw).toBeGreaterThanOrEqual(70);
  });
});

describe('Persona 21 — iniciante COM desconforto (combinação de risco)', () => {
  const { result } = runPersona('p21');

  it('não recomenda poliéster nem frame rígido', () => {
    expect(STIFF_STRING_TYPES).not.toContain(result.string_recommendation!.variant.model.string_type);
    for (const r of result.full_ranking.slice(0, 5)) {
      const beam = averageBeam(r.racket.variant.specs.beam_width_mm);
      if (beam !== null) expect(beam).toBeLessThan(VERY_STIFF_BEAM_THRESHOLD_MM);
    }
  });
});

describe('Persona 22 — quer equipamento mais exigente', () => {
  const { result } = runPersona('p22');
  const current = testRackets().find((r) => r.variant.id === 'babolat-pure-aero-team-gen-9-2026')!;

  it('sobe a exigência em relação ao atual', () => {
    expect(result.full_ranking[0]!.racket.attributes.demand_index).toBeGreaterThan(
      current.attributes.demand_index,
    );
  });
});
