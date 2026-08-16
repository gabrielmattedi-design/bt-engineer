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
        {/*
          Posição em tipografia, não em emoji de medalha.
          Emojis de pódio são renderizados pelo SISTEMA: mudam de desenho entre Android, iOS e
          Windows, chegam coloridos — o que contraria a paleta — e trazem um tom de gamificação
          que briga com "instrumento técnico". Um numeral tem aparência idêntica em todo aparelho.
        */}
        <span
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full font-display text-sm font-bold',
            isFirst ? 'bg-court text-paper' : 'border border-line text-graphite',
          )}
          aria-label={`${entry.rank}º lugar`}
        >
          {entry.rank}
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
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <rect x="4" y="10" width="16" height="10" rx="2" />
                <path d="M 8 10 V 7 a 4 4 0 0 1 8 0 v 3" />
              </svg>
              Modelo bloqueado
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

          {/*
            A leitura técnica NÃO fica aqui. No pódio cada card ocupa ~200px, e uma escala
            graduada nessa largura vira um risco: as marcas de 25/50/75 colapsam e o ponteiro fica
            indistinguível do trilho. Ela vive na seção principal do relatório, em largura cheia.
          */}
        </div>
      )}
    </article>
  );
}
