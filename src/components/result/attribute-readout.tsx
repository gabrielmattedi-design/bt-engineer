import { Seal } from '@/components/marketing/seal';
import { cn } from '@/lib/cn';

/**
 * Leitura técnica dos índices — o "quanto esta raquete entrega em cada aspecto".
 *
 * Usa a linguagem gráfica do brand book (pág. 03): escala com marcas de graduação, como um
 * instrumento de medição, e não a barra de progresso arredondada de app de consumo. A escala
 * graduada comunica MEDIÇÃO; a barra arredondada comunica CARREGAMENTO — e o que está sendo
 * mostrado aqui é medição.
 *
 * As marcas em 25 / 50 / 75 existem para dar referência: sem elas, uma barra preenchida não
 * responde "isso é muito ou pouco?".
 *
 * ═══ O 50 NÃO É A MÉDIA, E A LEGENDA DIZIA QUE ERA ══════════════════════════════════════════
 *
 * Este comentário e a legenda na tela afirmavam: "o 50 é a média do catálogo avaliado — acima
 * dele, esta raquete entrega mais que a média naquele aspecto". As duas frases estavam erradas.
 *
 * Os valores exibidos são POSIÇÃO na faixa que o catálogo ocupa em cada eixo, e a posição 50 é o
 * MEIO dessa faixa, não a média das raquetes que a preenchem. As duas coisas só coincidem se a
 * distribuição for simétrica, e ela não é. Medida a posição da média real nas 47 raquetes:
 *
 *     potência 49,4 · controle 42,5 · spin 60,5 · conforto 46,5
 *     estabilidade 57,7 · manobrabilidade 42,9 · precisão 39,5
 *
 * Em spin a média do catálogo cai em 60,5: uma raquete marcando 55 estava sendo apresentada como
 * "acima da média" quando está abaixo dela. Em precisão a média é 39,5, e o erro corre para o
 * outro lado. O desvio chega a 10,5 pontos numa escala de 100, e é sistemático, não aleatório.
 *
 * A legenda passa a descrever o que a barra de fato mede: onde a raquete cai DENTRO da faixa que
 * o mercado oferece naquele eixo. É uma afirmação mais modesta e é a verdadeira — e continua
 * respondendo a pergunta que o leitor faz, que é "isso é muito ou pouco?".
 *
 * A média real existe e viaja no resultado (`attribute_means`); quem a usa é o radar, que a
 * desenha como linha própria. Aqui ela não é desenhada, então não pode ser citada.
 *
 * Valores vêm em passos de 5 (R-04): o motor não tem precisão para afirmar 73 em vez de 75, e
 * exibir 73 transmitiria uma exatidão que não existe.
 */
/**
 * As chaves de `indices` são identificadores internos (`potencia`), não texto de interface.
 * Exibi-las cruas colocava "POTENCIA" sem acento na tela — erro de português num produto que se
 * vende como técnico e cuidadoso.
 */
const LABEL_PT: Record<string, string> = {
  potencia: 'Potência',
  controle: 'Controle',
  spin: 'Spin',
  conforto: 'Conforto',
  estabilidade: 'Estabilidade',
  manobrabilidade: 'Manobrabilidade',
};

export function AttributeReadout({
  indices,
  className,
}: {
  readonly indices: Readonly<Record<string, number>>;
  readonly className?: string;
}) {
  const entries = Object.entries(indices);

  return (
    <section className={cn('relative', className)}>
      <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
        <Seal label="Setup Score" />
        <span className="text-[11px] uppercase tracking-wider text-graphite">
          índice 0–100
        </span>
      </div>

      <dl className="mt-5 space-y-3.5">
        {entries.map(([key, value]) => (
          <div key={key} className="grid grid-cols-[7.5rem_1fr_2rem] items-center gap-3">
            <dt className="text-[11px] font-medium uppercase tracking-wider text-graphite">
              {LABEL_PT[key] ?? key}
            </dt>

            <dd className="relative h-4">
              {/* Trilho graduado — instrumento de medição, não barra de carregamento. */}
              <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 bg-line" />
              {[25, 50, 75].map((tick) => (
                <div
                  key={tick}
                  className={cn(
                    'absolute top-0 h-full w-px',
                    tick === 50 ? 'bg-graphite/40' : 'bg-line',
                  )}
                  style={{ left: `${tick}%` }}
                  aria-hidden
                />
              ))}
              {/* Preenchimento em Wimbledon Green — "gráficos e análises" (brand book pág. 01). */}
              <div
                className="absolute top-1/2 left-0 h-[3px] -translate-y-1/2 bg-court-mid"
                style={{ width: `${value}%` }}
              />
              {/* Ponteiro: leitura exata, como agulha de instrumento. */}
              <div
                className="absolute top-0 h-full w-[2px] bg-court"
                style={{ left: `calc(${value}% - 1px)` }}
                aria-hidden
              />
            </dd>

            <span className="text-right font-display text-sm font-semibold tabular-nums">
              {value}
            </span>
          </div>
        ))}
      </dl>

      <p className="mt-5 text-[11px] leading-relaxed text-graphite">
        A escala vai do menor ao maior valor que encontramos no catálogo em cada aspecto: o{' '}
        <strong>0</strong> é a raquete que menos entrega ali, o <strong>100</strong> é a que mais
        entrega. As marcas em 25, 50 e 75 dividem essa faixa em quatro — acima de 50, esta raquete
        está na metade de cima do que o mercado oferece naquele aspecto.
      </p>
    </section>
  );
}
