/**
 * Gerador determinístico de explicações.
 *
 * É o caminho PADRÃO, não o de emergência: o produto entrega um relatório completo e correto sem
 * nenhuma chamada de IA. A IA (quando disponível e aprovada pelo guard) apenas substitui este texto
 * por uma prosa mais fluida — nunca por informação diferente.
 *
 * Tom conforme §55: especialista, acessível, sem arrogância, sem falsa certeza.
 */

import { round } from '@/domain/scores';
import { formatTension } from '@/domain/units';
import type { ScoredRacket } from '@/domain/racket';
import type { PlayerProfile } from '@/domain/player-profile';
import type {
  RankedRacket,
  StringRecommendation,
  TensionRecommendation,
  TransitionAnalysis,
} from '@/domain/recommendation';

/** "Por que combina com você?" (§35) */
export function explainRacketFit(
  ranked: RankedRacket,
  profile: PlayerProfile,
): string[] {
  const out: string[] = [];
  const { attributes, variant } = ranked.racket;
  const byKey = new Map(ranked.breakdown.components.map((c) => [c.key, c]));

  const skill = byKey.get('skill_fit');
  if (skill && skill.raw >= 75) {
    out.push(
      `A exigência deste frame está alinhada ao seu nível técnico: ele responde bem ao que você ` +
        `já consegue executar, sem cobrar um swing que ainda está em construção.`,
    );
  }

  const physical = byKey.get('physical_fit');
  if (physical && physical.raw >= 80) {
    out.push(
      `A massa é compatível com o seu perfil físico e com a velocidade de swing informada — ` +
        `você deve conseguir acelerar o frame até o fim da partida, não só nos primeiros games.`,
    );
  }

  const swing = byKey.get('swing_fit');
  if (swing && swing.raw >= 75) {
    out.push(
      profile.natural_power_score >= 60
        ? `Como você já gera potência própria, escolhemos um frame mais contido: a potência que ` +
            `falta vem do seu swing, e o controle vem da raquete.`
        : `Este frame complementa a potência que seu swing ainda não entrega, ajudando a bola a ` +
            `chegar ao fundo da quadra com menos esforço.`,
    );
  }

  const objective = byKey.get('objective_fit');
  if (objective && objective.raw >= 75) {
    out.push('Ele caminha na direção do objetivo que você declarou.');
  }

  if (profile.arm_sensitivity_score >= 60) {
    out.push(
      `Pelo histórico de desconforto que você informou, tratamos o conforto como restrição, não ` +
        `como preferência: frames rígidos foram descartados antes mesmo da pontuação.`,
    );
  }

  const style = byKey.get('playstyle_fit');
  if (style && style.raw >= 75) {
    out.push(`As características do frame conversam com o estilo de jogo que você descreveu.`);
  }

  if (out.length === 0) {
    out.push(
      `Esta foi a raquete que apresentou maior compatibilidade com o perfil informado, ` +
        `considerando físico, nível técnico, swing, estilo e objetivo.`,
    );
  }

  // Honestidade sobre a base de dados (§62).
  if (attributes.data_completeness < 0.8) {
    out.push(
      `Vale registrar: ainda não temos todas as medições de laboratório verificadas para este ` +
        `modelo, então a análise usou os dados de catálogo do fabricante.`,
    );
  }

  if (variant.status === 'previous_generation') {
    out.push(
      'Este modelo é de geração anterior — costuma ser mais fácil de encontrar com bom preço, ' +
        'mas confirme a disponibilidade.',
    );
  }

  return out;
}

/** "O que você deve perceber?" (§35) */
export function explainExpectations(ranked: RankedRacket): string[] {
  const a = ranked.racket.attributes;
  const out: string[] = [];

  const describe = (label: string, score: number, high: string, low: string): void => {
    if (score >= 65) out.push(`**${label}:** ${high}`);
    else if (score <= 40) out.push(`**${label}:** ${low}`);
  };

  describe(
    'Potência',
    a.power_score,
    'o frame ajuda a bola a viajar; cuidado com o excesso nos primeiros treinos.',
    'a potência virá principalmente de você, não da raquete.',
  );
  describe(
    'Controle',
    a.control_score,
    'a bola deve ficar mais previsível quando você acelera.',
    'menos controle direcional, em troca de mais tolerância.',
  );
  describe(
    'Spin',
    a.spin_score,
    'facilidade para elevar a bola e produzir rotação com o mesmo gesto.',
    'trajetória mais plana; o spin dependerá mais da sua técnica.',
  );
  describe(
    'Conforto',
    a.comfort_score,
    'resposta mais macia no impacto.',
    'resposta mais direta e seca — acompanhe como seu braço reage.',
  );
  describe(
    'Estabilidade',
    a.stability_score,
    'firmeza contra bolas pesadas e em impactos descentralizados.',
    'pode ceder contra bolas muito pesadas.',
  );
  describe(
    'Manobrabilidade',
    a.maneuverability_score,
    'rápida de reposicionar em defesa e na rede.',
    'exige preparação mais cedo, especialmente em bolas rápidas.',
  );

  return out;
}

/** Explicação da corda (§36). */
export function explainString(rec: StringRecommendation): string[] {
  const out = [...rec.rationale];
  if (rec.gauge_note) out.push(rec.gauge_note);
  if (rec.variant.availability_warning) out.push(rec.variant.availability_warning);
  out.push(...rec.excluded_types);
  return out;
}

/** Explicação da tensão (§36) — mostra COMO chegamos ao número, sem fingir precisão. */
export function explainTension(tension: TensionRecommendation): string[] {
  const out: string[] = [];

  out.push(
    `Partimos de ${round(tension.base_lbs, 1)} lbs, ` +
      (tension.base_source === 'manufacturer_range'
        ? 'o ponto médio da faixa recomendada pelo fabricante para este frame,'
        : 'uma base conservadora (a faixa do fabricante ainda não foi confirmada para este modelo),') +
      ' e ajustamos a partir do seu perfil.',
  );

  // Os três ajustes de maior magnitude — o relatório completo aparece na auditoria.
  const top = [...tension.adjustments]
    .sort((a, b) => Math.abs(b.delta_lbs) - Math.abs(a.delta_lbs))
    .slice(0, 3);
  for (const adj of top) {
    out.push(`${adj.delta_lbs > 0 ? '+' : ''}${adj.delta_lbs} lbs — ${adj.rationale}`);
  }

  if (tension.anchored_to_current) {
    out.push(
      `Também consideramos a tensão que você usa hoje e o que você achou dela: essa é a ` +
        `evidência mais concreta disponível, e ela pesou ${Math.round(tension.anchor_weight * 100)}% no resultado.`,
    );
  }

  out.push(...tension.notes);
  out.push(tension.guidance);

  return out;
}

/** Explicação da combinação frame + corda + tensão (§36). */
export function explainCombination(
  ranked: RankedRacket,
  rec: StringRecommendation,
  tension: TensionRecommendation,
): string {
  const frame = ranked.racket.attributes;
  const isPowerful = frame.power_score >= 60;

  return (
    `O conjunto funciona porque as três peças se compensam. ` +
    (isPowerful
      ? `O frame entrega potência, então a corda e a tensão foram escolhidas para segurar a bola dentro da quadra. `
      : `O frame é mais contido, então a corda e a tensão trabalham para não tirar profundidade do seu jogo. `) +
    `Começar em ${formatTension(tension.lbs)} com ${rec.variant.model.brand} ` +
    `${rec.variant.model.model} ${rec.variant.variant.gauge_mm.toFixed(2)} mm dá um ponto de ` +
    `partida ajustável: encordoamento é o componente mais barato e mais reversível do setup, e é ` +
    `por ele que você deve calibrar antes de pensar em trocar de raquete novamente.`
  );
}

/** Comparação com a raquete atual (§22). */
export function explainTransition(transition: TransitionAnalysis): string[] {
  if (!transition.available) return [...transition.attention_points];
  return [...transition.expectations, ...transition.attention_points];
}

/** Texto de abertura do relatório (§64). */
export function explainHeadline(
  ranked: RankedRacket,
  hasTie: boolean,
): string {
  const base = `Esta foi a raquete com maior compatibilidade com o perfil que você informou.`;
  if (!hasTie) return base;
  return (
    base +
    ` Vale dizer com clareza: a segunda colocada ficou tecnicamente empatada com ela. ` +
    `Nesse caso a escolha é de preferência pessoal, e um teste em quadra resolve melhor que ` +
    `qualquer cálculo.`
  );
}

/** Comparação de conforto (§36) — sem linguagem clínica (§17). */
export function explainComfort(
  ranked: RankedRacket,
  profile: PlayerProfile,
  current: ScoredRacket | null,
): string[] {
  const out: string[] = [];
  const a = ranked.racket.attributes;

  if (profile.arm_sensitivity_score === 0) {
    out.push(
      'Você não relatou desconforto recorrente, então o conforto entrou na análise com peso ' +
        'padrão — sem descartar frames por rigidez.',
    );
  } else {
    out.push(
      `Você relatou desconforto em ${profile.discomfort_areas.join(', ')}. Isso elevou o peso do ` +
        `conforto na análise e excluiu frames rígidos e cordas de poliéster duras.`,
    );
    if (current && current.variant.specs.stiffness_ra !== null) {
      out.push('Compare também com a rigidez do seu equipamento atual antes de decidir.');
    }
  }

  if (a.arm_friendliness_score >= 65) {
    out.push('O frame recomendado está entre os mais amigáveis ao braço do catálogo avaliado.');
  }

  out.push(
    'Equipamento adequado ajuda, mas não substitui a avaliação de um profissional de saúde.',
  );

  return out;
}
