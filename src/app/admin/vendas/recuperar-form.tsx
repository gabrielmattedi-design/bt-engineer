'use client';

import { useActionState } from 'react';
import { recuperarPagamento } from './acoes';

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
    </section>
  );
}
