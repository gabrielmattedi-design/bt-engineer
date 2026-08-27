import 'server-only';
import { cookies } from 'next/headers';
import { newSessionToken } from '@/database/repositories/session-repo';

/**
 * Token anônimo do visitante — §57: nenhum cadastro é exigido antes do resultado.
 *
 * É um identificador opaco, sem nada sobre a pessoa. No banco guardamos apenas o SHA-256 dele, de
 * modo que um vazamento não permita se passar por ninguém (LGPD, §51).
 *
 * ═══ POR QUE ISTO SAIU DE `actions.ts` ═══════════════════════════════════════════════════════
 *
 * Passou a ter DOIS consumidores: a gravação da análise e os marcos do funil. Com uma cópia em
 * cada lugar, bastava alguém ajustar o `maxAge` de um lado para o funil e a análise passarem a
 * enxergar visitantes diferentes — e o sintoma seria uma taxa de conversão errada, que ninguém
 * associaria a uma configuração de cookie.
 */
export const VISITOR_COOKIE = 'te_visitor';

/** Lê o token; cria e grava um novo quando ainda não existe. */
export async function visitorToken(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(VISITOR_COOKIE)?.value;
  if (existing) return existing;

  const token = newSessionToken();
  jar.set(VISITOR_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 180,
  });
  return token;
}

/**
 * Lê o token SEM criar.
 *
 * Para quem só quer registrar algo se o visitante já existir — criar o identificador ali daria
 * cookie a quem a página apenas renderizou, e não a quem agiu.
 */
export async function existingVisitorToken(): Promise<string | null> {
  return (await cookies()).get(VISITOR_COOKIE)?.value ?? null;
}
