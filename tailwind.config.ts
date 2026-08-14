import type { Config } from 'tailwindcss';

/** Tokens de docs/DESIGN.md §2. Uma cor de acento por tela; muito branco; raio pequeno. */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0B0F14',
        paper: '#FAFAF8',
        graphite: '#5A6472',
        line: '#E4E6E3',
        court: '#1F6F5C',
        signal: '#C8FF3D',
        warn: '#B45309',
      },
      borderRadius: { sm: '4px', DEFAULT: '6px', lg: '8px' },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      letterSpacing: { tightest: '-0.03em' },
      maxWidth: { prose: '68ch' },
    },
  },
  plugins: [],
} satisfies Config;
