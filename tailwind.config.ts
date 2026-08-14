import type { Config } from 'tailwindcss';

/**
 * Tokens da marca — Tennis Engineer Brand Book + docs/DESIGN.md §2.
 *
 * REGRA DA MARCA (brand book): "A marca Tennis Engineer deve ser aplicada sempre em preto ou
 * branco. Cores de destaque nunca são aplicadas à marca." As cores abaixo vestem a INTERFACE —
 * fundos, gráficos, estados, acentos — nunca o logotipo. Ver `.wordmark` em globals.css.
 *
 * Uma cor de acento por tela continua valendo: a paleta é ampla para dar vocabulário aos gráficos
 * e aos estados, não para colorir tudo ao mesmo tempo.
 */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Marca ────────────────────────────────────────────────────────────────────────────
        /** Verde profundo. Cor institucional: fundos de destaque, cabeçalhos, rodapé. */
        court: '#0E3D2E',
        /** Verde médio. Superfícies secundárias, gráficos, estados de sucesso. */
        'court-mid': '#3A7D63',
        /** Laranja. Acento primário de ação — CTA, destaque de resultado. */
        clay: '#D85A2B',
        /** Azul. Informação técnica, links, dados de referência. */
        signal: '#1491E6',
        /** Amarelo bola. Realce pontual, badges, marcação de progresso. */
        ball: '#FFC62E',

        // ── Neutros ──────────────────────────────────────────────────────────────────────────
        ink: '#0B0F14',
        paper: '#FAFAF8',
        graphite: '#5A6472',
        line: '#E4E6E3',
        warn: '#B45309',
      },
      borderRadius: { sm: '4px', DEFAULT: '6px', lg: '8px' },
      fontFamily: {
        /** Sora — títulos, números grandes e wordmark. */
        display: ['var(--font-display)', 'Sora', 'system-ui', 'sans-serif'],
        /** Inter — texto corrido e interface. */
        sans: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      letterSpacing: { tightest: '-0.03em' },
      maxWidth: { prose: '68ch' },
    },
  },
  plugins: [],
} satisfies Config;
