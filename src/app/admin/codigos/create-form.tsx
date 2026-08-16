'use client';

import { useActionState } from 'react';
import { createCode, type CodeResult } from './actions';

type Preset = { readonly label: string; readonly description: string };

export function CreateCodeForm({ presets }: { presets: Readonly<Record<string, Preset>> }) {
  const [state, action, pending] = useActionState<CodeResult | undefined, FormData>(
    createCode,
    undefined,
  );

  return (
    <form action={action} className="mt-6 rounded border border-line bg-white p-6">
      <h2 className="font-display text-lg font-semibold">Criar ou editar um código</h2>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="code" className="text-sm font-medium">
            Código
          </label>
          <input
            id="code"
            name="code"
            required
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="DJOKOINSS"
            className="mt-1 min-h-[52px] w-full rounded border border-line px-3 uppercase
                       focus-visible:border-court"
          />
        </div>

        <div>
          <label htmlFor="max_uses" className="text-sm font-medium">
            Limite de usos
          </label>
          <input
            id="max_uses"
            name="max_uses"
            inputMode="numeric"
            placeholder="deixe em branco para ilimitado"
            className="mt-1 min-h-[52px] w-full rounded border border-line px-3
                       focus-visible:border-court"
          />
        </div>
      </div>

      <fieldset className="mt-5">
        <legend className="text-sm font-medium">O que o código libera</legend>
        <div className="mt-2 space-y-2">
          {Object.entries(presets).map(([key, preset], i) => (
            <label
              key={key}
              className="flex min-h-[56px] cursor-pointer items-start gap-3 rounded border-2
                         border-line bg-paper px-4 py-3 hover:border-court"
            >
              <input
                type="radio"
                name="preset"
                value={key}
                defaultChecked={i === 0}
                className="mt-1 accent-court"
              />
              <span>
                <span className="block font-medium">{preset.label}</span>
                <span className="block text-[13px] text-graphite">{preset.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-5">
        <label htmlFor="note" className="text-sm font-medium">
          Anotação <span className="font-normal text-graphite">(opcional)</span>
        </label>
        <input
          id="note"
          name="note"
          placeholder="Para quem você mandou este código"
          className="mt-1 min-h-[52px] w-full rounded border border-line px-3
                     focus-visible:border-court"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-6 flex min-h-[56px] w-full items-center justify-center rounded bg-clay
                   px-6 font-semibold text-white transition-opacity hover:opacity-90
                   disabled:opacity-50 sm:w-auto"
      >
        {pending ? 'Salvando…' : 'Salvar código'}
      </button>

      {state && 'ok' in state && <p className="mt-3 text-sm text-court">{state.ok}</p>}
      {state && 'error' in state && <p className="mt-3 text-sm text-warn">{state.error}</p>}
    </form>
  );
}
