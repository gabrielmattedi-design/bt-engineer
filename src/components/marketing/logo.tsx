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
      <defs>
        <clipPath id="te-ball">
          <circle cx="60" cy="60" r="41" />
        </clipPath>
        {/*
          Face da raquete: o grid do book não é uma grade retangular cortada pelo círculo — tem
          contorno CURVO, como a cabeça de uma raquete vista em perspectiva. Recortar por uma elipse
          inclinada é o que produz essa borda.
        */}
        <clipPath id="te-face">
          <ellipse cx="41" cy="64" rx="21" ry="29" transform="rotate(-8 41 64)" />
        </clipPath>
      </defs>

      {/* Marcas de registro — traço-ponto de desenho técnico, cruzando a borda da bola. */}
      <g stroke="currentColor" strokeWidth="1.2" strokeDasharray="5 3 1.5 3">
        <line x1="60" y1="7" x2="60" y2="26" />
        <line x1="60" y1="94" x2="60" y2="113" />
        <line x1="7" y1="60" x2="26" y2="60" />
        <line x1="94" y1="60" x2="113" y2="60" />
      </g>

      {/*
        Leito de cordas em PERSPECTIVA, não em grade reta: no book as linhas convergem, como a
        face de uma raquete vista de ângulo. O `skewX` é o que produz essa inclinação.
      */}
      <g clipPath="url(#te-face)" stroke="currentColor" strokeWidth="0.7" opacity="0.65">
        <g transform="skewX(-6) translate(5 0)">
          {[24, 30, 36, 42, 48, 54].map((x) => (
            <line key={`v${x}`} x1={x} y1="30" x2={x} y2="98" />
          ))}
          {[38, 44, 50, 56, 62, 68, 74, 80, 86, 92].map((y) => (
            <line key={`h${y}`} x1="16" y1={y} x2="58" y2={y} />
          ))}
        </g>
      </g>

      {/* Costuras da bola: arco fino à esquerda, S marcado à direita. */}
      <g clipPath="url(#te-ball)" fill="none" stroke="currentColor">
        <path d="M 36 25 Q 20 62 44 95" strokeWidth="1.1" />
        <path d="M 87 34 Q 95 60 88 90" strokeWidth="1.6" />
      </g>

      {/* Contorno da bola. */}
      <circle cx="60" cy="60" r="41" stroke="currentColor" strokeWidth="2.6" />

      {/*
        LIGADURA T+E — o ponto que eu tinha errado.
        A barra superior avança à ESQUERDA da haste, formando o T de "Tennis"; a haste com os dois
        braços à direita forma o E de "Engineer". Não é um E isolado dentro de um círculo.
      */}
      <path
        d="M 40 36 H 84 V 44 H 66 V 58.5 H 81.5 V 66.5 H 66 V 83 H 85 V 91 H 54 V 44 H 40 Z"
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
