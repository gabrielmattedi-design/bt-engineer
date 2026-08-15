import { LogoMark } from './logo';
import { cn } from '@/lib/cn';

/**
 * Selos proprietários Tennis Engineer.
 *
 * ─── A REGRA QUE ESTE COMPONENTE EXISTE PARA GARANTIR ────────────────────────────────────────
 *
 * A assinatura abreviada da marca é o MONOGRAMA, nunca as letras "TE" digitadas. Escrito como
 * texto, "TE" é lido como uma tentativa de escrever "the" em inglês, e derruba a sofisticação da
 * marca.
 *
 * Por isso não existe prop de texto para o prefixo: o `<LogoMark>` é fixo na estrutura do
 * componente. Escrever "TE VERIFIED" exigiria não usar este componente — e um teste procura por
 * essa string no código de UI justamente para impedir que alguém o faça.
 *
 * O monograma aqui não é letra decorativa: é SELO DE ORIGEM da tecnologia Tennis Engineer. É o que
 * permite a família crescer de forma consistente — VERIFIED, MATCH ENGINE, PLAYER PROFILE,
 * SETUP SCORE — sem redesenhar nada.
 *
 * Cor: preto sobre fundo claro, branco sobre fundo escuro. Nunca colorido (brand book pág. 04).
 */
export function Seal({
  label,
  subtitle,
  tone = 'light',
  size = 'md',
  className,
}: {
  /** Sempre em caixa alta e SEM o prefixo "TE" — o monograma já é a assinatura. */
  label: string;
  subtitle?: string;
  tone?: 'light' | 'dark';
  size?: 'sm' | 'md';
  className?: string;
}) {
  const mark = size === 'sm' ? 'h-5 w-5' : 'h-7 w-7';
  const text = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div className={cn(tone === 'dark' ? 'text-white' : 'text-ink', className)}>
      <div className="flex items-center gap-2">
        {/* Em selo o monograma é sempre a versão simplificada: aqui ele vive em 20–28 px. */}
        <LogoMark className={`${mark} shrink-0`} simplified />
        <span className={cn('font-display font-bold uppercase tracking-[0.14em]', text)}>
          {label}
        </span>
      </div>
      {subtitle && (
        <p className={cn('mt-1.5 text-xs', tone === 'dark' ? 'text-paper/70' : 'text-graphite')}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

/** Selo inline, para usar dentro de um bloco de conteúdo (ex.: cabeçalho de tabela). */
export function SealInline({
  label,
  tone = 'light',
  className,
}: {
  label: string;
  tone?: 'light' | 'dark';
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 align-middle',
        tone === 'dark' ? 'text-white' : 'text-ink',
        className,
      )}
    >
      <LogoMark className="h-4 w-4 shrink-0" simplified />
      <span className="font-display text-[11px] font-bold uppercase tracking-[0.14em]">
        {label}
      </span>
    </span>
  );
}
