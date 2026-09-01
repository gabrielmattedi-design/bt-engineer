'use client';

import { useActionState } from 'react';
import { salvarPrecos } from './actions';
import type { PrecoEditavel } from '@/database/setup';
import type { SetupResult } from './actions';

/**
 * Edição dos preços — o `/admin/precos` que o §34 sempre previu, aqui dentro do preparo.
 *
 * ═══ POR QUE ELE PRECISA EXISTIR ═════════════════════════════════════════════════════════════
 *
 * Sem ele, mudar um preço exigia editar código e publicar. Num produto de dono não-técnico isso não
 * é "um pouco mais trabalhoso": é um preço que na prática não muda, ou que muda com uma semana de
 * atraso e a ajuda de outra pessoa.
 *
 * ═══ POR QUE UM FORMULÁRIO SÓ, COM TODOS OS CAMPOS ═══════════════════════════════════════════
 *
 * A coerência da escada é do conjunto. Subir a raquete avulsa sozinha pode deixá-la mais cara que o
 * pacote — um estado que a validação recusa, e com razão. Se cada campo salvasse por conta própria,
 * o dono teria de atravessar esse estado inválido para chegar ao válido, e seria barrado no meio do
 * caminho. Com um envio só, ele descreve a tabela que quer e ela vale inteira.
 */
export function PrecosForm({ precos }: { precos: readonly PrecoEditavel[] }) {
  const [state, formAction, pending] = useActionState(salvarPrecos, undefined as
    | SetupResult
    | undefined);

  if (precos.length === 0) {
    return (
      <p className="mt-4 text-sm text-graphite">
        Os produtos ainda não foram criados. Conclua o passo acima para poder ajustar os preços.
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-4 space-y-4">
      {precos.map((p) => (
        <div key={p.sku} className="flex flex-wrap items-center justify-between gap-3">
          <label htmlFor={`preco-${p.sku}`} className="text-sm">
            {p.name}
            <span className="ml-2 font-mono text-xs text-graphite">{p.sku}</span>
          </label>

          <div className="flex items-center gap-2">
            <span className="text-sm text-graphite">R$</span>
            {/*
              `inputMode="decimal"` e não `type="number"`.

              No celular, `number` abre um teclado que em vários aparelhos não traz vírgula — e o
              dono digitaria "2999" achando que escreveu "29,99". O campo aceita texto e a conversão
              acontece no servidor, que entende vírgula, ponto e o prefixo "R$".
            */}
            <input
              id={`preco-${p.sku}`}
              name={p.sku}
              type="text"
              inputMode="decimal"
              defaultValue={(p.priceCents / 100).toFixed(2).replace('.', ',')}
              className="w-28 rounded border border-line px-3 py-2 text-right font-mono text-sm"
            />
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-4 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="min-h-[48px] rounded bg-clay px-6 font-semibold text-white disabled:opacity-50"
        >
          {pending ? 'Salvando…' : 'Salvar preços'}
        </button>

        {state && 'ok' in state && <span className="text-sm text-court">{state.ok}</span>}
      </div>

      {state && 'error' in state && (
        <p className="rounded border border-warn/40 bg-warn/5 p-3 text-sm text-warn">
          {state.error}
        </p>
      )}

      {/*
        A explicação da recusa vem ANTES da recusa acontecer.

        As regras não são óbvias de fora, e descobri-las uma a uma por tentativa e erro faria a tela
        parecer quebrada. Ditas aqui, uma mensagem de erro deixa de ser surpresa e passa a ser
        lembrete.
      */}
      <p className="max-w-prose pt-1 text-xs text-graphite">
        Duas combinações são recusadas, as duas por criarem alguém que paga mais e recebe menos: o
        setup completo custar menos que a raquete avulsa, e a raquete mais o upgrade somarem menos
        que o setup completo. Fora isso, os valores são livres. Quem já comprou continua com o preço
        que pagou.
      </p>
    </form>
  );
}
