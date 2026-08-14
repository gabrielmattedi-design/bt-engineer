import { cn } from '@/lib/cn';

/**
 * A marca (§39): "TENNIS ENGINEER / Seu jogo. Seu setup. Sob medida." deve ter bastante destaque.
 * O subtítulo acompanha a wordmark na home e no cabeçalho do relatório (§64). Nunca abreviar.
 */
export function Wordmark({
  size = 'md',
  withTagline = true,
  className,
}: {
  size?: 'sm' | 'md' | 'lg';
  withTagline?: boolean;
  className?: string;
}) {
  const sizes = {
    sm: 'text-sm',
    md: 'text-xl sm:text-2xl',
    lg: 'text-4xl sm:text-6xl',
  } as const;

  const taglineSizes = {
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-sm sm:text-base',
  } as const;

  return (
    <div className={className}>
      <div className={cn('wordmark leading-none', sizes[size])}>Tennis Engineer</div>
      {withTagline && (
        <p className={cn('mt-2 text-graphite', taglineSizes[size])}>
          Seu jogo. Seu setup. Sob medida.
        </p>
      )}
    </div>
  );
}
