import { redirect } from 'next/navigation';
import Link from 'next/link';
import { SiteHeader } from '@/components/marketing/site-header';
import { currentUser, endUserSession } from '@/auth/session';
import { analysesForUser } from '@/database/repositories/auth-repo';
import { withAutoBootstrap } from '@/database/setup';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Minhas análises — Tennis Engineer',
  robots: { index: false, follow: false },
};

async function sair(): Promise<void> {
  'use server';
  await endUserSession();
  redirect('/');
}

/**
 * A lista do que a pessoa comprou.
 *
 * Vem de `orders` pagos, e não das sessões de recomendação: o vínculo com a pessoa nasce da COMPRA.
 * Uma análise gerada e nunca comprada pertence à sessão anônima do navegador, não a um usuário —
 * listá-la aqui sugeriria uma posse que não existe.
 */
export default async function MinhasAnalisesPage() {
  const user = await currentUser();
  if (!user) redirect('/entrar');

  const analyses = await withAutoBootstrap(() => analysesForUser(user.userId));

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="font-display text-3xl font-bold">Minhas análises</h1>
          <form action={sair}>
            <button type="submit" className="text-sm text-graphite underline">
              Sair
            </button>
          </form>
        </div>
        <p className="mt-2 text-sm text-graphite">{user.email}</p>

        {analyses.length === 0 ? (
          /*
            Chegar aqui vazio é possível e não é erro: o e-mail existe porque alguma compra foi
            iniciada, mas nenhuma foi confirmada — pagamento recusado, PIX não pago, checkout
            abandonado. Dizer "nenhuma análise" e parar deixaria a pessoa achando que perdeu o que
            pagou, então o texto separa os dois casos e oferece saída para cada um.
          */
          <div className="mt-8 rounded border border-line bg-white p-6">
            <h2 className="font-display text-lg font-semibold">Nenhuma análise neste e-mail.</h2>
            <p className="mt-2 text-sm leading-relaxed text-graphite">
              Se você comprou, pode ter usado outro endereço —{' '}
              <Link href="/entrar" className="text-clay underline">
                tente com o outro e-mail
              </Link>
              . Se o pagamento foi feito e nada aparece aqui, fale com a gente que localizamos pelo
              comprovante.
            </p>
            <Link
              href="/questionario"
              className="mt-5 inline-flex min-h-[52px] items-center justify-center rounded bg-court
                         px-6 font-semibold text-paper transition-opacity hover:opacity-90"
            >
              Fazer uma análise
            </Link>
          </div>
        ) : (
          <ul className="mt-8 space-y-3">
            {analyses.map((a) => (
              <li key={a.publicId}>
                <Link
                  href={`/resultado/${a.publicId}`}
                  className="flex flex-wrap items-baseline justify-between gap-3 rounded border
                             border-line bg-white p-5 transition-colors hover:border-court"
                >
                  <span>
                    <span className="block font-display font-semibold">
                      Análise de{' '}
                      {a.createdAt.toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                    <span className="mt-0.5 block text-sm text-graphite">
                      {(a.paidCents / 100).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}{' '}
                      pagos
                    </span>
                  </span>
                  <span className="text-sm text-clay underline">Abrir</span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-10 border-t border-line pt-6 text-xs leading-relaxed text-graphite">
          Suas análises ficam guardadas com a versão exata do motor e do catálogo que as produziu —
          reabrir aqui mostra o mesmo relatório que você recebeu, e não uma recalculada de hoje.
        </p>
      </main>
    </>
  );
}
