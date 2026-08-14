/**
 * Filtros duros — docs/RECOMMENDATION_ENGINE.md §4.4.
 *
 * Aplicados ANTES da pontuação. Uma variante excluída aqui não aparece no pódio em hipótese alguma —
 * não é penalização, é exclusão. Cada exclusão é registrada com motivo, porque o admin precisa ver
 * por que uma raquete NÃO apareceu tanto quanto por que outra apareceu.
 */

import { MIN_DATA_COMPLETENESS } from '@/domain/reference-ranges';
import { hasRequiredSpecs, type ScoredRacket } from '@/domain/racket';
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

  // Segurança: nunca recomendar frame rígido a quem relata desconforto significativo.
  if (profile.arm_sensitivity_score >= 70 && (specs.stiffness_ra ?? 0) >= 68) {
    return {
      filter: 'arm_safety',
      reason: `Frame rígido (RA ${specs.stiffness_ra}) incompatível com o histórico de desconforto informado.`,
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
