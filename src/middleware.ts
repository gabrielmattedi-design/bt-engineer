import { NextResponse, type NextRequest } from 'next/server';

/**
 * Captura da origem do visitante — §15.
 *
 * ═══ POR QUE PRECISA SER AQUI, E NÃO NA PÁGINA ═══════════════════════════════════════════════
 *
 * Os parâmetros `utm_*` chegam na PRIMEIRA página visitada, quase sempre a home. O identificador
 * do visitante só nasce mais tarde, quando ele abre o questionário — que é uma decisão deliberada
 * (ver `funnel-actions.ts`: página que passa na frente de alguém não gera cookie).
 *
 * Entre um momento e outro a origem se perde. O middleware fecha essa distância guardando os
 * parâmetros num cookie próprio, que o questionário lê quando finalmente cria o visitante.
 *
 * ═══ PRIMEIRO TOQUE VENCE, INCLUSIVE AQUI ════════════════════════════════════════════════════
 *
 * Se o cookie já existe, ele NÃO é sobrescrito. Quem clica no anúncio, navega para a home e volta
 * carregaria `utm_source` de novo em cada volta; sobrescrever creditaria a última visita e não a
 * que trouxe a pessoa. A mesma regra vale no banco (`unique(visitor_hash)`), e as duas precisam
 * concordar — se só uma delas valesse, o resultado dependeria de qual caminho o visitante tomou.
 *
 * ═══ O QUE ELE NÃO FAZ ═══════════════════════════════════════════════════════════════════════
 *
 * Não escreve no banco, não bloqueia nada, não redireciona e não roda em requisição sem `utm_*`.
 * Middleware roda em TODA requisição do site, e um que faz trabalho em todas elas é um imposto
 * cobrado no carregamento de cada página — inclusive das que nunca vão converter.
 */

export const CAMPAIGN_COOKIE = 'te_campanha';

/** Só estes. Nada de referrer, IP ou impressão digital — ver `schema/campaigns.ts`. */
const PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const;

/**
 * Teto de tamanho por parâmetro.
 *
 * `utm_source` vem da URL, ou seja, de qualquer pessoa que monte um link. Sem limite, alguém
 * escreve dois mil caracteres num parâmetro e o painel do funil vira uma tabela ilegível — e o
 * cookie estoura o limite do navegador, o que derrubaria a captura para todo mundo.
 */
const MAX = 80;

function limpar(valor: string | null): string | null {
  if (!valor) return null;
  const limpo = valor.trim().slice(0, MAX);
  return limpo.length > 0 ? limpo : null;
}

export function middleware(request: NextRequest): NextResponse {
  const resposta = NextResponse.next();

  // Já sabemos de onde veio. Primeiro toque vence.
  if (request.cookies.has(CAMPAIGN_COOKIE)) return resposta;

  const source = limpar(request.nextUrl.searchParams.get('utm_source'));
  // Sem `utm_source` não há campanha a atribuir: os outros parâmetros sozinhos não identificam
  // origem nenhuma, e gravar `medium=cpc` sem saber a fonte produziria uma linha inútil no painel.
  if (!source) return resposta;

  const dados: Record<string, string> = {};
  for (const p of PARAMS) {
    const v = limpar(request.nextUrl.searchParams.get(p));
    if (v) dados[p] = v;
  }

  resposta.cookies.set(CAMPAIGN_COOKIE, JSON.stringify(dados), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    /*
      30 dias.

      Curto demais e a compra que amadurece por uma semana perde a origem. Longo demais e um clique
      de dois meses atrás leva crédito por uma venda que veio de outro lugar. Trinta dias cobre o
      ciclo real deste produto — ver a análise, pensar, voltar e comprar.
    */
    maxAge: 60 * 60 * 24 * 30,
  });

  return resposta;
}

export const config = {
  /*
    Fora de arquivos estáticos, imagens e rotas de API.

    Um anúncio nunca aponta para `/api/...` nem para um `.png`, e rodar ali só acrescentaria
    latência a requisições que não podem carregar campanha nenhuma.
  */
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)'],
};
