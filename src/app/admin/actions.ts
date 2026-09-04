'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { ADMIN_COOKIE, isAuthenticated, sessionToken, verifyPassword } from './auth';
import { canMarkVerified, writeRacketVerification } from '@/data/write-verification';
import { loadRacketCatalog, type RacketVerification } from '@/data/load';
import {
  contarTentativa,
  limparTentativas,
  LIMITE_JANELA_MINUTOS,
} from '@/database/repositories/throttle-repo';
import { withAutoBootstrap } from '@/database/setup';
import {
  removerJornadasDeCupomDoFunil,
  removerRelatoriosSemPagamento,
  resetFunnel,
} from '@/database/repositories/funnel-repo';

/**
 * Quantos palpites de senha cabem numa janela de 15 minutos.
 *
 * ═══ POR QUE ESTE NÚMERO ═════════════════════════════════════════════════════════════════════
 *
 * Dez é generoso para quem esqueceu a senha e sovina para quem está adivinhando. A conta que
 * importa não é o conforto: sem limite nenhum, uma lista de senhas comuns roda inteira em minutos,
 * e acertar aqui não dá "uma conta" — dá o painel, que cria cupom de acesso total, mexe no modo de
 * pagamento e roda migração no banco. É o caminho mais curto entre um desconhecido e o controle do
 * produto.
 *
 * Com dez por 15 minutos, a mesma lista levaria anos.
 *
 * ─── O TETO É GLOBAL, E O CUSTO DISSO É CONHECIDO ────────────────────────────────────────────
 *
 * A chave é a porta, não quem bate: este produto não guarda IP, e passar a guardar só para contar
 * tentativa contradiria a política de privacidade. A consequência aceita é que uma rajada de
 * ataque tranca o dono junto, por até 15 minutos. Para um painel usado algumas vezes por semana,
 * esse é o lado barato da troca.
 */
const MAX_TENTATIVAS_LOGIN = 10;
const ESCOPO_LOGIN = 'admin-login';

export async function login(_prev: unknown, formData: FormData): Promise<{ error: string } | void> {
  const password = String(formData.get('password') ?? '');

  /*
    A contagem vem ANTES da verificação, de propósito.

    Contar só os erros abriria um caminho: quem conhecesse a senha certa poderia intercalá-la entre
    palpites para zerar a conta. E medir antes também evita que o tempo de resposta diferencie
    "senha errada" de "bloqueado" — os dois caminhos custam a mesma ida ao banco.
  */
  const veredito = await withAutoBootstrap(() =>
    contarTentativa(ESCOPO_LOGIN, MAX_TENTATIVAS_LOGIN),
  );

  if (!veredito.permitido) {
    return {
      error: `Muitas tentativas. Aguarde ${LIMITE_JANELA_MINUTOS} minutos e tente de novo.`,
    };
  }

  if (!verifyPassword(password)) {
    /*
      A mensagem não diz quantas tentativas sobraram.

      Um contador visível é informação para quem está atacando — ele aprende o tamanho da janela e
      o ritmo exato que passa despercebido. Quem errou a própria senha tenta de novo e pronto.
    */
    return { error: 'Senha incorreta.' };
  }

  // Acertou: a janela é liberada, para que um engano honesto de manhã não atrapalhe à tarde.
  await limparTentativas(ESCOPO_LOGIN);

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

/**
 * A palavra que precisa ser digitada para zerar a medição.
 *
 * Um clique num botão vermelho é uma questão de tempo até acontecer sem querer, e este é o tipo de
 * estrago que não aparece na hora: o painel volta a mostrar zeros, o que é exatamente o esperado
 * logo depois de zerar de propósito. Ninguém desconfia. A falta só aparece semanas depois, quando
 * alguém procura a comparação com o período anterior e ela não existe mais.
 *
 * A palavra é em português e é a própria ação. Não é senha — é atrito deliberado, o suficiente
 * para que o dedo não faça sozinho o que a cabeça não decidiu.
 */
const CONFIRMACAO_ZERAR = 'ZERAR';

/**
 * Zera o funil e as origens de tráfego — ver `resetFunnel` para o que sai e o que fica.
 *
 * A autenticação é revalidada AQUI e não só na página, pelo mesmo motivo de `saveVerification`:
 * uma Server Action é um endpoint HTTP e pode ser chamada direto, sem passar por renderização
 * nenhuma. Numa ação destrutiva, a diferença entre conferir na tela e conferir aqui é a diferença
 * entre uma proteção e a aparência de uma.
 */
export async function resetarFunil(
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string } | { ok: true; marcos: number; origens: number }> {
  if (!(await isAuthenticated())) return { error: 'Sessão expirada. Entre novamente.' };

  const confirmacao = String(formData.get('confirmacao') ?? '').trim().toUpperCase();
  if (confirmacao !== CONFIRMACAO_ZERAR) {
    return { error: `Digite ${CONFIRMACAO_ZERAR} para confirmar. Nada foi apagado.` };
  }

  try {
    const { marcos, origens } = await withAutoBootstrap(() => resetFunnel());
    revalidatePath('/admin/funil');
    return { ok: true, marcos, origens };
  } catch (error) {
    console.error('[admin] falha ao zerar o funil', error);
    return { error: 'O banco recusou a limpeza. Nada foi apagado — confira o log do servidor.' };
  }
}

/**
 * Reconcilia o funil: apaga os marcos de relatório sem pagamento correspondente.
 *
 * ─── POR QUE ESTA NÃO EXIGE CONFIRMAÇÃO DIGITADA, E `resetarFunil` EXIGE ─────────────────────
 *
 * As duas apagam linhas de medição, e o que muda é o que se perde num clique errado. `resetarFunil`
 * apaga o histórico INTEIRO, não tem volta e não tem de onde reconstruir — daí a palavra digitada.
 *
 * Esta apaga apenas linhas que a instrumentação atual não produziria: `report` sem `paid` na mesma
 * identidade. Clicá-la por engano no funil já coerente não apaga nada, porque não há o que apagar —
 * a tela nem mostra o botão nesse caso. O custo do erro é zero, e uma confirmação cerimonial onde o
 * risco é zero ensina a digitar a palavra sem ler, que é o que estraga a confirmação da outra.
 *
 * A autenticação é revalidada aqui pelo mesmo motivo de `resetarFunil`: Server Action é endpoint
 * HTTP e pode ser chamada sem passar por tela nenhuma.
 */
export async function reconciliarFunil(): Promise<
  { error: string } | { ok: true; relatorios: number; convidados: number }
> {
  if (!(await isAuthenticated())) return { error: 'Sessão expirada. Entre novamente.' };

  try {
    const [relatorios, convidados] = await withAutoBootstrap(async () => [
      await removerRelatoriosSemPagamento(),
      await removerJornadasDeCupomDoFunil(),
    ]);
    revalidatePath('/admin/funil');
    return { ok: true, relatorios, convidados };
  } catch (error) {
    console.error('[admin] falha ao reconciliar o funil', error);
    return { error: 'O banco recusou a limpeza. Nada foi apagado — confira o log do servidor.' };
  }
}
