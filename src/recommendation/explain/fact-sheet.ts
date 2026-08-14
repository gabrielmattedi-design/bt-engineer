/**
 * `FactSheet` — o conjunto FECHADO de fatos que a IA pode citar (R-03).
 *
 * §4 proíbe a IA de inventar peso, swingweight, rigidez, padrão de cordas, tensão ou
 * características de um produto. Mas a IA precisa escrever as explicações, e explicações contêm
 * números — então a proibição não pode ser apenas uma instrução no prompt.
 *
 * A solução é estrutural: a IA recebe este objeto, com os números JÁ FORMATADOS COMO STRING, e a
 * instrução de citar apenas o que está aqui. Depois, `guard.ts` verifica cada numeral do texto
 * gerado contra esta lista. Qualquer número não autorizado invalida a explicação.
 */

import { formatTension } from '@/domain/units';
import { averageBeam, type ScoredRacket } from '@/domain/racket';
import type { PlayerProfile } from '@/domain/player-profile';
import type {
  RankedRacket,
  StringRecommendation,
  TensionRecommendation,
} from '@/domain/recommendation';
import { humanizeMissingFields } from '@/recommendation/normalize/racket-attributes';

export type Fact = {
  readonly label: string;
  /** Já formatado para exibição. A IA copia esta string; ela não recalcula nada. */
  readonly value: string;
};

export type FactSheet = {
  readonly product_name: string;
  readonly facts: readonly Fact[];
  /** Frases sobre o perfil, sem números — contexto qualitativo para a redação. */
  readonly profile_notes: readonly string[];
  /** Pontos de atenção que DEVEM aparecer no texto (§35). */
  readonly attention_points: readonly string[];
  /** Campos sem medição verificada — a IA deve dizer que não sabemos, não inventar. */
  readonly unknown_fields: readonly string[];
};

function specFact(label: string, value: number | null, unit: string): Fact | null {
  if (value === null) return null;
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return { label, value: unit ? `${formatted} ${unit}` : formatted };
}

/** Índices Tennis Engineer são exibidos em passos de 5 para não sugerir precisão que não temos (R-04). */
function indexFact(label: string, score: number): Fact {
  return { label, value: String(Math.round(score / 5) * 5) };
}

export function buildRacketFactSheet(
  ranked: RankedRacket,
  profile: PlayerProfile,
  current: ScoredRacket | null,
): FactSheet {
  const { variant, attributes } = ranked.racket;
  const specs = variant.specs;

  const facts: Fact[] = [
    { label: 'Compatibilidade', value: `${Math.round(ranked.fit_score)}%` },
    { label: 'Marca', value: variant.brand },
    { label: 'Modelo', value: variant.product_name },
  ];

  const specFacts = [
    specFact('Tamanho da cabeça', specs.head_size_sq_in, 'sq in'),
    specFact('Peso (não encordoada)', specs.unstrung_weight_g, 'g'),
    specFact('Balanço', specs.balance_mm, 'mm'),
    specFact('Perfil do quadro (médio)', averageBeam(specs.beam_width_mm), 'mm'),
  ].filter((f): f is Fact => f !== null);
  facts.push(...specFacts);

  // Índices derivados: passos de 5, e nomeados de modo que não se confundam com medições de
  // laboratório. A IA só pode citar estes números — nunca "swingweight" ou "RA".
  facts.push(indexFact('Índice de inércia de swing', attributes.swing_index));
  facts.push(indexFact('Índice de rigidez do quadro', attributes.stiffness_index));

  if (specs.string_pattern_mains !== null && specs.string_pattern_crosses !== null) {
    facts.push({
      label: 'Padrão de cordas',
      value: `${specs.string_pattern_mains}×${specs.string_pattern_crosses}`,
    });
  }

  facts.push(
    indexFact('Índice de potência', attributes.power_score),
    indexFact('Índice de controle', attributes.control_score),
    indexFact('Índice de spin', attributes.spin_score),
    indexFact('Índice de conforto', attributes.comfort_score),
    indexFact('Índice de estabilidade', attributes.stability_score),
    indexFact('Índice de manobrabilidade', attributes.maneuverability_score),
  );

  if (current) {
    const currentWeight = current.variant.specs.unstrung_weight_g;
    if (currentWeight !== null) {
      facts.push({ label: 'Peso da raquete atual', value: `${currentWeight} g` });
    }
    facts.push({ label: 'Raquete atual', value: current.variant.product_name });
  }

  const profileNotes: string[] = [];
  if (profile.arm_sensitivity_score >= 60) {
    profileNotes.push('O jogador relatou histórico de desconforto e priorizou conforto.');
  }
  if (profile.swing_length === 'long') profileNotes.push('O swing declarado é longo.');
  if (profile.swing_length === 'short') profileNotes.push('O swing declarado é curto.');
  if (profile.objectives.includes('maximize_current')) {
    profileNotes.push('O jogador quer potencializar o jogo atual, não mudá-lo.');
  }

  return {
    product_name: variant.product_name,
    facts,
    profile_notes: profileNotes,
    attention_points: ranked.breakdown.penalties.map((p) => p.reason),
    unknown_fields: attributes.missing_fields.length
      ? [humanizeMissingFields(attributes.missing_fields)]
      : [],
  };
}

export function buildSetupFactSheet(
  stringRec: StringRecommendation,
  tension: TensionRecommendation,
): FactSheet {
  const { model, variant } = stringRec.variant;

  const facts: Fact[] = [
    { label: 'Marca da corda', value: model.brand },
    { label: 'Modelo da corda', value: model.model },
    { label: 'Espessura', value: `${variant.gauge_mm.toFixed(2)} mm` },
    { label: 'Tensão recomendada', value: formatTension(tension.lbs) },
    {
      label: 'Faixa de tensão',
      value: `${tension.range_lbs[0]}–${tension.range_lbs[1]} lbs`,
    },
  ];

  if (tension.mains_lbs !== null && tension.crosses_lbs !== null) {
    facts.push(
      { label: 'Tensão das mains', value: `${tension.mains_lbs} lbs` },
      { label: 'Tensão das crosses', value: `${tension.crosses_lbs} lbs` },
    );
  }

  return {
    product_name: `${model.brand} ${model.model}`,
    facts,
    profile_notes: stringRec.rationale,
    attention_points: stringRec.variant.availability_warning
      ? [stringRec.variant.availability_warning]
      : [],
    unknown_fields: tension.base_source === 'fallback'
      ? ['faixa de tensão recomendada pelo fabricante']
      : [],
  };
}
