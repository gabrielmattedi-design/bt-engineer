import 'server-only';
import { exigir } from '@/lib/ambiente';

/**
 * Envio de e-mail transacional.
 *
 * ═══ POR QUE `fetch`, E NÃO O SDK DO RESEND ══════════════════════════════════════════════════
 *
 * A API de envio é um POST com JSON. Um SDK para isso acrescenta uma dependência, um ciclo de
 * atualização e um ponto de acoplamento ao provedor — em troca de escrever `resend.emails.send`
 * em vez de `fetch`. Trocar de provedor aqui é reescrever esta função; com SDK seria reescrever
 * esta função E remover a dependência.
 *
 * ═══ SEM CHAVE, NÃO ENVIA — E DIZ QUE NÃO ENVIOU ═════════════════════════════════════════════
 *
 * Sem `RESEND_API_KEY` o envio não acontece. O que ele NÃO faz é fingir sucesso: devolve
 * `{ ok: false, reason: 'not_configured' }`, e quem chamou decide o que mostrar.
 *
 * A diferença importa porque o modo de falha silenciosa é cruel: a tela diria "enviamos um link
 * para o seu e-mail", a pessoa esperaria, olharia o spam, tentaria de novo — e nada teria sido
 * enviado. Melhor dizer que o envio não está configurado.
 *
 * Em desenvolvimento, o link vai para o console. É o que permite percorrer o fluxo inteiro sem
 * depender de DNS verificado.
 */

export type SendResult =
  | { ok: true; id: string | null }
  | { ok: false; reason: 'not_configured' | 'rejected'; detail?: string };

const ENDPOINT = 'https://api.resend.com/emails';

/**
 * Remetente.
 *
 * `nao-responda@` é deliberado: este endereço não recebe. Um remetente que parece pessoal convida
 * resposta, e resposta sem ninguém do outro lado é pior que nenhum canal — a pessoa acha que
 * pediu ajuda. O canal de contato de verdade vai escrito no corpo da mensagem.
 *
 * Sem padrão. O que havia era o remetente do Tennis Engineer: recibo e link de acesso deste produto
 * saindo com o domínio e o nome de outra operação — que o Resend recusa se o domínio não estiver
 * nesta conta, e que confunde o cliente se estiver. Ver `src/lib/ambiente.ts`.
 */
export const FROM = exigir('EMAIL_FROM', process.env.EMAIL_FROM);

export function emailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  /**
   * Cabeçalhos extras, para o que não cabe no corpo.
   *
   * Nasceu para o `List-Unsubscribe` da pesquisa de satisfação. Ele é invisível para quem lê e
   * pesado para quem filtra: o Gmail o considera na entrega, e quem não acha como sair de uma
   * mensagem marca como spam — o que queima a reputação do domínio que entrega o RELATÓRIO.
   *
   * Opcional de propósito. O e-mail transacional NÃO deve carregá-lo: oferecer "descadastrar" de
   * uma mensagem que a pessoa comprou é convidá-la a perder o acesso ao que pagou.
   */
  headers?: Record<string, string>;
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;

  if (!key) {
    /*
      Em desenvolvimento o conteúdo vai para o console — é assim que se testa o fluxo inteiro sem
      provedor configurado. Em produção não: o corpo carrega um link de acesso válido, e log de
      produção é lido por mais gente e guardado por mais tempo do que se imagina.
    */
    if (process.env.NODE_ENV !== 'production') {
      console.log(`\n─── e-mail não enviado (sem RESEND_API_KEY) ───\npara: ${input.to}\nassunto: ${input.subject}\n\n${input.text}\n───\n`);
    }
    return { ok: false, reason: 'not_configured' };
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(input.headers === undefined ? {} : { headers: input.headers }),
      }),
    });

    if (!response.ok) {
      /*
        O corpo do erro vai para o log do servidor, nunca para a tela: ele cita o endereço de
        destino e às vezes ecoa cabeçalhos da requisição. Quem está na tela recebe uma frase.
      */
      const detail = await response.text().catch(() => '');
      console.error(`[email] ${response.status} ao enviar "${input.subject}": ${detail.slice(0, 300)}`);
      return { ok: false, reason: 'rejected', detail: `HTTP ${response.status}` };
    }

    const body = (await response.json().catch(() => null)) as { id?: string } | null;
    return { ok: true, id: body?.id ?? null };
  } catch (error) {
    // Rede fora, DNS do provedor caído, timeout. Nunca deve derrubar o fluxo de quem está usando.
    console.error('[email] falha de rede ao enviar:', error);
    return { ok: false, reason: 'rejected', detail: 'falha de rede' };
  }
}
