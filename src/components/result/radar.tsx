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
 * Os oito eixos vêm em dois blocos, e os blocos são DESENHADOS — cada um num setor de fundo
 * próprio, com título. Os três primeiros são o que a raquete faz com a BOLA; os cinco últimos são
 * o quanto ela encaixa em VOCÊ: braço, físico, nível, swing e estilo.
 *
 * O gráfico antigo mostrava só o primeiro bloco, e por isso conseguia contradizer a recomendação:
 * escondia justamente os eixos que mais pesam na decisão. Trazer os cinco resolveu aquilo e criou
 * outro problema, que o setor sombreado resolve — sem divisão visível, os oito eram lidos como oito
 * características do produto, e cinco deles não descrevem o produto.
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
  /**
   * Fundos dos dois SETORES. Claros de propósito: eles separam sem competir com os polígonos, que
   * continuam sendo a informação. Um fundo saturado transformaria o gráfico em decoração.
   */
  zoneBall: '#EAF0EC',
  zoneYou: '#F6F0EA',
} as const;

/**
 * Os dois blocos, nomeados. A ordem dos eixos em `radar.ts` garante que cada grupo é contíguo.
 *
 * ═══ POR QUE O GRÁFICO PRECISA DIZER ISTO ════════════════════════════════════════════════════
 *
 * Um usuário leu o radar três vezes seguidas como "a raquete recomendada é melhor que a minha em
 * cinco de seis características" — e concluiu, com toda lógica, que o catálogo tinha raquetes
 * globalmente superiores a outras, o que o produto promete não ter.
 *
 * A leitura estava errada, e a culpa era do desenho. Cinco dos oito vértices não descrevem a
 * raquete: descrevem o ENCAIXE entre ela e uma pessoa específica. `Peso p/ seu físico` marca 96
 * para um jogador de 82 kg e marcaria 40, na mesma raquete, para um de 50 kg. Postos na mesma teia,
 * com o mesmo peso visual e sem nenhuma divisão, os oito viravam oito specs de fabricante.
 *
 * O setor sombreado é a divisão que faltava: dois territórios, dois títulos, duas perguntas
 * diferentes. O que a raquete FAZ, e o quanto ela SERVE A VOCÊ.
 */
const ZONES = {
  bola: {
    fill: PALETTE.zoneBall,
    title: 'O que ela faz com a bola',
    hint: 'Comportamento do quadro — o mesmo para qualquer pessoa que jogue com ela.',
  },
  voce: {
    fill: PALETTE.zoneYou,
    title: 'Como ela encaixa em você',
    hint: 'Medidas do par raquete + você. Mudam de jogador para jogador, na mesma raquete.',
  },
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
const PAD_Y = 18;

/** Raio do setor de fundo: um pouco além da teia, para o sombreado emoldurar em vez de cortar. */
const ZONE_RADIUS = RADIUS + 9;

/** Ângulo do eixo `i`, começando no topo e girando no sentido horário. */
function angle(index: number, total: number): number {
  return (Math.PI * 2 * index) / total - Math.PI / 2;
}

function point(index: number, total: number, value: number): [number, number] {
  const a = angle(index, total);
  const r = (Math.max(0, Math.min(100, value)) / 100) * RADIUS;
  return [CENTER + Math.cos(a) * r, CENTER + Math.sin(a) * r];
}

/**
 * Posição de um RÓTULO, em pixels de raio — sem passar pela escala de valor.
 *
 * ═══ O BUG QUE ISTO CORRIGE ══════════════════════════════════════════════════════════════════
 *
 * Os rótulos eram posicionados com `point(i, total, 128)`, como se 128 fosse "um pouco além da
 * borda". Não era: `point` recebe um VALOR de eixo e o limita a 100 antes de converter em raio.
 * Qualquer número acima de 100 produzia exatamente o mesmo ponto que 100 — ou seja, os nomes
 * estavam colados na teia desde sempre, e aumentar o número não afastava nada.
 *
 * Era isso que fazia "Seu físico", embaixo, cair em cima do próprio polígono.
 */
function labelPoint(index: number, total: number, radius: number): [number, number] {
  const a = angle(index, total);
  return [CENTER + Math.cos(a) * radius, CENTER + Math.sin(a) * radius];
}

/** Distância dos nomes ao centro. Fora do setor sombreado, com folga para o traço mais grosso. */
const LABEL_RADIUS = ZONE_RADIUS + 16;

function polygon(values: readonly number[]): string {
  return values
    .map((v, i) => point(i, values.length, v).map((n) => n.toFixed(1)).join(','))
    .join(' ');
}

/**
 * Fatia de pizza cobrindo os eixos de `first` a `last`, com meia casa de folga de cada lado.
 *
 * A folga é o que faz os dois setores se encontrarem exatamente no meio do caminho entre dois
 * eixos vizinhos — sem ela, sobrariam fatias brancas e o vértice da fronteira pareceria pertencer
 * aos dois grupos.
 */
function sector(first: number, last: number, total: number): string {
  const half = Math.PI / total;
  const start = angle(first, total) - half;
  const end = angle(last, total) + half;
  const [x1, y1] = [
    CENTER + Math.cos(start) * ZONE_RADIUS,
    CENTER + Math.sin(start) * ZONE_RADIUS,
  ];
  const [x2, y2] = [CENTER + Math.cos(end) * ZONE_RADIUS, CENTER + Math.sin(end) * ZONE_RADIUS];
  const large = end - start > Math.PI ? 1 : 0;

  return `M ${CENTER} ${CENTER} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${ZONE_RADIUS} ${ZONE_RADIUS} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`;
}

/**
 * Faixa contígua de cada grupo. Devolve `null` se algum grupo estiver espalhado — nesse caso o
 * setor mentiria sobre quais eixos ele cobre, e é melhor não desenhar nada do que desenhar errado.
 */
function zoneRanges(
  axes: readonly RadarAxis[],
): ReadonlyArray<{ group: keyof typeof ZONES; first: number; last: number }> {
  const ranges: Array<{ group: keyof typeof ZONES; first: number; last: number }> = [];

  for (let i = 0; i < axes.length; i += 1) {
    const group = axes[i]!.group;
    const previous = ranges[ranges.length - 1];
    if (previous && previous.group === group) previous.last = i;
    else ranges.push({ group, first: i, last: i });
  }

  const groups = ranges.map((r) => r.group);
  return new Set(groups).size === groups.length ? ranges : [];
}

export function CompatibilityRadar({ axes }: { axes: readonly RadarAxis[] }) {
  if (axes.length < 3) return null;

  const total = axes.length;
  const hasCurrent = axes.every((a) => a.current !== null);
  const zones = zoneRanges(axes);

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
      label: 'Melhor possível para você',
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
          {/* Setores de fundo: um território por bloco, desenhados ANTES da teia. */}
          {zones.map((zone) => (
            <path
              key={zone.group}
              d={sector(zone.first, zone.last, total)}
              fill={ZONES[zone.group].fill}
              stroke="none"
            />
          ))}

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
            const [x, y] = labelPoint(i, total, LABEL_RADIUS);
            const a = angle(i, total);
            const anchor = Math.abs(Math.cos(a)) < 0.3 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';
            /*
              ═══ O PESO SAIU DAQUI, DE PROPÓSITO ═══════════════════════════════════════════

              Cada vértice trazia impresso quanto pesava na decisão, para que ninguém lesse um
              radar de nove pontas como se as nove valessem o mesmo. A intenção estava certa; o
              efeito, não. Lado a lado, "Spin 3%" e "Seu swing 17%" convidam à conclusão de que o
              motor ignorou o spin — quando os três eixos de bola são FATIAS de um único critério,
              repartidas na ordem de prioridade declarada, e swing é um critério inteiro. O gráfico
              misturava duas escalas incompatíveis num mesmo rótulo.

              O peso não sumiu do relatório: ele aparece somado POR BLOCO logo abaixo do gráfico,
              que é a única comparação que faz sentido — bolo contra bolo. Aqui em cima o radar
              volta a responder uma pergunta só: quanto cada raquete entrega em cada eixo.
            */
            return (
              <text
                key={axis.key}
                x={x}
                y={y}
                textAnchor={anchor}
                dominantBaseline="middle"
                fontSize="10"
                fill={PALETTE.graphite}
                className="uppercase"
                style={{ letterSpacing: '0.06em' }}
              >
                {axis.label}
              </text>
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

      {/*
        Os títulos ficam FORA do desenho, não curvados sobre os setores.

        Com oito vértices, um título ao longo da borda colidiria com os rótulos dos eixos em pelo
        menos duas posições — e o do bloco de baixo cairia exatamente sobre "Exigência p/ seu
        nível". Aqui eles têm largura para respirar, quebram linha no celular e ainda carregam a
        frase que faz o trabalho: por que os cinco eixos de encaixe não são notas da raquete.
      */}
      {zones.length > 0 && (
        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          {zones.map((zone) => (
            <div key={zone.group} className="flex gap-2.5">
              <span
                className="mt-0.5 h-4 w-4 shrink-0 rounded-sm border border-line"
                style={{ backgroundColor: ZONES[zone.group].fill }}
                aria-hidden
              />
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider">
                  {ZONES[zone.group].title}
                </dt>
                <dd className="mt-0.5 text-xs leading-relaxed text-graphite">
                  {ZONES[zone.group].hint}
                </dd>
              </div>
            </div>
          ))}
        </dl>
      )}

      {!hasCurrent && (
        <p className="mt-4 max-w-prose text-xs text-graphite">
          Sua raquete atual não aparece no gráfico porque não foi informada, ou não está no catálogo
          que analisamos.
        </p>
      )}
    </div>
  );
}
