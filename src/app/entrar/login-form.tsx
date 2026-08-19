'use client';

import { useActionState } from 'react';
import { requestLink, type LoginRequestResult } from './actions';

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginRequestResult | undefined, FormData>(
    requestLink,
    undefined,
  );

  /*
    Depois de enviar, o formulário SOME e dá lugar à confirmação.

    Deixá-lo na tela convidaria a clicar de novo — e cada clique é mais um e-mail idêntico na caixa
    de entrada, até bater no limite e a pessoa receber um erro por ter feito o que a tela sugeria.
  */
  if (state && 'sent' in state) {
    return (
      <div className="mt-8 rounded border border-court/30 bg-court/5 p-6">
        <h2 className="font-display text-lg font-semibold">Se esse e-mail tem análises, o link já saiu.</h2>
        <p className="mt-2 text-sm leading-relaxed text-graphite">
          Verifique sua caixa de entrada — e o spam, que é onde a primeira mensagem de um remetente
          novo costuma cair. O link vale por <strong>15 minutos</strong>.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-graphite">
          Não chegou nada? Pode ser que a compra tenha sido feita com outro endereço. Tente o outro
          e-mail, ou{' '}
          <a href="/" className="text-clay underline">
            volte ao início
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="mt-8">
      <label htmlFor="email" className="text-sm font-medium">
        Seu e-mail
      </label>
      <p className="mt-1 text-[13px] text-graphite">
        O mesmo que você usou na compra. Enviamos um link de acesso — não existe senha.
      </p>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="voce@exemplo.com"
          className="min-h-[56px] flex-1 rounded border border-line px-4 focus-visible:border-court"
        />
        <button
          type="submit"
          disabled={pending}
          className="flex min-h-[56px] items-center justify-center rounded bg-court px-8
                     font-semibold text-paper transition-opacity hover:opacity-90
                     disabled:opacity-50"
        >
          {pending ? 'Enviando…' : 'Enviar link'}
        </button>
      </div>

      {state && 'error' in state && (
        <p className="mt-3 rounded border border-warn/40 bg-warn/5 p-3 text-sm text-warn">
          {state.error}
        </p>
      )}
    </form>
  );
}
