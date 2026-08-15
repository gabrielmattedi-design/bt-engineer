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
 * responde "isso é muito ou pouco?". O 50 é destacado porque é a média do catálogo — é a leitura
 * que o usuário realmente faz ("acima ou abaixo do normal?").
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
        Marcas em 25, 50 e 75 são referência de escala. O <strong>50</strong> é a média do catálogo
        avaliado — acima dele, esta raquete entrega mais que a média naquele aspecto.
      </p>
    </section>
  );
}
