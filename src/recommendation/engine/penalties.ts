/**
 * Penalizações — docs/RECOMMENDATION_ENGINE.md §4.3.
 *
 * Diferentes dos filtros duros: aqui a raquete continua no ranking, mas perde pontos por um motivo
 * concreto e legível. Toda penalização carrega `reason` em português, porque ela aparece na auditoria
 * do admin e alimenta a lista de "pontos de atenção" do relatório.
 */

import { round } from '@/domain/scores';
import type { ScoredRacket } from '@/domain/racket';
import type { PlayerProfile } from '@/domain/player-profile';
import type { Penalty } from '@/domain/recommendation';
import {
  computeSwingIndex,
  humanizeMissingFields,
  parseBeamAverage,
  resolveStrungWeight,
} from '@/recommendation/normalize/racket-attributes';
import { STIFF_BEAM_THRESHOLD_MM } from '@/domain/reference-ranges';

export function computePenalties(
  profile: PlayerProfile,
  racket: ScoredRacket,
  referencePower: number | null,
): Penalty[] {
  const penalties: Penalty[] = [];
  const { attributes, variant } = racket;
  const specs = variant.specs;

  const push = (code: string, points: number, reason: string): void => {
    if (points > 0.01) penalties.push({ code, points: round(points), reason });
  };

  // P1 — iniciante em frame muito exigente.
  if (profile.player_level_score < 35 && attributes.demand_index > 60) {
    push(
      'P1_beginner_demanding_frame',
      (attributes.demand_index - 60) * 0.8,
      `Frame exigente (índice ${round(attributes.demand_index)}) para o nível técnico atual.`,
    );
  }

  // P2 — swing lento com frame de baixa potência: a bola não chega ao fundo da quadra.
  if (profile.swing_speed_score < 35 && attributes.power_score < 40) {
    push(
      'P2_slow_swing_low_power',
      (40 - attributes.power_score) * 0.7,
      'Frame de baixa potência combinado com swing lento tende a produzir bolas curtas.',
    );
  }

  // P3 — risco para o braço na faixa intermediária. Penalização GRADUADA a partir do perfil da
  // viga, que é o proxy de rigidez publicado. Complementa (não substitui) a exclusão de poliéster
  // e a redução de tensão, que são as proteções fortes.
  const beamAvg = parseBeamAverage(specs);
  if (profile.arm_sensitivity_score >= 60 && beamAvg !== null && beamAvg >= STIFF_BEAM_THRESHOLD_MM) {
    push(
      'P3_arm_risk_stiff_frame',
      (beamAvg - STIFF_BEAM_THRESHOLD_MM + 0.5) * 9.0,
      `Perfil de quadro largo (${beamAvg.toFixed(1)} mm) somado ao histórico de desconforto informado.`,
    );
  }

  // P4 — jogador avançado em frame recreacional ultraleve.
  const unstrung = specs.unstrung_weight_g;
  if (profile.player_level_score >= 70 && unstrung !== null && unstrung < 270) {
    push(
      'P4_advanced_recreational_frame',
      (270 - unstrung) * 0.6,
      `Frame de ${unstrung} g tende a ser instável contra bolas pesadas no nível informado.`,
    );
  }

  // P5 — transição brusca. Apenas o excedente da zona morta é penalizado.
  const current = profile.current_racket;
  if (current?.weight_g != null) {
    const newStrung = resolveStrungWeight(specs);
    if (newStrung !== null) {
      const dw = Math.abs(newStrung - (current.weight_g + 16));
      if (dw > 25) {
        push(
          'P5_abrupt_weight_change',
          (dw - 25) * 0.8,
          `Diferença de ${round(dw)} g em relação à raquete atual exige adaptação.`,
        );
      }
    }
  }
  // P5b — mudança brusca de inércia de swing, medida pelo índice derivado (peso × balanço).
  if (current?.swing_index != null) {
    const newSwing = computeSwingIndex(specs);
    if (newSwing !== null) {
      const relative = Math.abs(newSwing - current.swing_index) / current.swing_index;
      if (relative > 0.12) {
        push(
          'P5b_abrupt_swing_change',
          (relative - 0.12) * 120,
          `Mudança de ${(relative * 100).toFixed(0)}% na inércia de swing em relação à raquete atual.`,
        );
      }
    }
  }

  // P6 — conflito com o objetivo declarado.
  if (referencePower !== null) {
    const wantsControl = profile.desired_change_vector.control > 10;
    const wantsPower = profile.desired_change_vector.power > 10;
    if (wantsControl && attributes.power_score > referencePower + 15) {
      push(
        'P6_objective_conflict',
        12,
        'Você pediu mais controle, mas este frame é sensivelmente mais potente que sua referência.',
      );
    }
    if (wantsPower && attributes.power_score < referencePower - 15) {
      push(
        'P6_objective_conflict',
        12,
        'Você pediu mais potência, mas este frame é sensivelmente menos potente que sua referência.',
      );
    }
  }

  // P7 — disponibilidade limitada no Brasil.
  if (variant.brazil_availability_status === 'limited') {
    push(
      'P7_limited_availability',
      6,
      'Disponibilidade limitada no mercado brasileiro — confirme antes de comprar.',
    );
  }

  // P8 — dados incompletos. Não é o mesmo que "ruim", mas reduz a segurança da indicação.
  if (attributes.data_completeness < 0.7) {
    push(
      'P8_low_data_completeness',
      (0.7 - attributes.data_completeness) * 40,
      `Faltam medições verificadas: ${humanizeMissingFields(attributes.missing_fields)}.`,
    );
  }

  return penalties;
}
