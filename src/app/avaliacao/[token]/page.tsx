import { notFound } from 'next/navigation';
import { pesquisaPorToken } from '@/database/repositories/pesquisa-repo';
import { withAutoBootstrap } from '@/database/setup';
import { SiteHeader } from '@/components/marketing/site-header';
import { CONTATO_EMAIL } from '@/lib/contato';
import { FormularioDaPesquisa } from '../formulario';
import { responderPesquisa } from './action';

export const dynamic = 'force-dynamic';

/**
 * A página que abre quando alguém clica no link da pesquisa.
 *
 * O formulário em si mora em `../formulario.tsx` — a mesma peça que a prévia usa. Aqui ficam só as
 * duas coisas que dependem do token: descobrir de quem é a pesquisa e barrar a segunda resposta.
 *
 * ═══ O CABEÇALHO É O DO SITE, E NÃO UMA LINHA VERDE ══════════════════════════════════════════
 *
 * Esta página nascia com "Tennis Engineer" escrito em verde logo acima do título. Duas coisas
 * erradas numa linha: o brand book proíbe a marca em cor de destaque ("sempre em preto ou branco"),
 * e quem chega aqui vem de um e-mail — é o ponto do fluxo em que mais importa reconhecer na hora
 * onde se está. O cabeçalho de verdade responde as duas.
 */
export default async function AvaliacaoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const pesquisa = await withAutoBootstrap(() => pesquisaPorToken(token));

  if (pesquisa === null) notFound();

  if (pesquisa.jaRespondida) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-xl px-6 py-16">
          <h1 className="font-display text-2xl font-semibold text-ink">Já recebi, obrigado.</h1>
          <p className="mt-3 text-graphite">
            Sua resposta está registrada. Se quiser corrigir ou acrescentar alguma coisa, é só
            escrever para{' '}
            <a className="text-ink underline" href={`mailto:${CONTATO_EMAIL}`}>
              {CONTATO_EMAIL}
            </a>{' '}
            — eu leio todas.
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-xl px-6 py-12">
        <h1 className="font-display text-2xl font-semibold text-ink">O que achou do seu setup?</h1>
        <p className="mt-3 text-graphite">
          Cinco perguntas, dois minutos. Só a primeira é obrigatória — o resto, responde o que
          quiser.
        </p>

        <FormularioDaPesquisa
          token={pesquisa.token}
          email={pesquisa.email}
          action={responderPesquisa}
        />
      </main>
    </>
  );
}
