/**
 * Monograma Tennis Engineer — brand book, página 01.
 *
 * Quatro elementos, todos com significado declarado no book:
 *   • círculo + costuras  — a bola de tênis
 *   • grid                — o leito de cordas (o "engineer" do nome)
 *   • letra E             — o monograma
 *   • marcas de registro  — desenho técnico, o "precisão" da marca
 *
 * ─── REGRA DA MARCA, IMPOSTA PELA CONSTRUÇÃO ─────────────────────────────────────────────────
 *
 * "A marca deve ser aplicada sempre em preto ou branco. Cores de destaque nunca são aplicadas à
 * marca." (brand book, pág. 04)
 *
 * Todo traço usa `currentColor`, e o componente `<Logo>` só expõe `tone: 'light' | 'dark'`, que
 * resolvem para preto e branco. Não existe prop de cor. Pintar este monograma de verde ou laranja
 * exigiria reescrever o componente — que é exatamente a barreira que se quer.
 *
 * O book também proíbe distorcer, aplicar sombra e alterar proporções: por isso o `viewBox` é fixo
 * e o dimensionamento é sempre proporcional, por altura.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      className={className}
      role="img"
      aria-label="Tennis Engineer"
    >
      {/* Marcas de registro — desenho técnico (brand book pág. 03, "marcas de blueprint"). */}
      <g stroke="currentColor" strokeWidth="1.5" opacity="0.85">
        <line x1="60" y1="2" x2="60" y2="16" />
        <line x1="60" y1="104" x2="60" y2="118" />
        <line x1="2" y1="60" x2="16" y2="60" />
        <line x1="104" y1="60" x2="118" y2="60" />
      </g>

      <defs>
        <clipPath id="te-ball">
          <circle cx="60" cy="60" r="41" />
        </clipPath>
      </defs>

      {/* Leito de cordas, recortado pela bola. */}
      <g clipPath="url(#te-ball)" stroke="currentColor" strokeWidth="1.1" opacity="0.75">
        {[24, 29, 34, 39, 44, 49].map((x) => (
          <line key={`v${x}`} x1={x} y1="20" x2={x} y2="100" />
        ))}
        {[26, 31, 36, 41, 46, 51, 56, 61, 66, 71, 76, 81, 86, 91].map((y) => (
          <line key={`h${y}`} x1="19" y1={y} x2="52" y2={y} />
        ))}
      </g>

      {/* Costuras da bola. */}
      <g clipPath="url(#te-ball)" stroke="currentColor" strokeWidth="2.5" fill="none">
        <path d="M 33 25 Q 45 60 33 95" />
        <path d="M 89 25 Q 77 60 89 95" />
      </g>

      {/* Contorno da bola. */}
      <circle cx="60" cy="60" r="41" stroke="currentColor" strokeWidth="3" />

      {/* Monograma E. */}
      <path
        d="M 40 34 H 82 V 46 H 52 V 54 H 74 V 66 H 52 V 74 H 82 V 86 H 40 Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Marca completa: monograma + nome + tagline (brand book, "logo principal").
 * O book manda nunca abreviar para "TE" e sempre manter a tagline nas aplicações principais.
 */
export function Logo({
  size = 'md',
  tone = 'light',
  withTagline = true,
  className,
}: {
  size?: 'sm' | 'md' | 'lg';
  /** Fundo sobre o qual a marca é aplicada. `light` → marca preta, `dark` → marca branca. */
  tone?: 'light' | 'dark';
  withTagline?: boolean;
  className?: string;
}) {
  const mark = { sm: 'h-8 w-8', md: 'h-12 w-12', lg: 'h-20 w-20 sm:h-24 sm:w-24' }[size];
  const name = { sm: 'text-base', md: 'text-2xl', lg: 'text-4xl sm:text-5xl' }[size];
  const tag = { sm: 'text-[9px]', md: 'text-[11px]', lg: 'text-sm' }[size];
  const gap = { sm: 'gap-2', md: 'gap-3', lg: 'gap-4' }[size];

  return (
    <div
      className={[
        'flex items-center',
        gap,
        tone === 'dark' ? 'text-white' : 'text-ink',
        className ?? '',
      ].join(' ')}
    >
      <LogoMark className={`${mark} shrink-0`} />
      <div className="min-w-0">
        <div className={`font-display font-bold leading-[1.05] tracking-tight ${name}`}>
          Tennis Engineer
        </div>
        {withTagline && (
          <div className={`mt-0.5 font-display leading-tight opacity-70 ${tag}`}>
            Seu jogo. Seu setup. Sob medida.
          </div>
        )}
      </div>
    </div>
  );
}
