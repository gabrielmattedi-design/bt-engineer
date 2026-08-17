import { clamp01 } from '@/domain/scores';
import { NEED_KEYS, NEED_TO_RACKET_ATTRIBUTE, type NeedKey, type PlayerProfile } from '@/domain/player-profile';
import type { ComponentKey, RankedRacket, RecommendationResult } from '@/domain/recommendation';

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
  readonly key: string;
  readonly label: string;
  /**
   * O TETO: a melhor adequação que alguma raquete viável alcança neste eixo.
   *
   * ═══ POR QUE NÃO É 100 ═════════════════════════════════════════════════════════════════════
   *
   * Foi 100 por uma versão, e estava errado. Uma linha constante na borda é um círculo: não carrega
   * informação nenhuma e, pior, lê-se como "o seu jogo exige o máximo de tudo" — que é justamente
   * a acusação de burrice que o gráfico precisa não merecer.
   *
   * O teto é outra coisa, e é útil: em cada eixo, o melhor que EXISTE para este jogador entre as
   * raquetes que ainda são opção real para ele. Onde a recomendada encosta no teto, aquele aspecto
   * está no máximo que o mercado permite; onde ela fica abaixo, houve uma troca — e o tamanho do vão
   * é o tamanho da troca. A linha passa a responder "o que foi sacrificado, e quanto", que é
   * exatamente a pergunta que o leitor faz.
   */
  readonly profile: number;
  readonly recommended: number;
  readonly current: number | null;
  readonly catalog: number;
  /** `bola` = o que a raquete faz com a bola; `voce` = o quanto ela encaixa em você. */
  readonly group: 'bola' | 'voce';
  /**
   * Quanto este eixo pesou na decisão, 0–1.
   *
   * Vai para a tela junto do rótulo. Um radar trata todos os vértices como iguais, e eles não são:
   * `Nível técnico` vale 0.20 do score e `Spin` vale um terço de 0.16. Sem o peso escrito, dois
   * polígonos de área parecida podem corresponder a uma diferença real de seis pontos — e o leitor
   * não tem como saber qual vértice olhar. Com ele, o gráfico deixa de precisar ser interpretado
   * por adivinhação.
   */
  readonly weight: number;
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
const BALL_AXES = 3;

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
 * ═══ NOVE EIXOS, E POR QUE O GRÁFICO MUDOU DE UNIDADE ════════════════════════════════════════
 *
 * O radar tinha seis eixos, todos de COMPORTAMENTO DE BOLA, e por isso contradizia a própria
 * recomendação. O caso que expôs isso, medido:
 *
 *     distância média ao que o jogo pede — ATUAL 6.5  |  RECOMENDADA 11.7
 *     fit — ATUAL 78.3 (7ª)  |  RECOMENDADA 81.2 (1ª)
 *
 * As duas leituras estavam certas. A raquete atual do jogador de fato ficava mais perto do alvo
 * NAQUELES SEIS EIXOS; e a recomendada de fato vencia, porque a decisão é dominada por peso,
 * nível técnico e swing — que não estavam no desenho. O gráfico mostrava um terço do raciocínio e
 * o usuário, corretamente, concluía que a escolha estava errada.
 *
 * Mostrar menos critérios para "simplificar" foi o erro. A decisão do produto é a inversa: se o
 * gráfico é o que convence, ele precisa carregar TODOS os eixos que decidiram. Mais vértices, não
 * menos.
 *
 * ─── O QUE MUDOU DE UNIDADE ────────────────────────────────────────────────────────────────
 *
 * Antes cada eixo era POSIÇÃO NO CATÁLOGO (0 = a menos potente que existe, 100 = a mais). Isso
 * funciona para potência, mas não existe "posição de catálogo" para peso adequado ao seu braço.
 *
 * Agora todo eixo é ADEQUAÇÃO: 100 = perfeito para você naquele aspecto, 0 = inadequado. Nessa
 * unidade os nove eixos são comparáveis entre si, a linha do "o que seu jogo pede" é a borda
 * externa (o ideal), e o polígono maior é literalmente a raquete que o motor escolheu — o gráfico
 * passa a JUSTIFICAR a escolha em vez de disputá-la.
 *
 * Nos eixos de bola a adequação é a distância ao alvo daquele eixo; nos eixos de encaixe ela é o
 * próprio componente do motor, sem tradução nenhuma. Ver `fit-components.ts`.
 */
type AxisSpec = {
  readonly key: string;
  readonly label: string;
  readonly group: 'bola' | 'voce';
  /** Eixo de bola: qual necessidade ele mede. */
  readonly need?: NeedKey;
  /** Eixo de encaixe: qual componente do motor ele mostra. */
  readonly component?: ComponentKey;
};

/**
 * ─── POR QUE ESTABILIDADE E MANOBRABILIDADE SAÍRAM DO GRÁFICO ──────────────────────────────
 *
 * Não por serem inconvenientes. Por serem DUPLICATA, e duplicata com o sinal trocado.
 *
 * As duas são, quase inteiramente, função de massa e distribuição de massa — e massa já tem um
 * eixo próprio aqui, `Peso e manejo`, que é o componente que o motor de fato usa para decidir.
 * Medido no caso relatado, para a MESMA raquete atual:
 *
 *     Estabilidade 94   ·   Manobrabilidade 100   ·   Peso e manejo 66
 *
 * Os dois primeiros dizem "excelentes propriedades de massa"; o terceiro diz "massa demais para
 * este jogador". Não é contradição do modelo: `Peso e manejo` compara a massa COM O JOGADOR, e os
 * outros dois a descrevem em abstrato. Num gráfico onde todo eixo significa "adequação a você", um
 * eixo que não olha para você não pode ficar.
 *
 * Mantê-los custava duas coisas ao mesmo tempo: três vértices de nove descreviam massa (contra um
 * único componente de decisão), e dois deles empurravam a leitura na direção contrária à do
 * terceiro. O gráfico ficava, na média, elogiando a raquete que o motor havia recusado.
 *
 * ─── E POR QUE OITO, E NÃO SEIS ────────────────────────────────────────────────────────────
 *
 * Porque a decisão tem oito partes. Cinco delas — conforto, peso, nível, swing e estilo — pesam
 * juntas 0.66 do score final, e NENHUMA aparecia no gráfico antigo. Era por isso que ele conseguia
 * contradizer a recomendação: mostrava os 9% de objetivo e escondia os 66% que decidem.
 */
const AXES: readonly AxisSpec[] = [
  { key: 'power', label: 'Potência', group: 'bola', need: 'power' },
  { key: 'control', label: 'Controle', group: 'bola', need: 'control' },
  { key: 'spin', label: 'Spin', group: 'bola', need: 'spin' },
  { key: 'comfort_fit', label: 'Conforto e braço', group: 'voce', component: 'comfort_fit' },
  { key: 'physical_fit', label: 'Peso e manejo', group: 'voce', component: 'physical_fit' },
  { key: 'skill_fit', label: 'Nível técnico', group: 'voce', component: 'skill_fit' },
  { key: 'swing_fit', label: 'Seu swing', group: 'voce', component: 'swing_fit' },
  { key: 'playstyle_fit', label: 'Estilo de jogo', group: 'voce', component: 'playstyle_fit' },
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

function componentOf(racket: RankedRacket, key: ComponentKey): number {
  return racket.breakdown.components.find((c) => c.key === key)?.raw ?? 50;
}

/** Peso real do componente nesta análise — sai do breakdown, nunca de uma tabela paralela. */
function weightOf(racket: RankedRacket, key: ComponentKey): number {
  return racket.breakdown.components.find((c) => c.key === key)?.weight ?? 0;
}

/** Abaixo disto o eixo não teve pedido, e não há o que cobrar dele. */
const MIN_ASK = 5;

/** Piso do espaço de manobra, espelhando `MIN_HEADROOM` de `objectiveFit`. */
const MIN_HEADROOM = 15;

/**
 * Valor exibido num eixo em que o jogador não pediu nada.
 *
 * O mesmo neutro que `objectiveFit` usa: não pedir não é falha da raquete, e não pode virar nota
 * cheia — senão um perfil sem pedido nenhum desenharia um polígono perfeito sem ter sido analisado.
 */
const NEUTRAL = 70;

/**
 * Adequação num eixo de bola: QUANTO DO PEDIDO aquela raquete entregou.
 *
 * ═══ POR QUE NÃO É DISTÂNCIA AO ALVO ═════════════════════════════════════════════════════════
 *
 * A primeira versão media distância entre a raquete e o alvo do eixo. Parecia óbvio e estava
 * errado, porque o alvo é ancorado na raquete que o jogador JÁ TEM: alvo = posição atual + o que
 * ele pediu. Numa métrica assim, ficar parado é quase ótimo por construção — a raquete atual está,
 * por definição, a zero do próprio ponto de partida.
 *
 * O efeito foi medido na persona 5, e é exatamente a contradição que o usuário viu no gráfico:
 *
 *     objective_fit do motor    recomendada 85   ·   atual 56
 *     eixos de bola do radar    recomendada 30   ·   atual 95   (spin)
 *
 * As duas coisas descrevendo o mesmo fato, com sinais opostos. O motor pergunta "quanto da mudança
 * pedida esta raquete entrega?" — e a raquete atual entrega ZERO, porque ela é o ponto de partida.
 * O radar perguntava "quão perto do alvo ela está?" e premiava justamente quem não saiu do lugar.
 *
 * Agora o eixo faz a mesma pergunta do motor, com a mesma conta: a fração do espaço disponível
 * percorrida na direção pedida. `objectiveFit` e o gráfico param de discordar porque passam a
 * medir a mesma coisa.
 */
function askAdequacy(desired: number, reference: number, actual: number): number {
  if (Math.abs(desired) <= MIN_ASK) return NEUTRAL;

  const headroom = Math.max(desired > 0 ? 100 - reference : reference, MIN_HEADROOM);
  const delivered = Math.max(-1, Math.min(1, ((actual - reference) * Math.sign(desired)) / headroom));
  return Math.round(Math.max(0, Math.min(100, 50 + delivered * 50)));
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
  /**
   * As opções que ainda estão em jogo para este jogador — a fronteira do possível.
   *
   * Não é o catálogo inteiro: o catálogo inclui frames já descartados por peso, nível ou conforto,
   * e um teto calculado sobre eles apontaria para algo que não é alternativa para ninguém.
   */
  const viable = ranking.filter((r) => winner.fit_score - r.fit_score <= VIABLE_FIT_GAP);
  const frontier = viable.length > 0 ? viable : [winner];

  /**
   * Os três eixos de bola dividem o peso de `objective_fit` — mas NÃO em partes iguais.
   *
   * Eles dividiam. Um jogador que ordenou potência em 1º, controle em 2º e spin em 3º via os três
   * com o mesmo percentual na tela, o que contradiz a própria pergunta que ele acabou de responder:
   * a pergunta é ordenada, e a ordem tem que aparecer. A divisão passa a ser proporcional à
   * intensidade de cada pedido, que é onde a ordem já foi traduzida em número.
   *
   * Sem pedido nenhum, volta a ser igual — não há ordem a respeitar.
   */
  const askByAxis = AXES.filter((a) => a.need).map((a) =>
    Math.abs(profile.desired_change_vector[a.need!]),
  );
  const askTotal = askByAxis.reduce((s, v) => s + v, 0);
  const objectiveWeight = weightOf(winner, 'objective_fit');

  return AXES.map((axis): RadarAxis => {
    if (axis.component) {
      const catalogMean =
        ranking.length === 0
          ? 50
          : ranking.reduce((sum, r) => sum + componentOf(r, axis.component!), 0) / ranking.length;

      return {
        key: axis.key,
        label: axis.label,
        group: axis.group,
        profile: Math.round(
          Math.max(...frontier.map((r) => componentOf(r, axis.component!))),
        ),
        recommended: Math.round(componentOf(winner, axis.component)),
        current: currentRacket ? Math.round(componentOf(currentRacket, axis.component)) : null,
        catalog: Math.round(catalogMean),
        weight: weightOf(winner, axis.component),
      };
    }

    const need = axis.need!;
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
     * ═══ A ÂNCORA É O CATÁLOGO, NUNCA A RAQUETE ATUAL ════════════════════════════════════════
     *
     * Era a raquete atual, e isso produzia um artefato que invalidava a comparação inteira: se a
     * referência é a própria raquete do jogador, o avanço dela em relação a si mesma é ZERO, e
     * `askAdequacy` devolve exatamente 50 — em TODO eixo com pedido, sempre, independentemente de
     * quão boa ela seja naquele aspecto.
     *
     * Medido: potência 50, controle 50, spin 50 para a raquete atual, enquanto a recomendada
     * marcava 84, 98 e 68. O gráfico não estava dizendo que a recomendada é melhor — estava
     * dizendo que a atual está presa no meio da escala por definição. Foi isso que o usuário leu
     * como "melhor em tudo", e ele estava certo em desconfiar.
     *
     * Com a âncora no catálogo, as duas raquetes são medidas contra o MESMO ponto fixo e a
     * comparação volta a significar alguma coisa. A raquete atual pode ganhar num eixo — e, quando
     * ela já entrega o que foi pedido, ela ganha.
     */
    const reference = catalogPosition;
    const desired = profile.desired_change_vector[need];

    return {
      key: axis.key,
      label: axis.label,
      group: axis.group,
      profile: Math.round(
        Math.max(
          ...frontier.map((r) =>
            askAdequacy(desired, reference, position(bands, attribute, valueOf(r))),
          ),
        ),
      ),
      recommended: askAdequacy(desired, reference, position(bands, attribute, valueOf(winner))),
      // A atual entrega zero do pedido por definição — ela É o ponto de partida.
      current: currentPosition === null ? null : askAdequacy(desired, reference, currentPosition),
      catalog: askAdequacy(desired, reference, catalogPosition),
      weight:
        askTotal > 0
          ? (objectiveWeight * Math.abs(desired)) / askTotal
          : objectiveWeight / BALL_AXES,
    };
  });
}
