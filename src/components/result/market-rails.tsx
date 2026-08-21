import type { RadarAxis } from '@/payments/radar';

/**
 * Trilhos de mercado — os três eixos de BOLA, fora do radar.
 *
 * ═══ POR QUE ESTES TRÊS SAÍRAM DO RADAR ══════════════════════════════════════════════════════
 *
 * Porque nunca mediram a mesma coisa que os outros cinco, e forçar um desenho só custou quatro
 * versões da linha tracejada — cada uma consertando um bloco e quebrando o outro:
 *
 *   • encaixe — adequação do par raquete+jogador. 100 é o ideal, ninguém passa.
 *   • bola    — quanto do PEDIDO foi entregue. Passar do pedido é bom, não é excesso.
 *
 * Num radar as duas leituras dividem a mesma borda e a mesma escala radial, então o leitor não tem
 * como saber qual está valendo em qual vértice. A separação resolve isso sem precisar de legenda.
 *
 * ═══ POR QUE TRILHO, E NÃO BARRA ═════════════════════════════════════════════════════════════
 *
 * Uma barra responde "quanto", e a pergunta que o usuário faz aqui é OUTRA. Relato, com o card na
 * mão: "pedi potência como prioridade e veio o pior atributo da raquete — parece que não respeitou
 * meu desejo".
 *
 * A resposta honesta não é um número maior: é mostrar ONDE NO MERCADO essa raquete está, e onde
 * estão as que entregam mais. Neste catálogo a potência correlaciona +0,77 com tamanho de cabeça e
 * −0,85 com peso — as mais potentes são quadros de 105 a 108 pol² e 270 a 285 g, feitos para quem
 * está começando. O trilho mostra isso de graça: a marca da recomendada fica no meio, o alvo do
 * pedido fica adiante, e a faixa entre os dois é território de raquete que não serve ao jogador.
 *
 * Uma barra esconderia exatamente essa informação — a que transforma "a recomendação falhou" em
 * "o mercado não tem isso para você, e o caminho é a corda".
 */

const PALETTE = {
  court: '#0E3D2E',
  clay: '#D85A2B',
  ink: '#0B0F14',
  graphite: '#5A6472',
  line: '#E4E6E3',
  track: '#EEF1EE',
} as const;

/** Geometria do trilho, em unidades do `viewBox`. Largura fixa; a altura sai do número de eixos. */
const W = 320;
const TRACK_X = 8;
const TRACK_W = W - TRACK_X * 2;
const TRACK_H = 8;
const ROW_H = 58;

function x(position: number): number {
  return TRACK_X + (Math.max(0, Math.min(100, position)) / 100) * TRACK_W;
}

/**
 * Um marcador triangular apontando para baixo, sobre o trilho.
 *
 * Forma, não só cor: cerca de 8% dos homens têm alguma deficiência na visão de cores, e três
 * marcadores distinguíveis apenas por tom seriam três manchas iguais para eles.
 */
function Marker({ at, fill, label }: { at: number; fill: string; label: string }) {
  const cx = x(at);
  return (
    <g>
      <title>{label}</title>
      <path
        d={`M ${cx.toFixed(1)} ${TRACK_H + 2} L ${(cx - 4.5).toFixed(1)} ${TRACK_H - 5} L ${(cx + 4.5).toFixed(1)} ${TRACK_H - 5} Z`}
        fill={fill}
      />
    </g>
  );
}

export function MarketRails({ axes }: { axes: readonly RadarAxis[] }) {
  const rails = axes.filter((a) => a.market !== null);
  if (rails.length === 0) return null;

  const height = rails.length * ROW_H;

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="w-full"
        role="img"
        aria-label="Onde a raquete recomendada, a sua atual e a média do catálogo caem na faixa do mercado, em cada aspecto que você pediu"
      >
        {rails.map((axis, i) => {
          const m = axis.market!;
          /**
           * A faixa entre onde a recomendada está e onde o pedido aponta.
           *
           * Só é desenhada quando o pedido está À FRENTE da recomendada. Quando a raquete já passou
           * do alvo não há vão a mostrar, e desenhar a faixa ao contrário sugeriria excesso — que é
           * exatamente a leitura errada que tirou estes eixos do radar.
           */
          const gapStart = Math.min(m.recommended, m.ask);
          const gapEnd = Math.max(m.recommended, m.ask);
          const hasGap = m.ask - m.recommended > 3;

          return (
            <g key={axis.key} transform={`translate(0 ${i * ROW_H + 18})`}>
              <text
                x={TRACK_X}
                y={-6}
                fontSize="10"
                fill={PALETTE.graphite}
                className="uppercase"
                style={{ letterSpacing: '0.06em' }}
              >
                {axis.label}
              </text>

              {/* O trilho é a FAIXA DO CATÁLOGO: da menos à mais, entre as 47 avaliadas. */}
              <rect x={TRACK_X} y={0} width={TRACK_W} height={TRACK_H} rx={4} fill={PALETTE.track} />

              {hasGap && (
                <rect
                  x={x(gapStart)}
                  y={0}
                  width={x(gapEnd) - x(gapStart)}
                  height={TRACK_H}
                  rx={4}
                  fill={PALETTE.clay}
                  fillOpacity={0.18}
                />
              )}

              {/* Alvo do pedido: tracejado vertical, a mesma linguagem do radar. */}
              <line
                x1={x(m.ask)}
                y1={-2}
                x2={x(m.ask)}
                y2={TRACK_H + 2}
                stroke={PALETTE.clay}
                strokeWidth={1.5}
                strokeDasharray="3 2"
              />

              <line
                x1={x(m.catalog)}
                y1={0}
                x2={x(m.catalog)}
                y2={TRACK_H}
                stroke={PALETTE.graphite}
                strokeWidth={1}
              />

              {m.current !== null && (
                <Marker at={m.current} fill={PALETTE.ink} label={`Sua atual: ${m.current}`} />
              )}
              <Marker
                at={m.recommended}
                fill={PALETTE.court}
                label={`Recomendada: ${m.recommended}`}
              />

              <text x={TRACK_X} y={TRACK_H + 16} fontSize="8.5" fill={PALETTE.graphite}>
                menos
              </text>
              <text
                x={TRACK_X + TRACK_W}
                y={TRACK_H + 16}
                fontSize="8.5"
                textAnchor="end"
                fill={PALETTE.graphite}
              >
                mais
              </text>
            </g>
          );
        })}
      </svg>

      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-graphite">
        <li className="flex items-center gap-1.5">
          <span
            className="inline-block h-0 w-0 border-x-4 border-t-[6px] border-x-transparent"
            style={{ borderTopColor: PALETTE.court }}
          />
          Raquete recomendada
        </li>
        <li className="flex items-center gap-1.5">
          <span
            className="inline-block h-0 w-0 border-x-4 border-t-[6px] border-x-transparent"
            style={{ borderTopColor: PALETTE.ink }}
          />
          Sua raquete atual
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-px" style={{ backgroundColor: PALETTE.graphite }} />
          Média do catálogo
        </li>
        <li className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-px border-l border-dashed"
            style={{ borderColor: PALETTE.clay }}
          />
          Onde o seu pedido aponta
        </li>
      </ul>
    </div>
  );
}
