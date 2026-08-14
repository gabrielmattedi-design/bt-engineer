/**
 * Confiança da análise — docs/RECOMMENDATION_ENGINE.md §6.
 *
 * §24: "Separar Compatibilidade de Confiança na análise. Não fabricar certeza."
 *
 * Um resultado pode legitimamente ser "94% de compatibilidade · Confiança: Média". As duas dimensões
 * nunca são combinadas num único número, porque respondem a perguntas diferentes: "quão bem esta
 * raquete serve ao perfil?" e "quão bem conhecemos o perfil?".
 *
 * ─── v2: dois eixos, combinados pelo MENOR ────────────────────────────────────────────────────
 *
 * Na v1 tudo descontava de um único bolo de 100 pontos, e isso escondia um erro: um jogador que
 * respondeu "não sei" a 92% do questionário podia terminar em "Média" porque o catálogo estava bem
 * cadastrado. Conhecer bem a raquete não compensa não conhecer o jogador — são conhecimentos sobre
 * coisas diferentes.
 *
 * Agora existem dois eixos independentes:
 *   • `profile_knowledge` — quanto sabemos sobre o JOGADOR
 *   • `data_knowledge`    — quanto sabemos sobre o EQUIPAMENTO
 *
 * e a confiança final é o MENOR dos dois. O elo mais fraco define o que podemos afirmar. Na v1 o
 * eixo de dados estava permanentemente travado em ~61% porque dependia de medições de laboratório
 * que os fabricantes não publicam; com as especificações consolidadas de mercado da v2 ele chega a
 * 100%, e a confiança "Alta" passa a ser alcançável — mas apenas por quem responde o questionário.
 */

import { TECHNICAL_TIE_THRESHOLD } from '@/domain/reference-ranges';
import { clamp, round } from '@/domain/scores';
import type { ConfidenceLevel } from '@/domain/sourced';
import type { PlayerProfile } from '@/domain/player-profile';
import { humanizeMissingFields } from '@/recommendation/normalize/racket-attributes';
import type {
  ConfidenceReason,
  RankedRacket,
  RecommendationConfidence,
} from '@/domain/recommendation';

export function computeConfidence(
  profile: PlayerProfile,
  ranking: readonly RankedRacket[],
  opts: { tensionBaseIsFallback?: boolean } = {},
): RecommendationConfidence {
  const reasons: ConfidenceReason[] = [];
  let profileScore = 100;
  let dataScore = 100;
  /** Descontos que não pertencem a nenhum dos dois eixos: incerteza sobre o RESULTADO, não sobre o conhecimento. */
  let jointPenalty = 0;

  const deduct = (
    axis: 'profile' | 'data' | 'joint',
    code: string,
    points: number,
    message: string,
    remedy: string | null,
  ): void => {
    if (points <= 0.01) return;
    if (axis === 'profile') profileScore -= points;
    else if (axis === 'data') dataScore -= points;
    else jointPenalty += points;
    reasons.push({ code, points: round(points), message, remedy });
  };

  // O questionário é a única fonte sobre o jogador. Sem ele não há análise — por isso este desconto
  // sozinho pode levar o eixo do perfil de 100 a 30.
  deduct(
    'profile',
    'unknown_answers',
    profile.unknown_answer_ratio * 70,
    `${Math.round(profile.unknown_answer_ratio * 100)}% das perguntas foram respondidas com "não sei".`,
    'Responder as perguntas de swing e equipamento atual aumenta bastante a precisão da análise.',
  );

  deduct(
    'profile',
    'contradictions',
    profile.contradictions.length * 8,
    profile.contradictions.length === 1
      ? 'Encontramos uma inconsistência entre suas respostas.'
      : `Encontramos ${profile.contradictions.length} inconsistências entre suas respostas.`,
    'Revisar as respostas destacadas resolveria a ambiguidade.',
  );

  if (profile.current_racket?.unrecognized) {
    deduct(
      'profile',
      'unrecognized_racket',
      10,
      'Não reconhecemos sua raquete atual no nosso catálogo, então não foi possível comparar especificações.',
      'Informar marca, modelo e ano da sua raquete atual habilita a análise de transição.',
    );
  }

  if (profile.free_text_length > 0 && profile.free_text_length < 15) {
    deduct(
      'profile',
      'sparse_free_text',
      5,
      'O texto livre trouxe pouca informação adicional.',
      'Descrever seus golpes e o que incomoda no equipamento atual refina a análise.',
    );
  }

  const top = ranking[0];
  if (top) {
    const missing = humanizeMissingFields(top.racket.attributes.missing_fields);
    deduct(
      'data',
      'incomplete_catalog_data',
      (1 - top.breakdown.data_completeness) * 60,
      missing
        ? `Ainda não temos medições verificadas de ${missing} para a raquete recomendada. A análise foi feita com os dados disponíveis.`
        : 'Alguns dados técnicos da raquete recomendada ainda não estão verificados.',
      null,
    );
  }

  if (profile.contradictions.some((c) => c.code === 'level_mismatch')) {
    deduct(
      'profile',
      'level_ambiguity',
      12,
      'Seu nível autoavaliado divergiu do calibrado pelas perguntas objetivas.',
      'Confirmar o nível técnico deixaria a recomendação mais precisa.',
    );
  }

  const second = ranking[1];
  if (top && second && Math.abs(top.fit_score - second.fit_score) < TECHNICAL_TIE_THRESHOLD) {
    deduct(
      'joint',
      'technical_tie',
      5,
      'As duas primeiras opções ficaram tecnicamente empatadas — a escolha entre elas é de preferência pessoal.',
      'Um teste em quadra com as duas resolveria melhor que qualquer cálculo.',
    );
  }

  if (profile.swing_speed_inferred) {
    deduct(
      'profile',
      'inferred_swing_speed',
      6,
      'A velocidade do seu swing foi inferida a partir do nível e do condicionamento, não informada.',
      'Informar a velocidade do swing melhora diretamente a escolha do frame.',
    );
  }

  if (opts.tensionBaseIsFallback) {
    deduct(
      'data',
      'tension_base_unknown',
      10,
      'A faixa de tensão recomendada pelo fabricante ainda não foi confirmada para este frame.',
      null,
    );
  }

  const profileKnowledge = clamp(profileScore, 0, 100);
  const dataKnowledge = clamp(dataScore, 0, 100);

  // O elo mais fraco define o que podemos afirmar: conhecer a raquete não compensa não conhecer o
  // jogador, e vice-versa.
  const finalScore = clamp(Math.min(profileKnowledge, dataKnowledge) - jointPenalty, 0, 100);

  return {
    score: round(finalScore),
    level: toLevel(finalScore),
    reasons,
    profile_knowledge: round(profileKnowledge),
    data_knowledge: round(dataKnowledge),
  };
}

export function toLevel(score: number): ConfidenceLevel {
  if (score >= 75) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

export const CONFIDENCE_LABEL_PT: Record<ConfidenceLevel, string> = {
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};
