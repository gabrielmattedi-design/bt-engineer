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
 * ═══ A LINHA TRACEJADA É A BORDA, NOS OITO EIXOS ════════════════════════════════════════════
 *
 * Uma leitura só: 100 é o ideal PARA ESTE JOGADOR, e nenhuma raquete o ultrapassa. O que muda
 * entre os blocos é como cada eixo chega a esse 100 — não o que a linha significa.
 *
 *   encaixe (5) — adequação do par raquete+jogador. 100 é encaixe perfeito.
 *   bola (3)    — quanto do ALVO foi entregue, onde o alvo é o menor entre o que a pessoa pediu e
 *                 o que existe para ela (ver `ballTargetPosition`). 100 é o alvo alcançado, e
 *                 entregar mais que o pedido satura em 100 em vez de furar a linha.
 *
 * Antes disso a linha teve significado diferente por bloco, e chegou a virar dois gráficos
 * separados. Nenhuma das duas coisas sobreviveu ao uso: com significados diferentes o leitor não
 * tem como saber qual vale em qual vértice, e separados o relatório perdeu a leitura de conjunto
 * que é o motivo de existir um radar. Pôr o alvo no DENOMINADOR resolve os dois de uma vez, porque
 * a diferença entre os blocos passa a estar na conta, não na legenda.
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
   * A linha tracejada: o IDEAL para este jogador, 100 em todo eixo. Ninguém ultrapassa.
   *
   * ═══ AS CINCO VERSÕES QUE ESTA LINHA JÁ TEVE ═══════════════════════════════════════════════
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
   * 4. DUAS LEITURAS, uma por bloco — borda no encaixe, tamanho do pedido na bola. Mediu certo e
   *    comunicou errado: nada no desenho dizia qual leitura valia em qual vértice. E deixava o
   *    amarelo furar a linha em 460 dos 2640 eixos medidos, inclusive num caso que não dependia de
   *    dado nenhum — sem pedido no eixo, as raquetes valiam NEUTRAL (70) contra uma linha em
   *    DEMAND_FLOOR (55), então o amarelo passava por construção, para todo mundo.
   *
   * 5. A BORDA NOS OITO, com o alvo do pedido virando o DENOMINADOR dos eixos de bola. É a atual.
   *    Zero furos em 2640 eixos, uma frase só de legenda, e o alvo continua sendo o que a pessoa
   *    pediu — limitado ao que existe para ela, que era a informação faltando nas quatro anteriores.
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
 * O ALVO de um eixo de bola, em posição de catálogo: o menor entre o que o jogador pediu e o que
 * existe para ele. `null` quando não houve pedido.
 *
 * ═══ O DEFEITO QUE ISTO CONSERTA ═════════════════════════════════════════════════════════════
 *
 * Relato do usuário, com o gráfico na tela: "em spin, a raquete recomendada — que está dentro do
 * meu perfil por consequência — está ACIMA do limite laranja".
 *
 * Ele estava certo, e a causa era estrutural. Num eixo SEM pedido, as raquetes valiam `NEUTRAL`
 * (70) enquanto a tracejada saía de `demandToAxis(0)`, que é `DEMAND_FLOOR` (55). Setenta contra
 * cinquenta e cinco: o amarelo passava do laranja por CONSTRUÇÃO, em todo eixo não pedido, para
 * todo mundo. Nenhum dado — só duas escalas diferentes no mesmo vértice.
 *
 * ═══ O TETO, E POR QUE ELE TEM DIREÇÃO ═══════════════════════════════════════════════════════
 *
 * O teto é o extremo NA DIREÇÃO DO PEDIDO entre as raquetes plausíveis para o jogador: o máximo em
 * "quero mais", o mínimo em "quero menos". Usar sempre o máximo foi o primeiro erro desta função —
 * num pedido negativo o máximo fica do lado oposto, o limite nunca mordia, e a linha continuava
 * marcando um alvo mais extremo do que qualquer raquete adequada alcança.
 *
 * Sem teto, medido em 566 perfis, o alvo apontava para fora do alcançável em 70% deles, com
 * excesso médio de 20 pontos de posição — e o gráfico cobrava da recomendada um vão que nenhuma
 * escolha podia fechar.
 */
function ballTargetPosition(
  desired: number,
  reference: number,
  askedPosition: number,
  plausiblePositions: readonly number[],
): number | null {
  if (Math.abs(desired) <= MIN_ASK) return null;

  const sign = Math.sign(desired);
  const reach =
    plausiblePositions.length === 0
      ? askedPosition
      : sign > 0
        ? Math.max(...plausiblePositions)
        : Math.min(...plausiblePositions);

  const alvo = sign > 0 ? Math.min(askedPosition, reach) : Math.max(askedPosition, reach);

  /**
   * O alvo precisa ficar do LADO PEDIDO da referência, com um vão mínimo.
   *
   * Sem esta trava, um pedido de "mais" cujo alvo cai abaixo da média do catálogo — acontece com
   * quem já joga com um frame muito abaixo dela e pede pouco — inverteria o sinal da conta de
   * progresso, e a raquete que chegasse exatamente no alvo apareceria com ZERO em vez de cheia.
   */
  return sign > 0
    ? Math.max(alvo, reference + MIN_HEADROOM)
    : Math.min(alvo, reference - MIN_HEADROOM);
}

/**
 * Quanto do ALVO aquela raquete entregou, 0–100, onde 100 é o alvo alcançado.
 *
 * ═══ POR QUE ISTO SUBSTITUIU A ADEQUAÇÃO CONTRA A BORDA DO CATÁLOGO ══════════════════════════
 *
 * `askAdequacy` media o avanço contra TODO o espaço restante até o extremo do catálogo, e a linha
 * tracejada era desenhada à parte, num valor próprio. Duas consequências ruins:
 *
 *   • a raquete podia passar da linha, e passar de "o que seu jogo pede" lê-se como excesso mesmo
 *     quando é entrega a mais — 460 dos 2640 eixos medidos, com excesso mediano de 14 a 18 pontos;
 *   • a linha tinha um significado nos eixos de bola e outro nos de encaixe, no mesmo desenho.
 *
 * Com o alvo virando o DENOMINADOR, os dois somem de uma vez: 100 passa a significar "chegou no
 * ideal possível para você" nos oito eixos, a tracejada é a borda em todos eles, e entregar mais
 * que o pedido satura em 100 em vez de furar a linha. Entregar MENOS continua aparecendo, que é a
 * informação que o gráfico existe para dar.
 *
 * Abaixo de 50 a raquete andou na direção CONTRÁRIA à pedida — o vértice encolhe, e deve encolher.
 */
function askDelivery(
  desired: number,
  reference: number,
  target: number,
  actual: number,
): number {
  const headroom = Math.max(Math.abs(target - reference), MIN_HEADROOM);
  const delivered = Math.max(-1, Math.min(1, ((actual - reference) * Math.sign(desired)) / headroom));
  return Math.round(Math.max(0, Math.min(100, 50 + delivered * 50)));
}

export function buildRadar(
  profile: PlayerProfile,
  winner: RankedRacket,
  ranking: readonly RankedRacket[],
  bands: RecommendationResult['attribute_bands'],
  means: RecommendationResult['attribute_means'],
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
       * O alvo é ancorado em quem o jogador é hoje; sem raquete conhecida, na média do catálogo.
       * Sem pedido no eixo, `target` é null e as quatro séries caem no mesmo NEUTRAL — não há
       * critério ali, e portanto não há nada a cobrar nem a ultrapassar.
       */
      ...(() => {
        const target = ballTargetPosition(
          desired,
          reference,
          (currentPosition ?? catalogPosition) + desired,
          plausible.map((r) => position(bands, attribute, valueOf(r))),
        );
        const valor = (pos: number): number =>
          target === null ? NEUTRAL : askDelivery(desired, reference, target, pos);

        return {
          profile: target === null ? NEUTRAL : IDEAL,
          recommended: valor(position(bands, attribute, valueOf(winner))),
          current: currentPosition === null ? null : valor(currentPosition),
          catalog: valor(catalogPosition),
        };
      })(),
      weight:
        askTotal > 0
          ? (objectiveWeight * Math.abs(desired)) / askTotal
          : objectiveWeight / BALL_AXES,
    };
  });
}
