import { isAuthenticated } from '../../auth';
import { satisfactionSurveyEmail } from '@/email/templates';
import { SITE_URL } from '@/lib/site';

export const dynamic = 'force-dynamic';

/**
 * O e-mail da pesquisa, renderizado como página.
 *
 * ═══ POR QUE UMA ROTA, E NÃO UM COMPONENTE ═══════════════════════════════════════════════════
 *
 * O corpo do e-mail é uma STRING de HTML completo — `<!doctype>`, `<head>`, tabelas. Colar isso
 * dentro de uma página React com `dangerouslySetInnerHTML` daria uma coisa que não é o e-mail: o
 * Tailwind do site cascatearia por cima (reset de tabela, `box-sizing`, fonte do `body`) e a prévia
 * mostraria um layout que ninguém vai receber.
 *
 * Servida como documento próprio e exibida num `<iframe>`, o que aparece na tela é byte por byte o
 * que o provedor vai mandar — que é a única prévia que serve para decidir alguma coisa.
 *
 * ═══ O LINK DE DENTRO APONTA PARA A PRÉVIA ═══════════════════════════════════════════════════
 *
 * O botão "Responder" leva a `/avaliacao/previa`, e não a um token inventado. Assim o caminho
 * inteiro pode ser percorrido daqui — e-mail, clique, formulário, agradecimento — sem que exista
 * pedido, linha de pesquisa ou resposta de mentira em lugar nenhum.
 */
export async function GET(): Promise<Response> {
  if (!(await isAuthenticated())) {
    return new Response('nao autorizado', { status: 401 });
  }

  const email = satisfactionSurveyEmail({ url: `${SITE_URL}/avaliacao/previa` });

  return new Response(email.html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      /*
        Prévia é para ser conferida agora, depois de uma mudança. Cache aqui significaria mexer no
        template, recarregar e concluir que a mudança não funcionou.
      */
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}
