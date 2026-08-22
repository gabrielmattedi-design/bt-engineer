import { clamp01 } from '@/domain/scores';
import { NEED_KEYS, NEED_TO_RACKET_ATTRIBUTE, type NeedKey, type PlayerProfile } from '@/domain/player-profile';
import type { ComponentKey, RankedRacket, RecommendationResult } from '@/domain/recommendation';
import {
  FLOOR_SAFE_PHYSICAL,
  FLOOR_SAFE_SKILL,
} from '@/recommendation/engine/rank-rackets';

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
 * ═══ OS DOIS BLOCOS MEDEM COISAS DIFERENTES, E A ESCALA DIZ ISSO ════════════════════════════
 *
 *   bola (3)    — QUANTO A RAQUETE ENTREGA em relação à que mais entrega no catálogo. Cem é a
 *                 melhor das 47 naquele aspecto (ver `shareOfBest`). A tracejada é o seu PEDIDO,
 *                 normalizado ao que existe para você.
 *   encaixe (5) — ADEQUAÇÃO do par raquete+jogador, de 0 a 100. A tracejada é o MELHOR ENCAIXE
 *                 que existe para este jogador entre as candidatas plausíveis — quase sempre 100,
 *                 e menos que isso quando a perfeição não está no cardápio dele.
 *
 * Unificar as duas escalas foi tentado quatro vezes e falhou quatro vezes, sempre pelo mesmo
 * motivo de fundo: o melhor quadro em potência é um, o melhor em spin é outro, e a recomendada é a
 * melhor no CONJUNTO — logo, não é a melhor em nenhum eixo isolado. Qualquer escala que ponha o
 * ideal de bola na borda faz a recomendada ficar aquém em TODOS os eixos de bola, enquanto nos de
 * encaixe ela marca 90 a 100 porque foi escolhida por encaixar. O eixo que a pessoa priorizou
 * aparece como o pior do gráfico, por construção.
 *
 * Medido, com a tracejada de bola na borda: o eixo priorizado era o pior vértice. Com a tracejada
 * sendo o pedido normalizado: 0 de 626 perfis.
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
   * A linha tracejada: em ambos os blocos, O MELHOR QUE EXISTE PARA ESTE JOGADOR.
   *
   * Nos eixos de bola é o seu pedido, limitado ao que alguma raquete plausível para ele alcança.
   * Nos de encaixe é o maior encaixe que alguma dessas mesmas candidatas atinge — quase sempre
   * 100, e menos que isso quando a perfeição não está no cardápio dele.
   *
   * ═══ AS CINCO VERSÕES QUE ESTA LINHA JÁ TEVE ═══════════════════════════════════════════════
   *
   * 1. 100 fixo, com as raquetes em POSIÇÃO DE CATÁLOGO. A borda dizia "quero o máximo de tudo"
   *    porque, naquela unidade, dizia mesmo.
   *
   * 2. TETO DA OFERTA — o melhor que alguma raquete viável alcançava. Cada vértice vinha de uma
   *    raquete diferente: 0 de 22 personas tinham alguma raquete real capaz de alcançar a linha
   *    inteira.
   *
   * 3. NÍVEL DE PEDIDO nos oito eixos. Corrigiu a saturação e criou um erro nos eixos de encaixe:
   *    ali o verde é adequação, e passar do tracejado virou "entrega mais do que você precisa".
   *
   * 4. DUAS LEITURAS, uma por bloco. Mediu certo e comunicou errado: nada no desenho dizia qual
   *    leitura valia em qual vértice.
   *
   * 5. BORDA NOS OITO, com o alvo virando denominador nos eixos de bola. Resolveu a comunicação e
   *    reintroduziu o defeito da versão 2 — a recomendada não é a melhor em nenhum eixo isolado,
   *    então ficava aquém em todos os de bola e o eixo priorizado virava o pior do gráfico.
   *
   * A atual não é uma sexta tentativa de unificar as ESCALAS — os dois blocos seguem medindo
   * grandezas diferentes, e devem seguir. O que ficou igual nos dois é o SIGNIFICADO da linha: ela
   * é sempre o melhor que existe para este jogador, e nunca um ideal que ninguém alcança. Foi essa
   * distinção que faltou nas cinco anteriores.
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
 * O ALVO de um eixo de bola, em POSIÇÃO DE CATÁLOGO: o pedido do jogador, normalizado à realidade
 * dele — nunca além do que a melhor raquete plausível para o seu perfil alcança.
 *
 * ═══ POR QUE O ALVO NÃO É A BORDA ════════════════════════════════════════════════════════════
 *
 * Já foi. E era o defeito que mais estragava o relatório de quem declarava prioridade, porque o
 * mecanismo é estrutural e não de calibração:
 *
 *   o melhor quadro em POTÊNCIA é um; o melhor em SPIN é outro; o melhor em CONTROLE é um
 *   terceiro. A recomendada é a melhor no CONJUNTO — logo, não é a melhor em nenhum eixo
 *   isolado. Com o alvo na borda de cada eixo, ela fica aquém em TODOS os eixos de bola, sempre.
 *
 * Somando a isso que nos cinco eixos de encaixe ela marca 90 a 100 — foi escolhida por encaixar —,
 * o resultado é que o eixo PRIORIZADO aparece como o pior do gráfico, por construção. Relato do
 * usuário: "pedi potência e o sistema me mostra que está me dando tudo menos potência".
 *
 * A mesma armadilha já tinha derrubado a segunda versão desta linha, com o registro no arquivo:
 * "cada vértice vinha de uma raquete diferente; 0 de 22 personas tinham alguma raquete real capaz
 * de alcançar a linha inteira". O alvo precisa ser o PEDIDO, e não o teto do mercado.
 *
 * ═══ NORMALIZAR DENTRO DA REALIDADE ══════════════════════════════════════════════════════════
 *
 * Nas palavras do usuário: "se é porque eu pedi muito, normalize o meu pedido dentro da minha
 * realidade, e diminua meu pedido dentro do possível".
 *
 * O alvo é onde ele está hoje mais o que pediu, limitado ao extremo NA DIREÇÃO DO PEDIDO entre as
 * raquetes plausíveis para ele. Pedir 40 pontos de potência quando o melhor quadro adequado ao seu
 * nível está 17 acima não move o alvo 40 — move 17, que é o que existe.
 *
 * Sem pedido no eixo, o alvo é a média do catálogo: nada foi pedido, e o que se espera de um
 * aspecto que não foi pedido é que ele não seja ruim.
 */
function ballTargetPosition(
  desired: number,
  catalogPosition: number,
  currentPosition: number | null,
  plausiblePositions: readonly number[],
): number {
  if (Math.abs(desired) <= MIN_ASK) return catalogPosition;

  const asked = (currentPosition ?? catalogPosition) + desired;
  if (plausiblePositions.length === 0) return asked;

  const reach =
    desired > 0 ? Math.max(...plausiblePositions) : Math.min(...plausiblePositions);
  return desired > 0 ? Math.min(asked, reach) : Math.max(asked, reach);
}

/**
 * Converte uma POSIÇÃO na faixa do catálogo no que o eixo de bola desenha: quanto aquela raquete
 * entrega em relação à que MAIS entrega entre as 47 avaliadas.
 *
 * ═══ POR QUE NÃO DESENHAR A POSIÇÃO DIRETO ═══════════════════════════════════════════════════
 *
 * Porque posição é RANK dentro da faixa, e as faixas são estreitas. Spin vai de 21,1 a 55,1 no
 * catálogo inteiro: a HEAD Speed Pro tem 22,4 — pouco, mas 1,3 ponto acima do piso —, e em posição
 * isso dava 4. O gráfico afirmava, na prática, que a raquete NÃO TEM SPIN. Pergunta do usuário,
 * com o card na mão: "e a raquete tem zero de spin? É isso?".
 *
 * Uma compressão linear (a faixa ocupando 15 a 90 em vez de 0 a 100) foi a primeira tentativa e
 * resolvia pela metade: tirava o zero, mas o número continuava sendo rank disfarçado, e os três
 * vértices ficavam colados no centro sem que isso quisesse dizer nada sobre a raquete.
 *
 * ═══ O QUE ESTA ESCALA DIZ ═══════════════════════════════════════════════════════════════════
 *
 * `valor / maior valor do catálogo`. Cem é a raquete que mais entrega naquele aspecto; cinquenta é
 * metade do que ela entrega. É uma frase que dá para dizer em voz alta, e é verificável.
 *
 * O piso deixa de ser zero e passa a ser o que a MENOR do catálogo realmente entrega:
 *
 *     potência   a menor desenha em 38    controle   a menor desenha em 54
 *     spin       a menor desenha em 38
 *
 * Nenhum produto real aparece como nada, o contraste entre raquetes continua (62 pontos de
 * amplitude em potência e spin), e a ordem entre elas é idêntica à da posição — as duas são
 * lineares no valor cru, então nada muda de lugar no ranking nem no desenho relativo.
 *
 * ═══ ISTO NÃO É MAQUIAR O NÚMERO ═════════════════════════════════════════════════════════════
 *
 * A distinção importa e é fácil de errar: subir o piso por estética seria inflar a percepção de
 * qualidade, que é exatamente o que o §58 proíbe. Aqui a mudança é de PERGUNTA, não de régua sobre
 * a mesma pergunta — "em que lugar da fila esta raquete está" e "quanto ela entrega comparada à
 * melhor" são coisas diferentes, e a segunda é a que o leitor de um relatório de compra precisa.
 * A primeira continua disponível, sem transformação nenhuma, na tabela de índices.
 */
function shareOfBest(
  bands: RecommendationResult['attribute_bands'],
  attribute: string,
  positionOnBand: number,
): number {
  const band = bands[attribute];
  if (!band || band[1] <= 0) return Math.round(positionOnBand);

  const [lo, hi] = band;
  const raw = lo + ((hi - lo) * Math.max(0, Math.min(100, positionOnBand))) / 100;
  return Math.round(Math.max(0, Math.min(100, (raw / hi) * 100)));
}

export function buildRadar(
  profile: PlayerProfile,
  winner: RankedRacket,
  ranking: readonly RankedRacket[],
  bands: RecommendationResult['attribute_bands'],
  means: RecommendationResult['attribute_means'],
  componentMeans: RecommendationResult['component_means'],
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
  /**
   * As candidatas PLAUSÍVEIS para este jogador — a base do teto de cada eixo de bola.
   *
   * Os mínimos são os mesmos que o piso de demanda declarada usa para decidir se pode agir
   * (`FLOOR_SAFE_PHYSICAL` e `FLOOR_SAFE_SKILL`), importados de lá em vez de recopiados: se um dia
   * a definição de "serve para este jogador" mudar no motor, o gráfico não pode continuar
   * desenhando o teto da definição antiga.
   */
  const plausible = ranking.filter(
    (r) =>
      componentOf(r, 'physical_fit') >= FLOOR_SAFE_PHYSICAL &&
      componentOf(r, 'skill_fit') >= FLOOR_SAFE_SKILL,
  );

  const askByAxis = AXES.filter((a) => a.need).map((a) =>
    Math.abs(profile.desired_change_vector[a.need!]),
  );
  const askTotal = askByAxis.reduce((s, v) => s + v, 0);
  const objectiveWeight = weightOf(winner, 'objective_fit');


  return AXES.map((axis): RadarAxis => {
    if (axis.component) {
      /**
       * A média vem do resultado, calculada sobre TUDO que foi pontuado.
       *
       * Já foi calculada aqui a partir de `ranking`, e desviava muito: o piso de demanda remove
       * raquetes de um lado só — as fracas no eixo pedido, que tendem a ser as mais pesadas —,
       * então quem sobra é mais leve e a média de encaixe físico sobe. Medido em 2560 eixos:
       * desvio absoluto médio de 12,6 pontos, com casos de 40 (`physical_fit` desenhado em 87
       * quando o catálogo entrega 47 para aquele jogador).
       *
       * E o efeito na tela era o inverso do que se imagina: a linha de comparação inflava, e a
       * recomendada aparecia MENOS distante da média do que realmente está.
       */
      const catalogMean = componentMeans[axis.component] ?? 50;

      /**
       * A tracejada é o melhor encaixe que EXISTE para este jogador, não a perfeição.
       *
       * ═══ POR QUE DEIXOU DE SER 100 FIXO ═══════════════════════════════════════════════════
       *
       * Pelo mesmo princípio que já valia nos três eixos de bola: o gráfico não pode cobrar da
       * raquete uma distância que nenhuma escolha fecha. Nos eixos de encaixe isso estava
       * acontecendo de forma silenciosa — a borda em 100 afirma "existe encaixe perfeito aqui", e
       * para parte dos jogadores não existe.
       *
       * Medido nas 22 personas, o teto alcançável entre as candidatas plausíveis:
       *
       *     Seu braço    média 94, mínimo 62, abaixo de 95 em 6 das 22
       *     Seu nível    média 96, mínimo 80, abaixo de 95 em 7
       *     Seu jogo     média 97, mínimo 87, abaixo de 95 em 6
       *     Seu swing    média 99, mínimo 84, abaixo de 95 em 1
       *     Seu físico   média 100, mínimo 100, nunca
       *
       * Na maioria dos casos a linha praticamente não se move — e é justamente por isso que a
       * mudança é segura. Ela age só onde a perfeição não estava no cardápio, que é onde a borda
       * fixa estava acusando a recomendação de uma falha do catálogo.
       *
       * O valor da RAQUETE não é tocado: continua sendo a adequação crua, de 0 a 100. Mexer nele
       * seria inflar a percepção de qualidade; mexer no alvo é parar de cobrar o impossível.
       */
      const tetoDeEncaixe =
        plausible.length === 0
          ? IDEAL
          : Math.round(Math.max(...plausible.map((r) => componentOf(r, axis.component!))));

      return {
        key: axis.key,
        label: axis.label,
        group: axis.group,
        profile: tetoDeEncaixe,
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

    /**
     * A âncora é a média do CATÁLOGO COMPLETO, e vem pronta no resultado.
     *
     * Já foi calculada aqui, a partir de `ranking` — e isso quebrava justamente quando o motor
     * acertava. O piso de demanda remove do ranking as raquetes fracas no eixo pedido, então a
     * média do que sobra sobe; a âncora subia junto e a vencedora, que estava ACIMA da média real,
     * aparecia abaixo da âncora inflada. Medido num perfil que pediu potência: vencedora na
     * posição 61 contra média real 49, desenhada com 3 de 100.
     */
    const catalogPosition = means[attribute] ?? 50;
    const currentPosition = currentRacket
      ? position(bands, attribute, valueOf(currentRacket))
      : null;

    const reference = catalogPosition;
    const desired = profile.desired_change_vector[need];

    return {
      key: axis.key,
      label: axis.label,
      group: axis.group,
      /**
       * As quatro séries em POSIÇÃO DE CATÁLOGO — a mesma régua que o motor usa para decidir.
       *
       * Antes eram uma medida de "quanto do pedido foi entregue", ancorada na média do catálogo.
       * Duas consequências ruins, as duas relatadas pelo usuário:
       *
       *   • num eixo SEM pedido a medida não dependia de raquete nenhuma, e as quatro séries
       *     caíam no mesmo ponto — "controle e spin devem ter algo errado, a laranja, a
       *     recomendada, a atual e a média estão todas no mesmo lugar". Estavam mesmo, e não
       *     havia dado nenhum ali;
       *   • a âncora era uma média, então o vértice ficava hipersensível perto dela: uma raquete
       *     poucos pontos abaixo da média desabava para perto de zero.
       *
       * Posição de catálogo não tem nenhum dos dois problemas. É um número real por raquete em
       * todo eixo, some a distinção entre "pedido" e "não pedido" nas séries (ela vive na linha
       * tracejada, que é onde deve viver), e o que o gráfico mostra passa a ser exatamente o que
       * o motor leu para escolher.
       */
      profile: shareOfBest(
        bands,
        attribute,
        ballTargetPosition(
          desired,
          catalogPosition,
          currentPosition,
          plausible.map((r) => position(bands, attribute, valueOf(r))),
        ),
      ),
      recommended: shareOfBest(bands, attribute, position(bands, attribute, valueOf(winner))),
      current: currentPosition === null ? null : shareOfBest(bands, attribute, currentPosition),
      catalog: shareOfBest(bands, attribute, catalogPosition),
      weight:
        askTotal > 0
          ? (objectiveWeight * Math.abs(desired)) / askTotal
          : objectiveWeight / BALL_AXES,
    };
  });
}
