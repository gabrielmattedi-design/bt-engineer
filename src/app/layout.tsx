import type { Metadata, Viewport } from 'next';
import './globals.css';

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
  themeColor: '#0B0F14',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
