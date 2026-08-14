import { cn } from '@/lib/cn';
import type { PodiumEntry } from '@/payments/entitlements';

/**
 * Pódio — §28, §29.
 *
 * 1º central, maior, mais alto; 2º e 3º laterais. No mobile empilha mantendo a hierarquia.
 *
 * O bloqueio é de SERVIDOR: as entradas bloqueadas chegam aqui já sem marca, modelo ou foto
 * (§32). O blur é aplicado sobre um PLACEHOLDER, não sobre o dado real — o dado real nunca
 * chegou ao navegador.
 */
export function Podium({
  entries,
  onUnlock,
}: {
  entries: readonly PodiumEntry[];
  onUnlock?: React.ReactNode;
}) {
  const [first, ...rest] = entries;
  if (!first) return null;

  return (
    <section>
      <h2 className="font-display text-2xl font-bold">O pódio da sua análise</h2>
      <p className="mt-2 text-sm text-graphite">
        As três raquetes com maior compatibilidade com o perfil que você informou.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3 sm:items-end">
        {/* 2º — lateral esquerda no desktop, segundo no mobile */}
        {rest[0] && <PodiumCard entry={rest[0]} height="sm" order="sm:order-1" />}
        {/* 1º — central, maior, mais alto */}
        <PodiumCard entry={first} height="lg" order="sm:order-2" />
        {/* 3º */}
        {rest[1] && <PodiumCard entry={rest[1]} height="sm" order="sm:order-3" />}
      </div>

      {onUnlock}
    </section>
  );
}

function PodiumCard({
  entry,
  height,
  order,
}: {
  entry: PodiumEntry;
  height: 'sm' | 'lg';
  order: string;
}) {
  const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉';
  const isFirst = entry.rank === 1;

  return (
    <article
      className={cn(
        'rounded border bg-white p-5',
        order,
        isFirst ? 'border-2 border-ink sm:p-7' : 'border-line',
        height === 'lg' && 'sm:pb-10',
      )}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-2xl" aria-label={`${entry.rank}º lugar`}>
          {medal}
        </span>
        <div className="text-right">
          <div className={cn('display-number leading-none', isFirst ? 'text-5xl' : 'text-3xl')}>
            {entry.fit_score}%
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-widest text-graphite">match</div>
        </div>
      </div>

      {entry.locked ? (
        <div className="mt-5">
          {/* Placeholder borrado — não há dado real sob o blur. */}
          <div className="relative h-16 overflow-hidden rounded bg-line/60">
            <div className="string-bed absolute inset-0 blur-[6px]" aria-hidden />
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm font-medium text-graphite">
              <span aria-hidden>🔒</span> Modelo bloqueado
            </div>
          </div>
          <p className="mt-3 text-sm text-graphite">{entry.teaser}</p>
        </div>
      ) : (
        <div className="mt-5">
          <div className="text-xs uppercase tracking-wider text-graphite">{entry.brand}</div>
          <h3
            className={cn(
              'mt-1 font-display font-bold leading-tight',
              isFirst ? 'text-2xl' : 'text-lg',
            )}
          >
            {entry.product_name}
          </h3>

          {entry.technical_tie_with_previous && (
            <p className="mt-3 rounded bg-line/50 px-3 py-2 text-xs text-graphite">
              Empate técnico com a anterior — a escolha aqui é de preferência pessoal.
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-1.5">
            {entry.tags.map((tag) => (
              <span
                key={tag}
                className="rounded border border-line px-2 py-1 text-[10px] font-semibold
                           uppercase tracking-wider text-graphite"
              >
                {tag}
              </span>
            ))}
          </div>

          {isFirst && (
            <dl className="mt-6 space-y-2">
              {Object.entries(entry.indices).map(([key, value]) => (
                <div key={key} className="flex items-center gap-3">
                  <dt className="w-32 shrink-0 text-[11px] uppercase tracking-wider text-graphite">
                    {key}
                  </dt>
                  <dd className="flex flex-1 items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-line">
                      <div
                        className="h-full rounded-full bg-court"
                        style={{ width: `${value}%` }}
                      />
                    </div>
                    <span className="w-7 text-right text-xs tabular-nums">{value}</span>
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </article>
  );
}
