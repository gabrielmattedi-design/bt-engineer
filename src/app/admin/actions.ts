'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { ADMIN_COOKIE, isAuthenticated, sessionToken, verifyPassword } from './auth';
import { canMarkVerified, writeRacketVerification } from '@/data/write-verification';
import { loadRacketCatalog, type RacketVerification } from '@/data/load';

export async function login(_prev: unknown, formData: FormData): Promise<{ error: string } | void> {
  const password = String(formData.get('password') ?? '');
  if (!verifyPassword(password)) return { error: 'Senha incorreta.' };

  const jar = await cookies();
  jar.set(ADMIN_COOKIE, sessionToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/admin',
    maxAge: 60 * 60 * 8, // 8 h, como no ADMIN_SPEC §1
  });
  redirect('/admin/setup');
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
  redirect('/admin');
}

const formSchema = z.object({
  product_name: z.string().min(1),
  state: z.enum(['pending_verification', 'verified', 'disputed']),
  source_url: z.string().trim().url().or(z.literal('')),
  cross_check_url: z.string().trim().url().or(z.literal('')),
  brazil_availability_status: z.enum([
    'widely_available',
    'available',
    'limited',
    'not_found',
    'unknown',
  ]),
  brazil_sources: z.string(),
  image_url: z.string().trim().url().or(z.literal('')),
  image_verified: z.string().optional(),
  notes: z.string(),
});

export async function saveVerification(
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string } | { ok: true; product_name: string }> {
  // A autenticação é revalidada AQUI, e não apenas na página: uma Server Action é um endpoint HTTP
  // e pode ser chamada diretamente, sem passar por nenhuma renderização.
  if (!(await isAuthenticated())) return { error: 'Sessão expirada. Entre novamente.' };

  const parsed = formSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'Formulário inválido.' };
  const data = parsed.data;

  const variant = loadRacketCatalog().find((r) => r.product_name === data.product_name);
  if (!variant) return { error: 'Variante não encontrada.' };

  const verification: RacketVerification = {
    state: data.state,
    verified_at: data.state === 'verified' ? new Date().toISOString().slice(0, 10) : null,
    verified_by: 'curador',
    source_url: data.source_url || null,
    cross_check_url: data.cross_check_url || null,
    brazil_availability_status: data.brazil_availability_status,
    brazil_sources: data.brazil_sources
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter((s) => s.startsWith('http')),
    image_url: data.image_url || null,
    image_verified: data.image_verified === 'on',
    notes: data.notes.trim() || null,
  };

  const gate = canMarkVerified(verification);
  if (!gate.ok) return { error: gate.reason };

  try {
    writeRacketVerification(variant.brand, variant.product_name, verification);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Falha ao gravar.' };
  }

  revalidatePath('/admin/verificacao');
  return { ok: true, product_name: variant.product_name };
}
