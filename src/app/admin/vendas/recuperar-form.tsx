'use client';

import { useActionState } from 'react';
import { recuperarPagamento, varrerPagamentosPerdidos } from './acoes';
import { brl } from '@/payments/catalogo';

/**
 * O formulário de recuperação de uma compra que não entrou.
 *
 * ═══ POR QUE ELE FICA VISÍVEL O TEMPO TODO ═══════════════════════════════════════════════════
 *
 * O padrão da casa é o contrário — `ReconciliarFunilForm` só aparece quando existe incoerência,
 * justamente para o botão não virar hábito. Aqui não dá para seguir esse padrão: o sintoma de uma
 * compra perdida é uma linha que **não existe**, e não há como o sistema detectar a ausência de
 * algo que ele nunca soube que deveria ter.
 *
 * Quem percebe é o cliente, mandando o comprovante. Então o controle precisa estar onde o dono vai
 * procurar quando isso acontecer — e é por isso que o texto explica quando usar, em vez de só
 * oferecer um campo.
 */
export function RecuperarPagamentoForm() {
  const [state, action, pendente] = useActionState(recuperarPagamento, null);

  return (
    <section className="mt-12 rounded border border-line bg-white p-5">
      <h2 className="font-display text-lg font-semibold text-ink">
        Uma venda não apareceu aqui?
      </h2>
      <p className="mt-1 max-w-prose text-sm text-graphite">
        Cliente pagou, tem comprovante, e a venda não está na lista. Acontece quando a notificação
        do Mercado Pago se perde no caminho — o dinheiro entra e o nosso lado não fica sabendo.
      </p>
      <p className="mt-2 max-w-prose text-sm text-graphite">
        Cole o <strong className="text-ink">número da transação</strong> do comprovante. Eu consulto
        o Mercado Pago e, <strong className="text-ink">se ele confirmar que está pago</strong>,
        concedo o acesso e mando o relatório — o mesmo caminho da notificação normal.
      </p>

      <form action={action} className="mt-4 flex flex-wrap gap-3">
        <input
          name="pagamento"
          inputMode="numeric"
          required
          placeholder="179878109696"
          className="min-h-[48px] flex-1 rounded border border-line px-4 tabular-nums"
        />
        <button
          type="submit"
          disabled={pendente}
          className="min-h-[48px] rounded bg-clay px-6 font-semibold text-white
                     transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pendente ? 'Consultando…' : 'Recuperar'}
        </button>
      </form>

      {state && (
        <p
          className={`mt-3 max-w-prose rounded border p-3 text-sm ${
            'ok' in state
              ? 'border-court/30 bg-court/5 text-ink'
              : 'border-warn/40 bg-warn/5 text-warn'
          }`}
        >
          {'ok' in state ? state.ok : state.error}
        </p>
      )}

      {/*
        A ressalva que evita as duas perguntas que este formulário provoca.

        "Posso clicar de novo?" — pode: a idempotência é por pagamento + estado, no banco, e a
        segunda vez devolve "já processado" sem conceder nada.

        "Isso marca como pago?" — não. Quem decide é a API do Mercado Pago; o campo só escolhe qual
        pagamento consultar. Sem esta linha, o controle parece um interruptor de faturamento.
      */}
      <p className="mt-3 max-w-prose text-xs text-graphite">
        Pode clicar duas vezes sem medo: o segundo clique reconhece que já foi processado e não
        concede nada de novo. E isto não marca nada como pago por conta própria — quem confirma o
        pagamento é o Mercado Pago.
      </p>

      <VarreduraDePagamentos />
    </section>
  );
}

/**
 * A varredura: conferir TODOS os aprovados do gateway contra os pedidos daqui.
 *
 * ═══ POR QUE ELA PRECISA EXISTIR AO LADO DO BOTÃO DE RECUPERAR ═══════════════════════════════
 *
 * O formulário acima conserta UMA venda, e só funciona quando alguém já sabe que ela existe. No
 * caso de 19/09/2026 quem soube foi o cliente, reclamando.
 *
 * A pergunta que sobra — "e os que não reclamaram?" — não tem resposta do lado de cá: uma venda
 * perdida não deixa rastro, e um checkout sem desfecho é igualzinho a alguém que desistiu. Só o
 * gateway sabe a diferença.
 *
 * Sem esta varredura, o botão de recuperar é uma ferramenta que depende de o cliente ser educado o
 * bastante para cobrar em vez de sumir.
 */
function VarreduraDePagamentos() {
  const [state, action, pendente] = useActionState(varrerPagamentosPerdidos, null);
  const orfas = state && 'orfas' in state ? state.orfas : [];

  return (
    <div className="mt-8 border-t border-line pt-6">
      <h3 className="text-sm font-semibold text-ink">Conferir tudo com o Mercado Pago</h3>
      <p className="mt-1 max-w-prose text-sm text-graphite">
        Pega todos os pagamentos <strong className="text-ink">aprovados</strong> no período e
        confere um a um contra as vendas registradas aqui. É a mesma conferência que se faria com o
        extrato na mão.
      </p>

      <form action={action} className="mt-3 flex flex-wrap items-center gap-3">
        <label className="text-sm text-graphite">
          Últimos{' '}
          <input
            name="dias"
            type="number"
            min={1}
            max={90}
            defaultValue={30}
            className="w-20 rounded border border-line px-3 py-2 text-ink tabular-nums"
          />{' '}
          dias
        </label>
        <button
          type="submit"
          disabled={pendente}
          className="min-h-[48px] rounded border border-court px-6 font-semibold text-court
                     disabled:opacity-50"
        >
          {pendente ? 'Conferindo…' : 'Conferir'}
        </button>
      </form>

      {state && (
        <p
          className={`mt-3 max-w-prose rounded border p-3 text-sm ${
            'error' in state
              ? 'border-warn/40 bg-warn/5 text-warn'
              : orfas.length === 0
                ? 'border-court/30 bg-court/5 text-ink'
                : 'border-warn/40 bg-warn/5 text-ink'
          }`}
        >
          {'error' in state ? state.error : state.ok}
        </p>
      )}

      {orfas.length > 0 && (
        <ol className="mt-3 divide-y divide-line rounded border border-line">
          {orfas.map((o) => (
            <li key={o.pagamento} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3 text-sm">
              <span className="font-semibold tabular-nums text-ink">{o.pagamento}</span>
              <span className="min-w-0 flex-1 truncate text-graphite">
                {o.email ?? 'sem e-mail'}
                {o.valorCentavos > 0 && <> · {brl(o.valorCentavos)}</>}
              </span>
              {o.tipo === 'pendente' ? (
                <span className="text-clay">ficou pendente — dá para recuperar</span>
              ) : (
                /*
                  O gateway conhece um pedido que não existe neste banco. Recuperar não resolve:
                  não há o que conceder. Dizer isso aqui evita a próxima meia hora clicando num
                  botão que nunca vai funcionar para este caso.
                */
                <span className="font-medium text-warn">pedido não existe aqui — me chame</span>
              )}
            </li>
          ))}
        </ol>
      )}

      {orfas.some((o) => o.tipo === 'pendente') && (
        <p className="mt-3 max-w-prose text-xs text-graphite">
          Para cada um marcado como pendente, cole o número acima no campo{' '}
          <strong className="text-ink">Recuperar</strong> e confirme.
        </p>
      )}
    </div>
  );
}
