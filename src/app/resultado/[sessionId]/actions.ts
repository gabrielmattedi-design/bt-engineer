'use server';

import { revalidatePath } from 'next/cache';
import { chooseSetupVariant } from '@/database/repositories/session-repo';
import { grantedEntitlements } from '@/database/repositories/session-repo';
import { hasEntitlement } from '@/payments/entitlements';
import { withAutoBootstrap } from '@/database/setup';

/**
 * Escolhe para qual raquete do pódio o setup de corda e tensão deve ser calculado.
 *
 * ─── DUAS VERIFICAÇÕES, NENHUMA DELAS NO CLIENTE ─────────────────────────────────────────────
 *
 * 1. O jogador precisa ter `full_setup_access`. Sem isso a escolha não é dele para fazer, e
 *    permitir gravá-la deixaria o estado do relatório sob controle de quem não pagou.
 *
 * 2. A variante precisa estar NO PÓDIO daquela análise — verificado dentro de
 *    `chooseSetupVariant`. Sem essa checagem, bastaria mandar o id de qualquer raquete do catálogo
 *    para receber corda e tensão de um produto que nunca foi recomendado, contornando o pódio e o
 *    desbloqueio das posições.
 */
export async function selectSetupRacket(formData: FormData): Promise<void> {
  const sessionId = String(formData.get('session_id') ?? '');
  const variantId = String(formData.get('variant_id') ?? '');
  if (!sessionId || !variantId) return;

  const granted = await withAutoBootstrap(() => grantedEntitlements(sessionId));
  if (!hasEntitlement(granted, 'full_setup_access')) return;

  await chooseSetupVariant(sessionId, variantId);
  revalidatePath(`/resultado/${sessionId}`);
}
