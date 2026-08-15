import { Seal } from './seal';
import { IconChart, IconData, IconEngine, IconGauge, IconPrecision } from './icons';

/**
 * Os seis pilares comerciais — a seção que explica por que a recomendação tem valor.
 *
 * Dois deles são SELOS PROPRIETÁRIOS, assinados pelo monograma. Os outros quatro são números e
 * princípios, com a iconografia da pág. 03 do brand book.
 *
 * ─── UMA NOTA SOBRE O SELO VERIFIED ──────────────────────────────────────────────────────────
 *
 * O texto do selo descreve o MÉTODO ("cada especificação tem fonte registrada e conferência
 * humana"), não afirma que todo o catálogo já está conferido. A diferença não é retórica: hoje o
 * catálogo está em curadoria, e um selo dizendo "dados verificados" numa home enquanto 0 de 46
 * raquetes foram conferidas seria exatamente a promessa falsa que o §58 proíbe.
 *
 * Quando a curadoria terminar, o texto pode ficar mais afirmativo — e aí será verdade.
 */

type Pillar = {
  readonly seal?: string;
  readonly headline?: string;
  readonly title: string;
  readonly body: string;
  readonly Icon?: (props: { className?: string }) => React.ReactElement;
};

const PILLARS: readonly Pillar[] = [
  {
    headline: '20+',
    title: 'Variáveis analisadas',
    body: 'Físico, técnica, swing, estilo, objetivos, conforto e equipamento atual.',
    Icon: IconData,
  },
  {
    headline: 'MILHARES',
    title: 'de combinações possíveis',
    body: 'Raquete, corda, espessura e tensão são avaliadas como um conjunto, não isoladamente.',
    Icon: IconChart,
  },
  {
    seal: 'MATCH ENGINE',
    title: 'Motor de recomendação proprietário',
    body: 'Motor proprietário Tennis Engineer. O mesmo conjunto de respostas produz sempre o mesmo resultado.',
    Icon: IconEngine,
  },
  {
    headline: 'IA + ENGENHARIA',
    title: 'Cada uma no seu lugar',
    body: 'IA para interpretar o que você escreve. Engenharia para recomendar — a IA nunca escolhe o equipamento.',
    Icon: IconPrecision,
  },
  {
    seal: 'VERIFIED',
    title: 'Dados técnicos verificados',
    body: 'Cada especificação tem fonte registrada e conferência humana antes de sustentar uma recomendação paga.',
    Icon: IconGauge,
  },
  {
    headline: 'INDEPENDENTE',
    title: 'Sem preferência de marca',
    body: 'Não vendemos equipamento e não recebemos por indicação. Nenhuma marca tem vantagem no cálculo.',
    Icon: IconChart,
  },
];

export function Pillars() {
  return (
    <div className="grid gap-px overflow-hidden rounded border border-paper/15 bg-paper/15 sm:grid-cols-2 lg:grid-cols-3">
      {PILLARS.map((p) => (
        <div key={p.seal ?? p.headline} className="relative bg-court p-6">
          {p.Icon && (
            <p.Icon className="absolute right-4 top-4 h-8 w-8 text-paper/25" />
          )}

          {p.seal ? (
            <Seal label={p.seal} tone="dark" />
          ) : (
            <div className="display-number text-2xl leading-none text-ball sm:text-3xl">
              {p.headline}
            </div>
          )}

          <h3 className="mt-3 font-display text-sm font-semibold text-paper">{p.title}</h3>
          <p className="mt-2 max-w-[34ch] text-xs leading-relaxed text-paper/65">{p.body}</p>
        </div>
      ))}
    </div>
  );
}
