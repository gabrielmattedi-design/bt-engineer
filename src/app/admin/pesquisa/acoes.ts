'use server';

import { isAuthenticated } from '../auth';
import { sendEmail } from '@/email/send';
import { satisfactionSurveyEmail } from '@/email/templates';
import { SITE_URL } from '@/lib/site';
import { CONTATO_EMAIL } from '@/lib/contato';

export type TesteResult = { ok: string } | { error: string };

/**
 * Manda a pesquisa de satisfação para um endereço escolhido, agora.
 *
 * ═══ POR QUE ISTO PRECISA EXISTIR ANTES DO PRIMEIRO DISPARO ══════════════════════════════════
 *
 * Tudo que decide se este e-mail funciona só aparece dentro de um cliente de e-mail de verdade: se
 * o Gmail corta o assunto, se a faixa verde some no modo escuro, se o botão laranja fica legível no
 * celular, se a mensagem cai no spam, se o "cancelar inscrição" do Gmail aparece por causa do
 * `List-Unsubscribe`. Nenhuma dessas perguntas tem resposta olhando HTML na tela.
 *
 * A alternativa seria descobrir tudo isso no primeiro envio — para um cliente pagante.
 *
 * ═══ O QUE ELE NÃO FAZ ═══════════════════════════════════════════════════════════════════════
 *
 * Não cria linha em `satisfaction_surveys`, não consome ninguém da fila, não marca pedido como
 * pesquisado. O link de dentro vai para `/avaliacao/previa`, que também não grava. É um envio
 * isolado: nada no banco muda por causa dele, e a estatística da pesquisa continua sendo só o que
 * clientes responderam.
 *
 * ═══ POR QUE O DESTINATÁRIO É DIGITADO, E NÃO FIXO ═══════════════════════════════════════════
 *
 * Mesmo motivo do teste de envio em `/admin/setup`: o e-mail precisa chegar numa caixa que a pessoa
 * consiga abrir agora — no Gmail, no celular, no modo escuro. Só quem está na tela sabe qual é.
 */
export async function enviarPesquisaDeTeste(
  _prev: unknown,
  formData: FormData,
): Promise<TesteResult> {
  if (!(await isAuthenticated())) return { error: 'Sessão expirada. Entre novamente.' };

  const to = String(formData.get('para') ?? '').trim();
  if (!to.includes('@')) return { error: 'Digite um endereço de e-mail válido.' };

  const email = satisfactionSurveyEmail({ url: `${SITE_URL}/avaliacao/previa` });

  const r = await sendEmail({
    to,
    subject: email.subject,
    html: email.html,
    text: email.text,
    // Os mesmos cabeçalhos do disparo real — é o que faz o Gmail mostrar "cancelar inscrição".
    headers: {
      'List-Unsubscribe': `<mailto:${CONTATO_EMAIL}?subject=sair>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });

  if (r.ok) {
    return {
      ok:
        `Enviado para ${to}. Abra no celular e no computador, e olhe o spam — ` +
        'este é o e-mail que mais corre risco de cair lá.',
    };
  }

  if (r.reason === 'not_configured') {
    return { error: 'RESEND_API_KEY não chegou ao servidor. Configure na Vercel e refaça o deploy.' };
  }
  return { error: `O Resend recusou o envio (${r.detail ?? 'sem detalhe'}).` };
}
