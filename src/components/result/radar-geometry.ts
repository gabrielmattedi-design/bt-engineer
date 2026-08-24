/**
 * Geometria compartilhada entre o radar do relatório e o do card.
 *
 * Os dois desenhos são independentes por bons motivos — tamanhos, paletas e formatos de saída
 * diferentes —, mas a POSIÇÃO angular de cada eixo precisa ser a mesma nos dois. Quando ela vivia
 * duplicada, uma correção aplicada num lugar deixava o outro contando outra história, e o card é
 * justamente a peça que sai do site e circula sozinha.
 *
 * ═══ O SETOR DE CADA EIXO É PROPORCIONAL AO PESO DELE NA DECISÃO ═════════════════════════════
 *
 * Um radar de ângulos iguais convida o leitor a integrar a área — e a área de ângulos iguais trata
 * todo vértice como se valesse o mesmo. O motor não trata: `Seu nível` pesa 0,20 e `Spin` pode
 * pesar 0,05. O resultado era um gráfico que contradizia o próprio ranking.
 *
 * Medido nas personas com raquete atual fora do primeiro lugar, a vantagem da 1ª colocada em pontos
 * de área:
 *
 *     persona   posição da atual   área de ângulos iguais   área ponderada
 *       p02           8º              79 vs 83  (+4)          82 vs 86  (+4)
 *       p05          18º              82 vs 84  (+2)          82 vs 85  (+3)
 *       p06          17º              74 vs 84  (+10)         67 vs 87  (+20)
 *       p20          20º              81 vs 82  (+1)          84 vs 90  (+6)
 *       p22          21º              64 vs 82  (+18)         60 vs 91  (+31)
 *
 * Um ponto de diferença para uma raquete em VIGÉSIMO lugar. Relato do usuário, e ele estava certo:
 * "parece que a minha atual está melhor do que a recomendada; nos aspectos que ela perde, perde por
 * pouco, e nos que ganha, ganha por muito. E ela ficou só em décimo segundo".
 *
 * Estava mesmo — porque o desenho somava igual o que a decisão somou pesado. Com o setor
 * proporcional, a área que o olho integra passa a ser a mesma conta que escolheu a raquete, e a
 * separação média entre a 1ª e a atual sobe de 7,0 para 12,8 pontos.
 *
 * ═══ POR QUE EXISTE UM PISO DE SETOR ═════════════════════════════════════════════════════════
 *
 * Sem ele, um eixo de peso 0,05 receberia 18 graus e viraria um espeto ilegível com o rótulo
 * colado no vizinho. O piso custa fidelidade — os eixos mais leves aparecem um pouco maiores do que
 * pesam —, e é um custo assumido: um vértice que não dá para ler não informa nada, e a alternativa
 * seria esconder o eixo, que é pior. Os pesos exatos continuam escritos abaixo do gráfico.
 */

import type { RadarAxis } from '@/payments/radar';

/** Fração mínima da circunferência para um eixo, em nome da legibilidade. Ver a nota acima. */
const MIN_SHARE = 0.07;

export type AxisLayout = {
  /** Ângulo do CENTRO do setor, com a rotação já aplicada. É onde o vértice e o rótulo ficam. */
  readonly angle: number;
  /** Bordas angulares do setor, para as faixas de fundo de cada bloco. */
  readonly start: number;
  readonly end: number;
};

/**
 * Distribui os eixos ao redor do círculo, cada um ocupando um setor proporcional ao seu peso, e
 * gira o conjunto para que o bloco de BOLA fique centrado no topo.
 *
 * A rotação é CALCULADA, nunca uma constante: escrita como −45° ela deixaria silenciosamente de
 * centrar nada no dia em que um eixo entrasse ou saísse, e o gráfico voltaria a contradizer a
 * legenda sem ninguém perceber.
 */
export function layoutAxes(axes: readonly RadarAxis[]): AxisLayout[] {
  if (axes.length === 0) return [];

  const total = axes.reduce((sum, a) => sum + Math.max(0, a.weight), 0);
  const brutas =
    total <= 0
      ? axes.map(() => 1 / axes.length)
      : axes.map((a) => Math.max(0, a.weight) / total);

  // Piso e renormalização: o piso tira fatia de quem tem de sobra, nunca cria circunferência.
  const comPiso = brutas.map((s) => Math.max(s, MIN_SHARE));
  const somaComPiso = comPiso.reduce((sum, s) => sum + s, 0);
  const shares = comPiso.map((s) => s / somaComPiso);

  const semRotacao: { start: number; end: number; angle: number }[] = [];
  let acumulado = 0;
  for (const share of shares) {
    const start = acumulado * Math.PI * 2;
    acumulado += share;
    const end = acumulado * Math.PI * 2;
    semRotacao.push({ start, end, angle: (start + end) / 2 });
  }

  /** Centro angular do bloco de bola, para levá-lo ao topo. */
  const bola = semRotacao.filter((_, i) => axes[i]!.group === 'bola');
  const centroBola =
    bola.length === 0
      ? 0
      : (bola[0]!.start + bola[bola.length - 1]!.end) / 2;

  const rotacao = -Math.PI / 2 - centroBola;

  return semRotacao.map((s) => ({
    angle: s.angle + rotacao,
    start: s.start + rotacao,
    end: s.end + rotacao,
  }));
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
  angle: number,
  radius: number,
  center: { x: number; y: number },
): [number, number] {
  return [center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius];
}

/** Âncora horizontal do texto conforme o lado da teia em que o eixo cai. */
export function labelAnchor(angle: number): 'start' | 'middle' | 'end' {
  const c = Math.cos(angle);
  if (Math.abs(c) < 0.3) return 'middle';
  return c > 0 ? 'start' : 'end';
}
