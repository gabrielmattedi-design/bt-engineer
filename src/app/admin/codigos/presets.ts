import type { Entitlement } from '@/payments/entitlements';

/**
 * Conjuntos de acesso oferecidos na criação do código.
 *
 * ─── POR QUE NÃO FICA EM `actions.ts` ────────────────────────────────────────────────────────
 *
 * Aquele arquivo é `'use server'`, e um módulo assim só pode exportar funções assíncronas: tudo o
 * que ele exporta vira um endpoint remoto, e um objeto não tem como ser um. O build falha com
 * "a 'use server' file can only export async functions" — depois de compilar com sucesso, na
 * etapa de coleta de configuração, que é onde é fácil não perceber.
 *
 * ─── POR QUE CONJUNTOS, E NÃO CAIXAS DE SELEÇÃO ──────────────────────────────────────────────
 *
 * A alternativa seria cinco caixas com os nomes internos dos entitlements. Elas dariam mais
 * liberdade e produziriam combinações sem sentido — um código que abre a 3ª colocada mas não a
 * 1ª. Os três conjuntos abaixo cobrem o que se quer de fato oferecer.
 */
export const ACCESS_PRESETS = {
  completo: {
    label: 'Acesso completo',
    description: 'Raquete, as três posições do pódio, corda e tensão.',
    grants: ['racket_report_access', 'rank2_access', 'rank3_access', 'full_setup_access'],
  },
  podio: {
    label: 'Raquete e pódio',
    description: 'As três posições, sem corda e tensão.',
    grants: ['racket_report_access', 'rank2_access', 'rank3_access'],
  },
  raquete: {
    label: 'Somente a raquete',
    description: 'O relatório da 1ª colocada, sem pódio nem setup.',
    grants: ['racket_report_access'],
  },
  /**
   * O quarto item não é um conjunto de acesso — é o OUTRO tipo de código.
   *
   * ═══ POR QUE ELE MORA NA MESMA LISTA ═════════════════════════════════════════════════════
   *
   * Porque a pergunta que o dono responde ao criar um código é uma só: "o que este código faz?".
   * Três respostas liberam alguma coisa e uma dá desconto. Separar em duas telas duplicaria o
   * campo de código, o de limite e o de anotação para uma diferença que cabe num item a mais.
   *
   * `grants` vazio não é descuido: um código de desconto não entrega NADA por si só. Quem digita
   * segue para o checkout e paga — menos.
   */
  desconto: {
    label: 'Desconto em %',
    description: 'Não libera nada: abate uma porcentagem do preço no checkout.',
    grants: [],
    percentual: true,
  },
} as const satisfies Record<
  string,
  {
    label: string;
    description: string;
    grants: readonly Entitlement[];
    percentual?: boolean;
  }
>;

export type AccessPresetKey = keyof typeof ACCESS_PRESETS;
