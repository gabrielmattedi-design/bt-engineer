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
} as const satisfies Record<
  string,
  { label: string; description: string; grants: readonly Entitlement[] }
>;

export type AccessPresetKey = keyof typeof ACCESS_PRESETS;
