/**
 * Cobertura do catálogo por segmento de jogador.
 *
 * Um catálogo pode estar 100% verificado e ainda assim ser inadequado: se não existe nenhum frame
 * de cabeça grande e leve, o iniciante fraco recebe a MELHOR opção disponível, que ainda pode ser
 * uma opção ruim para ele. O motor não tem como saber disso — o fit score é relativo ao catálogo.
 *
 * Esta análise torna a lacuna visível antes de virar uma recomendação paga ruim (§62: "nunca tente
 * parecer mais inteligente do que os dados disponíveis").
 */

import { averageBeam, type RacketVariant } from '@/domain/racket';

export type SegmentRequirement = {
  readonly id: string;
  readonly label: string;
  readonly rationale: string;
  readonly matches: (v: RacketVariant) => boolean;
  readonly minCount: number;
};

export const SEGMENT_REQUIREMENTS: readonly SegmentRequirement[] = [
  {
    id: 'beginner_oversize_light',
    label: 'Iniciante — cabeça grande e leve',
    rationale:
      'Jogador com pouca força e swing lento precisa de área útil grande (≥ 103 sq in) COM massa ' +
      'baixa (≤ 285 g). Sem essa combinação, o motor é forçado a trocar tolerância por ' +
      'manobrabilidade, e nenhuma das duas opções serve bem.',
    matches: (v) =>
      (v.specs.head_size_sq_in ?? 0) >= 103 && (v.specs.unstrung_weight_g ?? 999) <= 285,
    minCount: 3,
  },
  {
    id: 'comfort_slim_beam',
    label: 'Conforto — perfil de quadro fino',
    rationale:
      'Jogadores com histórico de desconforto precisam de frames de perfil fino (≤ 22 mm médio), ' +
      'que na prática de mercado concentram os quadros mais flexíveis. Sem eles, o filtro de ' +
      'segurança (R-11) só pode agir pela corda e pela tensão, nunca pelo frame.',
    matches: (v) => {
      const beam = averageBeam(v.specs.beam_width_mm);
      return beam !== null && beam <= 22;
    },
    minCount: 3,
  },
  {
    id: 'control_dense_pattern',
    label: 'Controle — padrão denso 18×20',
    rationale: 'Jogador avançado que bate chapado e busca precisão precisa de padrão denso.',
    matches: (v) => v.specs.string_pattern_mains === 18,
    minCount: 2,
  },
  {
    id: 'advanced_heavy',
    label: 'Avançado — frame pesado',
    rationale: 'Jogador competitivo precisa de opções ≥ 310 g para estabilidade contra bolas pesadas.',
    matches: (v) => (v.specs.unstrung_weight_g ?? 0) >= 310,
    minCount: 2,
  },
  {
    id: 'spin_open_pattern',
    label: 'Spin — padrão aberto',
    rationale: 'Jogador de topspin pesado precisa de padrões 16×19 ou mais abertos.',
    matches: (v) => (v.specs.string_pattern_mains ?? 99) <= 16,
    minCount: 5,
  },
];

export type CoverageGap = {
  readonly id: string;
  readonly label: string;
  readonly found: number;
  readonly required: number;
  readonly rationale: string;
};

export function analyzeCoverage(catalog: readonly RacketVariant[]): {
  gaps: CoverageGap[];
  results: Array<{ id: string; label: string; found: number; required: number; ok: boolean }>;
} {
  const results = SEGMENT_REQUIREMENTS.map((req) => {
    const found = catalog.filter(req.matches).length;
    return {
      id: req.id,
      label: req.label,
      found,
      required: req.minCount,
      ok: found >= req.minCount,
    };
  });

  const gaps = results
    .filter((r) => !r.ok)
    .map((r) => {
      const req = SEGMENT_REQUIREMENTS.find((x) => x.id === r.id)!;
      return {
        id: r.id,
        label: r.label,
        found: r.found,
        required: r.required,
        rationale: req.rationale,
      };
    });

  return { gaps, results };
}
