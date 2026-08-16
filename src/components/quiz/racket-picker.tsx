'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';

export type RacketOption = {
  readonly id: string;
  readonly brand: string;
  readonly name: string;
};

/**
 * Busca da raquete atual dentro do catálogo.
 *
 * ─── POR QUE BUSCA E NÃO TEXTO LIVRE ─────────────────────────────────────────────────────────
 *
 * Existem centenas de modelos, multiplicados por geração e por peso. Pedir para digitar produziria
 * um dado que ninguém consegue interpretar com segurança — "Blade 98" pode ser 16×19 ou 18×20, v7
 * ou v9, 305 g ou 285 g, e cada combinação tem comportamento diferente em quadra.
 *
 * Mas a comparação só é possível contra uma variante cujas ESPECIFICAÇÕES nós temos. O universo
 * real da pergunta é, portanto, exatamente o nosso catálogo — e nele a busca é trivial.
 *
 * Quem não encontra a própria raquete descreve em texto. O motor marca `unrecognized`, baixa a
 * confiança e diz isso no relatório, em vez de inventar uma comparação.
 */
export function RacketPicker({
  options,
  valueId,
  freeText,
  onSelect,
  onFreeText,
}: {
  readonly options: readonly RacketOption[];
  readonly valueId: string | null;
  readonly freeText: string | null;
  readonly onSelect: (id: string | null) => void;
  readonly onFreeText: (text: string | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [describing, setDescribing] = useState(!!freeText);

  const selected = options.find((o) => o.id === valueId) ?? null;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    // Casa termo a termo: "blade 18" encontra "Wilson Blade 98 18x20 v9".
    const terms = q.split(/\s+/);
    return options
      .filter((o) => {
        const haystack = `${o.brand} ${o.name}`.toLowerCase();
        return terms.every((t) => haystack.includes(t));
      })
      .slice(0, 8);
  }, [query, options]);

  if (selected) {
    return (
      <div className="rounded border-2 border-court bg-white p-4">
        <p className="text-xs uppercase tracking-wider text-graphite">{selected.brand}</p>
        <p className="mt-1 font-display font-semibold">{selected.name}</p>
        <button
          type="button"
          onClick={() => {
            onSelect(null);
            setQuery('');
          }}
          className="mt-3 text-sm text-clay underline"
        >
          Trocar
        </button>
      </div>
    );
  }

  if (describing) {
    return (
      <div>
        <textarea
          rows={2}
          maxLength={120}
          defaultValue={freeText ?? ''}
          onChange={(e) => onFreeText(e.target.value.trim() || null)}
          placeholder="Ex.: Head Speed MP branca, comprei em 2019"
          className="w-full rounded border border-line px-3 py-3 text-[15px]"
        />
        <p className="mt-2 text-xs text-graphite">
          Sem as especificações exatas não conseguimos comparar sua raquete atual com a
          recomendada. O relatório vai dizer isso abertamente.
        </p>
        <button
          type="button"
          onClick={() => {
            setDescribing(false);
            onFreeText(null);
          }}
          className="mt-3 text-sm text-clay underline"
        >
          Voltar para a busca
        </button>
      </div>
    );
  }

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por marca ou modelo"
        aria-label="Buscar sua raquete atual"
        className="w-full rounded border border-line px-3 py-3 text-[15px] focus-visible:border-court"
      />

      {query.trim().length >= 2 && (
        <ul className="mt-3 space-y-2">
          {results.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => onSelect(o.id)}
                className={cn(
                  'flex min-h-[56px] w-full flex-col justify-center rounded border-2 border-line',
                  'bg-white px-4 py-2 text-left transition-colors hover:border-court',
                )}
              >
                <span className="text-[11px] uppercase tracking-wider text-graphite">
                  {o.brand}
                </span>
                <span className="font-medium">{o.name}</span>
              </button>
            </li>
          ))}
          {results.length === 0 && (
            <li className="rounded border border-line bg-white px-4 py-3 text-sm text-graphite">
              Nenhuma raquete encontrada para “{query.trim()}”.
            </li>
          )}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setDescribing(true)}
        className="mt-4 text-sm text-clay underline"
      >
        Não encontrei minha raquete
      </button>
    </div>
  );
}
