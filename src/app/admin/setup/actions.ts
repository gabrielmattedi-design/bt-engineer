'use server';

import { revalidatePath } from 'next/cache';
import { isAuthenticated } from '../auth';
import { runMigrations, seedProducts, withAutoBootstrap } from '@/database/setup';
import { writeSetting } from '@/database/repositories/settings-repo';
import { SETTING_KEYS } from '@/database/schema';

export type SetupResult = { ok: string } | { error: string };

export async function prepareDatabase(_prev: unknown): Promise<SetupResult> {
  if (!(await isAuthenticated())) return { error: 'Sessão expirada. Entre novamente.' };

  try {
    await runMigrations();
    revalidatePath('/admin/setup');
    return { ok: 'Tabelas criadas com sucesso.' };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Falha ao criar as tabelas.',
    };
  }
}

export async function createProducts(_prev: unknown): Promise<SetupResult> {
  if (!(await isAuthenticated())) return { error: 'Sessão expirada. Entre novamente.' };

  try {
    const count = await seedProducts();
    revalidatePath('/admin/setup');
    return { ok: `${count} produtos disponíveis.` };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Falha ao criar os produtos.',
    };
  }
}

/**
 * Liga ou desliga o modo de pagamento simulado.
 *
 * ─── POR QUE ESTA AÇÃO PODE EXISTIR ──────────────────────────────────────────────────────────
 *
 * Ela habilita um provedor que concede acesso sem cobrar, então merece ser olhada de perto. Três
 * coisas a mantêm segura:
 *
 *   1. exige sessão de admin — mesma barreira que já protege a curadoria do catálogo;
 *   2. não alcança gateway real: se `PAYMENT_PROVIDER` apontar para um provedor de verdade, o
 *      adapter simulado sequer é construído, e este interruptor não o traz de volta;
 *   3. é ruidosa — enquanto ligada, TODA página do site exibe o aviso de que nada está sendo
 *      cobrado, sem opção de fechar.
 *
 * O risco que ela remove é maior que o que adiciona: a alternativa era o dono do produto sem
 * conseguir percorrer o próprio funil, e uma trava que o dono legítimo não destrava não protege o
 * produto — impede o produto.
 */
export async function setSimulatedPayments(formData: FormData): Promise<void> {
  if (!(await isAuthenticated())) return;

  // Só "true" liga. Qualquer outra coisa desliga — inclusive um campo ausente ou adulterado.
  const enabled = String(formData.get('enabled') ?? '') === 'true';

  await withAutoBootstrap(() =>
    writeSetting(SETTING_KEYS.simulatedPayments, enabled ? 'true' : 'false'),
  );

  // A home e o aviso do topo leem esta configuração; sem invalidar, o botão mudaria e o site não.
  revalidatePath('/', 'layout');
  revalidatePath('/admin/setup');
}
