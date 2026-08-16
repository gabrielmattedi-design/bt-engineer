import type { RadarAxis } from '@/payments/radar';

/**
 * Card compartilhável — SVG autocontido, pensado para virar imagem.
 *
 * ─── POR QUE SVG, E POR QUE AUTOCONTIDO ──────────────────────────────────────────────────────
 *
 * O card precisa sair da tela e ir para o WhatsApp de um amigo. O caminho barato para isso é
 * rasterizar um SVG no `<canvas>` do próprio navegador — nada de biblioteca, nada de serviço de
 * imagem no servidor.
 *
 * Mas o canvas SUJA a tela quando o SVG referencia qualquer coisa de fora: uma imagem externa, uma
 * fonte carregada por `@font-face`, um `<use>` apontando para outro arquivo. Uma tela suja não
 * pode ser exportada, e o download falha silenciosamente.
 *
 * Por isso aqui não existe nenhuma referência externa: as fontes são a pilha do sistema, as cores
 * são literais, e a marca é desenhada com os mesmos caminhos do monograma. O card é um arquivo só.
 *
 * ─── O QUE ELE MOSTRA, E POR QUÊ ─────────────────────────────────────────────────────────────
 *
 * Nome, frase de identidade, o radar do jogo, a raquete e — quando comprado — corda e tensão. É a
 * informação que a pessoa quer mostrar, não o relatório inteiro: um card que tenta caber tudo não
 * é lido em dois segundos, que é o tempo que uma imagem recebe no celular de outra pessoa.
 *
 * O rodapé traz a marca e o endereço. O card É a peça de divulgação — sem isso ele circula sem
 * dizer de onde veio.
 */

const PALETTE = {
  court: '#0E3D2E',
  clay: '#D85A2B',
  ball: '#FFC62E',
  paper: '#FAFAF8',
  graphite: '#5A6472',
  line: 'rgba(250,250,248,0.22)',
  faint: 'rgba(250,250,248,0.45)',
} as const;

/** Proporção 4:5 — o formato que ocupa mais tela em feed e em conversa. */
const W = 1080;
const H = 1350;

const RADAR_CX = 540;
const RADAR_CY = 700;
const RADAR_R = 190;

function point(index: number, total: number, value: number): [number, number] {
  const a = (Math.PI * 2 * index) / total - Math.PI / 2;
  const r = (Math.max(0, Math.min(100, value)) / 100) * RADAR_R;
  return [RADAR_CX + Math.cos(a) * r, RADAR_CY + Math.sin(a) * r];
}

function polygon(values: readonly number[]): string {
  return values
    .map((v, i) => point(i, values.length, v).map((n) => n.toFixed(1)).join(','))
    .join(' ');
}

export type ShareCardData = {
  readonly playerName: string | null;
  readonly phrase: string;
  readonly level: string;
  readonly matchScore: number;
  readonly racketBrand: string;
  readonly racketName: string;
  readonly radar: readonly RadarAxis[];
  readonly setup: {
    readonly stringBrand: string;
    readonly stringModel: string;
    readonly gaugeMm: number;
    readonly tensionLbs: number;
  } | null;
};

export function ShareCard({ data, id }: { data: ShareCardData; id: string }) {
  const axes = data.radar;
  const total = axes.length;

  return (
    <svg
      id={id}
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      xmlns="http://www.w3.org/2000/svg"
      className="h-auto w-full"
      role="img"
      aria-label={`Card do resultado: ${data.phrase}, ${data.racketName}`}
      /*
        A pilha de fontes é do SISTEMA, de propósito.
        A Sora e a Inter da marca vêm por @font-face, e uma fonte carregada por CSS não existe
        dentro do SVG no momento em que o canvas o rasteriza — o texto sairia com a fonte de
        fallback do canvas, ou não sairia. Melhor escolher o fallback do que sofrê-lo.
      */
      style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}
    >
      <rect width={W} height={H} fill={PALETTE.court} />

      {/* Quadriculado de prancha — o mesmo recurso gráfico da capa. */}
      <g stroke="rgba(250,250,248,0.06)" strokeWidth="1">
        {Array.from({ length: Math.floor(W / 45) + 1 }, (_, i) => (
          <line key={`v${i}`} x1={i * 45} y1={0} x2={i * 45} y2={H} />
        ))}
        {Array.from({ length: Math.floor(H / 45) + 1 }, (_, i) => (
          <line key={`h${i}`} x1={0} y1={i * 45} x2={W} y2={i * 45} />
        ))}
      </g>

      {/* Linha de fundo de quadra, com a marca central — divisor da marca. */}
      <g>
        <line x1="80" y1="238" x2={W - 80} y2="238" stroke={PALETTE.faint} strokeWidth="2" />
        <line x1={W / 2} y1="238" x2={W / 2} y2="258" stroke={PALETTE.faint} strokeWidth="2" />
      </g>

      {/* ── Cabeçalho: quem é ───────────────────────────────────────────── */}
      <text x="80" y="120" fill={PALETTE.ball} fontSize="26" letterSpacing="6" fontWeight="600">
        TENNIS ENGINEER
      </text>

      {data.playerName && (
        <text x="80" y="196" fill={PALETTE.paper} fontSize="62" fontWeight="700">
          {data.playerName}
        </text>
      )}

      <text
        x="80"
        y={data.playerName ? 320 : 280}
        fill={PALETTE.paper}
        fontSize="38"
        fontWeight="600"
      >
        {data.phrase}
      </text>
      <text x="80" y={data.playerName ? 366 : 326} fill={PALETTE.faint} fontSize="27">
        Nível {data.level.toLowerCase()}
      </text>

      {/* ── Radar ───────────────────────────────────────────────────────── */}
      <g>
        {[25, 50, 75, 100].map((ring) => (
          <polygon
            key={ring}
            points={polygon(axes.map(() => ring))}
            fill="none"
            stroke={PALETTE.line}
            strokeWidth={ring === 100 ? 2 : 1}
          />
        ))}

        <polygon
          points={polygon(axes.map((a) => a.recommended))}
          fill={PALETTE.ball}
          fillOpacity="0.2"
          stroke={PALETTE.ball}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <polygon
          points={polygon(axes.map((a) => a.profile))}
          fill="none"
          stroke={PALETTE.clay}
          strokeWidth="3"
          strokeDasharray="10 7"
          strokeLinejoin="round"
        />

        {axes.map((axis, i) => {
          const [x, y] = point(i, total, 122);
          const a = (Math.PI * 2 * i) / total - Math.PI / 2;
          const anchor =
            Math.abs(Math.cos(a)) < 0.3 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';
          return (
            <text
              key={axis.key}
              x={x}
              y={y}
              textAnchor={anchor}
              dominantBaseline="middle"
              fontSize="19"
              letterSpacing="1.5"
              fill={PALETTE.faint}
            >
              {axis.label.toUpperCase()}
            </text>
          );
        })}
      </g>

      {/* Legenda mínima: sem ela os dois polígonos são só formas bonitas. */}
      <g fontSize="20" fill={PALETTE.faint}>
        <line x1="80" y1="965" x2="118" y2="965" stroke={PALETTE.ball} strokeWidth="4" />
        <text x="130" y="971">
          Raquete indicada
        </text>
        <line
          x1="380"
          y1="965"
          x2="418"
          y2="965"
          stroke={PALETTE.clay}
          strokeWidth="4"
          strokeDasharray="9 6"
        />
        <text x="430" y="971">
          O que seu jogo pede
        </text>
      </g>

      {/* ── Resultado ───────────────────────────────────────────────────── */}
      <line x1="80" y1="1025" x2={W - 80} y2="1025" stroke={PALETTE.faint} strokeWidth="2" />
      <line x1={W / 2} y1="1025" x2={W / 2} y2="1045" stroke={PALETTE.faint} strokeWidth="2" />

      <text x="80" y="1090" fill={PALETTE.faint} fontSize="22" letterSpacing="3">
        SUA RAQUETE
      </text>
      <text x="80" y="1142" fill={PALETTE.paper} fontSize="42" fontWeight="700">
        {data.racketName}
      </text>

      <text x={W - 80} y="1090" textAnchor="end" fill={PALETTE.faint} fontSize="22" letterSpacing="3">
        MATCH
      </text>
      <text x={W - 80} y="1148" textAnchor="end" fill={PALETTE.ball} fontSize="64" fontWeight="700">
        {data.matchScore}%
      </text>

      {data.setup && (
        <text x="80" y="1200" fill={PALETTE.paper} fontSize="27">
          {data.setup.stringBrand} {data.setup.stringModel} · {data.setup.gaugeMm.toFixed(2)} mm ·{' '}
          {data.setup.tensionLbs} lbs
        </text>
      )}

      {/* ── Rodapé: de onde veio ────────────────────────────────────────── */}
      <text
        x="80"
        y={H - 60}
        fill={PALETTE.faint}
        fontSize="24"
        letterSpacing="2"
      >
        tennis-engineer.vercel.app
      </text>
      <text x={W - 80} y={H - 60} textAnchor="end" fill={PALETTE.faint} fontSize="24">
        Seu jogo. Seu setup. Sob medida.
      </text>
    </svg>
  );
}
