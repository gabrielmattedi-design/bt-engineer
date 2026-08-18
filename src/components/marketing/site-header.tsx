import Link from 'next/link';
import { Wordmark } from './wordmark';
import { cn } from '@/lib/cn';

/**
 * Cabeçalho do site — fixo no topo e sempre clicável de volta para a home.
 *
 * ═══ POR QUE FIXO ════════════════════════════════════════════════════════════════════════════
 *
 * As páginas deste produto são longas: o questionário tem sete etapas e o relatório passa de dez
 * seções. Com o cabeçalho rolando para fora, a marca aparecia no primeiro segundo e sumia pelo
 * resto da leitura — justamente na parte em que a pessoa está decidindo se confia no que está
 * lendo. Um relatório técnico que perde a assinatura no meio vira um texto qualquer.
 *
 * ═══ POR QUE CLICÁVEL ════════════════════════════════════════════════════════════════════════
 *
 * Porque todo mundo tenta. A marca no topo esquerdo é o botão de "voltar ao início" mais universal
 * da web, e quando ela não é link a pessoa não conclui que ali não tem link — conclui que o site
 * travou. Custava um `<Link>`.
 *
 * ═══ POR QUE TRÊS TONS, E NÃO UM SÓ ══════════════════════════════════════════════════════════
 *
 * Cada página tem sua própria temperatura: o questionário e a análise são claros, o relatório abre
 * escuro, os planos vêm no verde institucional. Uniformizar em um tom só seria redesenhar três
 * telas para resolver um problema de comportamento. O componente carrega o comportamento; a cor
 * continua sendo decisão de cada página.
 *
 * A marca segue a regra inegociável do brand book em todos eles: preta sobre claro, branca sobre
 * escuro, nunca colorida.
 */
const TONES = {
  light: 'border-line bg-paper/95 text-ink',
  dark: 'border-white/10 bg-ink/95 text-paper',
  court: 'border-white/10 bg-court/95 text-paper',
} as const;

export function SiteHeader({
  tone = 'light',
  withTagline = true,
}: {
  tone?: keyof typeof TONES;
  /** O relatório e o catálogo já anunciam do que tratam; ali a linha de conceito é repetição. */
  withTagline?: boolean;
}) {
  return (
    <header
      className={cn(
        /*
          `backdrop-blur` porque o fundo é translúcido: sem ele, o conteúdo que passa por baixo
          continua legível através do cabeçalho e as duas camadas se embaralham na rolagem.
        */
        'sticky top-0 z-40 border-b backdrop-blur',
        TONES[tone],
      )}
    >
      <div className="mx-auto max-w-5xl px-6 py-4">
        <Link
          href="/"
          aria-label="Tennis Engineer — voltar ao início"
          className="inline-block rounded transition-opacity hover:opacity-80
                     focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4
                     focus-visible:outline-current"
        >
          <Wordmark
            size="sm"
            tone={tone === 'light' ? 'light' : 'dark'}
            withTagline={withTagline}
          />
        </Link>
      </div>
    </header>
  );
}
