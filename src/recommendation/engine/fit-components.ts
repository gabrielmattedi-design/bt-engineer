/**
 * Componentes do `racket_fit_score` — docs/RECOMMENDATION_ENGINE.md §4.1.
 *
 * Cada componente devolve 0–100 e a lista de termos que o produziu, para auditoria (§48).
 * Funções puras, sem I/O.
 */

import { RANGES } from '@/domain/reference-ranges';
import { clamp, norm, round, type WeightedTerm } from '@/domain/scores';
import type { PlayStyle, ScoredRacket } from '@/domain/racket';
import { PLAY_STYLES } from '@/domain/racket';
import type { NeedKey, PlayerProfile } from '@/domain/player-profile';
import { NEED_KEYS, NEED_TO_RACKET_ATTRIBUTE } from '@/domain/player-profile';
import type { ComponentBreakdown, ComponentKey } from '@/domain/recommendation';
import {
  computeSwingIndex,
  massIndex,
  resolveStrungWeight,
} from '@/recommendation/normalize/racket-attributes';
import type { CatalogScale, ScaleKey } from './catalog-scale';

type ComponentOutput = Omit<ComponentBreakdown, 'weight' | 'contribution'>;

function output(
  key: ComponentKey,
  raw: number,
  terms: ComponentBreakdown['terms'],
  missing: readonly string[] = [],
): ComponentOutput {
  return { key, raw: round(clamp(raw, 0, 100)), terms, missing_fields: missing };
}

/**
 * Todos os componentes abaixo comparam a raquete com o JOGADOR. Para que a comparação seja
 * legítima, os dois lados precisam viver na mesma escala — ver o cabeçalho de `catalog-scale.ts`
 * para o defeito de unidades que isso corrige. Na prática: sempre que um número da raquete
 * encontra um número do jogador, o da raquete passa antes por `scale.position()`.
 */

/**
 * Capacidade de manejo do jogador, 0–100 — quanto de frame o CORPO dele sustenta.
 *
 * Vive fora de `physicalFit` porque `skillFit` precisa exatamente do mesmo número: os dois
 * componentes se contradiziam quando cada um tinha sua própria noção do que o jogador aguenta.
 */
function handlingCapacity(profile: PlayerProfile): number {
  return (
    0.45 * profile.physical_capacity_score +
    0.35 * profile.swing_speed_score +
    0.2 * profile.player_level_score
  );
}

/**
 * `physical_fit` — o jogador consegue manejar a massa?
 *
 * A ASSIMETRIA é a decisão mais relevante deste componente: subir de peso além da capacidade produz
 * atraso de preparação e sobrecarga física (penalidade 1.35); descer de peso produz apenas perda de
 * desempenho, que é recuperável e às vezes desejada (penalidade 0.75).
 */
export function physicalFit(
  profile: PlayerProfile,
  racket: ScoredRacket,
  scale: CatalogScale,
): ComponentOutput {
  const mass = massIndex(racket.variant.specs);
  if (mass === null) {
    return output('physical_fit', 50, [], ['unstrung_weight_g']);
  }

  const massPosition = scale.position('mass_index', mass);
  const capacity = handlingCapacity(profile);

  /**
   * ═══ A TOLERÂNCIA É MEDIDA EM GRAMAS, NÃO EM PONTOS DE POSIÇÃO ═════════════════════════════
   *
   * As constantes deste componente sempre foram escritas em pontos de POSIÇÃO no catálogo. Isso
   * parecia neutro e não é: a faixa que o catálogo ocupa em `mass_index` tem apenas 18 pontos de
   * largura, e `position()` a estica para 0–100. Cada unidade real vale 5,5 pontos de posição.
   *
   * O efeito, medido em duas raquetes separadas por CINCO GRAMAS:
   *
   *     HEAD Boom MP    295 g   posição 59   physical_fit 95
   *     Babolat Pure Drive 300 g posição 80  physical_fit 70
   *
   * Vinte e cinco pontos de componente para uma diferença que quase ninguém sente na mão. Com a
   * zona morta antiga de 10 pontos — equivalente a 2,5 g —, capacidade virava um penhasco: uma
   * raquete logo abaixo passava livre e a de cinco gramas a mais levava a conta inteira.
   *
   * Foi isto que o usuário viu no gráfico e descreveu como "peso e manejo parece decidir sozinho".
   * Decidia mesmo, e não por ter peso demais na fórmula: por ter uma régua 5,5 vezes ampliada.
   *
   * A tolerância passa a ser dimensionada pelo que ela representa em gramas: a menor diferença de
   * massa que um jogador amador percebe de forma consistente, que é da ordem de 4 g. Abaixo disso o
   * componente cala; acima, a conta sobe, e sobe mais depressa quanto mais longe, porque sustentar
   * massa demais é problema que se acumula.
   *
   * Descer de peso continua mais barato que subir: é perda de desempenho, recuperável, e às vezes
   * exatamente o que o jogador quer.
   *
   * ═══ A CONSTANTE NÃO CORRESPONDIA AO PRÓPRIO RACIOCÍNIO ════════════════════════════════════
   *
   * Era 15, escrita aqui como sendo "da ordem de 4 g nesta faixa". Medido: regressão de posição
   * contra peso sobre as 47 raquetes do catálogo dá 0,42 g por ponto de posição, então 15 pontos
   * são ±6,3 g — uma janela de 12,6 g, mais de três vezes o limiar de percepção que o parágrafo
   * acima usa para se justificar.
   *
   * O efeito não era neutro. O catálogo é apertado (270 a 315 g, mediana em 300) e as posições se
   * aglomeram na metade superior; uma janela desse tamanho em volta da capacidade típica cobria
   * metade do catálogo. Medido em 1.034 pares persona × raquete: `physical_fit` cravava exatamente
   * 100 em 43,8% deles — contra 6,7% de `comfort_fit` e 1,3% de `objective_fit`. O componente
   * deixava de distinguir justamente na faixa onde quase todo mundo joga.
   *
   * ═══ POR QUE 13, E NÃO OS 10 QUE OS 4 g PEDIRIAM ══════════════════════════════════════════
   *
   * 10 pontos são ~4,2 g e seriam o valor coerente com o parágrafo acima. Testado, e ele REGRIDE a
   * persona 1 — o iniciante adulto de swing lento, justamente quem mais depende deste componente:
   * a tolerância do conjunto recomendado cai para o percentil 44 do catálogo, abaixo da mediana que
   * o teste de comportamento exige. Um iniciante recebendo quadros menos tolerantes é o oposto do
   * que a mudança pretendia.
   *
   * A causa é que esta constante nunca foi só um limiar de percepção. Ela absorve também a
   * imprecisão de `handlingCapacity`, que é uma ESTIMATIVA do jogador a partir do questionário, não
   * uma medida. Apertar a zona morta obriga o componente a confiar nessa estimativa com uma
   * precisão que ela não tem, e o erro aparece primeiro em quem está nos extremos da escala.
   *
   * 13 é o valor mais apertado que reduz a saturação sem regredir nenhuma das 22 personas —
   * limite achado por varredura (10, 11 e 12 quebram; 13 e 14 passam), não derivado. Vale ~5,5 g.
   * Medido: saturação de `physical_fit` cai de 43,8% para 38,3% dos pares persona × raquete, com
   * mudança de vencedor em 1 de 22 personas, numa margem de 0,37 ponto — quase-empate.
   *
   * O que sobra de saturação não se resolve mexendo mais aqui: ela vem da precisão de
   * `handlingCapacity`.
   *
   * ═══ A INVESTIGAÇÃO FOI FEITA — E FECHA ESTA CONSTANTE ════════════════════════════════════
   *
   * Ver `tests/integrity/handling-capacity-noise.test.ts`. Não existe gabarito para a capacidade
   * de um respondente, então o que se mede é ESTABILIDADE: mover em um degrau cada autoavaliação
   * que admite hesitação honesta e ver quanto a capacidade anda. Sobre 4.000 perfis:
   *
   *     velocidade de swing ..... 6,36    ← 62% do ruído
   *     força percebida ......... 2,11
   *     preparo físico .......... 1,34
   *     nível técnico ........... 0,44
   *     as quatro juntas ....... 10,28    (mediana 11,10 · máx 14,37)
   *
   * O ruído tem a MESMA ORDEM DE GRANDEZA dos 13 pontos desta constante. Ou seja: ela não está
   * folgada, está dimensionada — e a suspeita escrita acima, de que ela absorve a imprecisão da
   * estimativa, se confirma numericamente. Apertar mais obrigaria o componente a confiar num
   * número com uma precisão que ele não tem.
   *
   * Comprimir `SWING_SPEED_SCORE` (20…90 → 30…80) foi testado e REJEITADO: derrubaria a troca
   * material de recomendação de 20,8% para 17,3%, ao custo de trocar a raquete de 4 das 22
   * personas. Comprimir a escala não tira só ruído — tira sinal de quem de fato tem swing rápido,
   * que é justamente quem mais precisa de um frame que acompanhe.
   *
   * O que sobra é uma propriedade do produto, não um defeito a corrigir aqui: a pergunta mais
   * difícil de responder do questionário é também a mais decisiva, e em ~8% dos perfis hesitar
   * nela muda a recomendação de forma material. O caminho para isso não passa por esta constante
   * — passa por DIZER a incerteza ao leitor, que é o que `computeConfidence` já faz com o swing
   * inferido e ainda não faz com o swing declarado numa fronteira.
   */
  const MASS_TOLERANCE = 13;

  const delta = massPosition - capacity;
  const excess = Math.max(0, Math.abs(delta) - MASS_TOLERANCE);
  const raw =
    delta > 0
      ? 100 - excess * 1.5 - Math.max(0, excess - 15) * 1.0
      : 100 - excess * 0.8;

  return output('physical_fit', raw, [
    {
      label: 'mass_index',
      value: massPosition / 100,
      weight: 1,
      note: `massa no percentil ${round(massPosition)} do catálogo`,
    },
    {
      label: 'player_capacity',
      value: capacity / 100,
      weight: 1,
      note: `capacidade ${round(capacity)}`,
    },
  ]);
}

/**
 * `skill_fit` — a exigência do frame bate com o nível calibrado?
 *
 * O alvo é o próprio `player_level_score`, lido como posição na faixa de exigência do catálogo:
 * nível 30 procura a raquete no percentil 30 de exigência, nível 95 procura o topo. A fórmula
 * anterior (`0.85 × nível + 8`) foi calibrada contra a escala crua dos atributos e cobrava de todo
 * jogador avançado uma exigência que nenhuma raquete do mercado entrega.
 *
 * ─── O TETO FÍSICO ───────────────────────────────────────────────────────────────────────────
 *
 * `demand_index` tem 35% de índice de balanço e 15% de peso — ou seja, mais da metade do que ele
 * chama de "exigência" é, na verdade, massa. E massa é exatamente o que `physical_fit` cobra pelo
 * lado oposto.
 *
 * Para quem tem técnica acima do preparo físico, os dois componentes passavam a brigar: o de nível
 * pedia um frame mais pesado, o físico punia o mesmo frame por ser pesado demais, e NENHUMA
 * raquete do catálogo conseguia agradar aos dois. O jogador perdia pontos por uma contradição
 * interna do motor.
 *
 * O alvo de exigência passa a ser limitado pela capacidade de manejo, com uma folga de 10 pontos
 * (a capacidade é uma estimativa, e um pouco acima dela ainda é jogável). Quem tem técnica de
 * sobra e corpo limitado recebe o frame mais exigente que consegue de fato manejar — que é a
 * resposta certa, e a que um consultor humano daria.
 */
const CAPACITY_TOLERANCE = 10;

export function skillFit(
  profile: PlayerProfile,
  racket: ScoredRacket,
  scale: CatalogScale,
): ComponentOutput {
  const demand = scale.position('demand_index', racket.attributes.demand_index);
  const target = Math.min(
    profile.player_level_score,
    handlingCapacity(profile) + CAPACITY_TOLERANCE,
  );
  /**
   * Mesma correção de régua que `physicalFit` recebeu.
   *
   * `demand_index` ocupa ~30 pontos no catálogo e `position()` estica para 0–100: cada unidade real
   * vale 3,3 pontos de posição. Sem zona morta, a inclinação de 1.5 cobrava 5 pontos de componente
   * por unidade de exigência — precisão que o índice não tem, já que ele é média ponderada de quatro
   * especificações publicadas.
   *
   * A tolerância representa aproximadamente a diferença de exigência entre duas gerações do mesmo
   * modelo: abaixo dela, dizer que uma serve e a outra não seria inventar resolução.
   */
  const DEMAND_TOLERANCE = 12;
  const gap = Math.max(0, Math.abs(demand - target) - DEMAND_TOLERANCE);
  const raw = 100 - gap * 1.6;

  return output('skill_fit', raw, [
    {
      label: 'demand_index',
      value: demand / 100,
      weight: 1,
      note: `exigência no percentil ${round(demand)} do catálogo`,
    },
    {
      label: 'target_demand',
      value: target / 100,
      weight: 1,
      note: `alvo para o nível ${round(target)}`,
    },
  ]);
}

/**
 * `swing_fit` — o frame COMPLEMENTA a produção natural de potência?
 *
 * Jogador que gera muita potência precisa de frame contido; quem gera pouca precisa do frame.
 * Somar potência a quem já tem é a causa clássica de bolas longas.
 */
export function swingFit(
  profile: PlayerProfile,
  racket: ScoredRacket,
  scale: CatalogScale,
): ComponentOutput {
  const framePower = scale.position('power_score', racket.attributes.power_score);
  const requiredFramePower = 100 - profile.natural_power_score;

  /**
   * Zona morta pelo mesmo motivo de `physicalFit` e `skillFit`.
   *
   * `power_score` ocupa cerca de 37 pontos no catálogo, esticados para 0–100 — amplificação de
   * 2,7×. E o alvo aqui é uma ESTIMATIVA (`100 − potência natural`), não uma medida: cobrar
   * distância a partir do primeiro ponto é fingir uma precisão que a estimativa não sustenta.
   */
  const POWER_TOLERANCE = 12;
  const powerGap = Math.max(0, Math.abs(framePower - requiredFramePower) - POWER_TOLERANCE);
  const powerTerm = 100 - powerGap * 1.3;

  /**
   * Comprimento do swing → faixa aceitável de manobrabilidade, penalizando só o que sai dela.
   *
   * As três formas são deadbands, e isso é deliberado: um swing curto precisa de um frame que ele
   * consiga acelerar, mas não existe "manobrável demais" para ele — ganhar mais manobrabilidade
   * depois de certo ponto não melhora nada. As versões anteriores de `short` e `medium` somavam
   * manobrabilidade e potência como se fossem bens absolutos, e como os dois eixos são
   * anticorrelacionados no catálogo real, o componente ficava com teto de ~73 para todo swing
   * curto — nenhuma raquete do mercado podia zerar aquela perda.
   */
  const maneuver = scale.position(
    'maneuverability_score',
    racket.attributes.maneuverability_score,
  );
  let lengthTerm: number;
  switch (profile.swing_length) {
    case 'long':
      // Swing longo tolera inércia alta; penaliza-se apenas o excesso de leveza.
      lengthTerm = 100 - Math.max(0, maneuver - 70) * 0.4;
      break;
    case 'short':
      // Swing curto não completa a preparação com um frame lento.
      lengthTerm = 100 - Math.max(0, 60 - maneuver) * 1.4;
      break;
    default:
      lengthTerm = 100 - Math.max(0, 35 - maneuver) * 1.2 - Math.max(0, maneuver - 85) * 0.5;
  }

  const raw = 0.65 * clamp(powerTerm, 0, 100) + 0.35 * clamp(lengthTerm, 0, 100);

  return output('swing_fit', raw, [
    {
      label: 'power_complement',
      value: clamp(powerTerm, 0, 100) / 100,
      weight: 0.65,
      note: `frame ${round(framePower)} vs necessário ${round(requiredFramePower)}`,
    },
    {
      label: 'swing_length_match',
      value: clamp(lengthTerm, 0, 100) / 100,
      weight: 0.35,
      note: `swing ${profile.swing_length}`,
    },
  ]);
}

/**
 * `playstyle_fit` — produto interno entre o vetor de estilo do jogador e os fits do frame,
 * expresso como FRAÇÃO DO MELHOR FRAME DISPONÍVEL para aquele estilo.
 *
 * ─── POR QUE FRAÇÃO DO MELHOR, E NÃO O VALOR BRUTO ───────────────────────────────────────────
 *
 * Os eixos de estilo são combinações de atributos, e por isso herdam a mesma compressão deles: o
 * catálogo inteiro cabe entre 46.7 e 53.7 em `baseline`, entre 47.7 e 53.5 em `counterpuncher`.
 * Usar o valor bruto significava que um jogador de fundo de quadra jamais passava de ~54 neste
 * componente — e, com peso 0.14, isso descontava ~7 pontos do score final de TODA recomendação,
 * por uma razão que não tem nada a ver com a raquete escolhida.
 *
 * Percentil dentro do catálogo também não serve: esticar uma faixa real de 7 pontos até 0–100
 * transformaria diferenças imperceptíveis em quadra num veredicto de 100 pontos.
 *
 * A pergunta certa é a terceira: comparado com a melhor raquete que existe para o seu estilo,
 * quão perto esta chega? Num eixo pouco discriminante todas as raquetes ficam perto de 100 — o
 * que é a leitura honesta de "para o seu estilo, tanto faz". Num eixo discriminante como
 * `heavy_spin` (24.8 a 73.7), a diferença entre a melhor e a pior continua valendo 60 pontos.
 */
export function playstyleFit(
  profile: PlayerProfile,
  racket: ScoredRacket,
  scale: CatalogScale,
): ComponentOutput {
  let weightSum = 0;
  let acc = 0;
  const terms: WeightedTerm[] = [];

  for (const style of PLAY_STYLES) {
    const w = profile.style_weights[style as PlayStyle] ?? 0;
    if (w <= 0) continue;
    const fit = racket.fitProfile.styles[style as PlayStyle];
    weightSum += w;
    acc += w * fit;
    terms.push({ label: `style:${style}`, value: fit / 100, weight: w });
  }

  if (weightSum === 0) return output('playstyle_fit', 50, terms);

  const mix = acc / weightSum;
  const ceiling = scale.styleCeiling(profile.style_weights);
  const raw = ceiling <= 0 ? 50 : (mix / ceiling) * 100;

  return output('playstyle_fit', raw, terms);
}

/** Intensidade máxima possível de um pedido, conforme `desired_change_vector` é construído (§3.4). */
const MAX_ASK = 40;

/**
 * Piso do espaço de manobra, em pontos de posição.
 *
 * Quando a referência já está colada no extremo do catálogo — alguém com a raquete mais potente do
 * mercado pedindo ainda mais potência — o espaço restante tende a zero e a divisão explodiria.
 * O piso transforma esse caso em "quase nada a entregar aqui", que é a leitura correta.
 */
const MIN_HEADROOM = 15;

/**
 * Valor do componente para quem não declarou objetivo nenhum — e âncora para pedidos fracos.
 *
 * Acima de 50 porque "não pedi nada" não é uma falha da raquete: nenhuma direção foi contrariada.
 */
const NEUTRAL_OBJECTIVE = 65;

/**
 * `objective_fit` — o frame move o jogador na direção desejada?
 *
 * Compara contra a raquete atual quando conhecida; contra a média do catálogo quando não.
 *
 * NOTA DE CALIBRAÇÃO (v1.0.0): a formulação inicial dividia `delta` (pontos de ATRIBUTO) por
 * `|desired|` (pontos de NECESSIDADE) — grandezas de unidades diferentes. O efeito colateral era
 * perverso: quanto MAIS forte o pedido, maior o denominador e mais fraco o sinal, comprimindo o
 * componente numa faixa estreita em torno de 65 e tornando-o quase não discriminante.
 *
 * NOTA DE CALIBRAÇÃO (v2.1.0): o denominador passou a ser o ESPAÇO DE MANOBRA — a distância entre
 * a referência do jogador e o extremo do catálogo na direção pedida. `delivered = 1` deixa de
 * significar "andou uma quantidade arbitrária de pontos" e passa a significar "levou você tão
 * longe nessa direção quanto o mercado permite", que é literalmente a pergunta que o usuário fez.
 *
 * A diferença não é cosmética. Com um denominador fixo, um jogador cujo pedido é modesto em termos
 * absolutos — porque sua raquete atual já é boa naquele eixo — nunca conseguia pontuar bem,
 * embora estivesse recebendo tudo o que existia para receber.
 *
 * As duas dimensões continuam separadas:
 *   • `delivered`   — que fração do espaço disponível o frame percorreu;
 *   • `askStrength` — quão forte foi o pedido, usado como PESO na média.
 */
export function objectiveFit(
  profile: PlayerProfile,
  racket: ScoredRacket,
  reference: Readonly<Record<NeedKey, number>>,
  scale: CatalogScale,
): ComponentOutput {
  const terms: WeightedTerm[] = [];
  let weightedSum = 0;
  let weightTotal = 0;
  let strongestAsk = 0;

  for (const need of NEED_KEYS) {
    const desired = profile.desired_change_vector[need];
    if (Math.abs(desired) <= 5) continue;

    const attrKey = NEED_TO_RACKET_ATTRIBUTE[need] as ScaleKey;
    const racketValue = racket.attributes[attrKey as keyof typeof racket.attributes] as number;
    // Ambos os lados em posição de catálogo: o delta passa a ser comparável entre eixos.
    const referencePosition = scale.position(attrKey, reference[need]);
    const delta = scale.position(attrKey, racketValue) - referencePosition;

    // Quanto ainda existe para andar nessa direção, a partir de onde o jogador está hoje.
    const headroom = Math.max(
      desired > 0 ? 100 - referencePosition : referencePosition,
      MIN_HEADROOM,
    );

    // Ir na direção contrária é o pior caso (piso -1); percorrer todo o espaço disponível é 1.
    const delivered = clamp((delta * Math.sign(desired)) / headroom, -1, 1);
    const askStrength = clamp(Math.abs(desired) / MAX_ASK, 0, 1);

    weightedSum += delivered * askStrength;
    weightTotal += askStrength;
    strongestAsk = Math.max(strongestAsk, askStrength);

    terms.push({
      label: `objective:${need}`,
      value: clamp((delivered + 1) / 2, 0, 1),
      weight: round(askStrength, 3),
      note:
        `pedido ${desired > 0 ? '+' : ''}${round(desired)}, ` +
        `entregue ${round(delivered * 100)}% do espaço disponível`,
    });
  }

  // Nenhum objetivo declarado: valor neutro. Nao penalizamos nem premiamos ninguem.
  if (weightTotal === 0) return output('objective_fit', NEUTRAL_OBJECTIVE, terms);

  const avg = weightedSum / weightTotal;
  const measured = 100 * clamp(0.5 + avg / 2, 0, 1);

  /**
   * A DECISIVIDADE do componente acompanha a força do pedido.
   *
   * `askStrength` já pondera um pedido contra outro, mas não regulava o quanto o componente
   * inteiro pesava na decisão. O resultado era desproporcional: alguém que marcou um interesse
   * moderado em spin (12.5 de 40 possíveis) tinha 17% do seu score final decidido por aquele
   * interesse com a mesma força de quem declarou o pedido no máximo.
   *
   * Entre "não pedi nada" (neutro) e "pedi com toda a força" (medição integral) o componente agora
   * interpola pelo pedido mais forte que a pessoa fez. Pedido fraco desloca pouco o score — para
   * cima ou para baixo —, que é o que "fraco" significa.
   */
  return output(
    'objective_fit',
    NEUTRAL_OBJECTIVE + (measured - NEUTRAL_OBJECTIVE) * strongestAsk,
    terms,
  );
}

/**
 * `comfort_fit` — conforto do frame contra a sensibilidade declarada.
 *
 * A sensibilidade define uma EXIGÊNCIA, e só o que falta para atingi-la é descontado. Punir rigidez
 * em quem nunca teve desconforto seria viés, não análise — por isso a exigência de quem não relata
 * nada é baixa e quase todo frame a satisfaz.
 *
 * A formulação anterior multiplicava a amigabilidade por `0.6 + 0.4 × sensibilidade`, o que produzia
 * dois defeitos: a mesma raquete valia MAIS para quem era mais sensível (o fator crescia com a
 * sensibilidade), e o componente só chegava a 100 por um atalho — um `if` que devolvia 100 acima de
 * 80 pontos de amigabilidade e nada entre 80 e o valor calculado.
 */
export function comfortFit(
  profile: PlayerProfile,
  racket: ScoredRacket,
  scale: CatalogScale,
): ComponentOutput {
  const armFriendly = scale.position('arm_friendliness_score', racket.attributes.arm_friendliness_score);
  const sensitivity = profile.arm_sensitivity_score;

  /**
   * Duas parcelas, porque conforto é ao mesmo tempo requisito e qualidade.
   *
   * A rampa suave (`60 + 0.4 × amigabilidade`) mantém o componente DISCRIMINANTE para a maioria,
   * que não relata desconforto nenhum: sem ela, todo frame acima da exigência empatava em 100 e o
   * motor perdia um critério de desempate inteiro — a concentração de recomendações num único
   * modelo saltou para 36% quando isso aconteceu.
   *
   * O desconto abaixo da exigência é o que protege quem já sente dor.
   *
   * ─── NOTA DE CALIBRAÇÃO (v2.2.0) ───────────────────────────────────────────────────────────
   *
   * As constantes anteriores — `40 + 0.5 × s`, inclinação 1.6 — foram calibradas quando a faixa de
   * `arm_friendliness_score` ia de 22.3 a 66.4. Ao passar a recuar de vãos destacados
   * (`catalog-scale.ts`), a faixa desse eixo encolheu para 42.1 … 66.4: o frame mais hostil do
   * catálogo era um caso solto, e sair dele foi correto.
   *
   * Mas TODA constante desta função é expressa em posição de faixa, e uma faixa 45% mais estreita
   * torna cada constante proporcionalmente mais dura sem que ninguém tenha decidido isso. Medido: a
   * mesma Babolat Pure Drive 107, sem mudar uma especificação sequer, caiu de `comfort_fit` 64 para
   * 23. Um iniciante com dor no cotovelo (p21) passou a não ter NENHUMA raquete acima do piso de
   * match do produto — não porque o catálogo piorasse, mas porque a régua encolheu.
   *
   * As constantes abaixo restauram a severidade REAL: a exigência e a inclinação foram remapeadas
   * para que, em pontos de atributo, elas cobrem hoje o mesmo que cobravam antes. O que mudou de
   * verdade é só a resolução — o eixo passou a distinguir melhor os frames que existem de fato.
   *
   * ─── O QUE ESTA FUNÇÃO NÃO CONSEGUE CONSERTAR ──────────────────────────────────────────────
   *
   * O diagnóstico de p21 expôs um buraco de DADOS, e ele continua aberto: não existe no catálogo um
   * frame leve, de cabeça grande e flexível. Todos os arm-friendly têm 300–315 g; todos os de
   * iniciante têm viga larga. Some-se que `arm_friendliness_score` usa a largura da viga como proxy
   * de rigidez com peso 0.45 — proxy que a linha Clash quebra, porque ela é de viga larga E muito
   * flexível, e o catálogo não carrega o RA medido para desmentir a largura.
   *
   * Nenhuma constante resolve isso. Resolve-se medindo rigidez (§ curadoria) ou ampliando o
   * catálogo, e é assim que deve ser registrado.
   */
  const required = 0.8 * sensitivity;
  const raw = 60 + 0.4 * armFriendly - Math.max(0, required - armFriendly) * 0.9;

  return output('comfort_fit', raw, [
    {
      label: 'arm_friendliness',
      value: armFriendly / 100,
      weight: 1,
      note: `amigabilidade no percentil ${round(armFriendly)} do catálogo`,
    },
    {
      label: 'arm_sensitivity',
      value: sensitivity / 100,
      weight: 1,
      note: `sensibilidade ${round(sensitivity)}`,
    },
  ]);
}

/**
 * `transition_fit` (§22) — penaliza apenas o EXCEDENTE de mudança, com zonas mortas de
 * 12 g / 12 SW / 4 sq in. Trocas pequenas não devem ser penalizadas; grandes precisam ser conscientes.
 */
export function transitionFit(profile: PlayerProfile, racket: ScoredRacket): ComponentOutput {
  const current = profile.current_racket;
  if (!current || current.weight_g === null) {
    return output('transition_fit', 70, [], ['current_racket']);
  }

  const specs = racket.variant.specs;
  const newWeight = resolveStrungWeight(specs);
  const terms: WeightedTerm[] = [];
  let penalty = 0;

  if (newWeight !== null) {
    const currentStrung = current.weight_g + 16;
    const dw = Math.abs(newWeight - currentStrung);
    penalty += Math.max(0, dw - 12) * 1.2;
    terms.push({
      label: 'delta_weight',
      value: 1 - norm(dw, 0, 60),
      weight: 1,
      note: `Δ ${round(dw)} g`,
    });
  }

  const newSwing = computeSwingIndex(specs);
  if (current.swing_index !== null && newSwing !== null) {
    // Comparação RELATIVA: a inércia varia numa escala grande, então um delta absoluto não teria
    // significado uniforme entre frames leves e pesados.
    const rel = Math.abs(newSwing - current.swing_index) / current.swing_index;
    penalty += Math.max(0, rel - 0.08) * 260;
    terms.push({
      label: 'delta_swing_index',
      value: 1 - norm(rel, 0, 0.4),
      weight: 1,
      note: `Δ ${(rel * 100).toFixed(0)}% de inércia`,
    });
  }

  if (current.head_size_sq_in !== null && specs.head_size_sq_in !== null) {
    const dh = Math.abs(specs.head_size_sq_in - current.head_size_sq_in);
    penalty += Math.max(0, dh - 4) * 2.5;
    terms.push({ label: 'delta_head_size', value: 1 - norm(dh, 0, 20), weight: 1, note: `Δ ${round(dh)} sq in` });
  }

  return output('transition_fit', 100 - penalty, terms);
}

/**
 * Referência para `objective_fit` quando não há raquete atual: a média do catálogo avaliado.
 * Usar a média real (e não um valor fixo) mantém o componente calibrado ao universo disponível.
 */
export function catalogReference(rackets: readonly ScoredRacket[]): Record<NeedKey, number> {
  const ref = {} as Record<NeedKey, number>;
  for (const need of NEED_KEYS) {
    const attrKey = NEED_TO_RACKET_ATTRIBUTE[need];
    const values = rackets.map(
      (r) => r.attributes[attrKey as keyof typeof r.attributes] as number,
    );
    ref[need] = values.length === 0 ? 50 : values.reduce((s, v) => s + v, 0) / values.length;
  }
  return ref;
}

/** Referência a partir da raquete atual do jogador, quando reconhecida no catálogo. */
export function currentRacketReference(current: ScoredRacket): Record<NeedKey, number> {
  const ref = {} as Record<NeedKey, number>;
  for (const need of NEED_KEYS) {
    const attrKey = NEED_TO_RACKET_ATTRIBUTE[need];
    ref[need] = current.attributes[attrKey as keyof typeof current.attributes] as number;
  }
  return ref;
}

export const REFERENCE_RANGES_USED = RANGES;
