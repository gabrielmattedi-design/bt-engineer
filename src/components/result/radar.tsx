import type { RadarAxis } from '@/payments/radar';
import { axisAngle, labelAnchor, labelPoint, topBlockRotation } from './radar-geometry';

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
 * Todo eixo vai de 0 a 100 e o maior polígono é o melhor encaixe — mas a linha TRACEJADA tem duas
 * leituras, uma por bloco, e é isso que o explicador de cada setor precisa dizer:
 *
 *   • encaixe (5 eixos) — ela é a BORDA. 100 é o ideal e nenhuma raquete o ultrapassa, porque não
 *     existe mais adequado que perfeito.
 *   • bola (3 eixos)    — ela é o TAMANHO DO PEDIDO. As raquetes podem passar dela: entregar mais
 *     potência do que foi pedido é bom, não é excesso.
 *
 * A tentativa de unificar as duas — pôr a borda em 100 nos oito — falhou por causa do segundo caso:
 * o gráfico passou a dizer "esta raquete entrega mais do que você precisa" onde a leitura correta
 * era "ela entrega mais do que você pediu, e isso é bom".
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
   * Fundos dos dois SETORES.
   *
   * A primeira tentativa foi `#EAF0EC` e `#F6F0EA` — dois quase-brancos, escolhidos para "não
   * competir com os polígonos". Competiam pouco e comunicavam menos: na tela do celular os dois
   * setores eram indistinguíveis, e o quadradinho de cor da legenda parecia vazio. Um fundo que não
   * dá para ver não separa nada.
   *
   * Estes têm saturação suficiente para o olho separar os territórios de relance e continuam bem
   * abaixo do contraste das quatro séries, que seguem sendo a informação. E a cor não trabalha
   * sozinha: uma linha divisória marca a fronteira, para quem não distingue os dois tons.
   */
  zoneBall: '#D3E2D9',
  zoneYou: '#F0E2CD',
  /** Fronteira entre os setores — a separação que sobrevive sem depender de cor. */
  zoneEdge: '#B9C4BC',
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
/**
 * ═══ OS DOIS QUADROS PRECISAM TER O MESMO PESO ═══════════════════════════════════════════════
 *
 * Reclamação do usuário: "tá muito discrepante o nível e a quantidade de informação explicadas no
 * quadrado verde e no laranja, iguale, não complique muito nem seja raso".
 *
 * Ele estava certo e o desequilíbrio era grande: o de bola tinha quatro frases com ressalvas, o de
 * encaixe tinha uma linha. Dois blocos lado a lado com pesos assim ensinam o leitor a ler só um.
 *
 * A regra passa a ser: cada quadro responde as MESMAS três perguntas, na mesma ordem e no mesmo
 * tamanho — o que o eixo mede, o que a linha tracejada é, e o que significa a raquete passar dela.
 */
const ZONES = {
  bola: {
    fill: PALETTE.zoneBall,
    title: 'O que ela faz com a bola',
    hint:
      'Quanto cada raquete entrega, comparada à que mais entrega no catálogo — 100 é a melhor das ' +
      '47 naquele aspecto. A linha tracejada é o que VOCÊ pediu, limitado ao que existe para o seu ' +
      'perfil. Passar dela é bom: significa entregar mais do que você pediu.',
  },
  voce: {
    fill: PALETTE.zoneYou,
    title: 'Como ela encaixa em você',
    hint:
      'O quanto o par raquete + você funciona — muda de jogador para jogador, na mesma raquete. A ' +
      'linha tracejada é o melhor encaixe que EXISTE para você: quase sempre 100, e menos que isso ' +
      'quando nenhuma raquete adequada ao seu perfil chega lá. A recomendada não passa dela.',
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

function point(index: number, total: number, value: number, rotation: number): [number, number] {
  const a = axisAngle(index, total, rotation);
  const r = (Math.max(0, Math.min(100, value)) / 100) * RADIUS;
  return [CENTER + Math.cos(a) * r, CENTER + Math.sin(a) * r];
}

/** Distância dos nomes ao centro. Fora do setor sombreado, com folga para o traço mais grosso. */
const LABEL_RADIUS = ZONE_RADIUS + 16;

function polygon(values: readonly number[], rotation: number): string {
  return values
    .map((v, i) => point(i, values.length, v, rotation).map((n) => n.toFixed(1)).join(','))
    .join(' ');
}

/**
 * Fatia de pizza cobrindo os eixos de `first` a `last`, com meia casa de folga de cada lado.
 *
 * A folga é o que faz os dois setores se encontrarem exatamente no meio do caminho entre dois
 * eixos vizinhos — sem ela, sobrariam fatias brancas e o vértice da fronteira pareceria pertencer
 * aos dois grupos.
 */
function sector(first: number, last: number, total: number, rotation: number): string {
  const half = Math.PI / total;
  const start = axisAngle(first, total, rotation) - half;
  const end = axisAngle(last, total, rotation) + half;
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
  const rotation = topBlockRotation(axes);

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
      /**
       * Uma leitura só, nos oito eixos: a BORDA do que é ideal para este jogador.
       *
       * O rótulo já foi `O que seu jogo pede` porque a linha tinha significado diferente por
       * bloco e precisava cobrir os dois. Não tem mais: nos eixos de bola o alvo do pedido virou
       * o denominador da conta, então 100 significa "chegou no ideal possível para você" nos oito,
       * e nada ultrapassa. `O ideal para o seu jogo` voltou a ser exato.
       */
      label: 'O ideal para o seu jogo',
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
              d={sector(zone.first, zone.last, total, rotation)}
              fill={ZONES[zone.group].fill}
              stroke="none"
            />
          ))}

          {/*
            A fronteira, traçada.

            Mesma regra das quatro séries: a distinção nunca depende só de cor. Quem não separa o
            verde do bege — e cerca de 8% dos homens têm alguma deficiência na visão de cores — vê
            mesmo assim onde um território acaba e o outro começa.
          */}
          {zones.map((zone) => {
            // Meia casa antes do primeiro eixo do bloco: exatamente onde os dois setores se tocam.
            const a = axisAngle(zone.first, total, rotation) - Math.PI / total;
            return (
              <line
                key={`edge-${zone.group}`}
                x1={CENTER}
                y1={CENTER}
                x2={CENTER + Math.cos(a) * ZONE_RADIUS}
                y2={CENTER + Math.sin(a) * ZONE_RADIUS}
                stroke={PALETTE.zoneEdge}
                strokeWidth={1.25}
              />
            );
          })}

          {/* Teia: quatro anéis a 25, 50, 75 e 100. */}
          {[25, 50, 75, 100].map((ring) => (
            <polygon
              key={ring}
              points={polygon(axes.map(() => ring), rotation)}
              fill="none"
              stroke={PALETTE.line}
              strokeWidth={ring === 100 ? 1.5 : 1}
            />
          ))}

          {/* Raios */}
          {axes.map((axis, i) => {
            const [x, y] = point(i, total, 100, rotation);
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
              points={polygon(s.values, rotation)}
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
            const [x, y] = labelPoint(i, total, LABEL_RADIUS, rotation, { x: CENTER, y: CENTER });
            const anchor = labelAnchor(i, total, rotation);
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
            /*
              O CARD INTEIRO recebe a cor do setor, não um quadradinho ao lado.

              A primeira versão trazia um quadrado de 16 px preenchido com o mesmo tom do gráfico.
              Naquele tom quase branco ele parecia vazio, e a legenda deixava de ligar o texto à
              região que ele descreve — que é a única coisa que uma legenda precisa fazer. Um bloco
              de cor do tamanho do parágrafo não tem como passar despercebido, e a borda mais escura
              repete a mesma linha que separa os setores no desenho.
            */
            <div
              key={zone.group}
              className="rounded border-l-4 px-3.5 py-3"
              style={{
                backgroundColor: ZONES[zone.group].fill,
                borderLeftColor: PALETTE.zoneEdge,
              }}
            >
              <dt className="text-xs font-bold uppercase tracking-wider text-ink">
                {ZONES[zone.group].title}
              </dt>
              <dd className="mt-1 text-xs leading-relaxed text-ink/75">
                {ZONES[zone.group].hint}
              </dd>
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
