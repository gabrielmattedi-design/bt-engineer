'use client';

import { useActionState } from 'react';
import { startCheckout } from './actions';

export function CheckoutButton({ sessionId, sku }: { sessionId: string; sku: string }) {
  const [state, action, pending] = useActionState(startCheckout, undefined);

  return (
    <form action={action}>
      <input type="hidden" name="session_id" value={sessionId} />
      <input type="hidden" name="sku" value={sku} />

      {/*
        O e-mail vem ANTES do botão, e com o motivo escrito ao lado.

        Um campo de e-mail sem explicação, no meio de um checkout, lê-se como cadastro para receber
        propaganda — e é o ponto exato em que se desiste da compra. Dizer para que ele serve
        transforma o mesmo campo em benefício: é o que devolve o relatório se o navegador for
        fechado, o celular trocado ou o cache limpo.

        `id` inclui o SKU porque os dois planos aparecem lado a lado na mesma tela; sem isso os
        dois formulários teriam campos com o mesmo id, e clicar no rótulo de um focaria o outro.
      */}
      <div className="mt-4">
        <label htmlFor={`email-${sku}`} className="text-sm font-medium">
          Seu e-mail
        </label>
        <input
          id={`email-${sku}`}
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="voce@exemplo.com"
          className="mt-1 min-h-[52px] w-full rounded border border-line px-3
                     focus-visible:border-court"
        />
        <p className="mt-1.5 text-[13px] leading-snug text-graphite">
          Enviamos o link da sua análise para cá. É por ele que você volta depois, de qualquer
          aparelho.
        </p>
      </div>

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
