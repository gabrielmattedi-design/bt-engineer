'use client';

import { useActionState, useState } from 'react';
import { redeemAccessCode } from './actions';

/**
 * Resgate de código de acesso.
 *
 * ─── POR QUE FICA RECOLHIDO ATRÁS DE UM LINK ─────────────────────────────────────────────────
 *
 * Um campo de cupom aberto na tela de pagamento é um convite: quem não tem código passa a
 * procurar um, e uma parte das pessoas abandona a compra para ir caçar desconto que não existe.
 * É um efeito conhecido e mensurável em checkout.
 *
 * Recolhido, ele fica invisível para quem não sabe que existe — e a um clique de quem recebeu o
 * código junto com o link. Que é exatamente a distinção que este produto precisa fazer agora.
 */
export function CouponForm({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(redeemAccessCode, undefined);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-6 text-sm text-graphite underline underline-offset-4"
      >
        Tenho um código de acesso
      </button>
    );
  }

  return (
    <form action={action} className="mt-6 rounded border border-line bg-white p-5">
      <input type="hidden" name="session_id" value={sessionId} />
      <label htmlFor="access-code" className="text-sm font-medium">
        Código de acesso
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          id="access-code"
          name="code"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="Digite o código"
          className="min-h-[52px] flex-1 rounded border border-line px-3 text-[15px] uppercase
                     focus-visible:border-court"
        />
        <button
          type="submit"
          disabled={pending}
          className="min-h-[52px] rounded border-2 border-ink px-6 font-semibold
                     transition-colors hover:bg-ink hover:text-paper disabled:opacity-50"
        >
          {pending ? 'Validando…' : 'Aplicar'}
        </button>
      </div>

      {/*
        Opcional aqui, ao contrário do checkout — e o rótulo diz isso.

        Quem entra por convite costuma estar testando a pedido de alguém, às vezes num aparelho
        emprestado. Exigir cadastro para um teste é atrito sem contrapartida. Marcar "opcional" no
        rótulo evita o outro extremo: o campo sem marca é lido como obrigatório e produz a mesma
        desistência que a obrigatoriedade produziria.
      */}
      <div className="mt-4 border-t border-line pt-4">
        <label htmlFor="coupon-email" className="text-sm font-medium">
          Seu e-mail <span className="font-normal text-graphite">(opcional)</span>
        </label>
        <input
          id="coupon-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="voce@exemplo.com"
          className="mt-1 min-h-[52px] w-full rounded border border-line px-3
                     focus-visible:border-court"
        />
        <p className="mt-1.5 text-[13px] leading-snug text-graphite">
          Informe se quiser receber o link da análise e poder voltar a ela depois.
        </p>
      </div>

      {state?.error && <p className="mt-3 text-sm text-warn">{state.error}</p>}
    </form>
  );
}
