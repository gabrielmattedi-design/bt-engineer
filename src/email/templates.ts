import { SITE_DOMAIN } from '@/lib/site';

/**
 * Corpos dos e-mails transacionais.
 *
 * ═══ POR QUE O HTML É "ANTIQUADO" ════════════════════════════════════════════════════════════
 *
 * Tabelas, estilos inline, largura fixa, nenhuma fonte externa. Não é descuido: clientes de e-mail
 * não são navegadores. O Outlook desktop renderiza com o motor do Word, o Gmail remove `<style>` e
 * quase todo cliente ignora `@font-face`. O que sobra e funciona em todos é HTML de 2005.
 *
 * ═══ TODO E-MAIL TEM VERSÃO EM TEXTO ═════════════════════════════════════════════════════════
 *
 * Não é acessibilidade apenas — é entregabilidade. Mensagem só-HTML é sinal clássico de spam, e
 * filtros pontuam por isso. O texto também é o que aparece na prévia da lista de mensagens, antes
 * de a pessoa abrir.
 */

const COURT = '#0E3D2E';
const INK = '#14181B';
const GRAPHITE = '#5A6560';
const PAPER = '#FAFAF8';
const LINE = '#E2E5E1';

function layout(input: { preheader: string; body: string }): string {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:${PAPER};">
<!--
  Preheader: o trecho que o cliente de e-mail mostra depois do assunto, na lista de mensagens.
  Sem ele, o Gmail preenche com as primeiras palavras do corpo — normalmente "Ver no navegador"
  ou o nome da marca repetido, desperdiçando a única linha que decide se a pessoa abre.
-->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${input.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid ${LINE};border-radius:8px;">
  <tr><td style="padding:28px 32px 0;">
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:bold;color:${COURT};letter-spacing:-0.2px;">Tennis&nbsp;Engineer</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${GRAPHITE};padding-top:2px;">Seu jogo. Seu setup. Sob medida.</div>
  </td></tr>
  <tr><td style="padding:24px 32px 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:${INK};">
${input.body}
  </td></tr>
</table>
<div style="max-width:520px;padding:16px 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;color:${GRAPHITE};text-align:center;">
  ${SITE_DOMAIN} · este endereço não recebe respostas
</div>
</td></tr></table>
</body></html>`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr>
    <td style="background:${COURT};border-radius:6px;">
      <a href="${href}" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#FFFFFF;text-decoration:none;">${label}</a>
    </td></tr></table>`;
}

export type Email = { subject: string; html: string; text: string };

/**
 * O link de acesso.
 *
 * O endereço aparece TAMBÉM como texto embaixo do botão. Botão é imagem-de-link para muita gente:
 * alguns clientes bloqueiam, outros o usuário não confia, e num relógio ou leitor de tela ele pode
 * nem existir. A URL escrita é o caminho que nunca falha — e deixa a pessoa conferir para onde
 * está indo antes de clicar, que é exatamente o hábito que se quer incentivar.
 */
export function magicLinkEmail(input: { url: string; minutes: number }): Email {
  const subject = 'Seu link de acesso — Tennis Engineer';

  return {
    subject,
    html: layout({
      preheader: `Válido por ${input.minutes} minutos e só pode ser usado uma vez.`,
      body: `
    <p style="margin:0 0 4px;">Use o botão abaixo para acessar suas análises.</p>
    ${button(input.url, 'Acessar minhas análises')}
    <p style="margin:0 0 16px;font-size:13px;color:${GRAPHITE};">
      Se o botão não funcionar, copie e cole este endereço no navegador:<br>
      <span style="word-break:break-all;color:${INK};">${input.url}</span>
    </p>
    <p style="margin:0;font-size:13px;color:${GRAPHITE};border-top:1px solid ${LINE};padding-top:16px;">
      O link vale por <strong>${input.minutes} minutos</strong> e pode ser usado <strong>uma vez só</strong>.
      Se não foi você que pediu, ignore esta mensagem — sem o clique, nada acontece.
    </p>`,
    }),
    text: `Tennis Engineer — seu link de acesso

Acesse suas análises por este endereço:

${input.url}

O link vale por ${input.minutes} minutos e pode ser usado uma vez só.
Se não foi você que pediu, ignore esta mensagem — sem o clique, nada acontece.

${SITE_DOMAIN}`,
  };
}

/**
 * O recibo, logo após a compra.
 *
 * É o e-mail que resolve o problema que originou tudo isto: quem paga, fecha o navegador e perde o
 * link. Com esta mensagem na caixa de entrada, o relatório deixa de depender de um cookie, de um
 * aparelho ou de a pessoa ter salvo o endereço.
 *
 * Por isso ele carrega o link DIRETO do relatório, e não um convite para fazer login: o caminho
 * mais curto entre a pessoa e a coisa que ela comprou.
 */
export function reportReadyEmail(input: {
  url: string;
  productName: string;
  amountCents: number;
}): Email {
  const price = (input.amountCents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  return {
    subject: 'Sua análise está pronta — Tennis Engineer',
    html: layout({
      preheader: 'Guarde este e-mail: é por ele que você volta à sua análise quando quiser.',
      body: `
    <p style="margin:0 0 4px;">Sua análise está pronta.</p>
    ${button(input.url, 'Ver minha análise')}
    <p style="margin:0 0 16px;font-size:13px;color:${GRAPHITE};">
      Se o botão não funcionar, copie e cole este endereço no navegador:<br>
      <span style="word-break:break-all;color:${INK};">${input.url}</span>
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${LINE};margin-top:8px;">
      <tr><td style="padding-top:16px;font-size:13px;color:${GRAPHITE};">
        ${input.productName} · ${price}
      </td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:13px;color:${GRAPHITE};">
      <strong>Guarde este e-mail.</strong> É por ele que você volta à sua análise a qualquer momento,
      de qualquer aparelho — mesmo que troque de celular ou limpe o navegador.
    </p>`,
    }),
    text: `Tennis Engineer — sua análise está pronta

${input.url}

${input.productName} · ${price}

Guarde este e-mail: é por ele que você volta à sua análise a qualquer momento,
de qualquer aparelho — mesmo que troque de celular ou limpe o navegador.

${SITE_DOMAIN}`,
  };
}
