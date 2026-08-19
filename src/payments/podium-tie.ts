/**
 * Empate no pódio — o que dizer quando três opções mostram o mesmo número.
 *
 * ═══ A RECLAMAÇÃO ════════════════════════════════════════════════════════════════════════════
 *
 * Um relatório real trouxe as três primeiras raquetes marcando 88%, sem nada na tela que as
 * separasse. A leitura inevitável é a de que o motor não decidiu nada: se as três são 88, por que
 * esta é a primeira?
 *
 * ═══ POR QUE NÃO É CASA DECIMAL ══════════════════════════════════════════════════════════════
 *
 * A saída mais óbvia seria exibir 88.3 / 88.1 / 88.0. Ela resolve o sintoma e cria um problema
 * maior: sugere uma resolução que os dados não têm. O score sai de seis especificações publicadas
 * pelo fabricante — cabeça, peso, balanço, perfil de viga, comprimento e padrão de cordas. Nenhum
 * fabricante publica tolerância de fabricação, e a variação real entre duas unidades da MESMA
 * raquete costuma superar essas décimas. Escrever 88.3 contra 88.1 é afirmar uma diferença que
 * nenhuma medição sustenta — exatamente o tipo de precisão inventada que o produto promete não
 * fazer.
 *
 * Pior: no caso concreto do relatório, duas das três empatadas eram GÊMEAS DE ESPECIFICAÇÃO — 98
 * pol², 305 g, 315 mm, 16×19, 27". Elas não empatam por arredondamento; empatam até o último
 * decimal, porque recebem o mesmo vetor de atributos. Nenhuma casa decimal as separa, e insistir
 * em separá-las seria fabricar o número.
 *
 * ═══ O QUE ESTE MÓDULO FAZ ═══════════════════════════════════════════════════════════════════
 *
 * Diferencia pelo MOTIVO, não pelo dígito. Para cada opção dentro da faixa de empate, compara os
 * componentes do score contra a média das outras empatadas e devolve em que ela se destaca e em
 * que ela cede. Quando não há destaque nenhum acima do ruído, diz isso com todas as letras: são
 * equivalentes, e a escolha entre elas é de preço, disponibilidade ou gosto — critérios que o motor
 * não tem e não deve fingir ter.
 *
 * É o mesmo tratamento que as cordas idênticas já recebiam (`collectEquivalents`), aplicado às
 * raquetes.
 */

import type { ComponentKey, RankedRacket } from '@/domain/recommendation';
import { TECHNICAL_TIE_THRESHOLD } from '@/domain/reference-ranges';

/**
 * Diferença de componente abaixo da qual não vale a pena escrever uma frase.
 *
 * Os componentes vão de 0 a 100 e passam por equalização de dispersão; abaixo de dois pontos a
 * distância descreve o modelo, não a raquete.
 */
const MEANINGFUL_COMPONENT_GAP = 2;

/**
 * Piso mais baixo, usado só para COMPLETAR a frase.
 *
 * Sem ele, o card da 1ª colocada podia sair só com a parte negativa: no caso medido a VCORE 100
 * ganhava 1.2 em objetivo (abaixo do piso) e perdia 3.0 em conforto (acima), e o texto virava
 * "entre as empatadas, é menos amigável ao braço" — verdadeiro, e uma descrição absurda da raquete
 * que o motor acabou de escolher. Um destaque pequeno demais para abrir a frase ainda é grande o
 * bastante para fechá-la.
 */
const SECONDARY_COMPONENT_GAP = 0.75;

/** Só entram no grupo posições realmente exibidas — o pódio tem três. */
const MAX_TIE_GROUP = 3;

/**
 * Quatro formas por eixo, porque a mesma vantagem se diz diferente conforme ela seja A MAIOR do
 * grupo ou apenas maior que a média.
 *
 * `best` e `worst` são predicados que seguem "é" e valem quando a opção é o extremo do grupo:
 * "Das três, é a mais amigável ao braço". `more` e `less` são orações completas para o caso
 * comparativo: "Acompanha melhor o seu estilo de jogo".
 *
 * A distinção não é enfeite. Um superlativo afirma mais do que um comparativo, e usar o primeiro
 * onde só o segundo é verdade seria exagerar — três cards não podem ser cada um "o mais confortável".
 */
const COMPONENT_PT: Record<
  ComponentKey,
  { readonly best: string; readonly worst: string; readonly more: string; readonly less: string }
> = {
  physical_fit: {
    best: 'a que melhor encaixa no seu físico',
    worst: 'a que mais exige do seu físico',
    more: 'encaixa melhor no seu peso e condicionamento',
    less: 'exige um pouco mais do braço ao longo do jogo',
  },
  skill_fit: {
    best: 'a mais adequada ao nível que você tem hoje',
    worst: 'a que mais cobra técnica',
    more: 'pede de você exatamente o nível que você tem',
    less: 'cobra um pouco mais de técnica',
  },
  swing_fit: {
    best: 'a que melhor combina com a velocidade do seu swing',
    worst: 'a que menos combina com o seu swing',
    more: 'complementa melhor a velocidade do seu swing',
    less: 'combina um pouco menos com o seu swing',
  },
  playstyle_fit: {
    best: 'a que melhor acompanha o seu estilo de jogo',
    worst: 'a que menos acompanha o seu estilo de jogo',
    more: 'acompanha melhor o seu estilo de jogo',
    less: 'acompanha um pouco menos o seu estilo de jogo',
  },
  objective_fit: {
    best: 'a que mais entrega o que você pediu',
    worst: 'a que menos entrega o que você pediu',
    more: 'entrega mais do que você pediu, na ordem que você pediu',
    less: 'entrega um pouco menos do que você pediu',
  },
  comfort_fit: {
    best: 'a mais amigável ao braço',
    worst: 'a menos amigável ao braço',
    more: 'é mais amigável ao braço',
    less: 'é menos amigável ao braço',
  },
  transition_fit: {
    best: 'a troca mais suave a partir da sua raquete atual',
    worst: 'a que mais muda em relação à sua raquete atual',
    more: 'é uma troca mais suave a partir da sua raquete atual',
    less: 'muda mais em relação à sua raquete atual',
  },
};

const CARDINAL: Readonly<Record<number, string>> = { 2: 'duas', 3: 'três' };

function upperFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export type PodiumTieGroup = {
  /** Posições empatadas, em ordem. Sempre começa em 1 — só existe empate no topo. */
  readonly ranks: readonly number[];
  /** Maior distância dentro do grupo, arredondada como aparece na tela. */
  readonly spread: number;
  readonly message: string;
};

/** Como uma opção empatada se distingue das outras do mesmo grupo. */
export type PodiumDistinction = {
  readonly headline: string;
  /** `true` quando o vetor de atributos é idêntico ao de outra do grupo. */
  readonly identical_twin: boolean;
};

/**
 * As posições do topo que estão dentro da faixa de empate técnico.
 *
 * Retorna vazio quando a 1ª se destaca — o caso normal, em que não há nada a explicar.
 */
export function tieGroup(podium: readonly RankedRacket[]): readonly RankedRacket[] {
  const first = podium[0];
  if (!first) return [];

  /*
    ═══ EMPATE É O QUE O LEITOR VÊ, NÃO O QUE A FAIXA PERMITE ══════════════════════════════

    Antes o grupo era formado por `TECHNICAL_TIE_THRESHOLD` (2 pontos) sobre o score cru. Com 82,
    81 e 80 na tela, os três entravam — e o relatório dizia "entre as empatadas" ao lado de três
    números visivelmente diferentes. O texto contradizia o dado que ele mesmo exibia, que é a pior
    forma de errar: quem lê não conclui "a diferença é pequena", conclui que o texto é genérico.

    Empate agora é igualdade no número EXIBIDO. Duas colocadas em 88% estão empatadas; 82 e 81 não
    estão, por menor que seja a distância real — para essas existe a frase de comparação, que diz
    o que muda sem afirmar igualdade.
  */
  const shown = Math.round(first.fit_score);
  const group = podium
    .slice(0, MAX_TIE_GROUP)
    .filter((e) => Math.round(e.fit_score) === shown);

  return group.length > 1 ? group : [];
}

export function buildTieGroup(podium: readonly RankedRacket[]): PodiumTieGroup | null {
  const group = tieGroup(podium);
  if (group.length === 0) return null;

  const scores = group.map((e) => e.fit_score);
  const spread = Math.max(...scores) - Math.min(...scores);
  const n = group.length === 2 ? 'duas' : 'três';

  return {
    ranks: group.map((e) => e.rank),
    spread: Math.round(spread * 100) / 100,
    message:
      `Estas ${n} primeiras empataram tecnicamente: ${spread.toFixed(2)} ponto separa a maior da ` +
      'menor, num score construído sobre seis especificações publicadas. A ordem entre elas está ' +
      'correta — a 1ª realmente pontuou mais —, mas por uma margem menor do que a diferença entre ' +
      'duas unidades da mesma raquete saídas de fábrica. Não leia como "melhor" e "piores": são ' +
      'alternativas equivalentes, e o que separa cada uma está escrito no próprio card.',
  };
}

/**
 * O que separa `entry` das outras empatadas.
 *
 * A comparação é contra a MÉDIA das demais do grupo, e não contra a 1ª colocada: para a própria 1ª
 * não existiria referência, e comparar a 3ª com a 1ª ignoraria a 2ª, que está no meio.
 */
type Delta = { readonly key: ComponentKey; readonly delta: number };

/** Distância de cada componente de `entry` até a média das outras do escopo. */
function deltasFor(entry: RankedRacket, others: readonly RankedRacket[]): Delta[] {
  const out: Delta[] = [];
  for (const component of entry.breakdown.components) {
    if (component.weight <= 0) continue;
    const values = others.map(
      (o) => o.breakdown.components.find((c) => c.key === component.key)?.raw ?? component.raw,
    );
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    out.push({ key: component.key, delta: component.raw - mean });
  }
  return out;
}

/**
 * ═══ EIXOS DISTINTOS ENTRE OS CARDS ══════════════════════════════════════════════════════════
 *
 * O defeito que isto corrige, medido nas 22 personas de validação ANTES da mudança:
 *
 *     45% dos pódios tinham dois cards abrindo pelo MESMO eixo
 *     77% tinham os três começando com as mesmas 18 letras
 *     e em pelo menos um caso (p02) dois cards saíam com a frase LITERALMENTE IDÊNTICA
 *
 * A causa é aritmética, não de redação. Cada card escolhia seu maior delta isoladamente, e o delta
 * é medido contra a média das OUTRAS: se duas raquetes são confortáveis e a terceira não é, as duas
 * confortáveis têm conforto como maior delta, e as duas escrevem a mesma frase. Verdade nos dois
 * casos, e inútil — a pergunta do card é "o que ESTA faz de diferente das outras duas", e responder
 * a mesma coisa duas vezes não responde nada.
 *
 * Aqui os três cards são resolvidos JUNTOS: cada um recebe um eixo que nenhum outro usa. Com no
 * máximo 3 posições e 7 componentes, a busca exaustiva por permutações custa nada e evita os
 * artefatos de um algoritmo guloso — que daria ao primeiro card o melhor eixo e deixaria o terceiro
 * com sobras.
 *
 * O critério maximizado é a soma dos deltas escolhidos: a atribuição que diz o MAIS possível no
 * conjunto, e não a que favorece um card.
 *
 * ─── O QUE ISTO NÃO FAZ ──────────────────────────────────────────────────────────────────────
 *
 * Não força distinção onde ela não existe. Um eixo só é atribuído se o delta passar do piso; abaixo
 * dele o card volta a usar seu próprio melhor eixo, mesmo repetido. Repetir uma frase é feio;
 * afirmar uma vantagem que os dados não sustentam é mentira, e feio perde para mentira.
 */
function assignDistinctAxes(
  scope: readonly RankedRacket[],
  direction: 1 | -1,
  floor: number,
): Map<number, Delta> {
  const perEntry = scope.map((entry) => ({
    rank: entry.rank,
    deltas: deltasFor(
      entry,
      scope.filter((o) => o.rank !== entry.rank),
    )
      .filter((d) => d.delta * direction >= floor)
      .sort((a, b) => (b.delta - a.delta) * direction),
  }));

  type Assignment = { readonly total: number; readonly picks: Map<number, Delta> };

  /**
   * Melhor atribuição para os cards de `index` em diante, dados os eixos já usados.
   *
   * Recursiva e PURA — devolve a atribuição em vez de escrever numa variável de fora. Além de mais
   * fácil de ler, evita que o TypeScript perca o rastro do tipo: mutação dentro de closure não entra
   * na análise de fluxo, e a leitura depois do laço estreitaria para `never`.
   */
  const bestFrom = (index: number, used: ReadonlySet<ComponentKey>): Assignment => {
    if (index === perEntry.length) return { total: 0, picks: new Map() };

    const current = perEntry[index]!;
    // Deixar este card sem eixo é sempre uma opção — é o que acontece quando nada passa do piso.
    let best: Assignment = bestFrom(index + 1, used);

    for (const d of current.deltas) {
      if (used.has(d.key)) continue;

      const rest = bestFrom(index + 1, new Set([...used, d.key]));
      const candidate: Assignment = {
        total: rest.total + d.delta * direction,
        picks: new Map(rest.picks).set(current.rank, d),
      };

      // Atender mais cards vence sempre; entre atribuições do mesmo tamanho, vence a soma maior.
      const melhor =
        candidate.picks.size > best.picks.size ||
        (candidate.picks.size === best.picks.size && candidate.total > best.total);
      if (melhor) best = candidate;
    }

    return best;
  };

  return bestFrom(0, new Set()).picks;
}

/** O melhor eixo do card sem considerar os outros — a saída quando a atribuição distinta falha. */
function ownExtreme(
  entry: RankedRacket,
  others: readonly RankedRacket[],
  direction: 1 | -1,
  floor: number,
): Delta | null {
  const sorted = deltasFor(entry, others).sort((a, b) => (b.delta - a.delta) * direction);
  const top = sorted[0];
  return top && top.delta * direction >= floor ? top : null;
}

export function buildDistinction(
  entry: RankedRacket,
  podium: readonly RankedRacket[],
): PodiumDistinction | null {
  /*
    A comparação vale para TODO colocado do pódio, empatado ou não.

    Ela nasceu para explicar empates, mas o que ela responde — "o que esta faz de diferente das
    outras duas?" — é a pergunta de quem está escolhendo, com números iguais ou não. Restringi-la
    ao empate deixava os outros cards mudos justamente quando a decisão é real.
  */
  /*
    ═══ O ESCOPO É SEMPRE O PÓDIO INTEIRO ════════════════════════════════════════════════════

    Antes o escopo mudava conforme a posição estivesse ou não no grupo de empate: as empatadas se
    comparavam entre si, as demais se comparavam com as três. Parecia mais preciso e produzia uma
    colisão que a distribuição de eixos não conseguia enxergar — foi o que apareceu em p20:

        1. Das três, é a mais adequada ao nível que você tem hoje     (escopo: empatadas 1-2)
        2. É mais amigável ao braço                                   (escopo: empatadas 1-2)
        3. É mais amigável ao braço                                   (escopo: pódio 1-2-3)

    Os cards 2 e 3 foram resolvidos em distribuições DIFERENTES, então nenhuma das duas soube que o
    conforto já estava tomado. Distribuir eixos distintos só funciona se todos os cards entrarem na
    mesma conta.

    O pódio inteiro também é o escopo certo pelo lado do leitor: ele tem três cards à vista e compara
    os três. O grupo de empate continua existindo — é o que a faixa acima anuncia e o que decide se a
    frase pode falar em igualdade —, mas não é mais a régua da comparação.
  */
  const scope = podium.slice(0, MAX_TIE_GROUP);
  const others = scope.filter((e) => e.rank !== entry.rank);
  if (others.length === 0 || !scope.some((e) => e.rank === entry.rank)) return null;

  /**
   * ═══ GÊMEA PRIMEIRO, ANTES DE QUALQUER COMPARAÇÃO ══════════════════════════════════════════
   *
   * Este teste vinha DEPOIS, como último recurso: só falava em gêmeas quando não houvesse nenhuma
   * vantagem a apontar. E aí ele quase nunca disparava, porque duas gêmeas continuam tendo vantagem
   * sobre a TERCEIRA raquete do pódio.
   *
   * Foi o que apareceu em p20 — Babolat Pure Aero 98 (2026) e Pure Drive 98 (2025), vetores de
   * atributo iguais até a última casa, ambas mais confortáveis que a Percept 100D:
   *
   *     2. É mais amigável ao braço.
   *     3. É mais amigável ao braço.
   *
   * Duas frases idênticas para duas raquetes diferentes, e o motivo verdadeiro — que elas são o
   * mesmo quadro para efeito desta análise — não aparecia em lugar nenhum. Nenhum rearranjo de eixos
   * resolveria: os deltas das duas são iguais entre si em TODOS os componentes, então não existe
   * eixo em que uma se destaque da outra.
   *
   * Ser gêmea da vizinha é o fato mais decisivo do card, e vem antes de qualquer comparação com a
   * terceira. Cada uma aponta a outra pelo nome, então as duas frases também deixam de colidir.
   */
  const twin = others.find((o) => sameAttributeVector(entry, o));
  if (twin) {
    return {
      headline:
        `Tecnicamente idêntica à ${twin.rank}ª (${twin.racket.variant.product_name}): mesmas ` +
        'especificações publicadas, mesmo resultado na análise. Escolha por preço, ' +
        'disponibilidade ou preferência de marca.',
      identical_twin: true,
    };
  }

  /*
    ═══ O PREFIXO SAIU ═══════════════════════════════════════════════════════════════════════

    Era "Entre as empatadas, …" ou "Comparada às outras do pódio, …" — até 29 caracteres de
    garganta limpa antes de qualquer conteúdo, idênticos nos três cards, num espaço de ~200px onde
    cada linha conta. E redundantes: a faixa de empate logo acima já diz que as três empataram, e os
    três cards estão lado a lado, então "das três" já é o entendimento natural de quem lê.

    O escopo continua explícito onde ele pode ser mal lido — no superlativo, que sem "das três"
    soaria como "a melhor do catálogo".
  */
  const strongPick = assignDistinctAxes(scope, 1, SECONDARY_COMPONENT_GAP).get(entry.rank)
    ?? ownExtreme(entry, others, 1, SECONDARY_COMPONENT_GAP);
  const weakPick = assignDistinctAxes(scope, -1, SECONDARY_COMPONENT_GAP).get(entry.rank)
    ?? ownExtreme(entry, others, -1, SECONDARY_COMPONENT_GAP);

  /**
   * Basta UM lado acima do piso alto para haver o que dizer; o outro entra com o piso secundário.
   *
   * A frase precisa dos dois lados sempre que os dois existirem, porque o assunto dela é a TROCA
   * entre opções equivalentes. Só um lado deixaria o card ou vendendo ou depreciando.
   *
   * O piso ALTO é aferido sobre o próprio extremo do card, não sobre o eixo atribuído: a pergunta
   * "há algo relevante a dizer sobre esta raquete?" é sobre a raquete, e não pode depender de qual
   * eixo sobrou na distribuição.
   */
  const ownStrong = ownExtreme(entry, others, 1, -Infinity);
  const ownWeak = ownExtreme(entry, others, -1, -Infinity);
  const relevant =
    (ownStrong?.delta ?? -Infinity) >= MEANINGFUL_COMPONENT_GAP ||
    (ownWeak?.delta ?? Infinity) <= -MEANINGFUL_COMPONENT_GAP;

  const strong = relevant ? strongPick : null;
  const weak = relevant && weakPick?.key !== strong?.key ? weakPick : null;

  /**
   * Nenhuma diferença acima do ruído, e nenhuma gêmea.
   *
   * Especificações diferentes que mesmo assim não produzem distância mensurável no que importa para
   * este jogador. Não é falha da análise — é o resultado dela, e dizê-lo é mais útil do que inventar
   * um desempate a partir de decimais que nenhuma medição sustenta.
   */
  if (!strong && !weak) {
    return {
      headline:
        'Equivalente às outras do pódio: a diferença fica abaixo do que as especificações ' +
        'publicadas conseguem distinguir.',
      identical_twin: false,
    };
  }

  /*
    O superlativo precisa dizer DE QUE CONJUNTO ele é o máximo — sem isso, "é a mais confortável"
    se lê como "do catálogo inteiro". Com o escopo fixado no pódio, o conjunto é sempre o que está
    à vista, e "Das três" descreve exatamente o que o olho compara.
  */
  const setLabel = `Das ${CARDINAL[scope.length] ?? String(scope.length)}`;
  const isExtreme = (pick: Delta, direction: 1 | -1) =>
    others.every((o) => {
      const mine = entry.breakdown.components.find((c) => c.key === pick.key)?.raw ?? 0;
      const theirs = o.breakdown.components.find((c) => c.key === pick.key)?.raw ?? 0;
      return (mine - theirs) * direction > 0;
    });

  const head = strong
    ? isExtreme(strong, 1)
      ? `${setLabel}, é ${COMPONENT_PT[strong.key].best}`
      : upperFirst(COMPONENT_PT[strong.key].more)
    : null;

  const tail = weak
    ? isExtreme(weak, -1)
      ? `é ${COMPONENT_PT[weak.key].worst}`
      : COMPONENT_PT[weak.key].less
    : null;

  if (head && tail) return { headline: `${head}. Em troca, ${tail}.`, identical_twin: false };
  if (head) return { headline: `${head}.`, identical_twin: false };
  return { headline: `${upperFirst(tail!)}.`, identical_twin: false };
}

/**
 * Quantas raquetes do catálogo inteiro ficaram tecnicamente empatadas com a 1ª.
 *
 * ═══ POR QUE ESTE NÚMERO EXISTE ══════════════════════════════════════════════════════════════
 *
 * Reclamação de usuário, e ela é justa: "a 1ª, a 2ª e a 3ª deram 88%, e a minha raquete atual deu
 * 86% em 11º. Dá a impressão de que o aplicativo está dizendo que qualquer uma serve."
 *
 * A parte incômoda é que, para aquele perfil, era mais ou menos isso mesmo. Um intermediário de 82
 * kg com swing moderado consegue jogar bem com quase qualquer frame de 300–310 g e 98–100 pol²: o
 * encaixe físico satura, o swing satura, e o que sobra separando as opções é pouco. O erro não era
 * o número — era deixar a pessoa DEDUZIR isso de um silêncio, como se fosse falha da análise.
 *
 * Então o produto passa a dizer com todas as letras quantas empataram e o que isso significa. Um
 * empate largo é uma descoberta sobre o jogador, não uma indecisão do motor: quando o quadro
 * importa pouco, o que importa é a corda e a tensão — que é a outra metade do que se está
 * comprando, e a metade mais barata de ajustar.
 *
 * A alternativa seria esticar a escala até 88% virar 100% e 86% virar 40%. Isso resolveria a
 * aparência mentindo: a distância real entre as duas raquetes continuaria sendo de dois pontos.
 */
export type PodiumSeparation = {
  readonly tied_with_first: number;
  readonly evaluated: number;
  readonly verdict: 'aberto' | 'disputado' | 'indiferente';
  readonly message: string;
};

/** A partir daqui o empate deixa de ser detalhe e vira a conclusão principal da análise. */
const WIDE_TIE_SHARE = 0.2;

export function buildSeparation(
  fullRanking: readonly RankedRacket[],
): PodiumSeparation | null {
  const first = fullRanking[0];
  if (!first || fullRanking.length < 4) return null;

  const tied = fullRanking.filter(
    (r) => first.fit_score - r.fit_score < TECHNICAL_TIE_THRESHOLD,
  ).length;
  const evaluated = fullRanking.length;
  const share = tied / evaluated;

  if (tied <= 2) {
    return {
      tied_with_first: tied,
      evaluated,
      verdict: 'aberto',
      message:
        `A 1ª colocada se destacou: das ${evaluated} raquetes avaliadas, nenhuma outra chegou perto ` +
        'o bastante para ser considerada equivalente. Aqui a escolha do quadro faz diferença real, ' +
        'e vale seguir a recomendação.',
    };
  }

  if (share < WIDE_TIE_SHARE) {
    return {
      tied_with_first: tied,
      evaluated,
      verdict: 'disputado',
      message:
        `${tied} das ${evaluated} raquetes avaliadas ficaram tecnicamente empatadas com a 1ª. É um ` +
        'grupo pequeno e bem definido: dentro dele a escolha é de preferência, mas ficar fora dele ' +
        'custa compatibilidade de verdade.',
    };
  }

  return {
    tied_with_first: tied,
    evaluated,
    verdict: 'indiferente',
    message:
      `${tied} das ${evaluated} raquetes avaliadas ficaram tecnicamente empatadas com a 1ª — quase ` +
      'um quarto do catálogo. Isso não é indecisão da análise: é o resultado dela. Seu perfil ' +
      'físico e seu swing se dão bem com uma faixa larga de quadros, e nessa faixa trocar de ' +
      'raquete muda pouco. O que ainda muda bastante para você é a CORDA e a TENSÃO — e essas ' +
      'custam uma fração do preço de um quadro novo.',
  };
}

/** Duas raquetes com o mesmo vetor de atributos — o caso das gêmeas de especificação. */
function sameAttributeVector(a: RankedRacket, b: RankedRacket): boolean {
  const x = a.racket.attributes;
  const y = b.racket.attributes;
  return (
    x.power_score === y.power_score &&
    x.control_score === y.control_score &&
    x.spin_score === y.spin_score &&
    x.comfort_score === y.comfort_score &&
    x.stability_score === y.stability_score &&
    x.maneuverability_score === y.maneuverability_score
  );
}
