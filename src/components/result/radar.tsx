import type { RadarAxis } from '@/payments/radar';

/**
 * Radar de compatibilidade — SVG puro, sem biblioteca de gráficos.
 *
 * ─── POR QUE SVG À MÃO ───────────────────────────────────────────────────────────────────────
 *
 * Um radar de seis eixos é trigonometria de dez linhas. Uma biblioteca de gráficos custaria entre
 * 40 e 150 kB no bundle, traria seu próprio sistema de cores para brigar com a paleta da marca, e
 * quase certamente exigiria `'use client'` — transformando uma seção estática de um relatório
 * lido uma vez em componente hidratado no navegador.
 *
 * Como SVG servido pelo servidor, o gráfico chega pronto, imprime bem e usa exatamente as cores
 * do brand book.
 *
 * ─── COMO LER ────────────────────────────────────────────────────────────────────────────────
 *
 * Todo eixo está em ADEQUAÇÃO: 100 é a borda, e significa "perfeito para você neste aspecto".
 * Quanto MAIOR o polígono, melhor a raquete serve ao jogador — e o maior é, por construção, o que o
 * motor escolheu, porque é a mesma conta que decidiu o ranking.
 *
 * Os nove eixos vêm em dois blocos. Os cinco primeiros são o que a raquete faz com a BOLA; os
 * quatro últimos são o quanto ela encaixa em VOCÊ — peso, nível, swing e braço. O gráfico antigo
 * mostrava só o primeiro bloco, e por isso conseguia contradizer a recomendação: ele escondia
 * justamente os eixos que mais pesam na decisão.
 *
 * As quatro séries se distinguem por COR e por TRAÇO, nunca só por cor: cerca de 8% dos homens
 * têm alguma deficiência na visão de cores, e um gráfico que depende de distinguir verde de
 * laranja é ilegível para eles. Aqui a recomendada é preenchida, o perfil é tracejado, a atual é
 * pontilhada e o catálogo é uma linha fina contínua.
 */

/**
 * Cores literais, não `var(--color-*)`.
 *
 * A paleta deste projeto vive no `tailwind.config.ts` e vira classe utilitária — não existe
 * custom property em CSS para ela. Dentro de um `<svg>` os atributos `stroke` e `fill` não aceitam
 * classe do Tailwind, então a alternativa seria criar variáveis só para este componente. Os
 * literais aqui são os mesmos hexadecimais do config, e o teste de marca cobre a divergência.
 */
const PALETTE = {
  court: '#0E3D2E',
  clay: '#D85A2B',
  ink: '#0B0F14',
  graphite: '#5A6472',
  line: '#E4E6E3',
} as const;

const SIZE = 320;
const CENTER = SIZE / 2;
const RADIUS = 108;

/**
 * Folga horizontal da `viewBox`, para os RÓTULOS.
 *
 * A teia cabe em 320 px, mas os nomes dos eixos ficam fora dela — e "MANOBRABILIDADE", ancorado à
 * esquerda, saía da caixa e aparecia cortado como "BRABILIDADE". Aumentar o `SIZE` encolheria a
 * teia junto; estender só a `viewBox` deixa o desenho no tamanho e dá espaço para o texto.
 *
 * A folga vertical é menor porque no topo e na base os rótulos ficam centralizados, e crescem para
 * os dois lados em vez de para fora.
 */
const PAD_X = 62;
const PAD_Y = 8;

/** Ângulo do eixo `i`, começando no topo e girando no sentido horário. */
function angle(index: number, total: number): number {
  return (Math.PI * 2 * index) / total - Math.PI / 2;
}

function point(index: number, total: number, value: number): [number, number] {
  const a = angle(index, total);
  const r = (Math.max(0, Math.min(100, value)) / 100) * RADIUS;
  return [CENTER + Math.cos(a) * r, CENTER + Math.sin(a) * r];
}

function polygon(values: readonly number[]): string {
  return values
    .map((v, i) => point(i, values.length, v).map((n) => n.toFixed(1)).join(','))
    .join(' ');
}

export function CompatibilityRadar({ axes }: { axes: readonly RadarAxis[] }) {
  if (axes.length < 3) return null;

  const total = axes.length;
  const hasCurrent = axes.every((a) => a.current !== null);

  const series = [
    {
      key: 'recommended',
      label: 'Raquete recomendada',
      values: axes.map((a) => a.recommended),
      stroke: PALETTE.court,
      fill: PALETTE.court,
      fillOpacity: 0.16,
      dash: undefined,
      width: 2.5,
    },
    {
      key: 'profile',
      label: 'Adequação total (o ideal)',
      values: axes.map((a) => a.profile),
      stroke: PALETTE.clay,
      fill: 'none',
      fillOpacity: 0,
      dash: '6 4',
      width: 2,
    },
    ...(hasCurrent
      ? [
          {
            key: 'current',
            label: 'Sua raquete atual',
            values: axes.map((a) => a.current as number),
            stroke: PALETTE.ink,
            fill: 'none',
            fillOpacity: 0,
            dash: '2 3',
            width: 1.75,
          },
        ]
      : []),
    {
      key: 'catalog',
      label: 'Média do catálogo',
      values: axes.map((a) => a.catalog),
      stroke: PALETTE.graphite,
      fill: 'none',
      fillOpacity: 0,
      dash: undefined,
      width: 1,
    },
  ];

  return (
    <div>
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        <svg
          viewBox={`${-PAD_X} ${-PAD_Y} ${SIZE + PAD_X * 2} ${SIZE + PAD_Y * 2}`}
          className="h-auto w-full max-w-[400px] shrink-0"
          role="img"
          aria-label="Radar comparando o que seu jogo pede com a raquete recomendada, sua raquete atual e a média do catálogo"
        >
          {/* Teia: quatro anéis a 25, 50, 75 e 100. */}
          {[25, 50, 75, 100].map((ring) => (
            <polygon
              key={ring}
              points={polygon(axes.map(() => ring))}
              fill="none"
              stroke={PALETTE.line}
              strokeWidth={ring === 100 ? 1.5 : 1}
            />
          ))}

          {/* Raios */}
          {axes.map((axis, i) => {
            const [x, y] = point(i, total, 100);
            return (
              <line
                key={axis.key}
                x1={CENTER}
                y1={CENTER}
                x2={x}
                y2={y}
                stroke={PALETTE.line}
                strokeWidth={1}
              />
            );
          })}

          {series.map((s) => (
            <polygon
              key={s.key}
              points={polygon(s.values)}
              fill={s.fill}
              fillOpacity={s.fillOpacity}
              stroke={s.stroke}
              strokeWidth={s.width}
              strokeDasharray={s.dash}
              strokeLinejoin="round"
            />
          ))}

          {/* Rótulos dos eixos, empurrados para fora da teia. */}
          {axes.map((axis, i) => {
            const [x, y] = point(i, total, 128);
            const a = angle(i, total);
            const anchor = Math.abs(Math.cos(a)) < 0.3 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';
            /*
              O peso vai IMPRESSO junto do rótulo.

              Um radar trata todos os vértices como iguais, e eles não são: `Nível técnico` vale
              0.20 do score final e cada eixo de bola vale um terço de 0.16. Sem o número escrito,
              dois polígonos de área parecida podem corresponder a uma diferença real de seis
              pontos, e o leitor não teria como saber qual vértice olhar primeiro.
            */
            return (
              <g key={axis.key}>
                <text
                  x={x}
                  y={y - 4}
                  textAnchor={anchor}
                  dominantBaseline="middle"
                  fontSize="10"
                  fill={PALETTE.graphite}
                  className="uppercase"
                  style={{ letterSpacing: '0.06em' }}
                >
                  {axis.label}
                </text>
                <text
                  x={x}
                  y={y + 7}
                  textAnchor={anchor}
                  dominantBaseline="middle"
                  fontSize="8"
                  fill={PALETTE.graphite}
                  opacity="0.7"
                >
                  {Math.round(axis.weight * 100)}% do peso
                </text>
              </g>
            );
          })}
        </svg>

        <ul className="w-full space-y-2 text-sm sm:w-auto">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-2.5">
              <svg width="26" height="10" aria-hidden className="shrink-0">
                <line
                  x1="1"
                  y1="5"
                  x2="25"
                  y2="5"
                  stroke={s.stroke}
                  strokeWidth={s.width + 0.5}
                  strokeDasharray={s.dash}
                />
              </svg>
              {s.label}
            </li>
          ))}
        </ul>
      </div>

      {!hasCurrent && (
        <p className="mt-4 max-w-prose text-xs text-graphite">
          Sua raquete atual não aparece no gráfico porque não foi informada, ou não está no catálogo
          que analisamos.
        </p>
      )}
    </div>
  );
}
