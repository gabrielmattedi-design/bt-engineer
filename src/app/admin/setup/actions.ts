'use server';

import { revalidatePath } from 'next/cache';
import { isAuthenticated } from '../auth';
import { runMigrations, seedProducts } from '@/database/setup';

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
