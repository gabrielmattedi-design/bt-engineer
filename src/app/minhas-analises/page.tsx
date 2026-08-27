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
                    {/*
                      O NOME primeiro, a data depois — e a hora junto da data.

                      Antes o rótulo era só "Análise de 27 de agosto de 2026". Duas análises feitas
                      no mesmo dia ficavam idênticas, com o mesmo texto e o mesmo valor, e a única
                      forma de saber qual era qual era abrir as duas.

                      Não é caso raro: o uso natural do produto é responder uma vez por si e outra
                      pelo filho ou pelo parceiro de duplas, na mesma tarde. E quem tem mais de uma
                      análise é exatamente quem mais volta a esta tela.

                      O nome vem antes porque é como a pessoa de fato lembra — "a da Maitê", não "a
                      das 15h47". A hora entra como desempate para quem não deu nome nenhum.
                    */}
                    <span className="block font-display font-semibold">
                      {a.playerName ? `Análise de ${a.playerName}` : 'Análise sem nome'}
                    </span>
                    <span className="mt-0.5 block text-sm text-graphite">
                      {a.createdAt.toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })}
                      {' às '}
                      {a.createdAt.toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {/*
                        O valor só aparece quando existe.

                        Relatório liberado por código de convite não tem pedido, e "R$ 0,00 pagos"
                        ali soaria como cobrança falhada em vez de acesso concedido.
                      */}
                      {a.paidCents > 0 && (
                        <>
                          {' · '}
                          {(a.paidCents / 100).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </>
                      )}
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
