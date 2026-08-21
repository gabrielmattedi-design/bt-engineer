/**
 * Penalizações — docs/RECOMMENDATION_ENGINE.md §4.3.
 *
 * Diferentes dos filtros duros: aqui a raquete continua no ranking, mas perde pontos por um motivo
 * concreto e legível. Toda penalização carrega `reason` em português, porque ela aparece na auditoria
 * do admin e alimenta a lista de "pontos de atenção" do relatório.
 */

import { clamp, round } from '@/domain/scores';
import type { ScoredRacket } from '@/domain/racket';
import type { NeedKey, PlayerProfile } from '@/domain/player-profile';
import { NEED_KEYS, NEED_LABEL_PT, NEED_TO_RACKET_ATTRIBUTE } from '@/domain/player-profile';
import type { Penalty } from '@/domain/recommendation';
import type { CatalogScale, ScaleKey } from './catalog-scale';
import {
  computeSwingIndex,
  humanizeMissingFields,
  parseBeamAverage,
  resolveStrungWeight,
} from '@/recommendation/normalize/racket-attributes';
import { STIFF_BEAM_THRESHOLD_MM } from '@/domain/reference-ranges';

/** Abaixo desta intensidade o pedido é uma preferência, não um requisito — P6 não se aplica. */
const STRONG_ASK = 20;

/** Intensidade máxima possível de um pedido (§3.4). */
const MAX_ASK = 40;

export function computePenalties(
  profile: PlayerProfile,
  racket: ScoredRacket,
  referencePower: number | null,
  context?: {
    readonly reference: Readonly<Record<NeedKey, number>>;
    readonly scale: CatalogScale;
  },
): Penalty[] {
  const penalties: Penalty[] = [];
  const { attributes, variant } = racket;
  const specs = variant.specs;

  const push = (code: string, points: number, reason: string, axis?: NeedKey): void => {
    if (points > 0.01) penalties.push({ code, points: round(points), reason, axis });
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

  /**
   * P6 — o frame anda na direção CONTRÁRIA a um objetivo declarado com força.
   *
   * ─── POR QUE UMA PENALIZAÇÃO, E NÃO SÓ UM COMPONENTE BAIXO ───────────────────────────────
   *
   * `objective_fit` já mede a direção, mas ele é uma MÉDIA com peso 0.16: um frame que acerta
   * tudo o mais compensa facilmente o objetivo e sobe ao topo mesmo contradizendo o único pedido
   * que a pessoa fez. Foi exatamente o que passou a acontecer com a persona 5, que pede mais
   * estabilidade na intensidade máxima e recebia um frame MENOS estável que o dela.
   *
   * Recomendar o contrário do que foi pedido não é um trade-off aceitável — é a falha mais
   * visível que este produto pode cometer, e quem paga percebe na primeira leitura. A penalização
   * existe para que nenhum outro componente possa comprá-la de volta.
   *
   * A regra vale para os OITO eixos. Antes cobria apenas potência e controle, o que deixava
   * estabilidade, manobrabilidade, spin, conforto, tolerância e precisão sem proteção alguma.
   */
  const { reference, scale } = context ?? {};
  if (reference && scale) {
    /**
     * Só o PIOR conflito é cobrado, nunca a soma.
     *
     * Perfis com objetivos que se opõem entre si — mais estabilidade E mais manobrabilidade —
     * contrariam necessariamente algum eixo, faça o motor o que fizer. Somar uma penalização por
     * eixo cobraria da raquete a contradição do pedido, e ainda por cima de forma cumulativa: a
     * pessoa com o perfil mais difícil receberia a maior punição, que é o incentivo invertido.
     *
     * Um conflito é a mensagem; cinco conflitos continuam sendo a mesma mensagem.
     */
    let worst: { points: number; reason: string; axis: NeedKey } | null = null;

    for (const need of NEED_KEYS) {
      const desired = profile.desired_change_vector[need];
      if (Math.abs(desired) < STRONG_ASK) continue;

      const attrKey = NEED_TO_RACKET_ATTRIBUTE[need] as ScaleKey;
      const value = attributes[attrKey as keyof typeof attributes] as number;
      const moved =
        (scale.position(attrKey, value) - scale.position(attrKey, reference[need])) *
        Math.sign(desired);
      const strength = clamp(Math.abs(desired) / MAX_ASK, 0, 1);

      /**
       * A penalização cobre CONTRADIÇÃO, não estagnação — zona morta de 3 pontos, que absorve
       * diferenças imperceptíveis em quadra.
       *
       * Exigir movimento POSITIVO num pedido de intensidade máxima foi testado e descartado: como
       * a estagnação costuma atingir todas as candidatas ao mesmo tempo, a regra derrubava o score
       * do ranking inteiro sem reordenar nada — punia o usuário por uma limitação do catálogo em
       * vez de escolher melhor para ele. Não entregar avanço já aparece em `objective_fit`, que é
       * o lugar certo: lá é um componente proporcional, e não um desconto sobre todo mundo.
       */
      if (moved >= -3) continue;

      const points = Math.min(Math.abs(moved) * 0.8, 25) * strength;
      if (worst === null || points > worst.points) {
        worst = {
          points,
          axis: need,
          reason:
            `Você pediu mais ${NEED_LABEL_PT[need]}, mas este frame vai na direção contrária ` +
            `à da sua referência.`,
        };
      }
    }

    if (worst) push('P6_objective_conflict', worst.points, worst.reason, worst.axis);
  } else if (referencePower !== null) {
    // Sem a escala do catálogo (chamada legada), resta a checagem original sobre potência.
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
