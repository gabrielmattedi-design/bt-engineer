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
 * ═══ AS QUATRO SÉRIES ═══════════════════════════════════════════════════════════════════════
 *
 *   exigência   — quanto o SEU questionário pede em cada eixo, com hierarquia entre eles. É a
 *                 única série que não descreve raquete nenhuma: descreve você. Ver `profile`.
 *   recomendada — quão adequada a raquete escolhida é em cada eixo.
 *   atual       — a mesma leitura para a sua de hoje. Ausente quando não informada.
 *   catálogo    — a média das avaliadas, a régua de "normal".
 *
 * As três últimas estão em ADEQUAÇÃO (100 = perfeito para você naquele aspecto). A exigência está
 * na mesma escala de propósito, e é isso que torna o vão legível: onde o verde fica abaixo do
 * laranja, a recomendação entrega menos do que foi pedido naquele aspecto — e essa é uma troca que
 * o relatório precisa explicar em palavras, não um artefato do desenho.
 *
 * Onde o verde PASSA do laranja, ela entrega mais do que foi pedido. Isso é resultado bom, não
 * inconsistência: um teste chegou a proibir esse caso, herdando a época em que a linha laranja era
 * um teto de oferta em vez de um pedido.
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
   * A EXIGÊNCIA: quanta adequação o seu questionário pede NESTE eixo, na hierarquia dos oito.
   *
   * ═══ AS DUAS VERSÕES QUE JÁ SATURARAM ══════════════════════════════════════════════════════
   *
   * Foi 100 fixo. Uma linha constante na borda é um círculo: não informa nada e lê-se como "o seu
   * jogo exige o máximo de tudo".
   *
   * Virou então o TETO — o melhor que alguma raquete viável alcança no eixo — e o defeito voltou
   * pela porta dos fundos, porque um MÁXIMO sobre um conjunto grande satura por construção. Medido
   * nas 22 personas de validação, com fronteira média de 19 raquetes:
   *
   *     56% dos eixos com a linha em 99 ou 100
   *     "Seu físico" em 100 nas 22 personas, sem exceção
   *     0 de 22 personas em que ALGUMA raquete real alcançava a linha inteira
   *
   * Essa última é a que condena a versão do teto. O máximo por eixo é tirado de raquetes
   * DIFERENTES, então o polígono tracejado descrevia um produto que não existe — a mesma falha de
   * "apontar para o vazio" que o clamp da fronteira tinha sido escrito para corrigir, só que agora
   * pelo lado da oferta. E como a linha é rotulada "o que seu jogo pede", ela ainda atribuía ao
   * jogador uma exigência que não era dele: era a do catálogo.
   *
   * ═══ O QUE ELA É AGORA ═════════════════════════════════════════════════════════════════════
   *
   * O pedido do questionário, com hierarquia. Cada eixo recebe uma exigência proporcional a quanto
   * ELE foi demandado, medida de duas formas ao mesmo tempo (`axisDemand`):
   *
   *   • em ABSOLUTO  — a intensidade com que o questionário pediu aquele aspecto;
   *   • em RELATIVO  — o tamanho desse pedido comparado ao maior pedido do próprio perfil.
   *
   * As duas juntas são o que produz hierarquia legível: quem ordenou controle em 1º e spin em 3º
   * vê o vértice de controle esticado e o de spin recolhido, e quem não pediu nada com força vê o
   * polígono inteiro modesto — em vez de oito pontas na borda.
   *
   * Nunca encosta em 100 (`DEMAND_CEIL`) nem desce a zero (`DEMAND_FLOOR`): mesmo o aspecto que
   * ninguém priorizou precisa de uma raquete que não seja ruim nele, e o teto reservado deixa
   * visível que a linha é uma exigência, não um limite físico.
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
/**
 * ─── OS RÓTULOS DIZEM DE QUEM É A MEDIDA ───────────────────────────────────────────────────
 *
 * Antes eram `Conforto e braço`, `Peso e manejo`, `Nível técnico`, `Estilo de jogo`. Lidos numa
 * teia ao lado de `Potência` e `Controle`, os oito viravam oito características DA RAQUETE — e um
 * usuário concluiu, três vezes seguidas e com razão de sobra, que o gráfico estava afirmando que a
 * recomendada é um produto superior ao dele em cinco de seis aspectos.
 *
 * Nenhum destes cinco eixos descreve a raquete. `Peso para o seu físico` marca 96 para um jogador
 * de 82 kg e marcaria 40, na MESMA raquete, para um de 50 kg. É uma medida do par raquete-jogador,
 * e o rótulo tem que dizer isso sozinho, porque é lido sozinho.
 *
 * O possessivo faz o trabalho que a legenda não fazia: "seu físico", "seu nível", "seu swing",
 * "seu jogo", "seu braço" não têm como ser lidos como spec de fabricante.
 *
 * E são CURTOS de propósito. A primeira versão dizia `Exigência p/ seu nível` e `Conforto p/ seu
 * braço`; renderizados, esses rótulos invadiam a teia — o de baixo caía em cima do próprio
 * polígono. Alargar a moldura para acomodá-los encolheria o gráfico na mesma proporção. Como o
 * setor sombreado e o título do bloco já explicam de que se trata, o rótulo só precisa dizer de
 * QUEM é a medida, e "Seu braço" faz isso em duas palavras.
 */
const AXES: readonly AxisSpec[] = [
  { key: 'power', label: 'Potência', group: 'bola', need: 'power' },
  { key: 'control', label: 'Controle', group: 'bola', need: 'control' },
  { key: 'spin', label: 'Spin', group: 'bola', need: 'spin' },
  { key: 'comfort_fit', label: 'Seu braço', group: 'voce', component: 'comfort_fit' },
  { key: 'physical_fit', label: 'Seu físico', group: 'voce', component: 'physical_fit' },
  { key: 'skill_fit', label: 'Seu nível', group: 'voce', component: 'skill_fit' },
  { key: 'swing_fit', label: 'Seu swing', group: 'voce', component: 'swing_fit' },
  { key: 'playstyle_fit', label: 'Seu jogo', group: 'voce', component: 'playstyle_fit' },
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
 * Piso e teto da linha de exigência.
 *
 * O piso não é zero porque não pedir um aspecto não é o mesmo que aceitar ser ruim nele: quem não
 * priorizou conforto ainda assim não quer uma raquete que machuque. `DEMAND_FLOOR` é o "aceitável
 * sem ter pedido".
 *
 * O teto não é 100 de propósito. Encostar na borda é justamente o que as duas versões anteriores
 * faziam, e a borda tem um significado que a exigência não tem: 100 é adequação perfeita, um limite
 * do que existe. Um pedido, por mais forte que seja, é uma prioridade — não uma exigência de
 * perfeição. Deixar a folga visível é o que impede a linha de voltar a ser lida como "quero o
 * máximo de tudo".
 */
const DEMAND_FLOOR = 55;
const DEMAND_CEIL = 94;

/**
 * Maior peso que um componente de encaixe assume numa análise.
 *
 * Serve para pôr os pesos do motor (que somam 1 entre si) na mesma régua 0–1 dos pedidos de bola
 * (que vêm de `desired_change_vector`, de −40 a +40). Sem essa normalização os dois grupos não
 * seriam comparáveis, e a hierarquia entre "controle" e "seu braço" sairia do tamanho relativo dos
 * conjuntos, não da vontade do jogador.
 *
 * 0.30 é o topo observado nas 22 personas (`skill_fit` chega a 0.28).
 */
const MAX_COMPONENT_WEIGHT = 0.3;

/**
 * A exigência de um eixo, 0–1, combinando quanto ele foi pedido em ABSOLUTO e em RELATIVO.
 *
 * A média geométrica é a escolha certa aqui porque ela exige as DUAS coisas: um eixo só chega perto
 * de 1 se foi muito pedido *e* se foi o mais pedido do perfil. Uma média aritmética deixaria um
 * pedido fraco que por acaso é o maior do perfil subir alto — que é exatamente o caso "não pedi
 * quase nada, mas o gráfico grita" que a linha precisa parar de produzir.
 *
 * Quando ninguém pediu nada (`maiorPedido` igual a zero), não há hierarquia a desenhar e todos os
 * eixos ficam no piso.
 */
function axisDemand(pedidoAbsoluto: number, maiorPedido: number): number {
  if (maiorPedido <= 0) return 0;
  const relativo = Math.min(1, pedidoAbsoluto / maiorPedido);
  const absoluto = Math.min(1, pedidoAbsoluto);
  return Math.sqrt(absoluto * relativo);
}

/** Converte a exigência 0–1 para a escala de adequação do gráfico. */
function demandToAxis(demand: number): number {
  return Math.round(DEMAND_FLOOR + (DEMAND_CEIL - DEMAND_FLOOR) * demand);
}

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
   * O pedido de cada eixo em ABSOLUTO, 0–1 — a matéria-prima da hierarquia.
   *
   * Os dois grupos chegam em unidades diferentes e precisam da mesma régua antes de serem
   * comparados entre si:
   *
   *   • bola    — `desired_change_vector` vai de −40 a +40 e já É o pedido do questionário. O sinal
   *               não importa aqui: pedir −40 de potência é um pedido tão forte quanto pedir +40, e
   *               a linha mede o TAMANHO da exigência, não a direção dela.
   *   • encaixe — o peso que o motor deu ao componente NESTA análise. É profile-dependente de fato
   *               (medido: 10 a 11 valores distintos em 22 personas), e é onde a resposta do
   *               questionário já foi traduzida em prioridade — quem marcou sensibilidade no braço
   *               chega aqui com `comfort_fit` em 0.17~0.19 contra 0.07 de quem não marcou.
   */
  const askOf = (axis: AxisSpec): number =>
    axis.need
      ? Math.min(1, Math.abs(profile.desired_change_vector[axis.need]) / 40)
      : Math.min(1, weightOf(winner, axis.component!) / MAX_COMPONENT_WEIGHT);

  const asks = AXES.map(askOf);
  const maiorPedido = Math.max(...asks);

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

  return AXES.map((axis, axisIndex): RadarAxis => {
    /** A exigência deste eixo — mesma conta para os dois grupos, e é isso que os torna comparáveis. */
    const demanded = demandToAxis(axisDemand(asks[axisIndex]!, maiorPedido));

    if (axis.component) {
      const catalogMean =
        ranking.length === 0
          ? 50
          : ranking.reduce((sum, r) => sum + componentOf(r, axis.component!), 0) / ranking.length;

      return {
        key: axis.key,
        label: axis.label,
        group: axis.group,
        profile: demanded,
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
      profile: demanded,
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
