import { SITE_DOMAIN } from '@/lib/site';
import { CONTATO_EMAIL } from '@/lib/contato';

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
<!--
  ═══ O RODAPÉ DIZIA ONDE NÃO FALAR, SEM DIZER ONDE FALAR ═══════════════════════════════════

  "Este endereço não recebe respostas" é verdade e era metade da informação. Quem pagou e não
  recebeu o relatório lia isso e ficava sem saída — e a saída que sobra nesse ponto é abrir
  disputa no gateway, que custa o valor, a taxa e uma marca na conta que recebe.

  Fechar a porta sem apontar a próxima é o que transforma um problema de suporte de dois minutos
  numa contestação.
-->
<div style="max-width:520px;padding:16px 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;color:${GRAPHITE};text-align:center;">
  ${SITE_DOMAIN} · este endereço não recebe respostas<br>
  Precisa de ajuda? Escreva para <a href="mailto:${CONTATO_EMAIL}" style="color:${GRAPHITE};">${CONTATO_EMAIL}</a>
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

/**
 * A pesquisa de satisfação, quinze dias depois da compra.
 *
 * ═══ POR QUE ESTE E-MAIL NÃO SE PARECE COM OS OUTROS ═════════════════════════════════════════
 *
 * Os outros são transacionais: a pessoa está esperando, abre, clica. Este chega sem ser chamado e
 * pede um favor. Se ele tiver cara de disparo em massa, vai ser tratado como disparo em massa — e
 * o custo não fica só nele: a mesma reputação de domínio entrega o RELATÓRIO, que é o produto.
 *
 * Daí as três escolhas visíveis aqui:
 *
 *   **Assinado por uma pessoa.** "Gabriel aqui" muda a taxa de resposta mais que qualquer outra
 *   coisa no texto. Empresa mede; pessoa pergunta.
 *
 *   **Um link só, sem imagem.** Três chamadas e banner é o que disparo em massa parece.
 *
 *   **A frase sobre não ter trocado nada.** Sem ela, quem não implementou se sente cobrado e não
 *   responde — e é exatamente o grupo que mais interessa ouvir. Com ela, "não usei" vira resposta
 *   legítima em vez de silêncio.
 */
export function satisfactionSurveyEmail(input: { url: string }): Email {
  return {
    subject: 'O que achou do seu Setup?',
    html: layout({
      preheader: 'Duas perguntas rápidas sobre a sua análise — leva dois minutos.',
      body: `
    <p style="margin:0 0 16px;">Oi, Gabriel aqui, do Tennis Engineer!</p>
    <p style="margin:0 0 16px;">
      Faz uns quinze dias que você fez sua análise. Queria saber uma coisa:
      deu para testar alguma das recomendações?
    </p>
    <p style="margin:0 0 16px;">
      Gostaria do feedback, do seu relatório e claro, da prática em quadra caso já tenha
      seguido alguma recomendação.
    </p>
    ${button(input.url, 'Responder')}
    <p style="margin:0 0 16px;">
      E se você ainda não trocou nada, adoraria saber por que não trocou.
    </p>
    <p style="margin:0 0 4px;">Obrigado,<br>Gabriel.</p>
    <p style="margin:16px 0 0;font-size:13px;color:${GRAPHITE};">
      Tennis Engineer — Sua Evolução é o Nosso Projeto.
    </p>
    <p style="margin:16px 0 0;font-size:13px;color:${GRAPHITE};">
      Se o botão não funcionar, copie e cole:<br>
      <span style="word-break:break-all;color:${INK};">${input.url}</span>
    </p>`,
    }),
    text: `Oi, Gabriel aqui, do Tennis Engineer!

Faz uns quinze dias que você fez sua análise. Queria saber uma coisa: deu para
testar alguma das recomendações?

Gostaria do feedback, do seu relatório e claro, da prática em quadra caso já
tenha seguido alguma recomendação.

${input.url}

E se você ainda não trocou nada, adoraria saber por que não trocou.

Obrigado,
Gabriel.

Tennis Engineer — Sua Evolução é o Nosso Projeto.`,
  };
}
