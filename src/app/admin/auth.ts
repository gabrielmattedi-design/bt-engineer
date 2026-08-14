import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Autenticação do admin — versão mínima e honesta.
 *
 * O ADMIN_SPEC §1 pede Supabase Auth com allowlist. Isto NÃO é aquilo, e a diferença importa: aqui
 * há uma senha única compartilhada, sem papéis (`curator` / `admin`), sem `changed_by` por usuário.
 * É suficiente para a fase de curadoria, em que uma ou duas pessoas de confiança trabalham no
 * catálogo, e é substituível sem tocar em nenhuma página — só `requireAdmin()` muda.
 *
 * O que ela NÃO é: adequada para uma equipe. No momento em que houver mais de dois curadores, ou
 * qualquer necessidade de auditar quem mudou o quê, isto precisa virar autenticação real.
 *
 * O cookie é assinado com HMAC para que não baste inventar `admin=1` no navegador.
 */

const COOKIE = 'te_admin';

function secret(): string {
  const value = process.env.ADMIN_PASSWORD;
  if (!value || value.length < 8) {
    throw new Error(
      'ADMIN_PASSWORD não configurada (mínimo 8 caracteres). O painel de administração fica ' +
        'indisponível até que ela exista — nunca com uma senha padrão.',
    );
  }
  return value;
}

function tokenFor(password: string): string {
  return createHmac('sha256', password).update('tennis-engineer-admin-v1').digest('hex');
}

export function isAdminConfigured(): boolean {
  const value = process.env.ADMIN_PASSWORD;
  return !!value && value.length >= 8;
}

export function verifyPassword(candidate: string): boolean {
  const expected = Buffer.from(secret());
  const given = Buffer.from(candidate);
  // Comprimentos diferentes vazariam informação por tempo de resposta em uma comparação ingênua.
  if (expected.length !== given.length) return false;
  return timingSafeEqual(expected, given);
}

export function sessionToken(): string {
  return tokenFor(secret());
}

export async function isAuthenticated(): Promise<boolean> {
  if (!isAdminConfigured()) return false;
  const jar = await cookies();
  const value = jar.get(COOKIE)?.value;
  if (!value) return false;

  const expected = Buffer.from(sessionToken());
  const given = Buffer.from(value);
  if (expected.length !== given.length) return false;
  return timingSafeEqual(expected, given);
}

export const ADMIN_COOKIE = COOKIE;
