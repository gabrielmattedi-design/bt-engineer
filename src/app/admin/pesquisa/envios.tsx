'use client';

import { useActionState } from 'react';
import { reenviarPesquisa } from './acoes';

export type EnvioNaTela = {
  id: string;
  email: string | null;
  dia: string;
  envioOk: boolean | null;
  envioErro: string | null;
  respondeu: boolean;
};

/**
 * Quais e-mails saíram, quais não saíram, e o que o provedor disse.
 *
 * ═══ POR QUE ISTO PRECISOU EXISTIR ═══════════════════════════════════════════════════════════
 *
 * A linha da pesquisa nasce ANTES do disparo, para travar o reenvio. O efeito colateral é que a
 * existência da linha significa "foi tentado" — e o painel contava tudo como "enviadas". Um e-mail
 * recusado pelo provedor produzia a mesma linha de um aceito.
 *
 * O que torna isso grave é a trava: a linha também impede a segunda tentativa. Uma falha silenciosa
 * não atrasa a pesquisa daquele cliente, ELIMINA — ele nunca mais entra na fila, e o único sinal é
 * uma resposta que não chega, que é indistinguível de alguém que não quis responder.
 *
 * ═══ TRÊS ESTADOS, E O TERCEIRO NÃO É SUCESSO ════════════════════════════════════════════════
 *
 * Aceito, recusado e <em>desconhecido</em>. O desconhecido é linha criada antes desta coluna
 * existir, ou qualquer caminho que grave sem registrar o resultado. Ele aparece como o que é, em
 * cinza. Somar desconhecido com sucesso é como a informação se perde de novo.
 */
export function Envios({ envios }: { envios: readonly EnvioNaTela[] }) {
  const [state, reenviar, pendente] = useActionState(reenviarPesquisa, null);

  if (envios.length === 0) return null;

  const aceitos = envios.filter((e) => e.envioOk === true).length;
  const recusados = envios.filter((e) => e.envioOk === false).length;
  const desconhecidos = envios.filter((e) => e.envioOk === null).length;

  return (
    <section className="mt-10">
      <h2 className="font-display text-lg font-semibold text-ink">Envios, um a um</h2>
      <p className="mt-1 max-w-prose text-sm text-graphite">
        {aceitos} {aceitos === 1 ? 'aceito' : 'aceitos'} pelo provedor
        {recusados > 0 && <> · {recusados} recusados</>}
        {desconhecidos > 0 && <> · {desconhecidos} sem registro</>}.
      </p>

      {/*
        A ressalva não é rodapé: é o limite do que esta tela pode afirmar. "Aceito" quer dizer que o
        Resend recebeu a requisição — chave válida, remetente autorizado, endereço bem formado. Se a
        mensagem depois quicou ou caiu no spam do destinatário, isso não chega por aqui. Sem esta
        linha, a tela verde seria lida como "entregue" e a conclusão seria falsa.
      */}
      <p className="mt-2 max-w-prose text-xs text-graphite">
        <strong>Aceito não é entregue.</strong> Significa que o provedor recebeu a mensagem — se ela
        quicou ou caiu no spam do destinatário, isso só apareceria com um webhook do Resend, que
        este projeto não tem.
      </p>

      {state && (
        <p
          className={`mt-3 rounded border p-3 text-sm ${
            'ok' in state ? 'border-court/30 bg-court/5 text-ink' : 'border-warn/40 bg-warn/5 text-warn'
          }`}
        >
          {'ok' in state ? state.ok : state.error}
        </p>
      )}

      <ol className="mt-4 divide-y divide-line rounded border border-line bg-white">
        {envios.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 text-sm">
            <span className="w-24 shrink-0 tabular-nums text-graphite">{e.dia}</span>
            <span className="min-w-0 flex-1 truncate text-ink">{e.email ?? 'sem e-mail'}</span>

            {e.envioOk === true && <span className="text-court">aceito</span>}
            {e.envioOk === null && <span className="text-graphite">sem registro</span>}
            {e.envioOk === false && (
              <>
                <span className="text-warn">
                  recusado{e.envioErro !== null && <> · {e.envioErro}</>}
                </span>
                {/*
                  Um formulário por linha, e não um botão com `onClick`: sobrevive a JavaScript não
                  hidratado e é o padrão do resto do painel.
                */}
                <form action={reenviar}>
                  <input type="hidden" name="id" value={e.id} />
                  <button
                    type="submit"
                    disabled={pendente}
                    className="rounded border border-clay px-3 py-1 font-semibold text-clay
                               disabled:opacity-50"
                  >
                    {pendente ? 'Enviando…' : 'Tentar de novo'}
                  </button>
                </form>
              </>
            )}

            {e.respondeu && <span className="font-semibold text-court">respondeu</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
