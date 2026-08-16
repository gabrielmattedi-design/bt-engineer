import { TENSION_BOUNDS_LBS } from '@/domain/reference-ranges';
import type { RacketVariant } from '@/domain/racket';
import type { StringModel, StringVariant } from '@/domain/string';

/**
 * Tamanho REAL do espaço de busca do motor: raquete × corda × espessura × tensão.
 *
 * ─── POR QUE CALCULADO E NÃO ESCRITO ─────────────────────────────────────────────────────────
 *
 * A home dizia "Milhares de combinações possíveis". Número redondo escrito à mão é a forma mais
 * fácil de uma página institucional começar a mentir: o catálogo cresce, o texto fica parado, e
 * ninguém percebe porque nada quebra. Este módulo deriva a conta do catálogo que está no ar, de
 * modo que a afirmação da capa não pode divergir do produto.
 *
 * ─── O QUE CONTA COMO COMBINAÇÃO ─────────────────────────────────────────────────────────────
 *
 * Uma combinação é um SETUP que o motor pode efetivamente recomendar:
 *
 *   • uma variante de raquete,
 *   • uma variante de corda (modelo + espessura — 1.25 e 1.30 da mesma corda jogam diferente),
 *   • uma tensão inteira em libras, dentro do que é fisicamente admissível para aquele par.
 *
 * A faixa de tensão é a INTERSEÇÃO entre o que o fabricante da raquete publica e o que o tipo de
 * corda suporta: poliéster a 62 lbs não é uma opção, é uma lesão. Contar o produto cartesiano
 * cheio inflaria o número com setups que o motor jamais devolveria — seria propaganda, não conta.
 *
 * Meias-libras existem no encordoamento real, mas contá-las dobraria o total sem acrescentar
 * escolha significativa. Fica na libra inteira, que é o passo em que o motor recomenda.
 */
export function countSetupCombinations(
  rackets: readonly RacketVariant[],
  strings: { readonly models: readonly StringModel[]; readonly variants: readonly StringVariant[] },
): number {
  const typeByModel = new Map(strings.models.map((m) => [m.id, m.string_type]));
  let total = 0;

  for (const racket of rackets) {
    for (const variant of strings.variants) {
      const type = typeByModel.get(variant.string_id);
      if (!type) continue;

      const bounds = TENSION_BOUNDS_LBS[type];
      const lo = Math.max(racket.specs.recommended_tension_min_lbs ?? bounds[0], bounds[0]);
      const hi = Math.min(racket.specs.recommended_tension_max_lbs ?? bounds[1], bounds[1]);

      const steps = Math.floor(hi) - Math.ceil(lo) + 1;
      if (steps > 0) total += steps;
    }
  }

  return total;
}

/**
 * Arredonda PARA BAIXO ao milhar, para uso com "mais de".
 *
 * Arredondar para cima transformaria "mais de" em promessa falsa por até 999 unidades. Para baixo,
 * a frase continua verdadeira mesmo que alguém confira a conta — que é o único arredondamento que
 * um produto vendido como técnico pode usar.
 */
export function roundDownToThousand(value: number): number {
  return Math.floor(value / 1000) * 1000;
}

/** "17 mil" — formato curto em português, para a capa. */
export function formatThousands(value: number): string {
  return `${roundDownToThousand(value) / 1000} mil`;
}
