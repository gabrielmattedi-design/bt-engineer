'use server';

import { revalidatePath } from 'next/cache';
import { isAuthenticated } from '../auth';
import { setCouponActive, upsertCoupon } from '@/database/repositories/coupon-repo';
import { withAutoBootstrap } from '@/database/setup';
import type { Entitlement } from '@/payments/entitlements';

/**
 * Conjuntos de acesso oferecidos na criação do código.
 *
 * A alternativa seria cinco caixas de seleção com os nomes internos dos entitlements. Elas dariam
 * mais liberdade e produziriam combinações sem sentido — um código que abre a 3ª colocada mas não
 * a 1ª, por exemplo. Os três conjuntos abaixo cobrem o que se quer de fato oferecer.
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

export type CodeResult = { ok: string } | { error: string };

export async function createCode(_prev: unknown, formData: FormData): Promise<CodeResult> {
  if (!(await isAuthenticated())) return { error: 'Sessão expirada. Entre novamente.' };

  const code = String(formData.get('code') ?? '').trim();
  if (!/^[A-Za-z0-9_-]{3,32}$/.test(code)) {
    return { error: 'Use de 3 a 32 caracteres: letras, números, hífen ou sublinhado.' };
  }

  const preset = ACCESS_PRESETS[String(formData.get('preset') ?? '') as keyof typeof ACCESS_PRESETS];
  if (!preset) return { error: 'Escolha o que o código libera.' };

  /**
   * Campo vazio significa ILIMITADO, e isso é deliberado.
   *
   * O contrário — vazio virar zero — criaria um código nascido morto, e o dono só descobriria ao
   * ver alguém reclamar que não funciona. Entre os dois erros possíveis, "ilimitado por engano" é
   * visível na listagem e reversível num clique.
   */
  const rawLimit = String(formData.get('max_uses') ?? '').trim();
  const maxUses = rawLimit === '' ? null : Number.parseInt(rawLimit, 10);
  if (maxUses !== null && (!Number.isFinite(maxUses) || maxUses < 1)) {
    return { error: 'O limite precisa ser um número maior que zero, ou ficar em branco.' };
  }

  const note = String(formData.get('note') ?? '').trim() || null;

  try {
    await withAutoBootstrap(() => upsertCoupon({ code, grants: preset.grants, maxUses, note }));
    revalidatePath('/admin/codigos');
    return {
      ok: `Código ${code.toUpperCase()} salvo — ${preset.label.toLowerCase()}, ${
        maxUses === null ? 'usos ilimitados' : `${maxUses} usos`
      }.`,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Falha ao salvar o código.' };
  }
}

export async function toggleCode(formData: FormData): Promise<void> {
  if (!(await isAuthenticated())) return;

  const code = String(formData.get('code') ?? '');
  const active = String(formData.get('active') ?? '') === 'true';

  await withAutoBootstrap(() => setCouponActive(code, active));
  revalidatePath('/admin/codigos');
}
