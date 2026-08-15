import { cn } from '@/lib/cn';
import { Logo } from './logo';

/**
 * A marca (§39): "TENNIS ENGINEER / Seu jogo. Seu setup. Sob medida." deve ter bastante destaque.
 * O subtítulo acompanha a wordmark na home e no cabeçalho do relatório (§64). Nunca abreviar.
 *
 * ─── REGRA DA MARCA (brand book) ──────────────────────────────────────────────────────────────
 * "A marca Tennis Engineer deve ser aplicada sempre em preto ou branco.
 *  Cores de destaque nunca são aplicadas à marca."
 *
 * A prop `tone` é a ÚNICA forma de mudar a cor da wordmark, e ela só oferece as duas opções
 * permitidas. Não existe caminho para pintar o logotipo de verde, laranja, azul ou amarelo —
 * intencionalmente. `className` ajusta espaçamento e alinhamento, nunca cor.
 */
/**
 * `Wordmark` é hoje um apelido de `Logo` — mantido porque várias telas já o importam.
 *
 * A implementação real do monograma está em `logo.tsx`, desenhada a partir do brand book. Até
 * aqui a marca era só o nome em texto; o símbolo (bola + cordas + E + marcas de registro) não
 * existia no site.
 */
export function Wordmark(props: {
  size?: 'sm' | 'md' | 'lg';
  tone?: 'light' | 'dark';
  withTagline?: boolean;
  className?: string;
}) {
  return <Logo {...props} />;
}

/**
 * Assinatura de rodapé do brand book. Acompanha a marca no fechamento das páginas.
 * Como é ASSINATURA da marca, segue a mesma regra: preto ou branco, nunca colorida.
 */
export function BrandSignature({
  tone = 'light',
  className,
}: {
  tone?: 'light' | 'dark';
  className?: string;
}) {
  return (
    <p
      className={cn(
        'brand-signature',
        tone === 'dark' ? 'wordmark-on-dark' : 'wordmark-on-light',
        className,
      )}
    >
      Sua evolução é o nosso projeto.
    </p>
  );
}
