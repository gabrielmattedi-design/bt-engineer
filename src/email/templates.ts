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
 *
 * ═══ A MARCA AQUI É COR E TIPOGRAFIA, NUNCA IMAGEM ═══════════════════════════════════════════
 *
 * O e-mail passou a ter a cara do site — faixa verde institucional, filete laranja, wordmark em
 * caixa alta espaçada, o mesmo cartão branco de borda fina. Tudo isso é HTML: chega montado, sem
 * depender de nada carregar.
 *
 * Um logotipo em PNG seria o caminho óbvio e é o errado por três motivos que se somam:
 *
 *   1. **O Gmail bloqueia imagem por padrão.** A marca que só existe em imagem simplesmente não
 *      aparece na primeira abertura — que é a única que importa.
 *   2. **Imagem é rastreamento.** Toda imagem hospedada avisa o servidor quando e de onde a
 *      mensagem foi aberta. Este projeto recusou mandar conversão de quem negou cookie; não vai
 *      instalar um pixel de abertura pela porta dos fundos.
 *   3. **Proporção texto/imagem é métrica de filtro.** Peça gráfica grande com pouco texto é o
 *      formato que os filtros aprenderam a chamar de disparo em massa.
 *
 * O monograma SVG de `components/marketing/logo.tsx` não serve aqui pelo mesmo motivo: o Gmail
 * remove SVG inline. O que sobra da marca — e é o suficiente — é a wordmark tipográfica, que no
 * próprio site também é só texto com peso e espaçamento (`.wordmark` em globals.css).
 *
 * ═══ AS FONTES DO SITE SÃO PEDIDAS, NÃO BAIXADAS ═════════════════════════════════════════════
 *
 * Sora e Inter estão nomeadas na pilha e só serão usadas por quem já as tem instaladas. Não há
 * `@import` do Google Fonts de propósito: além de o Gmail descartar, seria mais uma requisição
 * externa contando ao Google quando cada cliente abriu o e-mail — a mesma objeção do item 2.
 *
 * O que carrega a marca sem as fontes é o resto: a cor, o peso, o espaçamento entre letras, a
 * proporção do cartão. Com Helvetica no lugar da Sora a peça continua reconhecível.
 *
 * ═══ MODO ESCURO ═════════════════════════════════════════════════════════════════════════════
 *
 * Gmail e Outlook invertem cores de mensagens claras por conta própria, e uma inversão parcial —
 * fundo escurecido, texto não — deixa texto quase invisível. As duas defesas usadas aqui são as
 * que funcionam: declarar `color-scheme` (clientes que respeitam param de inverter) e repetir todo
 * fundo no atributo `bgcolor` além do CSS, porque é o atributo que sobrevive quando o cliente
 * reescreve o `style`.
 */

/** Os tokens são os do site (tailwind.config.ts). Copiados porque e-mail não tem acesso ao CSS. */
const COURT = '#0E3D2E';
const CLAY = '#D85A2B';
const INK = '#0B0F14';
const GRAPHITE = '#5A6472';
const PAPER = '#FAFAF8';
const LINE = '#E4E6E3';
/** Verde claro do tagline sobre a faixa: 7,8:1 de contraste sobre o court. */
const COURT_SOFT = '#BFD3C9';

const FONTE_TITULO = `'Sora','Inter',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif`;
const FONTE_TEXTO = `'Inter',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif`;

function layout(input: { preheader: string; body: string }): string {
  return `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
</head>
<body style="margin:0;padding:0;background-color:${PAPER};" bgcolor="${PAPER}">
<!--
  Preheader: o trecho que o cliente de e-mail mostra depois do assunto, na lista de mensagens.
  Sem ele, o Gmail preenche com as primeiras palavras do corpo — normalmente "Ver no navegador"
  ou o nome da marca repetido, desperdiçando a única linha que decide se a pessoa abre.

  O entulho de &amp;zwnj; depois do texto é o truque conhecido: sem ele o cliente continua
  puxando as primeiras palavras do corpo para completar a prévia, e a frase escolhida aparece
  grudada em "Tennis Engineer Seu jogo. Seu setup...". São caracteres invisíveis que empurram o
  resto para fora do trecho exibido.
-->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${input.preheader}${'&zwnj;&nbsp;'.repeat(60)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PAPER}" style="background-color:${PAPER};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;border:1px solid ${LINE};border-radius:8px;">

  <!--
    A faixa institucional. É o cabeçalho do site (SiteHeader no tom "court") reduzido ao que
    cabe num e-mail: o verde, a wordmark branca e a linha de conceito.

    REGRA DA MARCA, do brand book: "a marca deve ser aplicada sempre em preto ou branco; cores de
    destaque nunca são aplicadas à marca". A versão anterior deste arquivo escrevia "Tennis
    Engineer" em VERDE sobre branco — bonito e proibido. Branco sobre o verde institucional é a
    aplicação correta, e é também a que o site usa nas telas de tom escuro.
  -->
  <tr><td bgcolor="${COURT}" style="background-color:${COURT};padding:22px 32px;border-radius:8px 8px 0 0;">
    <div style="font-family:${FONTE_TITULO};font-size:15px;font-weight:bold;letter-spacing:2.6px;color:#FFFFFF;line-height:1.3;">TENNIS&nbsp;ENGINEER</div>
    <div style="font-family:${FONTE_TEXTO};font-size:11px;letter-spacing:0.4px;color:${COURT_SOFT};padding-top:5px;line-height:1.4;">Seu jogo. Seu setup. Sob medida.</div>
  </td></tr>

  <!--
    O filete laranja. É a única aparição do acento e existe para separar a faixa do texto sem uma
    borda cinza a mais — no site o mesmo papel é do Clay em botões e destaques.

    font-size:0 com um espaço rígido dentro porque célula vazia some no Outlook: sem
    conteúdo, o motor do Word colapsa a linha e o filete desaparece.
  -->
  <tr><td bgcolor="${CLAY}" style="background-color:${CLAY};height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>

  <tr><td bgcolor="#FFFFFF" style="background-color:#FFFFFF;padding:28px 32px 32px;font-family:${FONTE_TEXTO};font-size:15px;line-height:1.6;color:${INK};border-radius:0 0 8px 8px;">
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
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
<tr><td align="center" style="padding:18px 8px 0;font-family:${FONTE_TEXTO};font-size:11px;line-height:1.6;color:${GRAPHITE};">
  <!--
    Aqui havia a assinatura da marca em caixa alta ("SUA EVOLUÇÃO É O NOSSO PROJETO"). Saiu porque
    a pesquisa de satisfação fecha com essa mesma frase no corpo, assinada pelo Gabriel — e a
    mesma sentença duas vezes em dois centímetros parece descuido, não marca. A faixa verde no
    topo já assina a mensagem; o rodapé só precisa dizer para onde ir quando algo der errado.
  -->
  ${SITE_DOMAIN} · este endereço não recebe respostas<br>
  Precisa de ajuda? Escreva para <a href="mailto:${CONTATO_EMAIL}" style="color:${GRAPHITE};">${CONTATO_EMAIL}</a>
</td></tr></table>
</td></tr></table>
</body></html>`;
}

/**
 * O botão.
 *
 * Laranja e não verde: no site o Clay é o acento de AÇÃO — todo botão primário, da home ao
 * checkout, é `bg-clay` com texto branco. Um botão verde no e-mail seria um botão que a pessoa não
 * reconhece quando chega na página.
 *
 * O par laranja/branco fica em 3,9:1 de contraste, abaixo do 4,5:1 que a WCAG pede para texto
 * pequeno. É o par que o site já usa e mudar só aqui criaria um segundo laranja de marca. O que
 * compensa é o endereço em texto logo abaixo do botão em todos os e-mails: quem não enxergar o
 * rótulo tem o link escrito, que é também o caminho de quem bloqueia botão ou usa leitor de tela.
 */
function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;"><tr>
    <td bgcolor="${CLAY}" style="background-color:${CLAY};border-radius:6px;">
      <a href="${href}" style="display:inline-block;padding:15px 30px;font-family:${FONTE_TEXTO};font-size:16px;font-weight:bold;color:#FFFFFF;text-decoration:none;">${label}</a>
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
