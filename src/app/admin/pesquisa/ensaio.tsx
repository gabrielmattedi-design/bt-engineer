'use client';

import { useActionState } from 'react';
import { enviarPesquisaDeTeste } from './acoes';

/**
 * O ensaio: percorrer a experiência inteira antes que ela chegue a um cliente.
 *
 * ═══ POR QUE ELE FICA NO TOPO DA TELA, E NÃO ESCONDIDO ═══════════════════════════════════════
 *
 * Enquanto nenhuma pesquisa tiver sido enviada, esta é a única coisa útil desta página — o resto é
 * um relatório de zeros. Depois do primeiro disparo ele continua servindo: toda mudança no texto ou
 * no layout precisa ser vista num cliente de e-mail de verdade antes de ir para a fila.
 *
 * Os três passos estão na ordem em que o cliente os vive: a mensagem, o clique, o formulário.
 */
export function EnsaioDaPesquisa({ assunto, texto }: { assunto: string; texto: string }) {
  const [state, action, pending] = useActionState(enviarPesquisaDeTeste, null);

  return (
    <section className="mt-8 rounded border border-line bg-white p-5">
      <h2 className="font-display text-lg font-semibold text-ink">
        Ensaio — antes de qualquer disparo
      </h2>
      <p className="mt-1 max-w-prose text-sm text-graphite">
        Nada aqui grava no banco nem consome a fila. É o caminho do cliente, percorrido por você.
      </p>

      {/* ── 1. A mensagem ─────────────────────────────────────────────────────────────────── */}
      <h3 className="mt-6 text-sm font-semibold text-ink">1. O e-mail, como ele chega</h3>
      <p className="mt-1 text-sm text-graphite">
        Assunto: <span className="text-ink">{assunto}</span>
      </p>
      {/*
        `<iframe>` e não HTML colado na página: o corpo do e-mail é um documento completo, e dentro
        da página ele herdaria o Tailwind do site. O que se veria seria uma peça que ninguém recebe.
      */}
      <iframe
        src="/admin/pesquisa/previa"
        title="Prévia do e-mail da pesquisa"
        className="mt-3 h-[620px] w-full rounded border border-line bg-paper"
      />
      <p className="mt-2 text-sm">
        <a className="text-ink underline" href="/admin/pesquisa/previa" target="_blank" rel="noreferrer">
          Abrir em outra aba
        </a>
      </p>

      {/*
        A versão em texto não é detalhe técnico: é o que aparece na PRÉVIA da lista de mensagens,
        antes de a pessoa abrir, e é o que o filtro de spam compara com o HTML. Ela merece ser lida.
      */}
      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-graphite">
          Ver a versão em texto (é ela que aparece na prévia da caixa de entrada)
        </summary>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded border border-line bg-paper p-4 text-xs text-ink">
          {texto}
        </pre>
      </details>

      {/* ── 2. O envio de verdade ─────────────────────────────────────────────────────────── */}
      <h3 className="mt-8 text-sm font-semibold text-ink">2. Receber na sua caixa</h3>
      <p className="mt-1 max-w-prose text-sm text-graphite">
        Manda esta mesma mensagem para o endereço que você escolher. É o único jeito de ver o modo
        escuro, o corte do assunto no celular e se ela cai no spam.
      </p>

      <form action={action} className="mt-3 flex flex-wrap gap-3">
        <input
          name="para"
          type="email"
          required
          placeholder="seu@email.com"
          className="min-h-[48px] flex-1 rounded border border-line px-4"
        />
        <button
          type="submit"
          disabled={pending}
          className="min-h-[48px] rounded bg-clay px-6 font-semibold text-white
                     transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? 'Enviando…' : 'Enviar para mim'}
        </button>
      </form>

      {state && (
        <p
          className={`mt-3 rounded border p-3 text-sm ${
            'ok' in state ? 'border-court/30 bg-court/5 text-ink' : 'border-warn/40 bg-warn/5 text-warn'
          }`}
        >
          {'ok' in state ? state.ok : state.error}
        </p>
      )}

      {/* ── 3. O formulário ───────────────────────────────────────────────────────────────── */}
      <h3 className="mt-8 text-sm font-semibold text-ink">3. O formulário, do outro lado do clique</h3>
      <p className="mt-1 max-w-prose text-sm text-graphite">
        A mesma tela que o cliente vê, com as mesmas validações — e sem gravar nada.
      </p>
      <p className="mt-2 text-sm">
        <a className="text-ink underline" href="/avaliacao/previa" target="_blank" rel="noreferrer">
          Abrir a prévia do formulário
        </a>
      </p>
    </section>
  );
}
