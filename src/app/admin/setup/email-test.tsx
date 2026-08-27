'use client';

import { useActionState } from 'react';
import { sendTestEmail } from './actions';

/**
 * O botão que responde "sai e-mail deste site?".
 *
 * Cliente porque precisa de estado de formulário — o resto da seção de e-mail é servidor e assim
 * continua. Só esta parte, que tem um campo e um retorno, atravessa a fronteira.
 */
export function EmailTest() {
  const [state, action, pending] = useActionState(sendTestEmail, null);

  return (
    <form action={action} className="mt-4 rounded border border-line bg-white p-5">
      <label htmlFor="para" className="block text-sm font-semibold text-ink">
        Testar o envio
      </label>
      <p className="mt-1 max-w-prose text-sm text-graphite">
        Manda um e-mail agora e mostra exatamente o que o provedor respondeu. É o único teste que
        vale — o diagnóstico acima infere, este verifica.
      </p>

      <div className="mt-3 flex flex-wrap gap-3">
        <input
          id="para"
          name="para"
          type="email"
          required
          placeholder="seu@email.com"
          className="min-h-[48px] flex-1 rounded border border-line px-4"
        />
        <button
          type="submit"
          disabled={pending}
          className="min-h-[48px] rounded bg-court px-6 font-semibold text-paper
                     transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? 'Enviando…' : 'Enviar teste'}
        </button>
      </div>

      {state && (
        <p
          className={`mt-3 rounded border p-3 text-sm ${
            'ok' in state ? 'border-court/30 bg-court/5' : 'border-warn/40 bg-warn/5 text-warn'
          }`}
        >
          {'ok' in state ? state.ok : state.error}
        </p>
      )}

      {/*
        "Enviado" não é o mesmo que "chegou".

        O Resend aceitar a requisição prova que a chave e o domínio estão certos — não prova que a
        mensagem passou pelos filtros do destinatário. Quem parar no "enviado com sucesso" pode
        concluir que está tudo certo com o e-mail parado no spam de todo mundo.
      */}
      <p className="mt-3 text-xs text-graphite">
        &quot;Enviado&quot; significa que o provedor aceitou. Confirme que a mensagem chegou de
        fato — e olhe o spam: os primeiros e-mails de um domínio novo costumam cair lá até ele
        ganhar reputação.
      </p>
    </form>
  );
}
