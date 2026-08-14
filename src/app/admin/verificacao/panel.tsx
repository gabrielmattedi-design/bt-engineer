'use client';

import { useActionState, useState } from 'react';
import { saveVerification } from '../actions';
import { VERIFIABLE_SPEC_FIELDS } from '@/data/verification-queue';
import type { RacketVariant } from '@/domain/racket';
import type { RacketVerification } from '@/data/load';
import { cn } from '@/lib/cn';

type Entry = {
  variant: RacketVariant;
  top3_hits: number;
  top1_hits: number;
  impact: number;
  saved: RacketVerification | null;
};

const AVAILABILITY_LABEL: Record<string, string> = {
  widely_available: 'Amplamente disponível',
  available: 'Disponível',
  limited: 'Limitada',
  not_found: 'Não encontrada no Brasil',
  unknown: 'Não conferida',
};

export function VerificationPanel({ queue }: { queue: Entry[] }) {
  const [openId, setOpenId] = useState<string | null>(queue[0]?.variant.id ?? null);

  return (
    <ol className="mt-6 space-y-2">
      {queue.map((entry) => {
        const verified = entry.saved?.state === 'verified';
        const open = openId === entry.variant.id;
        return (
          <li
            key={entry.variant.id}
            className={cn('rounded border bg-white', verified ? 'border-court-mid' : 'border-line')}
          >
            <button
              type="button"
              onClick={() => setOpenId(open ? null : entry.variant.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs',
                  verified ? 'bg-court-mid text-white' : 'border border-line text-graphite',
                )}
                aria-hidden
              >
                {verified ? '✓' : '·'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{entry.variant.product_name}</span>
                <span className="block text-xs text-graphite">
                  {entry.top1_hits > 0 && `1º lugar em ${entry.top1_hits} personas · `}
                  Top 3 em {entry.top3_hits} de 22
                  {entry.saved && ` · ${AVAILABILITY_LABEL[entry.saved.brazil_availability_status]}`}
                </span>
              </span>
              <span className="shrink-0 font-display text-sm tabular-nums text-graphite">
                {entry.impact}
              </span>
            </button>

            {open && <VerificationForm entry={entry} />}
          </li>
        );
      })}
    </ol>
  );
}

function VerificationForm({ entry }: { entry: Entry }) {
  const [state, action, pending] = useActionState(saveVerification, undefined);
  const saved = entry.saved;
  const specs = entry.variant.specs as unknown as Record<string, unknown>;

  const [sourceUrl, setSourceUrl] = useState(saved?.source_url ?? '');
  const [availability, setAvailability] = useState(saved?.brazil_availability_status ?? 'unknown');
  const [wantVerified, setWantVerified] = useState(saved?.state === 'verified');

  // A MESMA regra de `canMarkVerified`, refletida na UI. O botão desabilitado é conveniência; a
  // garantia real está na Server Action, que revalida tudo (ADMIN_SPEC §2).
  const blocked = wantVerified && (!sourceUrl.trim() || availability === 'unknown');

  return (
    <form action={action} className="border-t border-line px-4 py-5">
      <input type="hidden" name="product_name" value={entry.variant.product_name} />

      <p className="mb-4 text-xs text-graphite">
        Abra a ficha oficial da {entry.variant.brand} e confira os {VERIFIABLE_SPEC_FIELDS.length}{' '}
        campos abaixo <strong>lado a lado</strong>. Divergiu? Corrija no JSON do catálogo antes de
        marcar como verificada — nunca aceite o valor que já está aqui só porque está aqui.
      </p>

      <table className="w-full text-sm">
        <tbody>
          {VERIFIABLE_SPEC_FIELDS.map((field) => {
            const value = specs[field.key];
            return (
              <tr key={field.key} className="border-b border-line/60 last:border-0">
                <td className="py-1.5 text-graphite">{field.label}</td>
                <td className="py-1.5 text-right font-mono tabular-nums">
                  {value === null || value === undefined ? (
                    <span className="text-warn">não informado</span>
                  ) : (
                    `${String(value)} ${field.unit}`
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-5 space-y-3">
        <Field label="URL da ficha oficial (obrigatória para verificar)">
          <input
            name="source_url"
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://www.head.com/..."
            className="w-full rounded border border-line px-3 py-2 text-sm"
          />
        </Field>

        <Field label="URL de confirmação cruzada (varejista especializado)">
          <input
            name="cross_check_url"
            type="url"
            defaultValue={saved?.cross_check_url ?? ''}
            className="w-full rounded border border-line px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Disponibilidade no Brasil">
          <select
            name="brazil_availability_status"
            value={availability}
            onChange={(e) => setAvailability(e.target.value as typeof availability)}
            className="w-full rounded border border-line px-3 py-2 text-sm"
          >
            {Object.entries(AVAILABILITY_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Varejistas nacionais conferidos (URLs, um por linha)">
          <textarea
            name="brazil_sources"
            rows={2}
            defaultValue={(saved?.brazil_sources ?? []).join('\n')}
            className="w-full rounded border border-line px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Foto do produto — precisa ser desta variante E desta geração (§54)">
          <input
            name="image_url"
            type="url"
            defaultValue={saved?.image_url ?? ''}
            className="w-full rounded border border-line px-3 py-2 text-sm"
          />
        </Field>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="image_verified" defaultChecked={saved?.image_verified} />
          Confirmo que a foto é desta variante e geração
        </label>

        <Field label="Notas">
          <textarea
            name="notes"
            rows={2}
            defaultValue={saved?.notes ?? ''}
            className="w-full rounded border border-line px-3 py-2 text-sm"
          />
        </Field>

        <fieldset className="rounded border border-line p-3">
          <legend className="px-1 text-xs text-graphite">Estado</legend>
          {(
            [
              ['pending_verification', 'Pendente — ainda não conferi'],
              ['verified', 'Verificada — conferi campo a campo na fonte'],
              ['disputed', 'Divergente — as fontes não batem'],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 py-1 text-sm">
              <input
                type="radio"
                name="state"
                value={value}
                defaultChecked={(saved?.state ?? 'pending_verification') === value}
                onChange={() => setWantVerified(value === 'verified')}
              />
              {label}
            </label>
          ))}
        </fieldset>

        {blocked && (
          <p className="text-sm text-warn">
            Para marcar como verificada é preciso a URL da fonte e a disponibilidade no Brasil.
            Sem fonte, &ldquo;verificado&rdquo; significa apenas que alguém clicou num botão.
          </p>
        )}
        {state && 'error' in state && <p className="text-sm text-warn">{state.error}</p>}
        {state && 'ok' in state && (
          <p className="text-sm text-court-mid">Gravado em src/data/rackets/ — lembre de commitar.</p>
        )}

        <button
          type="submit"
          disabled={pending || blocked}
          className="min-h-[48px] w-full rounded bg-clay font-semibold text-white disabled:opacity-40"
        >
          {pending ? 'Gravando…' : 'Salvar'}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-graphite">{label}</span>
      {children}
    </label>
  );
}
