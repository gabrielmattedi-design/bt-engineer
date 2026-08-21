import type { RadarAxis } from '@/payments/radar';
import { SITE_DOMAIN } from '@/lib/site';
import { axisAngle, labelAnchor, labelPoint, topBlockRotation } from './radar-geometry';

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

/** Altura de linha da frase de perfil, em unidades do viewBox. */
const PHRASE_LINE_HEIGHT = 46;

/**
 * Quantos caracteres cabem numa linha da frase.
 *
 * Estimado, não medido: SVG renderizado no servidor não tem como consultar a métrica da fonte. A
 * largura útil é 920 (1080 menos as margens de 80), e uma sans em 38px/600 gasta cerca de 20px por
 * caractere na média do português. 44 deixa folga para as palavras largas — "compatibilidade",
 * "desconforto" — sem desperdiçar linha.
 */
const PHRASE_MAX_CHARS = 44;

/**
 * Corpo do nome da raquete, encolhido quando o nome é longo demais para a linha.
 *
 * ═══ O DEFEITO ═══════════════════════════════════════════════════════════════════════════════
 *
 * `<text>` de SVG não quebra, não reticencia e não encolhe: ele simplesmente ATRAVESSA o que
 * estiver do lado. O nome da raquete e o número do match dividem a mesma linha, e "Wilson Blade 98
 * 18x20 v10 (2026)" — 32 caracteres, nem o maior do catálogo — passava por cima do "97%".
 *
 * Medido no card renderizado, com a fonte de sistema: 809 px para esses 32 caracteres em corpo 42,
 * terminando em x=889, contra o "97%" começando em x=847. Quarenta e dois pixels de sobreposição,
 * no artefato que existe justamente para circular sem ninguém por perto para explicar.
 *
 * ═══ O ORÇAMENTO ════════════════════════════════════════════════════════════════════════════
 *
 * 686 px, de x=80 até a borda esquerda de um match de três dígitos ("100%", ~204 px terminando em
 * x=1000), menos um vão de 30. A razão de 0,60 em por caractere sai da mesma medição (809/32/42) e
 * é DELIBERADAMENTE a da fonte mais larga que apareceu: o download rasteriza no navegador de quem
 * baixa, com a fonte que aquele sistema tiver. Errar para o lado largo encolhe um pouco mais que o
 * necessário; errar para o estreito devolve a sobreposição.
 *
 * O piso de 26 nunca é alcançado pelo catálogo atual — o nome mais longo ("Babolat Pure Strike 100
 * 16x19 Gen 4 (2024)", 42 caracteres) cai em 27. Ele existe para o dia em que entrar um mais
 * comprido: melhor um nome pequeno e inteiro do que um nome cortado.
 */
export function racketNameSize(name: string): number {
  const NAME_BUDGET_PX = 686;
  const CHAR_WIDTH_EM = 0.6;
  const size = Math.floor(NAME_BUDGET_PX / Math.max(1, name.length) / CHAR_WIDTH_EM);
  return Math.max(26, Math.min(42, size));
}

/** Duas linhas no máximo: a terceira invadiria os rótulos do radar, que começam em y≈476. */
const PHRASE_MAX_LINES = 2;

/**
 * Quebra a frase em linhas, cortando entre palavras.
 *
 * Uma palavra maior que a linha inteira não existe nas frases de perfil, e mesmo assim ela sai
 * numa linha só — melhor estourar um caso improvável do que partir palavra no meio, que é o que a
 * versão sem quebra já fazia e é justamente o defeito sendo corrigido.
 */
export function wrapPhrase(
  phrase: string,
  maxChars = PHRASE_MAX_CHARS,
  maxLines = PHRASE_MAX_LINES,
): string[] {
  const palavras = phrase.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let atual = '';

  for (let i = 0; i < palavras.length; i += 1) {
    const palavra = palavras[i]!;
    const candidata = atual ? `${atual} ${palavra}` : palavra;

    if (candidata.length <= maxChars) {
      atual = candidata;
      continue;
    }

    // Já na última linha disponível: cabe o que couber e as reticências dizem que há mais.
    if (lines.length === maxLines - 1) {
      const resto = atual ? `${atual} ${palavras.slice(i).join(' ')}` : palavras.slice(i).join(' ');
      atual = `${resto.slice(0, maxChars - 1).trimEnd()}…`;
      break;
    }

    // `atual || palavra` cobre a palavra sozinha maior que a linha: sai inteira, sem partir.
    lines.push(atual || palavra);
    atual = atual ? palavra : '';
  }

  if (atual) lines.push(atual);
  return lines;
}

function point(index: number, total: number, value: number, rotation: number): [number, number] {
  const a = axisAngle(index, total, rotation);
  const r = (Math.max(0, Math.min(100, value)) / 100) * RADAR_R;
  return [RADAR_CX + Math.cos(a) * r, RADAR_CY + Math.sin(a) * r];
}

function polygon(values: readonly number[], rotation: number): string {
  return values
    .map((v, i) => point(i, values.length, v, rotation).map((n) => n.toFixed(1)).join(','))
    .join(' ');
}

/** Distância dos nomes ao centro, em PIXELS — ver a nota em `radar-geometry.ts`. */
const CARD_LABEL_RADIUS = RADAR_R + 34;

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
  /**
   * Só os eixos de ENCAIXE — os mesmos cinco do radar do relatório.
   *
   * O card recebe os oito e descarta os três de bola aqui dentro, e não na página, porque quem
   * quebra isto é quem desenha: a linha tracejada é uma coisa só no SVG, e nos oito eixos ela
   * carregaria dois significados ao mesmo tempo. Nos cinco de encaixe ela é a BORDA — 100 é o
   * ideal e nenhuma raquete o ultrapassa. Nos três de bola ela é o TAMANHO DO PEDIDO, e a raquete
   * pode passar dela, o que é bom. Num polígono só, o amarelo cruzava para fora em alguns
   * vértices e não em outros, sem nada na imagem dizendo por quê.
   *
   * Foi exatamente esse defeito que tirou os três de bola do radar do relatório (ver `radar.tsx`
   * e `market-rails.tsx`). O card é a peça que circula sem legenda e sem quem explique — se em
   * algum lugar as duas leituras não podem coexistir, é aqui.
   */
  const axes = data.radar.filter((a) => a.group === 'voce');
  const total = axes.length;
  const rotation = topBlockRotation(axes);
  const phraseLines = wrapPhrase(data.phrase);

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

      {/*
        ═══ AS LINHAS DE FUNDO DE QUADRA SAÍRAM DAQUI ═════════════════════════════════════

        Eram uma linha horizontal com uma marca central curta — a citação da linha de fundo. A
        mesma ideia já tinha sido removida da home pelo mesmo motivo: fora do contexto de uma
        quadra inteira, ela não é lida como quadra, é lida como um filete com um defeito no meio.

        No card o custo era maior que na home. Ele é a peça que sai do site e circula sozinha, num
        feed, em tamanho pequeno — e ali cada traço que não informa disputa atenção com os três que
        informam: o nome, a raquete e o match.

        A separação passa a vir de ESPAÇO. O card já é uma pilha de blocos com pesos tipográficos
        muito diferentes (nome grande, frase média, rótulos pequenos em caixa alta); com respiro
        suficiente entre eles, a divisão se lê sozinha e sem nenhum elemento novo.
      */}

      {/* ── Cabeçalho: quem é ───────────────────────────────────────────── */}
      <text x="80" y="120" fill={PALETTE.ball} fontSize="26" letterSpacing="6" fontWeight="600">
        TENNIS ENGINEER
      </text>

      {data.playerName && (
        <text x="80" y="196" fill={PALETTE.paper} fontSize="62" fontWeight="700">
          {data.playerName}
        </text>
      )}

      {/*
        ═══ A FRASE QUEBRA EM DUAS LINHAS ════════════════════════════════════════════════

        `<text>` de SVG NÃO quebra linha. Não há `width`, não há `overflow`, não há reticências:
        o que passa da borda do viewBox some, cortado no meio da palavra.

        Isso estava acontecendo em produção, no artefato mais público que existe. "Agressor de
        linha de base que quer firmeza no controle" tem 53 caracteres e cabem ~44 na largura útil —
        quem compartilhasse o card publicava uma frase truncada sobre si mesmo, e o corte acontece
        DEPOIS de tudo estar certo no servidor, então nada no sistema acusava.

        As frases de perfil são geradas e podem crescer; a quebra tinha de ser calculada, não
        ajustada à mão para a frase mais longa de hoje.
      */}
      {phraseLines.map((line, i) => (
        <text
          key={line}
          x="80"
          y={(data.playerName ? 320 : 280) + i * PHRASE_LINE_HEIGHT}
          fill={PALETTE.paper}
          fontSize="38"
          fontWeight="600"
        >
          {line}
        </text>
      ))}
      <text
        x="80"
        y={(data.playerName ? 366 : 326) + (phraseLines.length - 1) * PHRASE_LINE_HEIGHT}
        fill={PALETTE.faint}
        fontSize="27"
      >
        Nível {data.level.toLowerCase()}
      </text>

      {/* ── Radar ───────────────────────────────────────────────────────── */}
      <g>
        {[25, 50, 75, 100].map((ring) => (
          <polygon
            key={ring}
            points={polygon(axes.map(() => ring), rotation)}
            fill="none"
            stroke={PALETTE.line}
            strokeWidth={ring === 100 ? 2 : 1}
          />
        ))}

        <polygon
          points={polygon(axes.map((a) => a.recommended), rotation)}
          fill={PALETTE.ball}
          fillOpacity="0.2"
          stroke={PALETTE.ball}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <polygon
          points={polygon(axes.map((a) => a.profile), rotation)}
          fill="none"
          stroke={PALETTE.clay}
          strokeWidth="3"
          strokeDasharray="10 7"
          strokeLinejoin="round"
        />

        {axes.map((axis, i) => {
          const [x, y] = labelPoint(i, total, CARD_LABEL_RADIUS, rotation, {
            x: RADAR_CX,
            y: RADAR_CY,
          });
          const anchor = labelAnchor(i, total, rotation);
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
          O ideal para o seu jogo
        </text>
      </g>

      {/* ── Resultado ───────────────────────────────────────────────────── */}

      <text x="80" y="1090" fill={PALETTE.faint} fontSize="22" letterSpacing="3">
        SUA RAQUETE
      </text>
      <text x="80" y="1142" fill={PALETTE.paper} fontSize={racketNameSize(data.racketName)} fontWeight="700">
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
        {SITE_DOMAIN}
      </text>
      <text x={W - 80} y={H - 60} textAnchor="end" fill={PALETTE.faint} fontSize="24">
        Seu jogo. Seu setup. Sob medida.
      </text>
    </svg>
  );
}
