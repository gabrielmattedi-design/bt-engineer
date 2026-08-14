import type { Metadata, Viewport } from 'next';
import { Inter, Sora } from 'next/font/google';
import './globals.css';

/** Tipografia do brand book: Sora nos títulos e números, Inter no texto de interface. */
const sora = Sora({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  weight: ['400', '600', '700'],
});

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'Tennis Engineer — Seu jogo. Seu setup. Sob medida.',
  description:
    'Responda algumas perguntas sobre seu jogo e descubra quais equipamentos realmente combinam ' +
    'com você. Análise técnica de raquete, corda e tensão.',
  openGraph: {
    title: 'Tennis Engineer',
    description: 'Seu jogo. Seu setup. Sob medida.',
    locale: 'pt_BR',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Verde institucional da marca.
  themeColor: '#0E3D2E',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${sora.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
