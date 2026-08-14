/**
 * Filtros duros — docs/RECOMMENDATION_ENGINE.md §4.4.
 *
 * Aplicados ANTES da pontuação. Uma variante excluída aqui não aparece no pódio em hipótese alguma —
 * não é penalização, é exclusão. Cada exclusão é registrada com motivo, porque o admin precisa ver
 * por que uma raquete NÃO apareceu tanto quanto por que outra apareceu.
 */

import {
  MIN_DATA_COMPLETENESS,
  VERY_STIFF_BEAM_THRESHOLD_MM,
} from '@/domain/reference-ranges';
import { hasRequiredSpecs, type ScoredRacket } from '@/domain/racket';
import { parseBeamAverage } from '@/recommendation/normalize/racket-attributes';
import { isRecommendable } from '@/domain/sourced';
import type { PlayerProfile } from '@/domain/player-profile';
import type { ExcludedRacket } from '@/domain/recommendation';

export type FilterMode = 'strict' | 'permissive';

/**
 * Retorna o motivo da exclusão, ou `null` se a variante passa.
 *
 * O filtro de segurança (RA alto + sensibilidade alta) é o único que existe por razão física e não
 * por razão de desempenho — ver docs/00_RISKS_AND_DECISIONS.md#r-11.
 */
export function excludeReason(
  racket: ScoredRacket,
  profile: PlayerProfile,
  mode: FilterMode,
): { filter: string; reason: string } | null {
  const { variant, attributes } = racket;
  const specs = variant.specs;

  if (!hasRequiredSpecs(specs)) {
    return {
      filter: 'missing_required_specs',
      reason:
        'Faltam especificações obrigatórias (tamanho de cabeça, peso ou padrão de cordas). ' +
        'Não recomendamos com dados incompletos.',
    };
  }

  const isCurrentRacket = profile.current_racket?.variant_id === variant.id;

  if (
    !isRecommendable(
      {
        verification_state: variant.verification_state,
        status: variant.status,
        brazil_availability_status: variant.brazil_availability_status,
      },
      mode,
    ) &&
    !isCurrentRacket
  ) {
    if (variant.status === 'discontinued') {
      return { filter: 'discontinued', reason: 'Modelo descontinuado.' };
    }
    if (variant.brazil_availability_status === 'not_found') {
      return {
        filter: 'not_available_in_brazil',
        reason:
          'Não encontrada no mercado brasileiro. Um setup tecnicamente perfeito, mas inexistente, ' +
          'é uma recomendação errada.',
      };
    }
    return {
      filter: 'not_verified',
      reason: 'Dados ainda não verificados contra a fonte oficial.',
    };
  }

  // ── Segurança para o braço (R-11) ────────────────────────────────────────────────────────
  //
  // Na v2 esta é a camada MAIS FRACA da proteção, e isso é deliberado: o perfil da viga é um
  // proxy publicado de rigidez, não uma medição, e tem exceções conhecidas (Wilson Clash tem
  // viga larga e é flexível). Por isso aqui só excluímos os casos mais claros — viga muito
  // larga somada a sensibilidade alta — e o trabalho pesado fica com as duas camadas
  // realmente confiáveis, que não dependem deste proxy:
  //
  //   • corda:  poliéster é EXCLUÍDO por regra dura em `excludedStringTypes()`
  //   • tensão: reduzida proporcionalmente à sensibilidade em `computeTension()`
  //
  // A faixa intermediária vira penalização graduada em `penalties.ts` (P3), não exclusão.
  const beam = parseBeamAverage(specs);
  if (profile.arm_sensitivity_score >= 70 && beam !== null && beam >= VERY_STIFF_BEAM_THRESHOLD_MM) {
    return {
      filter: 'arm_safety',
      reason:
        `Quadro de perfil muito largo (${beam.toFixed(1)} mm), tipicamente mais rígido, ` +
        'incompatível com o histórico de desconforto informado.',
    };
  }

  // Frames não adultos ficam fora do universo da v1.
  if (specs.length_in !== null && specs.length_in < 27) {
    return { filter: 'not_adult_frame', reason: 'Frame fora do padrão adulto (comprimento < 27").' };
  }
  if (specs.head_size_sq_in !== null && specs.head_size_sq_in > 118) {
    return {
      filter: 'not_adult_frame',
      reason: 'Cabeça acima de 118 sq in — fora do universo de frames adultos da v1.',
    };
  }

  if (attributes.data_completeness < MIN_DATA_COMPLETENESS) {
    return {
      filter: 'insufficient_data',
      reason: `Completude de dados ${(attributes.data_completeness * 100).toFixed(0)}% — abaixo do mínimo para uma recomendação paga.`,
    };
  }

  return null;
}

export function applyHardFilters(
  rackets: readonly ScoredRacket[],
  profile: PlayerProfile,
  mode: FilterMode,
): { kept: ScoredRacket[]; excluded: ExcludedRacket[] } {
  const kept: ScoredRacket[] = [];
  const excluded: ExcludedRacket[] = [];

  for (const racket of rackets) {
    const reason = excludeReason(racket, profile, mode);
    if (reason === null) {
      kept.push(racket);
    } else {
      excluded.push({
        variant_id: racket.variant.id,
        product_name: racket.variant.product_name,
        filter: reason.filter,
        reason: reason.reason,
      });
    }
  }

  return { kept, excluded };
}
