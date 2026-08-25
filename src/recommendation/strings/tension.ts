/**
 * Motor de tensão — docs/STRING_AND_TENSION_ENGINE.md §4.
 *
 * §9 da especificação: "A tensão deve ser calculada de forma independente e nunca copiada de uma
 * tabela fixa."
 *
 * Aqui a tensão é construída: base do fabricante + 12 ajustes documentados + ancoragem na experiência
 * real do jogador + clamps de segurança. Cada ajuste devolve seu `rationale`, então o relatório pode
 * mostrar exatamente como se chegou ao número — sem transmitir falsa precisão.
 */

import {
  FALLBACK_BASE_TENSION_LBS,
  HYBRID_CROSS_OFFSET_LBS,
  RANGES,
  TENSION_BOUNDS_LBS,
} from '@/domain/reference-ranges';
import { clamp, norm, round } from '@/domain/scores';
import { lbsToKg } from '@/domain/units';
import { averageBeam, type ScoredRacket } from '@/domain/racket';
import type { ScoredStringVariant, StringType } from '@/domain/string';
import type { PlayerProfile } from '@/domain/player-profile';
import type { TensionAdjustment, TensionRecommendation } from '@/domain/recommendation';
import { computeOpenness } from '@/recommendation/normalize/racket-attributes';

/**
 * Quanto a tensão base se desloca conforme o material.
 *
 * A lógica é a rigidez dinâmica: um poliéster fica sensivelmente mais duro que um multifilamento
 * NA MESMA TENSÃO, então se compensa encordoando mais baixo. Materiais elásticos aceitam mais.
 *
 * `polyamide_monofilament` entra em -1.0: a poliamida é bem mais macia que um co-poliéster (que
 * leva -3.0), mas continua sendo fio único, sem a elasticidade de uma trançada (que leva +0.5).
 * O meio-termo é o que a construção sustenta.
 */
const STRING_TYPE_ADJUSTMENT: Record<StringType, number> = {
  polyester: -3.0,
  co_polyester: -3.0,
  polyamide_monofilament: -1.0,
  multifilament: 0.5,
  synthetic_gut: 0.5,
  natural_gut: 1.0,
  hybrid: -1.5,
};

const FEEDBACK_DELTA: Record<string, number> = {
  muito_solta: 3.0,
  um_pouco_solta: 1.5,
  ideal: 0,
  um_pouco_dura: -1.5,
  muito_dura: -3.0,
};

export type TensionOptions = {
  /** Perna cruzada de um híbrido, quando aplicável. */
  readonly hybridCross?: ScoredStringVariant | null;
};

export function computeTension(
  racket: ScoredRacket,
  stringVariant: ScoredStringVariant,
  profile: PlayerProfile,
  options: TensionOptions = {},
): TensionRecommendation {
  const specs = racket.variant.specs;
  const stringType = stringVariant.model.string_type;
  const adjustments: TensionAdjustment[] = [];
  const notes: string[] = [];

  // ── Base: faixa do fabricante, lida do BANCO. Nunca uma tabela fixa. ────────────────────────
  const hasRange =
    specs.recommended_tension_min_lbs !== null && specs.recommended_tension_max_lbs !== null;
  const base = hasRange
    ? ((specs.recommended_tension_min_lbs as number) +
        (specs.recommended_tension_max_lbs as number)) /
      2
    : FALLBACK_BASE_TENSION_LBS;

  if (!hasRange) {
    notes.push(
      'A faixa de tensão recomendada pelo fabricante ainda não foi confirmada para este modelo. ' +
        'Usamos uma base conservadora e reduzimos a confiança da recomendação.',
    );
  }

  const add = (factor: string, delta: number, rationale: string): void => {
    if (Math.abs(delta) < 0.05) return;
    adjustments.push({ factor, delta_lbs: round(delta, 1), rationale });
  };

  // 1 — tipo de corda
  add(
    'tipo_de_corda',
    STRING_TYPE_ADJUSTMENT[stringType],
    'Poliéster tem rigidez dinâmica muito maior que multifilamento: na mesma tensão, o leito fica ' +
      'sensivelmente mais duro. Materiais mais elásticos aceitam tensão um pouco maior.',
  );

  // 2 — espessura da variante escolhida (nunca de um gauge hipotético)
  add(
    'espessura',
    (1.25 - stringVariant.variant.gauge_mm) * 8,
    `Corda de ${stringVariant.variant.gauge_mm.toFixed(2)} mm alonga ${stringVariant.variant.gauge_mm < 1.25 ? 'mais' : 'menos'} sob impacto; a tensão compensa para manter o controle.`,
  );

  // 3 — abertura do padrão
  const openness = computeOpenness(specs.string_pattern_mains, specs.string_pattern_crosses);
  if (openness !== null) {
    add(
      'padrao_de_cordas',
      (openness - 0.5) * 3.0,
      `Padrão ${specs.string_pattern_mains}×${specs.string_pattern_crosses} ${openness > 0.5 ? 'aberto lança a bola mais alto — subimos a tensão para conter' : 'denso já contém a bola — aliviamos a tensão'}.`,
    );
  }

  // 4 — tamanho de cabeça
  if (specs.head_size_sq_in !== null) {
    add(
      'tamanho_de_cabeca',
      (norm(specs.head_size_sq_in, RANGES.head_size_sq_in[0], RANGES.head_size_sq_in[1]) - 0.5) * 4.0,
      `Cabeça de ${specs.head_size_sq_in} sq in produz um leito ${specs.head_size_sq_in > 100 ? 'mais elástico e potente' : 'mais contido'}.`,
    );
  }

  // 5 — perfil do quadro (proxy de rigidez).
  //
  // A rigidez medida (RA) não é publicada pelos fabricantes e, quando existe, vem de laboratórios
  // independentes com metodologias diferentes. Usamos o perfil da viga, que TODA marca publica:
  // quadros mais largos são, na média do mercado, mais rígidos. É uma correlação, não uma
  // identidade — por isso o ajuste é modesto (máx. 1,5 lb) e a proteção forte do braço mora na
  // escolha da corda, não aqui.
  const beam = averageBeam(specs.beam_width_mm);
  if (beam !== null) {
    add(
      'perfil_do_quadro',
      -norm(beam, RANGES.beam_width_avg_mm[0], RANGES.beam_width_avg_mm[1]) * 1.5,
      `Quadro de perfil ${specs.beam_width_mm} mm ${beam >= 25 ? 'é largo e tipicamente mais rígido; aliviamos na corda para preservar o braço' : 'é relativamente fino e tende a absorver mais impacto, o que abre margem na tensão'}.`,
    );
  }

  // 6 — velocidade de swing
  add(
    'velocidade_do_swing',
    (-(profile.swing_speed_score - 50) / 50) * 3.0,
    profile.swing_speed_score > 50
      ? 'Seu swing gera potência própria, então a corda pode trabalhar mais solta sem perder profundidade.'
      : 'Seu swing ainda depende do equipamento para gerar profundidade; a tensão sobe para não perder controle.',
  );

  // 7/8 — necessidades de potência e controle
  add(
    'necessidade_de_potencia',
    (-(profile.needs.power - 50) / 50) * 3.0,
    'Tensão menor aumenta o efeito trampolim do leito de cordas.',
  );
  add(
    'necessidade_de_controle',
    ((profile.needs.control - 50) / 50) * 3.0,
    'Tensão maior reduz a deformação do leito e aumenta a previsibilidade.',
  );

  // 9 — spin
  add(
    'necessidade_de_spin',
    (-(profile.needs.spin - 50) / 50) * 1.5,
    'Tensão um pouco menor aumenta o encaixe da bola e o retorno das cordas.',
  );

  // 10 — braço. Conforto com peso real (§37).
  add(
    'sensibilidade_no_braco',
    (-profile.arm_sensitivity_score / 100) * 4.0,
    'Tensão mais baixa reduz a carga transmitida ao braço.',
  );

  // 11 — idade
  if (profile.age !== null && profile.age >= 50) {
    add('idade', -1.0, 'Ajuste de conforto para maior longevidade em quadra.');
  } else if (profile.age !== null && profile.age <= 16) {
    add('idade', -1.0, 'Ajuste de conforto para jogador em formação.');
  }

  // 12 — frequência
  const freq = profile.current_string?.breakage_frequency ?? 0;
  if (freq >= 80) {
    add(
      'frequencia_de_jogo',
      0.5,
      'Com jogo frequente a tensão cai rápido; começar um pouco acima prolonga a janela útil do encordoamento.',
    );
  }

  const computed = base + adjustments.reduce((s, a) => s + a.delta_lbs, 0);

  // ── Ancoragem na experiência real (§4.3) ────────────────────────────────────────────────────
  // A percepção do jogador sobre a própria tensão é a evidência mais forte disponível — mais forte
  // que qualquer fórmula. Quando existe, ela domina.
  const current = profile.current_string;
  let alpha = 0;
  let anchored = computed;

  if (
    current?.tension_lbs != null &&
    current.tension_feeling != null &&
    current.tension_feeling !== 'nao_sei'
  ) {
    const delta = FEEDBACK_DELTA[current.tension_feeling] ?? 0;
    anchored = current.tension_lbs + delta;
    const sameType = current.string_type === stringType;
    alpha = sameType ? 0.55 : 0.35;

    if (!sameType) {
      notes.push(
        'Como o tipo de corda muda, sua referência de tensão anterior perde parte da validade — ' +
          'por isso ela pesa menos no cálculo.',
      );
    }
    if (current.tension_feeling === 'ideal' && sameType) {
      notes.push(
        'Você indicou que a tensão atual está ideal. Mantivemos o setup próximo dela: mudar sem ' +
          'motivo seria ruído, não melhoria.',
      );
    }
  }

  let final = alpha * anchored + (1 - alpha) * computed;

  // ── Limites. Nunca ultrapassar o tecnicamente aceitável para o frame (§9). ───────────────────
  let clampedBy: TensionRecommendation['clamped_by'] = null;
  /*
    Guardado ANTES de qualquer limite, para o relatório poder mostrar de onde para onde o clamp
    moveu o número. A frase "ajustamos para a faixa do fabricante" sem os dois valores deixava o
    leitor com uma conta que não fecha: base menos ajustes não dava o resultado exibido.
  */
  const preClamp = round(final, 1);

  const bounds = TENSION_BOUNDS_LBS[stringType];
  const boundClamped = clamp(final, bounds[0], bounds[1]);
  if (boundClamped !== final) {
    clampedBy = 'string_type_bounds';
    notes.push(
      `A conta dava ${round(final, 1)} lbs; ajustamos para os limites praticáveis deste tipo de ` +
        `corda (${bounds[0]}–${bounds[1]} lbs), o que levou a ${round(boundClamped, 1)} lbs.`,
    );
    final = boundClamped;
  }

  if (hasRange) {
    const min = specs.recommended_tension_min_lbs as number;
    const max = specs.recommended_tension_max_lbs as number;
    const frameClamped = clamp(final, min, max);
    if (frameClamped !== final) {
      clampedBy = 'frame_range';
      notes.push(
        `A conta dava ${round(final, 1)} lbs; ajustamos para a faixa recomendada pelo fabricante ` +
          `para este frame (${min}–${max} lbs), o que levou a ${round(frameClamped, 1)} lbs.`,
      );
      final = frameClamped;
    }
  }

  const lbs = Math.round(final);
  const rangeLo = Math.round(clamp(lbs - 2, bounds[0], bounds[1]));
  const rangeHi = Math.round(clamp(lbs + 2, bounds[0], bounds[1]));

  const isHybrid = !!options.hybridCross;
  const mains = isHybrid ? lbs : null;
  const crosses = isHybrid ? lbs + HYBRID_CROSS_OFFSET_LBS : null;

  return {
    lbs,
    kg: lbsToKg(lbs),
    range_lbs: [rangeLo, rangeHi],
    mains_lbs: mains,
    crosses_lbs: crosses,
    base_lbs: round(base, 1),
    base_source: hasRange ? 'manufacturer_range' : 'fallback',
    adjustments,
    clamped_by: clampedBy,
    pre_clamp_lbs: preClamp,
    anchored_to_current: alpha > 0,
    anchor_weight: alpha,
    guidance: buildGuidance(lbs),
    notes,
  };
}

/**
 * Orientação de ajuste (§9). Entregamos um ponto de partida, uma faixa e um método — não uma
 * precisão que não temos.
 */
function buildGuidance(lbs: number): string {
  return (
    `Comece em ${lbs} lbs (${lbsToKg(lbs).toFixed(1).replace('.', ',')} kg). ` +
    'Se sentir excesso de potência ou dificuldade para segurar a bola dentro da quadra, considere ' +
    '+2 lbs no próximo encordoamento. Se sentir pouca profundidade ou conforto insuficiente, ' +
    'considere −2 lbs. Ajuste um fator por vez: mudanças de 2 lbs são perceptíveis, mudanças de ' +
    '1 lb raramente são.'
  );
}
