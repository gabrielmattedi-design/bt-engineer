import { clamp01 } from '@/domain/scores';
import { NEED_KEYS, NEED_TO_RACKET_ATTRIBUTE, type NeedKey, type PlayerProfile } from '@/domain/player-profile';
import type { RankedRacket, RecommendationResult } from '@/domain/recommendation';

/**
 * Dados do radar — quatro leituras sobre os mesmos seis eixos.
 *
 * ─── POR QUE NÃO EXISTE "MÉDIA DE JOGADORES DO SEU NÍVEL" ────────────────────────────────────
 *
 * A ideia original era comparar o jogador com a média de quem tem o mesmo nível. Seria o gráfico
 * mais interessante dos quatro, e não dá para fazê-lo hoje: não existe base de usuários. Publicar
 * uma curva chamada "média do seu nível" apoiada em nada seria inventar uma população — a mesma
 * coisa que o sistema de proveniência do catálogo existe para impedir, só que na camada de cima.
 *
 * Quando houver volume de questionários respondidos, essa série passa a ser calculável de verdade,
 * e entra sem mudar mais nada aqui: os eixos e a escala já são estes.
 *
 * ═══ O ERRO QUE ESTE ARQUIVO JÁ COMETEU ══════════════════════════════════════════════════════
 *
 * A primeira versão desenhava, no MESMO eixo, duas grandezas que não são comparáveis:
 *
 *   • as raquetes entravam como POSIÇÃO NO CATÁLOGO (0 = a menos potente que existe, 100 = a mais);
 *   • o jogador entrava como PRIORIDADE (0 = não me importo, 100 = é o que mais quero mudar).
 *
 * Prioridade 85 em potência não significa "quero uma raquete no percentil 85 de potência" —
 * significa "potência é o que mais quero melhorar". Sobrepostas, as duas leituras produziam um
 * abismo visual onde muitas vezes não havia nenhum, e o gráfico acusava o motor de um erro que
 * ele não tinha cometido. Pior: escondia os casos em que o erro era real, porque toda a diferença
 * parecia ruído de escala.
 *
 * ═══ AS QUATRO SÉRIES, TODAS EM POSIÇÃO DE CATÁLOGO ══════════════════════════════════════════
 *
 *   alvo        — ONDE seu jogo pede que a raquete esteja. É a posição de hoje mais a mudança
 *                 que o perfil pediu. Agora comparável com as outras três.
 *   recomendada — onde a raquete escolhida está.
 *   atual       — onde a sua de hoje está. Ausente quando não informada.
 *   catálogo    — a média das avaliadas, a régua de "normal".
 *
 * Com as quatro na mesma unidade, a leitura passa a ser verificável: se o verde fica abaixo do
 * laranja em potência, a recomendação REALMENTE entrega menos potência do que o perfil pediu, e
 * isso é uma troca que o relatório precisa explicar — não um artefato do desenho.
 *
 * ═══ POR QUE POSIÇÃO DE CATÁLOGO, E NÃO O VALOR CRU ══════════════════════════════════════════
 *
 * Os atributos crus se aglomeram entre 40 e 55 (ver `catalog-scale.ts`), e quatro polígonos quase
 * sobrepostos não mostram nada. Aqui a compressão seria pior que nos índices, porque a FORMA do
 * polígono é a informação.
 */

export type RadarAxis = {
  readonly key: NeedKey;
  readonly label: string;
  /** Posição de catálogo que o perfil pede neste eixo, 0–100. */
  readonly profile: number;
  readonly recommended: number;
  readonly current: number | null;
  readonly catalog: number;
};

/**
 * Quantos pontos de POSIÇÃO um pedido de intensidade máxima representa.
 *
 * `desired_change_vector` vai de −40 a +40 e é medido em pontos de prioridade. Traduzi-lo para o
 * eixo do catálogo exige uma taxa, e 1:1 é a escolha defensável: pedir a mudança mais forte que o
 * questionário permite move o alvo 40 pontos percentuais — de um frame mediano para perto do
 * extremo, sem exigir o extremo. Uma taxa maior faria o alvo estourar o topo em qualquer pedido
 * forte e o gráfico voltaria a acusar o motor por diferença que ninguém consegue fechar.
 */
const ASK_TO_POSITION = 1.0;

/**
 * Distância de fit que ainda define uma opção CONSIDERÁVEL para este jogador.
 *
 * ═══ POR QUE O ALVO PRECISA DE UMA FRONTEIRA ═════════════════════════════════════════════════
 *
 * Reclamação do usuário, e ela estava certa: "o gráfico da raquete indicada precisa minimamente se
 * parecer com o resultado das necessidades do teste".
 *
 * O alvo era um DESEJO SEM RESTRIÇÃO — posição de hoje mais o que o perfil pediu, sem passar por
 * nenhuma checagem de existência. Um intermediário pedindo potência recebia alvo 90 num eixo em que
 * toda raquete compatível com o resto do perfil dele vive entre 30 e 60. O laranja apontava para um
 * lugar onde não há produto, o verde ficava onde há, e o gráfico parecia denunciar um erro do motor
 * quando estava só desenhando um lugar vazio.
 *
 * O alvo passa a ser limitado pela FRONTEIRA DO POSSÍVEL: o melhor e o pior que se pode alcançar
 * naquele eixo entre as raquetes que continuam sendo opções reais para este jogador — as que estão
 * a menos de `VIABLE_FIT_GAP` do primeiro colocado. Não é o catálogo inteiro, porque o catálogo
 * inteiro inclui frames que já foram descartados por peso, nível ou conforto, e apontar para eles
 * seria apontar de novo para o vazio.
 *
 * ─── O QUE ISTO NÃO FAZ ────────────────────────────────────────────────────────────────────
 *
 * Não aproxima os polígonos por conveniência. Quando existe uma raquete viável bem melhor naquele
 * eixo, a fronteira fica lá em cima e a distância continua aparecendo inteira — que é exatamente
 * quando ela É informação. O que some é só a distância impossível de fechar, e essa some do gráfico
 * porque ela já é dita em palavras nos pontos de atenção, onde cabe a explicação.
 */
const VIABLE_FIT_GAP = 12;

const AXIS_LABEL_PT: Record<NeedKey, string> = {
  power: 'Potência',
  control: 'Controle',
  spin: 'Spin',
  comfort: 'Conforto',
  stability: 'Estabilidade',
  maneuverability: 'Manobrabilidade',
  forgiveness: 'Tolerância',
  precision: 'Precisão',
};

/**
 * Seis eixos, não oito.
 *
 * Um radar de oito pontas em tela de celular gasta metade da largura com rótulos e vira uma
 * mandala. `forgiveness` e `precision` ficam de fora porque são os mais correlacionados com
 * `control` e `power` — eles repetiriam a forma sem acrescentar leitura.
 */
const RADAR_AXES: readonly NeedKey[] = [
  'power',
  'control',
  'spin',
  'stability',
  'maneuverability',
  'comfort',
];

/** Mesma reposição usada pelos índices: a faixa real do catálogo vira 0–100. */
function position(
  bands: RecommendationResult['attribute_bands'],
  attribute: string,
  raw: number,
): number {
  const band = bands[attribute];
  if (!band || band[1] <= band[0]) return Math.round(raw);
  return Math.round(clamp01((raw - band[0]) / (band[1] - band[0])) * 100);
}

export function buildRadar(
  profile: PlayerProfile,
  winner: RankedRacket,
  ranking: readonly RankedRacket[],
  bands: RecommendationResult['attribute_bands'],
  currentRacket: RankedRacket | null,
): readonly RadarAxis[] {
  /**
   * As opções que ainda estão em jogo para este jogador.
   *
   * Inclui sempre a vencedora, mesmo que o ranking venha vazio por algum caminho degenerado — sem
   * isso a fronteira poderia excluir a própria raquete recomendada, e o alvo seria clampado para
   * longe dela.
   */
  const viable = ranking.filter((r) => winner.fit_score - r.fit_score <= VIABLE_FIT_GAP);
  const frontier = viable.length > 0 ? viable : [winner];

  return RADAR_AXES.filter((need) => NEED_KEYS.includes(need)).map((need) => {
    const attribute = NEED_TO_RACKET_ATTRIBUTE[need];
    const valueOf = (r: RankedRacket): number =>
      (r.racket.attributes[attribute as keyof typeof r.racket.attributes] as number) ?? 0;

    const catalogMean =
      ranking.length === 0
        ? 50
        : ranking.reduce((sum, r) => sum + valueOf(r), 0) / ranking.length;

    const catalogPosition = position(bands, attribute, catalogMean);
    const currentPosition = currentRacket
      ? position(bands, attribute, valueOf(currentRacket))
      : null;

    /**
     * O alvo parte de ONDE A PESSOA ESTÁ, não do meio da escala.
     *
     * Quem já usa um frame potente e pede mais potência está pedindo outra coisa — em posição
     * absoluta — do que quem pede o mesmo partindo de um frame fraco. Ancorar no ponto de partida
     * é o que faz "quero mais X" significar a mesma coisa para os dois.
     */
    const reference = currentPosition ?? catalogPosition;
    const wish = reference + profile.desired_change_vector[need] * ASK_TO_POSITION;

    /*
      A fronteira é sempre alargada até incluir a raquete ATUAL do jogador.

      Sem isso, alguém que já usa um frame mais extremo do que qualquer opção viável veria o alvo
      puxado para trás da própria raquete só porque o topo do que sobrou é mais baixo — e o gráfico
      diria "seu jogo pede menos potência do que você já tem" para quem acabou de pedir mais.
    */
    const positions = frontier.map((r) => position(bands, attribute, valueOf(r)));
    if (currentPosition !== null) positions.push(currentPosition);

    const reachableMax = Math.max(...positions);
    const reachableMin = Math.min(...positions);
    const target = Math.round(Math.max(reachableMin, Math.min(reachableMax, wish)));

    return {
      key: need,
      label: AXIS_LABEL_PT[need],
      profile: target,
      recommended: position(bands, attribute, valueOf(winner)),
      current: currentPosition,
      catalog: catalogPosition,
    };
  });
}
