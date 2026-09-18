'use server';

import { isAuthenticated } from '../auth';
import { sendEmail } from '@/email/send';
import { amostraPor } from '@/email/amostras';
import { CONTATO_EMAIL } from '@/lib/contato';

export type TesteResult = { ok: string } | { error: string };

/**
 * Manda um dos e-mails do produto para um endereço escolhido, agora.
 *
 * ═══ POR QUE ISTO PRECISA EXISTIR ANTES DO PRIMEIRO DISPARO ══════════════════════════════════
 *
 * Tudo que decide se um e-mail funciona só aparece dentro de um cliente de e-mail de verdade: se o
 * Gmail corta o assunto, se a faixa verde some no modo escuro, se o botão laranja fica legível no
 * celular, se a mensagem cai no spam, se o "cancelar inscrição" aparece. Nenhuma dessas perguntas
 * tem resposta olhando HTML na tela.
 *
 * A alternativa seria descobrir tudo isso no primeiro envio — para um cliente pagante.
 *
 * ═══ POR QUE OS TRÊS, E NÃO SÓ A PESQUISA ════════════════════════════════════════════════════
 *
 * A pesquisa é a mensagem nova, mas não é a mais importante: o e-mail do RELATÓRIO é o que entrega
 * o produto, e ele mudou de layout junto. Um redesenho conferido só na peça nova é um redesenho
 * pela metade — e a peça não conferida é justamente a que, se quebrar, quebra uma compra.
 *
 * ═══ O QUE ELE NÃO FAZ ═══════════════════════════════════════════════════════════════════════
 *
 * Não cria linha em `satisfaction_surveys`, não consome ninguém da fila, não marca pedido como
 * pesquisado, e não gera token nenhum — os links das amostras vão para páginas públicas do site
 * (ver `email/amostras.ts`). Nada no banco muda por causa deste botão.
 */
export async function enviarEmailDeTeste(
  _prev: unknown,
  formData: FormData,
): Promise<TesteResult> {
  if (!(await isAuthenticated())) return { error: 'Sessão expirada. Entre novamente.' };

  const to = String(formData.get('para') ?? '').trim();
  if (!to.includes('@')) return { error: 'Digite um endereço de e-mail válido.' };

  const amostra = amostraPor(String(formData.get('modelo') ?? ''));
  const email = amostra.montar();

  const r = await sendEmail({
    to,
    subject: email.subject,
    html: email.html,
    text: email.text,
    /*
      Os mesmos cabeçalhos do envio real desta mensagem — e só dela. É o `List-Unsubscribe` que faz
      o Gmail desenhar o "cancelar inscrição" no topo, e ele existe na pesquisa e não nos
      transacionais. Um teste que mandasse sempre os dois mostraria um botão que o cliente não vai
      ver; que nunca mandasse, esconderia um que ele vai.
    */
    ...(amostra.descadastro
      ? {
          headers: {
            'List-Unsubscribe': `<mailto:${CONTATO_EMAIL}?subject=sair>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        }
      : {}),
  });

  if (r.ok) {
    return {
      ok:
        `"${amostra.label}" enviado para ${to}. Abra no celular e no computador, ` +
        'e olhe o spam antes de concluir que não chegou.',
    };
  }

  if (r.reason === 'not_configured') {
    return { error: 'RESEND_API_KEY não chegou ao servidor. Configure na Vercel e refaça o deploy.' };
  }
  return { error: `O Resend recusou o envio (${r.detail ?? 'sem detalhe'}).` };
}
