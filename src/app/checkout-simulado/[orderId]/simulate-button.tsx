'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { simulatePayment } from './actions';

export function SimulateButton({ orderId, returnUrl }: { orderId: string; returnUrl: string }) {
  const [state, action, pending] = useActionState(simulatePayment, undefined);
  const paid = state && 'ok' in state;

  return (
    <div className="mt-6">
      {!paid && (
        <form action={action} className="space-y-3">
          <input type="hidden" name="order_id" value={orderId} />
          <button
            type="submit"
            name="status"
            value="paid"
            disabled={pending}
            className="min-h-[56px] w-full rounded bg-clay font-semibold text-white disabled:opacity-50"
          >
            {pending ? 'Processando…' : 'Confirmar pagamento'}
          </button>
          <button
            type="submit"
            name="status"
            value="failed"
            disabled={pending}
            className="min-h-[48px] w-full rounded border border-line text-sm text-graphite"
          >
            Simular falha
          </button>
        </form>
      )}

      {state && 'error' in state && <p className="mt-3 text-sm text-warn">{state.error}</p>}

      {paid && (
        <div className="space-y-3">
          <p className="rounded border border-court-mid/40 bg-court-mid/5 p-3 text-sm text-court-mid">
            Webhook processado: <code className="break-all">{state.body}</code>
          </p>
          <Link
            href={returnUrl}
            className="flex min-h-[56px] items-center justify-center rounded bg-court font-semibold text-paper"
          >
            Ver meu relatório
          </Link>
        </div>
      )}
    </div>
  );
}
