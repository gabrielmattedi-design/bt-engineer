/**
 * O fim do fluxo da pesquisa.
 *
 * Página própria, e não um estado da anterior, porque assim o recarregar não reenvia o formulário —
 * o padrão POST-redirect-GET. Sem ele, um F5 depois de responder tentaria gravar de novo.
 */
export default function ObrigadoPage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <p className="text-sm font-semibold text-court">Tennis Engineer</p>
      <h1 className="mt-2 font-display text-2xl font-semibold text-ink">Obrigado de verdade.</h1>
      <p className="mt-3 text-graphite">
        Eu leio todas as respostas, uma por uma. O que você escreveu aqui muda o que vem depois —
        inclusive o que ainda não existe.
      </p>
      <p className="mt-6 text-graphite">
        Se quiser falar comigo sobre qualquer coisa, é só escrever para{' '}
        <a className="text-ink underline" href="mailto:contato@tennisengineer.com.br">
          contato@tennisengineer.com.br
        </a>
        .
      </p>
      <p className="mt-8">
        <a className="text-ink underline" href="/">
          Voltar ao Tennis Engineer
        </a>
      </p>
    </main>
  );
}
