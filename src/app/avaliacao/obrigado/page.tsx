import { SiteHeader } from '@/components/marketing/site-header';
import { CONTATO_EMAIL } from '@/lib/contato';

/**
 * O fim do fluxo da pesquisa.
 *
 * Página própria, e não um estado da anterior, porque assim o recarregar não reenvia o formulário —
 * o padrão POST-redirect-GET. Sem ele, um F5 depois de responder tentaria gravar de novo.
 *
 * ═══ O `?previa=1` ═══════════════════════════════════════════════════════════════════════════
 *
 * Quem chega pela prévia lê exatamente o mesmo agradecimento, com uma tarja dizendo que nada foi
 * gravado. Sem ela, a prévia terminaria com "eu leio todas as respostas" e quem a percorreu ficaria
 * sem saber se a dele entrou — que é a única dúvida que a tela de teste não pode deixar.
 */
export default async function ObrigadoPage({
  searchParams,
}: {
  searchParams: Promise<{ previa?: string }>;
}) {
  const { previa } = await searchParams;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-xl px-6 py-16">
        {previa === '1' && (
          <p className="mb-8 rounded border border-clay/40 bg-clay/5 p-3 text-sm text-ink">
            <strong>Prévia.</strong> Nada foi gravado — esta resposta não existe no banco e não
            aparece no painel.
          </p>
        )}

        <h1 className="font-display text-2xl font-semibold text-ink">Obrigado de verdade.</h1>
        <p className="mt-3 text-graphite">
          Eu leio todas as respostas, uma por uma. O que você escreveu aqui muda o que vem depois —
          inclusive o que ainda não existe.
        </p>
        <p className="mt-6 text-graphite">
          Se quiser falar comigo sobre qualquer coisa, é só escrever para{' '}
          <a className="text-ink underline" href={`mailto:${CONTATO_EMAIL}`}>
            {CONTATO_EMAIL}
          </a>
          .
        </p>
        <p className="mt-8">
          <a className="text-ink underline" href="/">
            Voltar ao Tennis Engineer
          </a>
        </p>
      </main>
    </>
  );
}
