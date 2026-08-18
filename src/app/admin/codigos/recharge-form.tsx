'use client';

import { useActionState } from 'react';
import { rechargeCode } from './actions';

/**
 * Recarga de um código — soma usos ao teto sem apagar o contador.
 *
 * Fica ao lado de cada código, e não numa tela separada, porque a decisão de recarregar nasce
 * olhando "restam 0". Um formulário isolado exigiria digitar o código de novo, que é digitação sem
 * informação nova e uma chance a mais de errar o alvo.
 *
 * Só o código LIMITADO recebe o controle: recarregar ilimitado não significa nada, e oferecer o
 * botão ali ensinaria que ele faz algo.
 */
export function RechargeForm({ code }: { code: string }) {
  const [state, action, pending] = useActionState(rechargeCode, null);

  return (
    <form action={action} className="mt-3 flex flex-wrap items-center gap-2">
      <input type="hidden" name="code" value={code} />
      <label className="text-sm text-graphite" htmlFor={`amount-${code}`}>
        Recarregar
      </label>
      <input
        id={`amount-${code}`}
        name="amount"
        type="number"
        min={1}
        defaultValue={20}
        className="w-20 rounded border border-line px-2 py-1 text-sm tabular-nums"
      />
      <span className="text-sm text-graphite">usos</span>
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-ink px-3 py-1 text-sm font-medium
                   transition-colors hover:bg-ink hover:text-paper disabled:opacity-50"
      >
        {pending ? 'Recarregando…' : 'Aplicar'}
      </button>

      {state && 'ok' in state && <span className="text-sm text-court">{state.ok}</span>}
      {state && 'error' in state && <span className="text-sm text-warn">{state.error}</span>}
    </form>
  );
}
