import Link from 'next/link';
import { Wordmark } from './wordmark';
import { cn } from '@/lib/cn';
import { authConfigured, currentUser } from '@/auth/session';

/**
 * Cabeçalho do site — fixo no topo e sempre clicável de volta para a home.
 *
 * ═══ POR QUE FIXO ════════════════════════════════════════════════════════════════════════════
 *
 * As páginas deste produto são longas: o questionário tem sete etapas e o relatório passa de dez
 * seções. Com o cabeçalho rolando para fora, a marca aparecia no primeiro segundo e sumia pelo
 * resto da leitura — justamente na parte em que a pessoa está decidindo se confia no que está
 * lendo. Um relatório técnico que perde a assinatura no meio vira um texto qualquer.
 *
 * ═══ POR QUE CLICÁVEL ════════════════════════════════════════════════════════════════════════
 *
 * Porque todo mundo tenta. A marca no topo esquerdo é o botão de "voltar ao início" mais universal
 * da web, e quando ela não é link a pessoa não conclui que ali não tem link — conclui que o site
 * travou. Custava um `<Link>`.
 *
 * ═══ POR QUE TRÊS TONS, E NÃO UM SÓ ══════════════════════════════════════════════════════════
 *
 * Cada página tem sua própria temperatura: o questionário e a análise são claros, o relatório abre
 * escuro, os planos vêm no verde institucional. Uniformizar em um tom só seria redesenhar três
 * telas para resolver um problema de comportamento. O componente carrega o comportamento; a cor
 * continua sendo decisão de cada página.
 *
 * A marca segue a regra inegociável do brand book em todos eles: preta sobre claro, branca sobre
 * escuro, nunca colorida.
 */
const TONES = {
  light: 'border-line bg-paper/95 text-ink',
  dark: 'border-white/10 bg-ink/95 text-paper',
  court: 'border-white/10 bg-court/95 text-paper',
} as const;

/**
 * ═══ POR QUE O CABEÇALHO PRECISOU DE NAVEGAÇÃO ═══════════════════════════════════════════════
 *
 * `/entrar` e `/minhas-analises` existiam, funcionavam e não tinham NENHUM link apontando para
 * elas em lugar nenhum do site — só o e-mail do magic link levava até lá. Quem fechasse aquele
 * e-mail não tinha como voltar às próprias análises, mesmo estando logado.
 *
 * É a pior forma de uma funcionalidade falhar: ela existe, foi paga em tempo de desenvolvimento, e
 * o usuário conclui que o produto não a tem.
 *
 * ─── POR QUE O ESTADO DE LOGIN DECIDE O QUE APARECE ────────────────────────────────────────
 *
 * "Entrar" para quem já está logado é ruído, e "Minhas análises" para quem nunca comprou nada leva
 * a uma tela vazia que parece erro. Cada estado mostra a única ação que faz sentido nele.
 *
 * ─── E POR QUE ELE SOME SEM `AUTH_SECRET` ──────────────────────────────────────────────────
 *
 * Sem a variável, `currentUser()` devolve `null` para todo mundo e o login não tem como funcionar
 * (ver `authConfigured`). Exibir "Entrar" nesse estado é oferecer uma porta que não abre. Enquanto
 * a variável não estiver configurada em produção, o cabeçalho fica como era.
 */
export async function SiteHeader({
  tone = 'light',
  withTagline = true,
}: {
  tone?: keyof typeof TONES;
  /** O relatório e o catálogo já anunciam do que tratam; ali a linha de conceito é repetição. */
  withTagline?: boolean;
}) {
  const user = authConfigured() ? await currentUser() : null;
  const mostrarConta = authConfigured();

  return (
    <header
      className={cn(
        /*
          `backdrop-blur` porque o fundo é translúcido: sem ele, o conteúdo que passa por baixo
          continua legível através do cabeçalho e as duas camadas se embaralham na rolagem.
        */
        'sticky top-0 z-40 border-b backdrop-blur',
        TONES[tone],
      )}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <Link
          href="/"
          aria-label="Tennis Engineer — voltar ao início"
          className="inline-block rounded transition-opacity hover:opacity-80
                     focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4
                     focus-visible:outline-current"
        >
          <Wordmark
            size="sm"
            tone={tone === 'light' ? 'light' : 'dark'}
            withTagline={withTagline}
          />
        </Link>

        {mostrarConta && (
          <nav aria-label="Sua conta" className="shrink-0 text-sm">
            {user ? (
              <Link
                href="/minhas-analises"
                className="rounded px-1 font-medium underline underline-offset-4 opacity-90
                           transition-opacity hover:opacity-100
                           focus-visible:outline focus-visible:outline-2
                           focus-visible:outline-offset-4 focus-visible:outline-current"
              >
                Minhas análises
              </Link>
            ) : (
              <Link
                href="/entrar"
                className="rounded px-1 font-medium underline underline-offset-4 opacity-90
                           transition-opacity hover:opacity-100
                           focus-visible:outline focus-visible:outline-2
                           focus-visible:outline-offset-4 focus-visible:outline-current"
              >
                Entrar
              </Link>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
