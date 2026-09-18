'use server';

import { revalidatePath } from 'next/cache';
import { isAuthenticated } from '../auth';
import { sendEmail } from '@/email/send';
import { amostraPor } from '@/email/amostras';
import { satisfactionSurveyEmail } from '@/email/templates';
import { CONTATO_EMAIL } from '@/lib/contato';
import { SITE_URL } from '@/lib/site';
import { pesquisaPorId, registrarEnvio } from '@/database/repositories/pesquisa-repo';
import { withAutoBootstrap } from '@/database/setup';

export type TesteResult = { ok: string } | { error: string };

/** Os cabeçalhos da pesquisa — só dela. Ver o comentário no envio de teste. */
const CABECALHOS_DA_PESQUISA = {
  'List-Unsubscribe': `<mailto:${CONTATO_EMAIL}?subject=sair>`,
  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
};

/**
 * Tenta de novo um envio que o provedor recusou.
 *
 * ═══ POR QUE SÓ A RECUSA EXPLÍCITA, E POR QUE À MÃO ══════════════════════════════════════════
 *
 * Só linhas com `envio_ok = false` entram aqui, e `pesquisaPorId` recusa o resto. `false` é uma
 * recusa declarada pelo provedor: a mensagem não saiu, e mandar de novo não duplica nada.
 * `null` — desconhecido — poderia ter saído, e reenviar "por via das dúvidas" é o caminho para o
 * mesmo cliente receber a pesquisa duas vezes, que é o defeito que a tabela existe para evitar.
 *
 * E é um botão, não uma repetição automática. A causa quase sempre é externa e duradoura — chave
 * vencida, domínio não verificado, endereço inválido — e uma tentativa automática a cada dia
 * empilharia a mesma recusa para sempre sem ninguém olhar. Um botão obriga alguém a ver o motivo
 * antes de insistir.
 *
 * O token é o mesmo de antes: o link que a pessoa receber continua sendo o dela, e uma resposta
 * dada por ele cai na linha certa.
 */
export async function reenviarPesquisa(
  _prev: unknown,
  formData: FormData,
): Promise<TesteResult> {
  if (!(await isAuthenticated())) return { error: 'Sessão expirada. Entre novamente.' };

  const id = String(formData.get('id') ?? '');
  const pesquisa = await withAutoBootstrap(() => pesquisaPorId(id));
  if (pesquisa === null) {
    return { error: 'Esta pesquisa não está marcada como recusada — nada foi reenviado.' };
  }

  const email = satisfactionSurveyEmail({ url: `${SITE_URL}/avaliacao/${pesquisa.token}` });
  const r = await sendEmail({
    to: pesquisa.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
    headers: CABECALHOS_DA_PESQUISA,
  });

  await registrarEnvio(
    pesquisa.token,
    r.ok ? { ok: true, id: r.id } : { ok: false, motivo: r.detail ?? r.reason },
  );
  revalidatePath('/admin/pesquisa');

  return r.ok
    ? { ok: `Reenviado para ${pesquisa.email}.` }
    : { error: `O provedor recusou de novo (${r.detail ?? r.reason}).` };
}

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
    ...(amostra.descadastro ? { headers: CABECALHOS_DA_PESQUISA } : {}),
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
