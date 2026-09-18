'use client';

import { useActionState, useState } from 'react';
import { enviarEmailDeTeste } from './acoes';
import type { AmostraId } from '@/email/amostras';

export type Peca = {
  id: AmostraId;
  label: string;
  quando: string;
  descadastro: boolean;
  subject: string;
  html: string;
  text: string;
};

/**
 * O ensaio: percorrer a experiência inteira antes que ela chegue a um cliente.
 *
 * ═══ POR QUE ELE FICA NO TOPO DA TELA, E NÃO ESCONDIDO ═══════════════════════════════════════
 *
 * Enquanto nenhuma pesquisa tiver sido enviada, esta é a única coisa útil desta página — o resto é
 * um relatório de zeros. Depois do primeiro disparo ele continua servindo: toda mudança no texto ou
 * no layout precisa ser vista num cliente de e-mail de verdade antes de ir para a fila.
 *
 * ═══ UM SELETOR, DUAS COISAS QUE O SEGUEM ════════════════════════════════════════════════════
 *
 * A prévia e o envio de teste obedecem à mesma escolha, e as três peças vêm montadas do servidor
 * pela mesma função que o envio usa (`email/amostras.ts`). Se a prévia mostrasse uma coisa e o
 * envio mandasse outra, o ensaio estaria testando a si mesmo.
 */
export function EnsaioDaPesquisa({ pecas }: { pecas: readonly Peca[] }) {
  const [state, action, pending] = useActionState(enviarEmailDeTeste, null);
  const [escolhida, setEscolhida] = useState<AmostraId>(pecas[0]?.id ?? 'relatorio');

  const peca = pecas.find((p) => p.id === escolhida) ?? pecas[0];
  if (peca === undefined) return null;

  return (
    <section className="mt-8 rounded border border-line bg-white p-5">
      <h2 className="font-display text-lg font-semibold text-ink">
        Ensaio — antes de qualquer disparo
      </h2>
      <p className="mt-1 max-w-prose text-sm text-graphite">
        Nada aqui grava no banco nem consome a fila. É o caminho do cliente, percorrido por você.
      </p>

      {/*
        Os destinos ficam em cima, antes de qualquer conteúdo longo.

        Na primeira versão eles vinham depois da prévia do e-mail — e a prévia não carregava (ver o
        comentário do iframe abaixo). Quem abriu a tela encontrou uma moldura vazia de 620px de
        altura e concluiu que a página estava quebrada, sem chegar ao formulário de teste que estava
        logo abaixo. Um caminho de teste que depende de rolar até o fim de uma coisa que falhou não
        é um caminho de teste.
      */}
      <nav className="mt-4 flex flex-wrap gap-3 text-sm">
        <a
          className="rounded border border-line px-3 py-2 text-ink underline"
          href={`/admin/pesquisa/previa?modelo=${peca.id}`}
          target="_blank"
          rel="noreferrer"
        >
          Ver este e-mail em outra aba
        </a>
        <a
          className="rounded border border-line px-3 py-2 text-ink underline"
          href="/avaliacao/previa"
          target="_blank"
          rel="noreferrer"
        >
          Abrir a prévia do formulário
        </a>
        <a className="rounded border border-line px-3 py-2 text-ink underline" href="#enviar-teste">
          Enviar o teste para mim
        </a>
      </nav>

      {/* ── 1. Qual mensagem ──────────────────────────────────────────────────────────────── */}
      <h3 className="mt-6 text-sm font-semibold text-ink">1. O e-mail, como ele chega</h3>

      <div className="mt-3 flex flex-wrap gap-2">
        {pecas.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setEscolhida(p.id)}
            className={`rounded border px-3 py-2 text-sm ${
              p.id === escolhida
                ? 'border-court bg-court/5 font-semibold text-ink'
                : 'border-line text-graphite'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <p className="mt-3 max-w-prose text-sm text-graphite">{peca.quando}</p>
      <p className="mt-1 text-sm text-graphite">
        Assunto: <span className="text-ink">{peca.subject}</span>
        {peca.descadastro && (
          <span className="ml-2 text-xs">
            · leva <code className="text-ink">List-Unsubscribe</code>, então o Gmail desenha
            &quot;cancelar inscrição&quot;
          </span>
        )}
      </p>

      {/*
        ═══ POR QUE `srcDoc`, E NÃO `src` ════════════════════════════════════════════════════

        O corpo do e-mail é um documento completo e precisa de `<iframe>`: colado na página, ele
        herdaria o Tailwind do site e a prévia mostraria um layout que ninguém recebe.

        Mas apontar o iframe para `/admin/pesquisa/previa` não funciona NESTE site, e a causa é uma
        decisão nossa: `next.config.mjs` manda `X-Frame-Options: DENY` e `frame-ancestors 'none'`
        em toda resposta. `DENY` recusa também o enquadramento pela própria origem — é isso que o
        separa de `SAMEORIGIN`. O navegador bloqueava em silêncio e sobrava uma moldura vazia.

        Afrouxar o cabeçalho para conseguir uma prévia seria trocar proteção contra clickjacking no
        PAINEL — onde um clique roubado é uma migração rodada — por conveniência de tela. `srcDoc`
        resolve sem tocar nele: o conteúdo vem junto com a página, não há resposta HTTP para
        carregar, e não há nada que o cabeçalho possa recusar.

        `sandbox=""` (vazio = tudo desligado) porque um srcdoc sem sandbox roda com a MESMA origem
        da página que o contém. Nosso HTML não tem script nenhum hoje; a garantia de que amanhã
        também não é o atributo, não a memória.
      */}
      <iframe
        key={peca.id}
        srcDoc={peca.html}
        sandbox=""
        title={`Prévia do e-mail: ${peca.label}`}
        className="mt-3 h-[620px] w-full rounded border border-line bg-paper"
      />

      {/*
        A versão em texto não é detalhe técnico: é o que aparece na PRÉVIA da lista de mensagens,
        antes de a pessoa abrir, e é o que o filtro de spam compara com o HTML. Ela merece ser lida.
      */}
      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-graphite">
          Ver a versão em texto (é ela que aparece na prévia da caixa de entrada)
        </summary>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded border border-line bg-paper p-4 text-xs text-ink">
          {peca.text}
        </pre>
      </details>

      {/* ── 2. O envio de verdade ─────────────────────────────────────────────────────────── */}
      <h3 id="enviar-teste" className="mt-8 text-sm font-semibold text-ink">
        2. Receber na sua caixa
      </h3>
      <p className="mt-1 max-w-prose text-sm text-graphite">
        Manda <strong>{peca.label}</strong> para o endereço que você escolher. É o único jeito de
        ver o modo escuro, o corte do assunto no celular e se ela cai no spam.
      </p>

      <form action={action} className="mt-3 flex flex-wrap gap-3">
        {/* A escolha viaja junto: o que chega na caixa é o que está na moldura acima. */}
        <input type="hidden" name="modelo" value={peca.id} />
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
        </a>{' '}
        <span className="text-graphite">
          — é uma página do próprio site, então também abre digitando{' '}
          <code className="text-ink">/avaliacao/previa</code> no endereço.
        </span>
      </p>
    </section>
  );
}
