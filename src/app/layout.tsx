import type { Metadata, Viewport } from 'next';
import { Inter, Sora } from 'next/font/google';
import './globals.css';
import { TestModeBanner } from '@/components/marketing/test-mode-banner';
import { SITE_URL } from '@/lib/site';

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
  /*
    `metadataBase` faltava, e sem ela o Next resolve as URLs de Open Graph contra `localhost`.
    O sintoma só aparece FORA do site: o link colado no WhatsApp ou no Instagram perde a prévia,
    porque o robô da rede social tenta buscar a imagem num endereço que não existe para ele.
  */
  metadataBase: new URL(SITE_URL),
  title: 'Tennis Engineer — Seu jogo. Seu setup. Sob medida.',
  description:
    'Responda algumas perguntas sobre seu jogo e descubra quais equipamentos realmente combinam ' +
    'com você. Análise técnica de raquete, corda e tensão.',
  openGraph: {
    title: 'Tennis Engineer',
    description: 'Seu jogo. Seu setup. Sob medida.',
    url: SITE_URL,
    siteName: 'Tennis Engineer',
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
      <body>
        <TestModeBanner />
        {children}
      </body>
    </html>
  );
}
