/**
 * Geometria compartilhada entre o radar do relatório e o do card.
 *
 * Os dois desenhos são independentes por bons motivos — tamanhos, paletas e formatos de saída
 * diferentes —, mas a POSIÇÃO angular de cada eixo precisa ser a mesma nos dois. Quando ela vivia
 * duplicada, uma correção aplicada num lugar deixava o outro contando outra história, e o card é
 * justamente a peça que sai do site e circula sozinha.
 */

import type { RadarAxis } from '@/payments/radar';

/**
 * Rotação da teia para que o bloco de BOLA fique centrado no topo.
 *
 * ═══ O QUE ESTAVA ERRADO ═════════════════════════════════════════════════════════════════════
 *
 * O texto do relatório diz "os três de cima medem o que ela faz com a bola". Com o primeiro eixo
 * fixado às 12 horas, os três de cima eram `Seu jogo`, `Potência` e `Controle` — dois de bola e um
 * de encaixe. A frase estava simplesmente errada sobre o próprio desenho, e o `Spin` ficava caído
 * às 3 horas, longe dos irmãos.
 *
 * Girar o conjunto meia casa por eixo de bola resolve: `Potência`, `Controle` e `Spin` passam a
 * ocupar 10:30, 12:00 e 1:30, lidos da esquerda para a direita na ordem em que o texto os nomeia.
 *
 * ═══ POR QUE CALCULADO, E NÃO −45° NO CÓDIGO ═════════════════════════════════════════════════
 *
 * −45° é a resposta certa para OITO eixos com TRÊS de bola. Escrito como constante, ele silenciosa-
 * mente deixaria de centrar nada no dia em que um eixo entrasse ou saísse — e o gráfico voltaria a
 * contradizer a legenda sem ninguém perceber. Derivar do próprio vetor mantém a promessa verdadeira
 * por construção.
 */
export function topBlockRotation(axes: readonly RadarAxis[]): number {
  const ball: number[] = [];
  for (let i = 0; i < axes.length; i += 1) if (axes[i]!.group === 'bola') ball.push(i);

  const first = ball[0];
  const last = ball[ball.length - 1];
  if (first === undefined || last === undefined || axes.length === 0) return 0;

  return -(Math.PI * 2 * ((first + last) / 2)) / axes.length;
}

/** Ângulo do eixo `i`: começa no topo, gira no sentido horário, deslocado por `rotation`. */
export function axisAngle(index: number, total: number, rotation: number): number {
  return (Math.PI * 2 * index) / total - Math.PI / 2 + rotation;
}

/**
 * Ponto de um RÓTULO, em pixels de raio.
 *
 * ═══ O BUG QUE ISTO CORRIGE, NOS DOIS DESENHOS ═══════════════════════════════════════════════
 *
 * Os nomes dos eixos eram posicionados passando um "raio" para a função que converte VALOR de eixo
 * em coordenada — e essa função limita a 100 antes de converter. Todo número acima de 100 dava
 * exatamente o mesmo ponto, então os rótulos estavam colados na teia desde sempre e aumentar o
 * número nunca afastou nada. No relatório isso fazia `Seu físico` cair sobre o próprio polígono; no
 * card, o mesmo. Aqui o raio é raio.
 */
export function labelPoint(
  index: number,
  total: number,
  radius: number,
  rotation: number,
  center: { x: number; y: number },
): [number, number] {
  const a = axisAngle(index, total, rotation);
  return [center.x + Math.cos(a) * radius, center.y + Math.sin(a) * radius];
}

/** Âncora horizontal do texto conforme o lado da teia em que o eixo cai. */
export function labelAnchor(
  index: number,
  total: number,
  rotation: number,
): 'start' | 'middle' | 'end' {
  const c = Math.cos(axisAngle(index, total, rotation));
  if (Math.abs(c) < 0.3) return 'middle';
  return c > 0 ? 'start' : 'end';
}
