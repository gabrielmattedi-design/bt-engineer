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
 * ═══ A LINHA TRACEJADA TEM DUAS LEITURAS, UMA POR BLOCO ══════════════════════════════════════
 *
 * Não por indecisão: as duas unificações foram tentadas e falharam por lados opostos.
 *
 *   • como NÍVEL DE PEDIDO nos oito — nos cinco eixos de encaixe o verde passava do tracejado, e o
 *     gráfico dizia "esta raquete entrega mais do que você precisa". Sem sentido: aqueles eixos já
 *     são adequação, e não existe mais adequado que perfeito.
 *   • como BORDA nos oito — nos três eixos de bola o mesmo desenho passou a acusar de excesso uma
 *     raquete que entrega mais potência do que foi pedido, que é resultado bom.
 *
 * A separação sobrevive porque os dois blocos medem coisas diferentes:
 *
 *   encaixe (5) — adequação do par raquete+jogador. O tracejado é a BORDA, ninguém passa.
 *   bola (3)    — quanto do PEDIDO foi entregue. O tracejado é o TAMANHO DO PEDIDO, e passar dele
 *                 significa entregar mais do que se pediu.
 *
 * As outras três séries — recomendada, atual e catálogo — estão sempre na mesma unidade dentro de
 * cada bloco, e é isso que mantém a comparação entre elas válida.
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
   * A linha tracejada. NOS EIXOS DE ENCAIXE é o ideal (100); NOS DE BOLA é o tamanho do pedido.
   *
   * ═══ AS QUATRO VERSÕES QUE ESTA LINHA JÁ TEVE ══════════════════════════════════════════════
   *
   * 1. 100 fixo, com as raquetes em POSIÇÃO DE CATÁLOGO. A borda dizia "quero o máximo de tudo"
   *    porque, naquela unidade, dizia mesmo.
   *
   * 2. TETO DA OFERTA — o melhor que alguma raquete viável alcançava. Saturava por construção
   *    (máximo sobre ~19 raquetes) e cada vértice vinha de uma raquete diferente: 0 de 22 personas
   *    tinham alguma raquete real capaz de alcançar a linha inteira.
   *
   * 3. NÍVEL DE PEDIDO nos oito eixos. Corrigiu a saturação e criou um erro nos eixos de encaixe:
   *    ali o verde é adequação, e passar do tracejado virou "entrega mais do que você precisa".
   *
   * 4. BORDA nos oito eixos. Corrigiu o encaixe e quebrou a bola: uma raquete que entrega mais
   *    potência do que foi pedido passou a parecer excessiva, quando é o resultado desejado.
   *
   * A quinta é a separação por bloco. Ela não é um meio-termo — é o reconhecimento de que os dois
   * blocos nunca mediram a mesma coisa, e que uma linha só não descreve as duas.
   *
   * ─── NOS EIXOS DE BOLA, POR QUE NÃO ENCOSTA EM 100 ─────────────────────────────────────────
   *
   * Piso `DEMAND_FLOOR` e teto `DEMAND_CEIL`: não pedir um aspecto não é aceitar ser ruim nele, e
   * um pedido, por mais forte, é prioridade e não exigência de perfeição. A folga até a borda é o
   * que impede a linha de voltar a ser lida como "meu jogo exige o máximo de tudo".
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
 * A borda do gráfico — o ideal para este jogador em qualquer eixo.
 *
 * Não é um parâmetro ajustável: é o topo da escala de adequação. Mudar este número exigiria mudar
 * o que `askAdequacy` e os componentes de encaixe significam.
 */
const IDEAL = 100;

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
 * Valor de um eixo de bola em que o jogador não pediu nada.
 *
 * Acima de 50 porque não pedir não é falha da raquete — nenhuma direção foi contrariada. É o mesmo
 * neutro que `objectiveFit` usa.
 *
 * ⚠️ LIMITAÇÃO CONHECIDA: como este valor não depende da raquete, as três séries (recomendada,
 * atual e catálogo) caem no MESMO ponto quando não houve pedido. Visualmente parece um empate
 * triplo, e não é: é a ausência de critério. Já foi tentado resolver isso levando o neutro a 100 —
 * o empate continuou, só que na borda, onde chama mais atenção e ainda afirma que a raquete média
 * atende 100% de uma exigência que não existe. O tratamento certo é de TEXTO, e está no explicador
 * do bloco: o gráfico não tem como desenhar "não perguntado" num vértice.
 */
const NEUTRAL = 70;

/**
 * Piso e teto da linha de exigência dos eixos de BOLA.
 *
 * O piso não é zero porque não pedir um aspecto não é aceitar ser ruim nele. O teto não é 100
 * porque a borda, nesta escala, é o ideal — e um pedido é prioridade, não exigência de perfeição.
 */
const DEMAND_FLOOR = 55;
const DEMAND_CEIL = 94;

/**
 * A exigência de um eixo de bola, 0–1, combinando quanto ele foi pedido em ABSOLUTO e em RELATIVO
 * aos outros dois.
 *
 * A média geométrica exige as DUAS coisas: um eixo só chega perto de 1 se foi muito pedido E se foi
 * o mais pedido do perfil. Uma média aritmética deixaria um pedido fraco que por acaso é o maior
 * subir alto — o caso "não pedi quase nada, mas o gráfico grita".
 */
function axisDemand(pedidoAbsoluto: number, maiorPedido: number): number {
  if (maiorPedido <= 0) return 0;
  const relativo = Math.min(1, pedidoAbsoluto / maiorPedido);
  const absoluto = Math.min(1, pedidoAbsoluto);
  return Math.sqrt(absoluto * relativo);
}

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

  /**
   * O pedido de cada eixo de BOLA, 0–1, comparado apenas aos outros dois.
   *
   * A hierarquia que interessa aqui é interna ao bloco: quem pôs potência em 1º precisa ver o
   * vértice de potência esticado em relação a controle e spin. Comparar contra os pesos dos eixos
   * de encaixe misturaria fatia com bolo — o mesmo erro que tirou o peso dos rótulos.
   */
  const ballAsks = new Map<string, number>(
    AXES.filter((a) => a.need).map((a) => [
      a.key,
      Math.min(1, Math.abs(profile.desired_change_vector[a.need!]) / 40),
    ]),
  );
  const maiorPedido = Math.max(0, ...ballAsks.values());

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
        profile: IDEAL,
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
      profile: demandToAxis(axisDemand(ballAsks.get(axis.key) ?? 0, maiorPedido)),
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
