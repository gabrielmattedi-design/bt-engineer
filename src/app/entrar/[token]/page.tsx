import { SiteHeader } from '@/components/marketing/site-header';
import { confirmLink } from '../actions';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Confirmar acesso — Tennis Engineer',
  // O link é de uso único e pessoal: nunca deve entrar em índice de busca.
  robots: { index: false, follow: false },
};

/**
 * A confirmação do link.
 *
 * ─── POR QUE ESTA PÁGINA EXISTE, EM VEZ DE JÁ ENTRAR ─────────────────────────────────────────
 *
 * O token é de uso único, e filtros corporativos de e-mail — o Safe Links do Outlook é o mais
 * comum — ABREM as URLs recebidas para inspecioná-las antes de qualquer pessoa clicar. Se entrar
 * fosse consequência de VISITAR, o filtro gastaria o link e a pessoa encontraria "link inválido"
 * no primeiro clique, num erro impossível de entender de dentro da tela.
 *
 * Robô segue link; robô não envia formulário. O consumo mora no POST.
 *
 * A página não diz de quem é o link nem se ele é válido: qualquer coisa dita AQUI seria dita
 * também ao robô que passou antes. A validação acontece no envio.
 */
export default async function ConfirmarPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-lg px-6 py-20">
        <h1 className="font-display text-3xl font-bold">Confirmar acesso</h1>
        <p className="mt-3 leading-relaxed text-graphite">
          Você chegou pelo link enviado por e-mail. Confirme para abrir suas análises.
        </p>

        <form action={confirmLink} className="mt-8">
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="flex min-h-[56px] w-full items-center justify-center rounded bg-court px-8
                       font-semibold text-paper transition-opacity hover:opacity-90 sm:w-auto"
          >
            Entrar
          </button>
        </form>

        <p className="mt-10 border-t border-line pt-6 text-sm leading-relaxed text-graphite">
          O link vale por 15 minutos e só funciona uma vez. Se ele já tiver expirado,{' '}
          <a href="/entrar" className="text-clay underline">
            peça outro
          </a>{' '}
          — leva um instante.
        </p>
      </main>
    </>
  );
}
