/**
 * Divisor de seção desenhado como marcação de quadra.
 *
 * ─── POR QUE ISTO E NÃO UM `border-top` ──────────────────────────────────────────────────────
 *
 * A capa já tem um elemento gráfico que funciona: o quadriculado do topo, que dá ar de prancha de
 * engenharia. O que faltava era continuidade — abaixo do herói a página virava uma pilha de blocos
 * separados por traços genéricos, e o vocabulário visual sumia justamente onde começa o argumento
 * comercial.
 *
 * Uma quadra de tênis não é separada por traços: ela é dividida por MARCAÇÕES, cada uma com
 * significado. Reaproveitar esse vocabulário resolve o problema visual e o conceitual ao mesmo
 * tempo — a página passa a ser lida como uma quadra vista de cima, e cada seção ocupa um setor.
 *
 * ─── AS TRÊS MARCAÇÕES ───────────────────────────────────────────────────────────────────────
 *
 *   baseline  ──────────────┴──────────────   linha de fundo, com a marca central.
 *   service   ──────────────┼──────────────   linha de saque, cortada pela linha central.
 *   alley     ═══════════════════════════════ corredor de duplas: duas linhas paralelas.
 *
 * Elas não são decoração intercambiável. A `baseline` fecha um bloco (a marca central aponta para
 * dentro do que terminou), a `service` separa dois blocos de mesmo peso, e a `alley` marca a
 * passagem para um território diferente — é a que separa o conteúdo institucional do comercial.
 *
 * ─── SOBRE `aria-hidden` ─────────────────────────────────────────────────────────────────────
 *
 * O divisor é puramente visual: não é um `<hr>` semântico porque as seções já são `<section>` com
 * títulos próprios, e anunciar "separador" três vezes a um leitor de tela só adiciona ruído a uma
 * estrutura que já está correta.
 */

type Variant = 'baseline' | 'service' | 'alley';

/**
 * `tone` acompanha o FUNDO da seção, não a marca.
 *
 * Sobre o verde institucional a linha é branca esmaecida; sobre o papel, a mesma linha cinza do
 * resto da interface. Uma única cor fixa desapareceria em metade da página.
 */
export function CourtDivider({
  variant = 'service',
  tone = 'light',
  className,
}: {
  readonly variant?: Variant;
  readonly tone?: 'light' | 'dark';
  readonly className?: string;
}) {
  /**
   * Linha de quadra é PINTADA em branco, e no verde ela é o elemento de maior contraste do campo.
   *
   * A primeira versão usava 25% de opacidade e sumia: o herói e os pilares, ambos sobre o verde
   * institucional, continuavam lidos como um bloco só — exatamente o problema que o divisor existe
   * para resolver. Sobre o papel o traço pode ser discreto, porque ali já há troca de fundo; sobre
   * o verde ele precisa ter a presença que tem na quadra real.
   */
  const line = tone === 'dark' ? 'bg-paper/45' : 'bg-line';
  const mark = tone === 'dark' ? 'bg-paper/75' : 'bg-graphite/45';

  return (
    <div className={`relative w-full ${className ?? ''}`} aria-hidden>
      <div className={`h-px w-full ${line}`} />

      {variant === 'alley' && <div className={`mt-[6px] h-px w-full ${line}`} />}

      {/*
        A marca central é posicionada a partir do centro e deslocada por metade da própria
        largura — não por `left: calc(50% - 1px)` — para que continue centrada se a espessura
        mudar. `-translate-x-1/2` faz isso sem que a medida apareça duplicada no código.
      */}
      {variant !== 'alley' && (
        <>
          <div
            className={`absolute left-1/2 top-0 h-[14px] w-px -translate-x-1/2 ${mark}`}
          />
          {variant === 'service' && (
            <div
              className={`absolute bottom-full left-1/2 h-[14px] w-px -translate-x-1/2 ${mark}`}
            />
          )}
        </>
      )}
    </div>
  );
}
