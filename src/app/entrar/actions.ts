'use server';

import { redirect } from 'next/navigation';
import { consumeLoginToken, requestLoginLink, TOKEN_MINUTES } from '@/database/repositories/auth-repo';
import { withAutoBootstrap } from '@/database/setup';
import { startUserSession, authConfigured } from '@/auth/session';
import { sendEmail, emailEnabled } from '@/email/send';
import { magicLinkEmail } from '@/email/templates';
import { SITE_URL } from '@/lib/site';

export type LoginRequestResult = { sent: true } | { error: string };

/** A mesma frase para "enviei" e "esse e-mail não tem conta". Ver a nota abaixo. */
const SENT_MESSAGE = 'sent';

export async function requestLink(
  _prev: unknown,
  formData: FormData,
): Promise<LoginRequestResult> {
  const email = String(formData.get('email') ?? '').trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Digite um e-mail válido.' };
  }

  if (!authConfigured() || !emailEnabled()) {
    /*
      Falha ABERTA e honesta, e é o oposto do que a segurança pede em quase todo outro lugar.

      Aqui o risco de dizer a verdade é nenhum — "o acesso por e-mail ainda não está ligado" não
      revela nada sobre ninguém — e o custo de mentir é alto: a pessoa esperaria um e-mail que
      nunca sai, olharia o spam, tentaria de novo e concluiria que o site está quebrado.
    */
    return { error: 'O acesso por e-mail ainda não está disponível. Use o link do seu relatório.' };
  }

  try {
    const result = await withAutoBootstrap(() => requestLoginLink(email));

    if (result.kind === 'rate_limited') {
      return {
        error: `Muitos pedidos para este endereço. Aguarde ${TOKEN_MINUTES} minutos e tente de novo.`,
      };
    }

    /*
      ═══ A MESMA RESPOSTA PARA OS DOIS CASOS ══════════════════════════════════════════════════

      `unknown_email` não vira mensagem. Se a tela dissesse "esse e-mail não tem conta", o
      formulário viraria um oráculo: qualquer pessoa descobriria, um endereço por vez, quem é
      cliente daqui. É pouco para nós e pode ser muito para o titular do endereço.

      Quem digitou errado o próprio e-mail não recebe nada e tenta de novo — incômodo pequeno,
      e o texto da tela orienta exatamente isso.
    */
    if (result.kind === 'issued') {
      const url = `${SITE_URL}/entrar/${result.token}`;
      const mail = magicLinkEmail({ url, minutes: TOKEN_MINUTES });

      const sent = await sendEmail({ to: result.email, ...mail });
      if (!sent.ok) {
        return { error: 'Não conseguimos enviar o e-mail agora. Tente novamente em alguns minutos.' };
      }
    }

    return { sent: true };
  } catch (error) {
    console.error('[entrar] falha ao pedir link:', error);
    return { error: 'Não conseguimos processar o pedido agora. Tente novamente em alguns minutos.' };
  }
}

/**
 * Consome o token — e só a partir de um POST.
 *
 * ─── POR QUE UM BOTÃO, E NÃO O CLIQUE NO E-MAIL DIRETO ───────────────────────────────────────
 *
 * O link é de uso único. Filtros corporativos de e-mail (o Safe Links do Outlook é o mais comum)
 * ABREM as URLs recebidas para inspecioná-las, antes de qualquer pessoa clicar. Se o consumo
 * acontecesse na visita, o filtro gastaria o link e a pessoa encontraria "link inválido" no
 * primeiro clique — falha impossível de diagnosticar de dentro da tela.
 *
 * Robô segue link; robô não envia formulário. O passo a mais também mostra o endereço antes de
 * entrar, que é uma conferência útil quando o link foi encaminhado por engano.
 */
export async function confirmLink(formData: FormData): Promise<void> {
  const token = String(formData.get('token') ?? '');

  const user = await withAutoBootstrap(() => consumeLoginToken(token));

  /*
    O fracasso REDIRECIONA, não devolve.

    Um `action={confirmLink}` simples descarta o valor de retorno — devolver `{ error }` daqui
    resultaria num clique que não faz absolutamente nada, o pior desfecho para quem já está
    desconfiado de um link que veio por e-mail. Mandar de volta ao formulário com o motivo
    explicado dá o próximo passo pronto.

    Expirado, já usado e inexistente levam à MESMA tela de propósito: distingui-los diria a quem
    tem um token qualquer se ele existe, e a única resposta útil é a mesma nos três casos.
  */
  if (!user) redirect('/entrar?link=expirado');

  await startUserSession({ userId: user.userId, email: user.email });
  redirect('/minhas-analises');
}
