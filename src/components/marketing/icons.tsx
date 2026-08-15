/**
 * Iconografia da marca — brand book, página 03 ("iconografia e linguagem gráfica").
 *
 * Traço fino uniforme, sem preenchimento, cantos retos: é linguagem de desenho técnico, não de app
 * de consumo. Todos herdam `currentColor` e vivem em `viewBox` 0 0 48 48, para que troquem de
 * tamanho e cor sem ajuste.
 *
 * O book atribui um significado a cada um. Usá-los fora desse significado é o que transformaria a
 * linguagem em enfeite — então cada função carrega o rótulo original do book no comentário.
 */

type IconProps = { className?: string };

const S = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** "quadras e diagramas" */
export function IconCourt({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} {...S} aria-hidden>
      <rect x="4" y="10" width="40" height="28" />
      <line x1="24" y1="10" x2="24" y2="38" />
      <rect x="12" y="17" width="24" height="14" />
      <line x1="12" y1="24" x2="36" y2="24" />
    </svg>
  );
}

/** "trajetórias e movimento" */
export function IconTrajectory({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} {...S} aria-hidden>
      <path d="M 5 40 Q 16 8 36 13" strokeDasharray="3 3" />
      <path d="M 31 10 L 37 13 L 32 17" />
      <circle cx="42" cy="14" r="4" />
    </svg>
  );
}

/** "gráficos e análises" */
export function IconChart({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} {...S} aria-hidden>
      <line x1="8" y1="40" x2="8" y2="26" />
      <line x1="18" y1="40" x2="18" y2="18" />
      <line x1="28" y1="40" x2="28" y2="30" />
      <line x1="38" y1="40" x2="38" y2="14" />
      <polyline points="8,22 18,13 28,20 38,9" strokeDasharray="0" />
      {[
        [8, 22],
        [18, 13],
        [28, 20],
        [38, 9],
      ].map(([cx, cy]) => (
        <circle key={`${cx}`} cx={cx} cy={cy} r="2" />
      ))}
    </svg>
  );
}

/** "performance e indicadores" */
export function IconGauge({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} {...S} aria-hidden>
      <path d="M 6 34 A 18 18 0 0 1 42 34" />
      <line x1="24" y1="34" x2="33" y2="21" />
      <circle cx="24" cy="34" r="2.5" />
      <line x1="9" y1="27" x2="12" y2="28.5" />
      <line x1="24" y1="16" x2="24" y2="19" />
      <line x1="39" y1="27" x2="36" y2="28.5" />
    </svg>
  );
}

/** "precisão e alinhamento" */
export function IconPrecision({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} {...S} aria-hidden>
      <circle cx="24" cy="24" r="14" />
      <circle cx="24" cy="24" r="6" />
      <line x1="24" y1="4" x2="24" y2="14" />
      <line x1="24" y1="34" x2="24" y2="44" />
      <line x1="4" y1="24" x2="14" y2="24" />
      <line x1="34" y1="24" x2="44" y2="24" />
    </svg>
  );
}

/** "dados e conexões" */
export function IconData({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} {...S} aria-hidden>
      <rect x="18" y="18" width="12" height="12" rx="2" />
      <line x1="24" y1="18" x2="24" y2="10" />
      <line x1="24" y1="30" x2="24" y2="38" />
      <line x1="18" y1="24" x2="10" y2="24" />
      <line x1="30" y1="24" x2="38" y2="24" />
      <circle cx="24" cy="7" r="2.5" />
      <circle cx="24" cy="41" r="2.5" />
      <circle cx="7" cy="24" r="2.5" />
      <circle cx="41" cy="24" r="2.5" />
    </svg>
  );
}

/** "sistemas e engenharia" */
export function IconEngine({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} {...S} aria-hidden>
      <circle cx="24" cy="24" r="7" />
      <path d="M 24 6 L 24 11 M 24 37 L 24 42 M 6 24 L 11 24 M 37 24 L 42 24 M 11 11 L 15 15 M 33 33 L 37 37 M 37 11 L 33 15 M 15 33 L 11 37" />
      <circle cx="24" cy="24" r="15" strokeDasharray="4 4" />
    </svg>
  );
}

/** "enquadramento técnico" */
export function IconFrame({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} {...S} aria-hidden>
      <polyline points="8,18 8,8 18,8" />
      <polyline points="30,8 40,8 40,18" />
      <polyline points="40,30 40,40 30,40" />
      <polyline points="18,40 8,40 8,30" />
      <line x1="24" y1="19" x2="24" y2="29" />
      <line x1="19" y1="24" x2="29" y2="24" />
    </svg>
  );
}

/** "sistemas e engenharia" aplicado a independência — escudo com marca de conferência. */
export function IconShield({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} {...S} aria-hidden>
      <path d="M 24 6 L 39 12 V 25 C 39 34 32 40 24 43 C 16 40 9 34 9 25 V 12 Z" />
      <polyline points="17,24 22,29 31,19" />
    </svg>
  );
}
