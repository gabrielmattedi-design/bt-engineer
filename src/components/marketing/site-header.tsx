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

        {mostrarConta && <AccountNav logged={user !== null} />}
      </div>
    </header>
  );
}

/**
 * O link de conta, separado do cabeçalho para poder aparecer também na HOME.
 *
 * ═══ POR QUE ELE PRECISOU SAIR DAQUI ═════════════════════════════════════════════════════════
 *
 * A home é a única página do site que não usa `SiteHeader` — o herói já carrega a marca em grande,
 * e um cabeçalho por cima dela repetiria o logo duas vezes na mesma dobra. A consequência não
 * intencional: a home, que é onde quase todo mundo chega, era a única tela sem NENHUM caminho para
 * as análises já compradas.
 *
 * Quem comprou, fechou o e-mail e voltou pelo endereço do site não tinha como reabrir o relatório.
 * A única forma seria adivinhar `/resultado/<id>`, e ninguém adivinha um id.
 */
export async function AccountLink() {
  if (!authConfigured()) return null;
  const user = await currentUser();
  return <AccountNav logged={user !== null} comoBotao />;
}

function AccountNav({ logged, comoBotao = false }: { logged: boolean; comoBotao?: boolean }) {
  return (
    <nav aria-label="Sua conta" className="shrink-0 text-sm">
      <Link
        href={logged ? '/minhas-analises' : '/entrar'}
        className={cn(
          'rounded transition-opacity hover:opacity-90 focus-visible:outline' +
            ' focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current',
          comoBotao
            ? /*
                Na home ele é BOTÃO, e no mesmo molde dos dois do herói: mesma altura de 56px,
                mesmo raio, mesmo peso de fonte. Como link sublinhado ele sumia sobre o verde — e
                sumir é o defeito exato que a gente estava tentando consertar ao trazê-lo para a
                home.

                A cor é o Court Yellow, o terceiro papel da paleta ("performance e energia"). O
                laranja continua sendo a ação principal, o papel é o secundário do herói; o amarelo
                distingue este dos dois sem competir com o laranja, que é quem manda na tela.

                Texto em `ink` porque amarelo sobre branco não tem contraste para leitura.
              */
              'inline-flex min-h-[56px] items-center justify-center bg-ball px-8 font-semibold' +
              ' text-ink'
            : 'px-1 font-medium underline underline-offset-4 opacity-90 hover:opacity-100',
        )}
      >
        {/*
          O rótulo muda com o estado, e os dois casos são diferentes de propósito.

          "Entrar" para quem já está logado é ruído. "Minhas análises" para quem nunca entrou leva a
          uma tela de login que parece um obstáculo em vez de um destino — e quem chega aqui já sabe
          que tem algo para reabrir.
        */}
        {logged ? 'Minhas análises' : 'Já fiz uma análise'}
      </Link>
    </nav>
  );
}
