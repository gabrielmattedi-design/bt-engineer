'use client';

import { useActionState } from 'react';
import { startCheckout } from './actions';

export function CheckoutButton({ sessionId, sku }: { sessionId: string; sku: string }) {
  const [state, action, pending] = useActionState(startCheckout, undefined);

  return (
    <form action={action}>
      <input type="hidden" name="session_id" value={sessionId} />
      <input type="hidden" name="sku" value={sku} />
      {state?.error && <p className="mt-3 text-sm text-warn">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-4 flex min-h-[56px] w-full items-center justify-center rounded bg-clay
                   font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? 'Abrindo pagamento…' : 'Continuar para o pagamento'}
      </button>
    </form>
  );
}
