import 'server-only';

import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Sessão de quem entrou pelo link de e-mail.
 *
 * ═══ POR QUE COOKIE ASSINADO, E NÃO UMA TABELA DE SESSÕES ════════════════════════════════════
 *
 * Uma tabela daria revogação imediata — e cobraria uma consulta ao banco em toda navegação de toda
 * página, para um produto cuja área logada é uma lista de dois ou três relatórios. O cookie
 * assinado carrega a identidade consigo e não consulta nada.
 *
 * A revogação que se perde é aceitável aqui pelo que está em jogo: a sessão dá acesso à lista de
 * análises que a pessoa comprou. Não move dinheiro, não muda cadastro, não apaga nada. Se um dia
 * der, a troca se reavalia.
 *
 * ═══ ASSINATURA, NÃO CRIPTOGRAFIA ════════════════════════════════════════════════════════════
 *
 * O conteúdo (id e e-mail) é legível por quem abrir o próprio cookie — e tudo bem, é o e-mail da
 * própria pessoa. O que a assinatura impede é ALTERAR: trocar o id por outro e ler as análises de
 * um terceiro. Sem `AUTH_SECRET` correta, o HMAC não fecha e o cookie é descartado.
 *
 * ═══ SEM `AUTH_SECRET`, NINGUÉM ENTRA ════════════════════════════════════════════════════════
 *
 * Não há valor padrão. Um segredo padrão seria público — está no repositório —, e qualquer pessoa
 * forjaria um cookie válido para qualquer conta. Falhar fechado é a única opção defensável: sem a
 * variável, o login simplesmente não funciona, e isso aparece na hora.
 */

const COOKIE = 'te_user';

/** 30 dias. O suficiente para voltar sem repetir o e-mail, curto para um aparelho emprestado. */
const MAX_AGE = 60 * 60 * 24 * 30;

export type UserSession = { readonly userId: string; readonly email: string };

export function authConfigured(): boolean {
  const value = process.env.AUTH_SECRET;
  return Boolean(value && value.length >= 32);
}

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    throw new Error(
      'AUTH_SECRET não configurada (mínimo 32 caracteres). O acesso por e-mail fica indisponível ' +
        'até que ela exista — nunca com um segredo padrão, que seria público.',
    );
  }
  return value;
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

/**
 * Compara assinaturas em tempo constante.
 *
 * Uma comparação ingênua (`a === b`) devolve mais rápido quanto antes surgir o primeiro byte
 * diferente. Medindo esse tempo repetidas vezes, dá para descobrir a assinatura byte a byte, sem
 * jamais conhecer o segredo.
 */
function sameSignature(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

export async function startUserSession(session: UserSession): Promise<void> {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  const jar = await cookies();

  jar.set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function endUserSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export async function currentUser(): Promise<UserSession | null> {
  if (!authConfigured()) return null;

  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;

  const cut = raw.lastIndexOf('.');
  if (cut <= 0) return null;

  const payload = raw.slice(0, cut);
  if (!sameSignature(raw.slice(cut + 1), sign(payload))) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as UserSession;
    // Assinado não é o mesmo que bem formado — um cookie antigo pode ter outro formato.
    return parsed.userId && parsed.email ? parsed : null;
  } catch {
    return null;
  }
}
