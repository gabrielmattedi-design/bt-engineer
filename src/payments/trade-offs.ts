import type { NeedKey, PlayerProfile } from '@/domain/player-profile';
import type { ComponentBreakdown, RankedRacket } from '@/domain/recommendation';

/**
 * Tudo o que a explicação precisa saber além do ranking.
 *
 * É opcional em toda a cadeia porque relatórios gravados antes de `objective_reference` existir não
 * o têm. Sem contexto o relatório diz menos — nunca diz errado.
 */
export type TradeOffContext = {
  readonly profile: PlayerProfile;
  readonly reference: Readonly<Record<NeedKey, number>>;
  readonly bands: Readonly<Record<string, readonly [number, number]>>;
};

/** Posição do valor dentro da faixa ocupada pelo catálogo — a mesma régua de `catalog-scale.ts`. */
function positionIn(
  bands: TradeOffContext['bands'],
  attribute: string,
  raw: number,
): number | null {
  const band = bands[attribute];
  if (!band || band[1] <= band[0]) return null;
  return Math.max(0, Math.min(100, ((raw - band[0]) / (band[1] - band[0])) * 100));
}

/**
 * Pontos de atenção reescritos como TROCAS ESTUDADAS.
 *
 * ─── O PROBLEMA ──────────────────────────────────────────────────────────────────────────────
 *
 * O relatório listava as penalizações cruas do motor. A frase que chegava a quem pagou era:
 *
 *   "Você pediu mais estabilidade, mas este frame vai na direção contrária à da sua referência."
 *
 * Ela é verdadeira e é péssima. Do lado de cá é uma anotação de auditoria — existe para o admin
 * entender por que a raquete perdeu pontos. Do lado de lá, logo abaixo do nome do produto que a
 * pessoa acabou de comprar, ela lê como confissão de erro: pedi uma coisa e o sistema entregou o
 * contrário. O usuário não tem como saber que o motor avaliou 46 opções, que as mais estáveis
 * falhavam em coisas que pesam mais no perfil dele, e que esta é a melhor combinação possível.
 *
 * ─── O QUE MUDA E O QUE NÃO MUDA ─────────────────────────────────────────────────────────────
 *
 * O fato NÃO é escondido nem suavizado: continua dito que naquele eixo específico a raquete
 * entrega menos do que foi pedido. O que muda é que a frase passa a carregar o RACIOCÍNIO — o que
 * a alternativa custaria, medido no ranking real, e não uma promessa genérica de que "foi o
 * melhor possível".
 *
 * A diferença é verificável: a alternativa citada existe, está no ranking, e o que ela perde é
 * calculado a partir do mesmo `ScoreBreakdown` que sustenta o resto do relatório. Se não houver
 * alternativa melhor naquele eixo, a frase diz isso, em vez de inventar uma justificativa.
 */

const NEED_LABEL_PT: Record<NeedKey, string> = {
  power: 'potência',
  control: 'controle',
  spin: 'spin',
  comfort: 'conforto',
  stability: 'estabilidade',
  maneuverability: 'manobrabilidade',
  forgiveness: 'tolerância',
  precision: 'precisão',
};

const NEED_TO_ATTRIBUTE: Record<NeedKey, string> = {
  power: 'power_score',
  control: 'control_score',
  spin: 'spin_score',
  comfort: 'comfort_score',
  stability: 'stability_score',
  maneuverability: 'maneuverability_score',
  forgiveness: 'forgiveness_score',
  precision: 'precision_score',
};

/**
 * O que a alternativa custaria, dito em linguagem de quadra — e na DIREÇÃO certa.
 *
 * ═══ POR QUE ISTO NÃO É UM DICIONÁRIO ════════════════════════════════════════════════════════
 *
 * A primeira versão era um `Record<ComponentKey, string>`: cada componente tinha uma frase fixa.
 * Ela estava errada em metade dos casos, e o caso que a desmascarou é justamente o mais comum.
 *
 * Um jogador intermediário pede potência. A raquete mais potente do catálogo é uma HEAD Ti.S6 —
 * um frame de 225 g, cabeça enorme, feito para quem está começando. Ela perde no `skill_fit`, e o
 * dicionário traduzia essa perda como "cobraria um nível técnico acima do que você descreveu".
 *
 * O contrário exato do que acontece. `skill_fit` é uma DISTÂNCIA — `100 − |exigência − alvo| × 1.5`
 * — e distância não tem sinal: perde-se pontos por exigir demais e por exigir de menos, do mesmo
 * jeito. `physical_fit` é assimétrico mas também bilateral, e `swing_fit` mede complemento, que por
 * definição falha nos dois sentidos.
 *
 * Uma frase errada aqui é pior do que nenhuma frase: ela aparece exatamente onde o usuário foi
 * buscar o porquê, e é verificável em dez segundos por qualquer pessoa que conheça a raquete
 * citada. O relatório inteiro se sustenta em ser conferível — ver §48.
 *
 * Por isso a direção sai dos TERMOS gravados no `ScoreBreakdown`, que são os mesmos números que
 * produziram a perda. Não há uma segunda fonte de verdade a desincronizar: se o componente mudar
 * de fórmula, os termos mudam junto e a frase acompanha.
 */

/** Lê um termo pelo rótulo. `null` quando o componente não o gravou (dados incompletos). */
function termValue(component: ComponentBreakdown, label: string): number | null {
  const term = component.terms.find((t) => t.label === label);
  return term && term.value !== null ? term.value * 100 : null;
}

/**
 * `unknown` é `null` de propósito: sem saber o comprimento do swing não há frase honesta a dizer
 * sobre o tempo dele, e a explicação cai para a versão que não depende disso.
 */
const SWING_LENGTH_COST: Record<PlayerProfile['swing_length'], string | null> = {
  long: 'seria leve demais para o seu swing longo, perdendo firmeza no impacto',
  short: 'seria lenta demais para o seu swing curto, chegando atrasada na bola',
  medium: 'não acompanharia bem o tempo do seu swing',
  unknown: null,
};

/**
 * Frases de custo por componente, calculadas a partir dos termos da ALTERNATIVA.
 *
 * `null` significa "não sei dizer a direção com honestidade" — e nesse caso a explicação inteira
 * cai para a versão sem alternativa nomeada, em vez de arriscar uma frase que pode estar invertida.
 */
function describeCost(
  component: ComponentBreakdown,
  alternative: RankedRacket,
  context: TradeOffContext | undefined,
): string | null {
  const profile = context?.profile;

  switch (component.key) {
    case 'physical_fit': {
      const mass = termValue(component, 'mass_index');
      const capacity = termValue(component, 'player_capacity');
      if (mass === null || capacity === null) return null;
      return mass > capacity
        ? 'exigiria mais braço do que o seu preparo comporta hoje'
        : 'seria leve demais para o seu preparo, e leveza demais custa firmeza no impacto';
    }

    case 'skill_fit': {
      const demand = termValue(component, 'demand_index');
      const target = termValue(component, 'target_demand');
      if (demand === null || target === null) return null;
      return demand > target
        ? 'cobraria um nível técnico acima do que você descreveu'
        : 'foi desenhada para quem está começando: resolve a bola por você, e tira de você o ' +
          'controle sobre onde ela cai';
    }

    case 'swing_fit': {
      const power = termValue(component, 'power_complement');
      const length = termValue(component, 'swing_length_match');

      // O termo mais fraco é o que explica a perda; empate cai para a potência, que pesa 0.65.
      if (power !== null && (length === null || power <= length)) {
        if (!context) return null;
        const framePower = positionIn(
          context.bands,
          'power_score',
          alternative.racket.attributes.power_score,
        );
        if (framePower === null) return null;

        /*
          `swingFit` procura o COMPLEMENTO: quem gera muita potência precisa de frame contido, quem
          gera pouca precisa que o frame contribua. O alvo é literalmente `100 − potência natural`,
          e errar para cima ou para baixo desconta igual — daí a comparação, em vez de uma frase
          fixa que só descreveria um dos dois lados.
        */
        return framePower > 100 - context.profile.natural_power_score
          ? 'somaria potência a um swing que já produz bastante — bola longa'
          : 'devolveria pouca bola para um swing que ainda não produz potência sozinho';
      }
      if (length !== null && profile) return SWING_LENGTH_COST[profile.swing_length];
      return null;
    }

    case 'playstyle_fit':
      return 'se afastaria do seu estilo de jogo';
    case 'comfort_fit':
      return 'seria mais dura com o seu braço';
    case 'transition_fit':
      return 'seria uma mudança brusca demais em relação à sua raquete atual';
    case 'objective_fit':
      return 'entregaria menos em outro objetivo que você declarou';
    default:
      return null;
  }
}

export type TradeOff = {
  /** Frase principal: o que a raquete deixa de entregar, dito sem rodeio. */
  readonly headline: string;
  /** O raciocínio: por que a alternativa não compensa. */
  readonly rationale: string;
};

/**
 * Encontra a raquete do ranking que MAIS entrega naquele eixo e mostra o que ela perde.
 *
 * É o coração da explicação. Sem isso, dizer "foi a melhor combinação" seria só uma afirmação
 * agradável — com isso, a afirmação vem acompanhada da alternativa concreta que foi descartada e
 * do motivo pelo qual ela foi descartada.
 */
type Alternative = {
  /** O que ela custaria, em linguagem de quadra. */
  readonly cost: string;
  /**
   * O que ela É, em duas especificações publicadas — "225 g e 115 pol²".
   *
   * É a metade verificável da explicação. "A mais potente cobraria caro" é uma afirmação que o
   * usuário só pode aceitar ou recusar; "a mais potente é um frame de 225 g" é uma afirmação que
   * ele reconhece na hora, porque sabe o que 225 g significa na mão. `null` quando o catálogo não
   * publica as duas specs — inventar número aqui destruiria justamente o que a frase serve.
   */
  readonly shape: string | null;
  readonly position: number;
};

function bestAlternative(
  axis: NeedKey,
  winner: RankedRacket,
  ranking: readonly RankedRacket[],
  context: TradeOffContext | undefined,
): Alternative | null {
  const attribute = NEED_TO_ATTRIBUTE[axis];
  const valueOf = (r: RankedRacket): number =>
    (r.racket.attributes[attribute as keyof typeof r.racket.attributes] as number) ?? 0;

  const winnerValue = valueOf(winner);
  const better = ranking.filter((r) => valueOf(r) > winnerValue + 3);
  if (better.length === 0) return null;

  // A melhor alternativa naquele eixo — a que o usuário teria escolhido se olhasse só para ele.
  const alternative = better.reduce((best, r) => (valueOf(r) > valueOf(best) ? r : best));

  // Onde ela perde para a recomendada, em pontos ponderados: é o que a troca custaria de fato.
  const winnerComponents = new Map(winner.breakdown.components.map((c) => [c.key, c]));
  let worst: ComponentBreakdown | null = null;
  let worstGap = 0;

  for (const component of alternative.breakdown.components) {
    if (component.weight <= 0) continue;
    const mine = winnerComponents.get(component.key);
    if (!mine) continue;
    const gap = (mine.raw - component.raw) * component.weight;
    if (gap > worstGap) {
      worstGap = gap;
      worst = component;
    }
  }

  if (!worst || worstGap < 1) return null;
  const cost = describeCost(worst, alternative, context);
  if (!cost) return null;

  const specs = alternative.racket.variant.specs;
  const shape =
    specs.unstrung_weight_g && specs.head_size_sq_in
      ? `${Math.round(specs.unstrung_weight_g)} g e ${Math.round(specs.head_size_sq_in)} pol²`
      : null;

  const position = context
    ? (positionIn(context.bands, attribute, valueOf(alternative)) ?? 0)
    : 0;

  return { cost, shape, position: Math.round(position) };
}

/**
 * Constrói os pontos de atenção do relatório.
 *
 * Penalizações sobre OBJETIVO viram troca explicada. As demais (risco para o braço, transição
 * brusca, dados incompletos) continuam como estão: são avisos de fato, não trocas, e amenizá-las
 * seria o erro oposto.
 */
/**
 * O que o SETUP ainda pode fazer por aquele eixo, quando o frame não pôde.
 *
 * Existe porque a explicação não devia terminar em "não dá". A raquete é uma das quatro peças que
 * este produto recomenda, e em vários eixos a corda tem alcance real — trocar de corda e de tensão
 * custa uma fração do preço de um frame e move potência e conforto de verdade.
 *
 * `null` onde a corda NÃO alcança. Estabilidade e manobrabilidade são massa e distribuição de
 * massa: prometer que uma corda resolve isso seria vender esperança, e a frase perderia o direito
 * de ser acreditada nas outras vezes. A direção também importa — tensão baixa devolve potência e
 * tira controle, então cada eixo traz a sua, e nunca a do vizinho.
 */
const SETUP_LEVER: Record<NeedKey, string | null> = {
  power: 'uma corda mais macia e uma tensão mais baixa devolvem potência sem trocar de raquete',
  comfort: 'um multifilamento em tensão mais baixa amortece bem mais que qualquer troca de frame',
  spin: 'um poliéster de perfil áspero, em calibre fino, é o que mais agarra a bola',
  control: 'um poliéster em tensão um pouco mais alta segura a bola dentro',
  precision: 'um poliéster em tensão um pouco mais alta encurta a bola e fecha o alvo',
  stability: null,
  maneuverability: null,
  forgiveness: null,
};

/** Fração do pedido abaixo da qual o relatório DEVE explicar por que não entregou. */
const SHORTFALL_THRESHOLD = 0.45;

/** Intensidade de pedido a partir da qual o silêncio deixa de ser aceitável. */
const STRONG_ASK = 20;

/**
 * Pedidos fortes que a raquete NÃO atendeu — mesmo sem contrariá-los.
 *
 * ═══ O BURACO QUE ISTO FECHA ═════════════════════════════════════════════════════════════════
 *
 * A penalização P6 cobra CONTRADIÇÃO: a raquete andar para trás no eixo pedido. Mas o caso que
 * mais incomoda quem lê o relatório não é esse — é o pedido forte que fica quase parado.
 *
 * Um jogador pede potência como prioridade máxima, o alvo fica em 64, a raquete entrega 34, a
 * atual dele está em 29. Tecnicamente a recomendação AVANÇOU cinco pontos, então P6 não dispara e
 * nada é dito. Mas o radar mostra o abismo, e o silêncio faz o relatório parecer desatento
 * justamente no ponto que a pessoa mais olha.
 *
 * Quase sempre existe um motivo bom, e ele é verificável: as raquetes realmente potentes do
 * catálogo são frames leves de cabeça grande, que seriam instáveis para o nível informado. Dizer
 * isso é o trabalho — a alternativa é o usuário concluir sozinho que o sistema ignorou o pedido.
 */
function unmetAsks(
  winner: RankedRacket,
  ranking: readonly RankedRacket[],
  candidatesEvaluated: number,
  context: TradeOffContext,
  alreadyExplained: ReadonlySet<NeedKey>,
): TradeOff[] {
  const { profile, reference, bands } = context;
  const out: TradeOff[] = [];

  for (const need of Object.keys(NEED_LABEL_PT) as NeedKey[]) {
    if (alreadyExplained.has(need)) continue;

    const asked = profile.desired_change_vector[need];
    if (Math.abs(asked) < STRONG_ASK) continue;

    const attribute = NEED_TO_ATTRIBUTE[need];
    const referencePosition = positionIn(bands, attribute, reference[need]);
    const winnerPosition = positionIn(
      bands,
      attribute,
      (winner.racket.attributes[attribute as keyof typeof winner.racket.attributes] as number) ?? 0,
    );
    if (referencePosition === null || winnerPosition === null) continue;

    const moved = (winnerPosition - referencePosition) * Math.sign(asked);
    const delivered = moved / Math.abs(asked);
    if (delivered >= SHORTFALL_THRESHOLD) continue;

    const label = NEED_LABEL_PT[need];
    const alternative = bestAlternative(need, winner, ranking, context);

    /*
      "Cerca de 0%" é uma frase que ninguém escreveria à mão. Ela sai de arredondar uma fração
      pequena, e soa a erro de sistema justamente onde o texto precisa soar deliberado — a mesma
      informação dita como "praticamente não avança" é mais honesta E mais legível.
    */
    const percent = Math.round(Math.max(0, delivered) * 100);
    const howMuch =
      percent < 5
        ? `Ela praticamente não avança em ${label} em relação ao seu ponto de partida.`
        : `Ela entrega cerca de ${percent}% do avanço que o seu perfil pede em ${label}.`;

    /*
      A frase segue uma ordem deliberada: primeiro o FATO (entregou pouco), depois a EVIDÊNCIA (a
      alternativa existe, e é isto que ela é), e só então a conclusão.

      Invertida — conclusão primeiro — ela leria como desculpa, e o leitor já chegou aqui
      desconfiado, porque foi o radar que o trouxe. Na ordem certa ele tem os dois números na mão
      antes de precisar acreditar em qualquer coisa.
    */
    const evidence = alternative
      ? `Entre as ${candidatesEvaluated} avaliadas, a que mais entrega ${label} chega a ` +
        `${alternative.position} de 100 nesse eixo` +
        (alternative.shape ? ` — e é um frame de ${alternative.shape}` : '') +
        `. Ela ${alternative.cost}. `
      : `As raquetes com bem mais ${label} no mercado que analisamos são frames de outro ` +
        `propósito, que falhariam no que pesa mais para você. `;

    out.push({
      headline:
        `Você pediu mais ${label} como prioridade, e esta raquete avança pouco nesse ponto.`,
      rationale:
        `${howMuch} ` +
        evidence +
        `Ganhar ${label} por esse caminho custaria mais do que ${label} vale para o seu jogo — e ` +
        `é por isso que a escolha foi outra.` +
        (SETUP_LEVER[need]
          ? ` O lugar certo de buscar ${label} no seu caso é o setup: ${SETUP_LEVER[need]}.`
          : ''),
    });
  }

  return out;
}

export function buildTradeOffs(
  winner: RankedRacket,
  ranking: readonly RankedRacket[],
  candidatesEvaluated: number,
  context?: TradeOffContext,
): readonly TradeOff[] {
  const out: TradeOff[] = [];
  const explained = new Set<NeedKey>();

  for (const penalty of winner.breakdown.penalties) {
    if (penalty.code !== 'P6_objective_conflict' || !penalty.axis) {
      out.push({ headline: penalty.reason, rationale: '' });
      continue;
    }

    explained.add(penalty.axis);
    const label = NEED_LABEL_PT[penalty.axis];
    const alternative = bestAlternative(penalty.axis, winner, ranking, context);

    out.push({
      headline: `Em ${label}, esta raquete entrega menos do que você pediu.`,
      rationale: alternative
        ? `Entre as ${candidatesEvaluated} avaliadas existem opções com mais ${label} — mas a ` +
          `melhor delas ${alternative.cost}. Como esses fatores pesam mais no seu perfil do que o ` +
          `ganho em ${label}, o conjunto que sobra é melhor com esta escolha. É uma troca, não um ` +
          `descuido.`
        : `Nenhuma das ${candidatesEvaluated} raquetes avaliadas entrega mais ${label} sem ` +
          `contrariar algo que pesa mais no seu perfil. Esta é a melhor posição possível nesse ` +
          `eixo dentro do que existe hoje no mercado que analisamos.`,
    });
  }

  if (context) {
    out.push(...unmetAsks(winner, ranking, candidatesEvaluated, context, explained));
  }

  return out;
}
