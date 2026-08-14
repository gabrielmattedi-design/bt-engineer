'use client';

import { useActionState } from 'react';
import { login } from './actions';

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <form action={action} className="mt-6 space-y-3">
      <label className="block text-sm font-medium" htmlFor="password">
        Senha
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        className="w-full rounded border border-line px-3 py-2 focus-visible:border-court"
      />
      {state?.error && <p className="text-sm text-warn">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="min-h-[48px] w-full rounded bg-clay font-semibold text-white disabled:opacity-50"
      >
        {pending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
