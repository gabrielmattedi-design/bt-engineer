import { isAuthenticated } from '../../auth';
import { amostraPor } from '@/email/amostras';

export const dynamic = 'force-dynamic';

/**
 * Um dos e-mails do produto, renderizado como página.
 *
 * ═══ POR QUE UMA ROTA, E NÃO UM COMPONENTE ═══════════════════════════════════════════════════
 *
 * O corpo do e-mail é uma STRING de HTML completo — `<!doctype>`, `<head>`, tabelas. Colar isso
 * dentro de uma página React com `dangerouslySetInnerHTML` daria uma coisa que não é o e-mail: o
 * Tailwind do site cascatearia por cima (reset de tabela, `box-sizing`, fonte do `body`) e a prévia
 * mostraria um layout que ninguém vai receber.
 *
 * Servida como documento próprio, o que aparece na tela é byte por byte o que o provedor vai
 * mandar — que é a única prévia que serve para decidir alguma coisa.
 *
 * Ela é a prévia em ABA SEPARADA. A moldura dentro do painel usa `srcDoc`, e não esta rota, porque
 * `X-Frame-Options: DENY` recusa enquadrar até a própria origem (ver `ensaio.tsx`). Aqui é
 * navegação de primeiro nível, que o cabeçalho não alcança — e é a forma de ver a peça em tamanho
 * real, ampliar, e conferir no celular abrindo o mesmo endereço.
 *
 * ═══ OS LINKS DE DENTRO SÃO PÁGINAS PÚBLICAS ═════════════════════════════════════════════════
 *
 * Nenhuma amostra carrega chave de verdade — o botão "Responder" leva a `/avaliacao/previa`, o do
 * relatório a `/minhas-analises`, o de acesso a `/entrar`. Ver `email/amostras.ts`: o que se
 * confere aqui é a peça, e peça nenhuma precisa de um token válido para ser conferida.
 */
export async function GET(req: Request): Promise<Response> {
  if (!(await isAuthenticated())) {
    return new Response('nao autorizado', { status: 401 });
  }

  /* `?modelo=relatorio|pesquisa|acesso`. Valor desconhecido cai na primeira amostra, sem erro. */
  const email = amostraPor(new URL(req.url).searchParams.get('modelo')).montar();

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
