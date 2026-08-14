import { cn } from '@/lib/cn';

/**
 * A marca (§39): "TENNIS ENGINEER / Seu jogo. Seu setup. Sob medida." deve ter bastante destaque.
 * O subtítulo acompanha a wordmark na home e no cabeçalho do relatório (§64). Nunca abreviar.
 *
 * ─── REGRA DA MARCA (brand book) ──────────────────────────────────────────────────────────────
 * "A marca Tennis Engineer deve ser aplicada sempre em preto ou branco.
 *  Cores de destaque nunca são aplicadas à marca."
 *
 * A prop `tone` é a ÚNICA forma de mudar a cor da wordmark, e ela só oferece as duas opções
 * permitidas. Não existe caminho para pintar o logotipo de verde, laranja, azul ou amarelo —
 * intencionalmente. `className` ajusta espaçamento e alinhamento, nunca cor.
 */
export function Wordmark({
  size = 'md',
  tone = 'light',
  withTagline = true,
  className,
}: {
  size?: 'sm' | 'md' | 'lg';
  /** Fundo sobre o qual a marca é aplicada: `light` → marca preta, `dark` → marca branca. */
  tone?: 'light' | 'dark';
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
      <div
        className={cn(
          'wordmark leading-none',
          tone === 'dark' ? 'wordmark-on-dark' : 'wordmark-on-light',
          sizes[size],
        )}
      >
        Tennis Engineer
      </div>
      {withTagline && (
        <p className={cn('mt-2', tone === 'dark' ? 'text-paper/70' : 'text-graphite', taglineSizes[size])}>
          Seu jogo. Seu setup. Sob medida.
        </p>
      )}
    </div>
  );
}

/**
 * Assinatura de rodapé do brand book. Acompanha a marca no fechamento das páginas.
 * Como é ASSINATURA da marca, segue a mesma regra: preto ou branco, nunca colorida.
 */
export function BrandSignature({
  tone = 'light',
  className,
}: {
  tone?: 'light' | 'dark';
  className?: string;
}) {
  return (
    <p
      className={cn(
        'brand-signature',
        tone === 'dark' ? 'wordmark-on-dark' : 'wordmark-on-light',
        className,
      )}
    >
      Sua evolução é o nosso projeto.
    </p>
  );
}
