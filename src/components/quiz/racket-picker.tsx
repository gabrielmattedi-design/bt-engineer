'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { racketModelLabel } from '@/domain/racket';

export type RacketOption = {
  readonly id: string;
  readonly brand: string;
  /** Nome do modelo SEM geração — "Pure Drive", nunca "Pure Drive Gen 11 (2025)". */
  readonly model: string;
  readonly weightG: number | null;
};

/**
 * "Pure Drive · 300 g" — o que a pessoa consegue reconhecer na própria raquete.
 *
 * A forma vem de `racketModelLabel`, no domínio, e não de uma montagem local. O relatório precisa
 * chamar a raquete atual do MESMO jeito que esta lista chamou, e enquanto as duas montagens eram
 * separadas elas divergiram: aqui saía "Blade 98 16×19 · 305 g" e lá saía "Wilson Blade 98 16×19
 * v10 (2026)" — uma versão que a pessoa nunca declarou.
 */
function label(option: RacketOption): string {
  return racketModelLabel(option.model, option.weightG);
}

/**
 * Busca da raquete atual dentro do catálogo.
 *
 * ─── POR QUE BUSCA E NÃO TEXTO LIVRE ─────────────────────────────────────────────────────────
 *
 * Existem centenas de modelos, multiplicados por geração e por peso. Pedir para digitar produziria
 * um dado que ninguém consegue interpretar com segurança — "Blade 98" pode ser 16×19 ou 18×20,
 * 305 g ou 285 g, e cada combinação tem comportamento diferente em quadra.
 *
 * Mas a comparação só é possível contra uma variante cujas ESPECIFICAÇÕES nós temos. O universo
 * real da pergunta é, portanto, exatamente o nosso catálogo — e nele a busca é trivial.
 *
 * ─── SEM GERAÇÃO, COM PESO ───────────────────────────────────────────────────────────────────
 *
 * A lista mostra "Pure Drive · 300 g", não "Pure Drive Gen 11 (2025)". Ninguém sabe de que geração
 * é a própria raquete, e ver um ano que não bate faz a pessoa concluir que a dela não está na
 * lista — perdendo a comparação por causa de um detalhe que não muda o cálculo. Peso, cabeça e
 * balanço praticamente não se movem entre gerações do mesmo modelo; o que muda é layup e pintura.
 * Ver o cabeçalho de `app/questionario/page.tsx` para o raciocínio completo.
 *
 * A BUSCA continua aceitando o que a pessoa digitar, inclusive o nome da geração ("blade v7"), e
 * casa pelo que reconhece. Ela só não precisa acertar a geração para encontrar.
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
    /**
     * Casa termo a termo, e IGNORA os termos que não existem no catálogo.
     *
     * "blade 98 v7" precisa encontrar a Blade 98 — o "v7" é a geração, que deixou de aparecer nos
     * rótulos mas continua vindo do teclado de quem sabe a própria. Exigir que todo termo case
     * devolveria lista vazia justamente para quem deu a informação mais precisa.
     */
    const terms = q.split(/\s+/);
    const haystacks = options.map((o) => `${o.brand} ${label(o)}`.toLowerCase());
    const useful = terms.filter((t) => haystacks.some((h) => h.includes(t)));
    if (useful.length === 0) return [];

    return options
      .filter((_, i) => useful.every((t) => haystacks[i]!.includes(t)))
      .slice(0, 8);
  }, [query, options]);

  if (selected) {
    return (
      <div className="rounded border-2 border-court bg-white p-4">
        <p className="text-xs uppercase tracking-wider text-graphite">{selected.brand}</p>
        <p className="mt-1 font-display font-semibold">{label(selected)}</p>
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
        placeholder="Ex.: pure drive, blade 98, ezone"
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
                <span className="font-medium">{label(o)}</span>
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

      <p className="mt-3 text-xs text-graphite">
        Não se preocupe com o ano ou a versão da sua — escolha o modelo e o peso.
      </p>

      <button
        type="button"
        onClick={() => setDescribing(true)}
        className="mt-3 text-sm text-clay underline"
      >
        Não encontrei minha raquete
      </button>
    </div>
  );
}
