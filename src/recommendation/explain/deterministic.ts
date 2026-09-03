/**
 * Gerador determinístico de explicações.
 *
 * É o caminho PADRÃO, não o de emergência: o produto entrega um relatório completo e correto sem
 * nenhuma chamada de IA. A IA (quando disponível e aprovada pelo guard) apenas substitui este texto
 * por uma prosa mais fluida — nunca por informação diferente.
 *
 * Tom conforme §55: especialista, acessível, sem arrogância, sem falsa certeza.
 */

import { round } from '@/domain/scores';
import { formatTension } from '@/domain/units';
import type { RacketAttributes, ScoredRacket } from '@/domain/racket';
import type { NeedKey, PlayerProfile } from '@/domain/player-profile';
import type {
  RankedRacket,
  StringRecommendation,
  TensionRecommendation,
  TransitionAnalysis,
} from '@/domain/recommendation';

/**
 * Posição de um atributo dentro da faixa que o catálogo ocupa, 0–100.
 *
 * É a MESMA conta que `explainExpectations` faz. Ela vive aqui em cima, sozinha, porque as duas
 * seções precisam falar da mesma raquete usando a mesma régua — ver o defeito registrado no
 * cabeçalho de `explainRacketFit`.
 */
function bandPosition(
  bands: Readonly<Record<string, readonly [number, number]>> | undefined,
  attribute: string,
  value: number,
): number | null {
  const band = bands?.[attribute];
  if (!band || band[1] <= band[0]) return null;
  return Math.max(0, Math.min(100, ((value - band[0]) / (band[1] - band[0])) * 100));
}

/**
 * "Por que combina com você?" (§35)
 *
 * ═══ AS DUAS FRASES DE POTÊNCIA VIVIAM EM RÉGUAS DIFERENTES ══════════════════════════════════
 *
 * Relato do usuário, com o relatório do perfil 06 na mão: a Babolat Pure Aero 98 aparecia ao mesmo
 * tempo como o frame que "complementa a potência que seu swing ainda não entrega" e, três blocos
 * abaixo, como um "frame contido: a potência vem mais de você do que da raquete". Uma raquete não
 * pode entregar a potência que falta e ao mesmo tempo não entregar potência.
 *
 * ─── AS DUAS CAUSAS, EMPILHADAS ──────────────────────────────────────────────────────────────
 *
 * 1. RÉGUAS DIFERENTES. A frase daqui era relativa ao JOGADOR (`100 − potência natural`, com zona
 *    morta de ±12); a de `EXPECTATION_AXES` é absoluta contra o CATÁLOGO. As duas podiam ser
 *    individualmente verdadeiras e, lidas em sequência, se contradizerem — que é como o leitor lê.
 *
 * 2. O GATILHO NÃO MEDIA O QUE A FRASE AFIRMAVA. A condição era `swing_fit >= 75`, e `swing_fit` é
 *    `0.65 × potência + 0.35 × comprimento de swing`. Um frame com a potência inteiramente errada
 *    para a pessoa passava do gatilho carregado pelo termo de comprimento. Medido na persona p04:
 *    potência do frame no percentil 14 do catálogo, necessária 48 — e `swing_fit` 79, acima do
 *    corte. A frase sobre POTÊNCIA era liberada por um número que é só 65% potência.
 *
 * ─── O CONSERTO ──────────────────────────────────────────────────────────────────────────────
 *
 * O gatilho passa a ser o próprio termo de potência (`power_complement`), e a redação passa a
 * consultar a posição no catálogo — a mesma que a outra seção usa. Quando o frame é contido em
 * termos absolutos, esta seção CALA sobre potência: quem diz o que há para dizer é a linha de
 * "o que você deve perceber", e o bloco de trocas explica o que foi trocado por quê. Uma frase a
 * menos é melhor que duas que se desmentem.
 *
 * Medido depois: as duas frases opostas disparavam juntas em 2 de 58 perfis varridos; passam a
 * disparar em 0.
 */
export function explainRacketFit(
  ranked: RankedRacket,
  profile: PlayerProfile,
  bands?: Readonly<Record<string, readonly [number, number]>>,
): string[] {
  const out: string[] = [];
  const { attributes, variant } = ranked.racket;
  const byKey = new Map(ranked.breakdown.components.map((c) => [c.key, c]));

  const skill = byKey.get('skill_fit');
  if (skill && skill.raw >= 75) {
    out.push(
      `A exigência deste frame está alinhada ao seu nível técnico: ele responde bem ao que você ` +
        `já consegue executar, sem cobrar um swing que ainda está em construção.`,
    );
  }

  const physical = byKey.get('physical_fit');
  if (physical && physical.raw >= 80) {
    out.push(
      `A massa é compatível com o seu perfil físico e com a velocidade de swing informada — ` +
        `você deve conseguir acelerar o frame até o fim da partida, não só nos primeiros games.`,
    );
  }

  /*
    O gatilho é o TERMO DE POTÊNCIA, não o `swing_fit` inteiro — ver o cabeçalho da função.

    Sem o termo (raquete sem `power_score` utilizável) não há frase: o silêncio é a leitura certa
    de "não temos como afirmar isso".
  */
  const powerTerm = byKey
    .get('swing_fit')
    ?.terms.find((t) => t.label === 'power_complement')?.value;
  const framePower = bandPosition(bands, 'power_score', attributes.power_score);

  if (powerTerm !== null && powerTerm !== undefined && powerTerm >= 0.75) {
    if (profile.natural_power_score >= 60) {
      out.push(
        `Como você já gera potência própria, escolhemos um frame mais contido: a potência que ` +
          `falta vem do seu swing, e o controle vem da raquete.`,
      );
    } else if (framePower === null || framePower > EXPECTATION_LOW) {
      out.push(
        `Este frame complementa a potência que seu swing ainda não entrega, ajudando a bola a ` +
          `chegar ao fundo da quadra com menos esforço.`,
      );
    }
    /*
      O caso restante — o jogador gera pouca potência E o frame é contido no catálogo — não ganha
      frase nenhuma AQUI de propósito. Era exatamente ele que produzia a contradição, e a leitura
      honesta dele já é dada duas vezes na página: em "o que você deve perceber" e no bloco de
      trocas, que diz o que foi trocado por quê.
    */
  }

  const objective = byKey.get('objective_fit');
  if (objective && objective.raw >= 75) {
    out.push('Ele caminha na direção do objetivo que você declarou.');
  }

  if (profile.arm_sensitivity_score >= 60) {
    out.push(
      `Pelo histórico de desconforto que você informou, tratamos o conforto como restrição, não ` +
        `como preferência: frames rígidos foram descartados antes mesmo da pontuação.`,
    );
  }

  const style = byKey.get('playstyle_fit');
  if (style && style.raw >= 75) {
    out.push(`As características do frame conversam com o estilo de jogo que você descreveu.`);
  }

  if (out.length === 0) {
    out.push(
      `Esta foi a raquete que apresentou maior compatibilidade com o perfil informado, ` +
        `considerando físico, nível técnico, swing, estilo e objetivo.`,
    );
  }

  // Honestidade sobre a base de dados (§62).
  if (attributes.data_completeness < 0.8) {
    out.push(
      `Vale registrar: ainda não temos todas as medições de laboratório verificadas para este ` +
        `modelo, então a análise usou os dados de catálogo do fabricante.`,
    );
  }

  if (variant.status === 'previous_generation') {
    out.push(
      'Este modelo é de geração anterior — costuma ser mais fácil de encontrar com bom preço, ' +
        'mas confirme a disponibilidade.',
    );
  }

  return out;
}

/**
 * Um eixo do "O que você deve perceber": rótulo, atributo e as duas leituras com destaque.
 *
 * Não há texto para o meio da escala: eixo sem destaque só aparece quando foi PEDIDO, e aí sai
 * agrupado com os outros na mesma situação — ver a nota da função.
 */
type ExpectationAxis = {
  readonly need: NeedKey;
  readonly label: string;
  readonly attribute: string;
  readonly value: (a: RacketAttributes) => number;
  readonly high: string;
  readonly low: string;
};

const EXPECTATION_AXES: readonly ExpectationAxis[] = [
  {
    need: 'power',
    label: 'Potência',
    attribute: 'power_score',
    value: (a) => a.power_score,
    high: 'entre as mais potentes do catálogo — nos primeiros treinos sobra bola até o swing calibrar.',
    low: 'frame contido: a potência vem mais de você do que da raquete.',
  },
  {
    need: 'control',
    label: 'Controle',
    attribute: 'control_score',
    value: (a) => a.control_score,
    high: 'entre as mais controladoras do catálogo — a bola fica previsível quando você acelera.',
    low: 'menos controle direcional que a média, em troca de mais tolerância.',
  },
  {
    need: 'spin',
    label: 'Spin',
    attribute: 'spin_score',
    value: (a) => a.spin_score,
    high: 'entre as que mais ajudam a rotação — fica mais fácil elevar a bola com o mesmo gesto.',
    low: 'trajetória mais plana que a média; o spin dependerá mais da sua técnica.',
  },
  {
    need: 'comfort',
    label: 'Conforto',
    attribute: 'comfort_score',
    value: (a) => a.comfort_score,
    high: 'entre as mais macias do catálogo no impacto.',
    low: 'resposta mais seca que a média — acompanhe como seu braço reage nas primeiras semanas.',
  },
  {
    need: 'stability',
    label: 'Estabilidade',
    attribute: 'stability_score',
    value: (a) => a.stability_score,
    high: 'entre as mais firmes contra bolas pesadas e impactos descentralizados.',
    low: 'cede mais que a média contra bolas muito pesadas.',
  },
  {
    need: 'maneuverability',
    label: 'Manobrabilidade',
    attribute: 'maneuverability_score',
    value: (a) => a.maneuverability_score,
    high: 'entre as mais rápidas de reposicionar em defesa e na rede.',
    low: 'exige preparação mais cedo que a média, especialmente em bolas rápidas.',
  },
];

/**
 * Acima disto o eixo é destaque; abaixo do piso, é limitação. Em POSIÇÃO de catálogo.
 *
 * O par 60/40 saiu de medição, não de gosto. Sobre 4.000 perfis, a fração dos eixos da raquete
 * VENCEDORA que cai na zona sem destaque é 55,8% com 70/30, 40,9% com 65/35 e 27,4% com 60/40. Com
 * o corte em 70/30 a maioria das linhas virava "no meio do catálogo" repetido — trocar um ruído
 * (defeito em eixo não pedido) por outro (três linhas dizendo que não há nada a dizer).
 */
const EXPECTATION_HIGH = 60;
const EXPECTATION_LOW = 40;

/** Teto de linhas. Acima disso a seção vira lista de specs e para de ser lida. */
const MAX_EXPECTATIONS = 5;
/** Quantos eixos NÃO pedidos podem entrar, quando são notáveis. */
const MAX_UNREQUESTED = 2;

/**
 * "O que você deve perceber?" (§35)
 *
 * ═══ OS DOIS DEFEITOS QUE ISTO CORRIGE (v2.28.0) ═════════════════════════════════════════════
 *
 * Reclamação do usuário: o relatório dele abria a linha `Spin: trajetória mais plana; o spin
 * dependerá mais da sua técnica` — sendo que ele não tinha pedido spin, e spin era secundário na
 * análise dele. Investigando, eram dois defeitos empilhados.
 *
 * ─── 1. A FUNÇÃO NÃO SABIA O QUE A PESSOA PEDIU ────────────────────────────────────────────
 *
 * Ela recebia só `RankedRacket`. Sem `profile`, era IMPOSSÍVEL distinguir o eixo que decidiu a
 * recomendação daquele que a pessoa nunca mencionou — e os dois saíam com o mesmo peso visual,
 * no mesmo bloco. Uma seção chamada "o que você deve perceber" que abre com um eixo que o leitor
 * não pediu gasta a atenção dele no lugar errado.
 *
 * ─── 2. O LADO POSITIVO ERA INALCANÇÁVEL EM TRÊS EIXOS ─────────────────────────────────────
 *
 * Os limiares eram absolutos (>= 65 e <= 40) sobre atributos derivados, que regridem ao centro —
 * o mesmo erro de unidades que `catalog-scale.ts` já corrigiu no resto do motor. Medido no
 * catálogo de produção (47 variantes):
 *
 *     potência       21 … 57     0 raquetes >= 65     26 <= 40
 *     spin           21 … 55     0 raquetes >= 65      9 <= 40
 *     estabilidade   40 … 62     0 raquetes >= 65      1 <= 40
 *     controle       44 … 81     6 raquetes >= 65      0 <= 40
 *     conforto       45 … 65     2 raquetes >= 65      0 <= 40
 *     manobra        41 … 69     1 raquete  >= 65      0 <= 40
 *
 * Em potência, spin e estabilidade a frase POSITIVA não podia ser exibida a ninguém, nunca — não
 * existe raquete no catálogo que alcance o limiar. Só a negativa disparava. O resultado agregado:
 * média de 1,0 linha por raquete, das quais 0,8 eram limitação, e 18 das 47 raquetes não
 * produziam linha nenhuma — a seção saía vazia para 38% do catálogo.
 *
 * Somados, os dois defeitos faziam uma seção que se apresenta como "o que esperar em quadra"
 * funcionar como lista de defeitos em eixos aleatórios. Não é honestidade — é ruído com cara de
 * honestidade, e ele desloca a atenção de onde o trade-off REAL está.
 *
 * ─── POR QUE ISTO NÃO ESCONDE TRADE-OFF ────────────────────────────────────────────────────
 *
 * Porque o trade-off tem seção própria, e mais bem feita: `buildTradeOffs` já mede por posição de
 * catálogo, já parte do que o jogador pediu, e já diz o que a alternativa custaria no ranking
 * real. Um eixo pedido em que a raquete entrega menos aparece LÁ, com o raciocínio junto — e é
 * por isso que aqui os eixos já cobertos por um trade-off são pulados: repetir a limitação em dois
 * blocos vizinhos, num deles sem o raciocínio, é o que fazia a leitura parecer contraditória.
 *
 * O que continua garantido: todo eixo que a pessoa DECLAROU aparece, com o lado que for — alto,
 * médio ou baixo. Se ela pediu spin e a raquete é fraca em spin, ela lê isso. O que deixou de
 * acontecer é a raquete ser julgada em público num eixo que ninguém perguntou.
 */
export function explainExpectations(
  ranked: RankedRacket,
  profile: PlayerProfile,
  bands: Readonly<Record<string, readonly [number, number]>>,
  coveredByTradeOff: readonly NeedKey[] = [],
): string[] {
  const a = ranked.racket.attributes;
  const declared = new Set(profile.declared_priorities);
  const covered = new Set(coveredByTradeOff);

  const position = (axis: ExpectationAxis): number | null => {
    const band = bands[axis.attribute];
    if (!band || band[1] <= band[0]) return null;
    return Math.max(0, Math.min(100, ((axis.value(a) - band[0]) / (band[1] - band[0])) * 100));
  };

  const line = (axis: ExpectationAxis, pos: number): string =>
    `**${axis.label}:** ${pos >= EXPECTATION_HIGH ? axis.high : axis.low}`;

  const pedidos: string[] = [];
  const pedidosNoMeio: string[] = [];
  const extras: Array<{ line: string; distance: number }> = [];

  for (const axis of EXPECTATION_AXES) {
    const pos = position(axis);
    if (pos === null) continue;
    const notavel = pos >= EXPECTATION_HIGH || pos <= EXPECTATION_LOW;

    if (declared.has(axis.need)) {
      // Eixo pedido entra sempre — mas os que não têm destaque saem AGRUPADOS, ver abaixo.
      if (notavel) pedidos.push(line(axis, pos));
      else pedidosNoMeio.push(axis.label);
      continue;
    }

    // Eixo não pedido: só quando é notável, e nunca repetindo o que a seção de atenção já disse.
    if (covered.has(axis.need)) continue;
    if (!notavel) continue;
    extras.push({ line: line(axis, pos), distance: Math.abs(pos - 50) });
  }

  /*
    OS EIXOS PEDIDOS SEM DESTAQUE SAEM EM UMA LINHA SÓ.

    Eles precisam ser ditos: quem pediu potência tem o direito de saber que a raquete não é um
    destaque em potência, mesmo quando isso não vira uma troca (`buildTradeOffs` só dispara quando
    o déficit contra a referência é relevante). O que não pode é virar três linhas seguidas com a
    mesma frase, que foi o que a primeira versão desta correção produziu — medido, a maioria dos
    relatórios saía com "no meio do catálogo" repetido, e uma seção que se repete deixa de ser lida.

    Agrupados, os eixos são NOMEADOS e a informação continua inteira, em uma linha que se lê.
  */
  if (pedidosNoMeio.length > 0) {
    const eixos = listPt(pedidosNoMeio);
    pedidos.push(
      pedidosNoMeio.length === 1
        ? `**${eixos}:** no meio do catálogo — não é aqui que esta raquete se destaca, e também ` +
          `não é aqui que ela decepciona.`
        : `**${eixos}:** a raquete fica no meio do catálogo nesses eixos que você pediu. Ela não ` +
          `decepciona em nenhum deles, e também não é neles que se destaca — o encaixe com você ` +
          `vem do conjunto.`,
    );
  }

  /*
    A ORDEM é a do questionário, não a do catálogo.

    `declared_priorities` já chega ordenado pelo que a pessoa colocou em 1º, e `EXPECTATION_AXES`
    preserva essa ordem para os pedidos. Os extras entram depois, do mais notável para o menos —
    quem não foi perguntado não disputa o topo da lista com quem foi.
  */
  const ordenados = [...pedidos];
  extras.sort((x, y) => y.distance - x.distance);
  for (const extra of extras.slice(0, MAX_UNREQUESTED)) {
    if (ordenados.length >= MAX_EXPECTATIONS) break;
    ordenados.push(extra.line);
  }

  if (ordenados.length === 0) {
    ordenados.push(
      'Esta raquete não se destaca nem decepciona em nenhum eixo isolado — o encaixe dela com ' +
        'você está no conjunto, não em uma característica única.',
    );
  }

  return ordenados.slice(0, MAX_EXPECTATIONS);
}

/** Explicação da corda (§36). */
export function explainString(rec: StringRecommendation): string[] {
  const out = [...rec.rationale];
  if (rec.gauge_note) out.push(rec.gauge_note);
  if (rec.variant.availability_warning) out.push(rec.variant.availability_warning);

  /**
   * Modelos que a análise não conseguiu separar da escolhida — ditos, nunca omitidos.
   *
   * Cinco multifilamentos do catálogo têm atributos numericamente idênticos entre si, porque os
   * números vêm de quatro rótulos qualitativos que eles compartilham. Apresentar um deles como "a
   * escolha" e calar sobre os outros seria afirmar uma distinção que não foi feita — e tirar do
   * jogador os únicos critérios capazes de decidir ali: preço, o que a loja dele tem, a marca que
   * ele já usa. São critérios legítimos que o motor não tem, e fingir que tem é o oposto do que
   * este relatório vende.
   */
  const equivalents = rec.equivalents ?? [];
  if (equivalents.length > 0) {
    out.push(
      `Nossa análise não distingue esta corda de ${listPt(equivalents)}: com os dados publicados ` +
        `deste catálogo, elas se comportam igual. Se alguma estiver mais barata ou for a que seu ` +
        `encordoador tem, pode trocar sem prejuízo para a recomendação.`,
    );
  }

  out.push(...rec.excluded_types);
  return out;
}

/** "A, B e C" — lista em português, com "e" antes do último. */
function listPt(items: readonly string[]): string {
  if (items.length === 1) return items[0]!;
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

/** Explicação da tensão (§36) — mostra COMO chegamos ao número, sem fingir precisão. */
export function explainTension(tension: TensionRecommendation): string[] {
  const out: string[] = [];

  out.push(
    `Partimos de ${round(tension.base_lbs, 1)} lbs, ` +
      (tension.base_source === 'manufacturer_range'
        ? 'o ponto médio da faixa recomendada pelo fabricante para este frame,'
        : 'uma base conservadora (a faixa do fabricante ainda não foi confirmada para este modelo),') +
      ' e ajustamos a partir do seu perfil.',
  );

  /**
   * ═══ A CONTA PRECISA FECHAR NA TELA (v2.28.0) ══════════════════════════════════════════════
   *
   * Reclamação do usuário, com o relatório aberto: base 55 lbs, ajustes listados de −3, −2,1 e
   * −1,3, e resultado final 50 lbs. Ou seja, ele lia −6,4 de ajuste e via −5 de resultado, sem
   * nada na página explicando os 1,4 lbs de diferença.
   *
   * Havia QUATRO fontes de divergência, e nenhuma delas aparecia:
   *
   *   1. `slice(0, 3)` mostra os três maiores ajustes e cala sobre os demais, sem dizer que
   *      existem — quem soma o que está na tela nunca chega ao subtotal real.
   *   2. A ancoragem na tensão atual mistura o valor calculado com o que a pessoa já usa.
   *   3. Os clamps de segurança (limite do tipo de corda, faixa do fabricante) podem mover o
   *      número, e a nota dizia que houve ajuste sem dizer de quanto para quanto.
   *   4. O arredondamento final para lbs inteiro.
   *
   * Um relatório que mostra parcelas e um total que não bate com elas destrói a confiança em
   * TODO o resto — e este produto vende justamente a auditabilidade da conta (§48). O conserto é
   * mostrar as etapas que faltavam, não esconder as parcelas.
   */
  const ordenados = [...tension.adjustments].sort(
    (a, b) => Math.abs(b.delta_lbs) - Math.abs(a.delta_lbs),
  );
  const MOSTRADOS = 3;
  for (const adj of ordenados.slice(0, MOSTRADOS)) {
    out.push(`${adj.delta_lbs > 0 ? '+' : ''}${adj.delta_lbs} lbs — ${adj.rationale}`);
  }

  const resto = ordenados.slice(MOSTRADOS);
  if (resto.length > 0) {
    const soma = round(
      resto.reduce((s, a) => s + a.delta_lbs, 0),
      1,
    );
    out.push(
      `${soma > 0 ? '+' : ''}${soma} lbs — outros ${resto.length} ` +
        `${resto.length === 1 ? 'ajuste menor' : 'ajustes menores'} do seu perfil, somados.`,
    );
  }

  const somaAjustes = round(
    tension.adjustments.reduce((s, a) => s + a.delta_lbs, 0),
    1,
  );
  if (tension.adjustments.length > 0) {
    out.push(
      `Somados, os ajustes levam a base de ${round(tension.base_lbs, 1)} lbs para ` +
        `${round(tension.base_lbs + somaAjustes, 1)} lbs.`,
    );
  }

  if (tension.anchored_to_current) {
    out.push(
      `Também consideramos a tensão que você usa hoje e o que você achou dela: essa é a ` +
        `evidência mais concreta disponível, e ela pesou ${Math.round(tension.anchor_weight * 100)}% no resultado.`,
    );
  }

  out.push(...tension.notes);

  /*
    O último passo da conta: o arredondamento.

    Só é dito quando explica uma diferença que o leitor consegue VER — encordoador não regula
    máquina em décimo de libra, e anunciar "arredondamos de 50,0 para 50" seria ruído.
  */
  const antes = tension.pre_clamp_lbs;
  if (antes != null && tension.clamped_by === null && Math.abs(antes - tension.lbs) >= 0.1) {
    out.push(
      `A conta fechou em ${round(antes, 1)} lbs e arredondamos para ${tension.lbs} — é assim que ` +
        `a tensão é regulada na máquina.`,
    );
  }

  out.push(tension.guidance);

  return out;
}

/** Explicação da combinação frame + corda + tensão (§36). */
export function explainCombination(
  ranked: RankedRacket,
  rec: StringRecommendation,
  tension: TensionRecommendation,
): string {
  const frame = ranked.racket.attributes;
  const isPowerful = frame.power_score >= 60;

  return (
    `O conjunto funciona porque as três peças se compensam. ` +
    (isPowerful
      ? `O frame entrega potência, então a corda e a tensão foram escolhidas para segurar a bola dentro da quadra. `
      : `O frame é mais contido, então a corda e a tensão trabalham para não tirar profundidade do seu jogo. `) +
    `Começar em ${formatTension(tension.lbs)} com ${rec.variant.model.brand} ` +
    `${rec.variant.model.model} ${rec.variant.variant.gauge_mm.toFixed(2)} mm dá um ponto de ` +
    `partida ajustável: encordoamento é o componente mais barato e mais reversível do setup, e é ` +
    `por ele que você deve calibrar antes de pensar em trocar de raquete novamente.`
  );
}

/** Comparação com a raquete atual (§22). */
export function explainTransition(transition: TransitionAnalysis): string[] {
  if (!transition.available) return [...transition.attention_points];
  return [...transition.expectations, ...transition.attention_points];
}

/** Texto de abertura do relatório (§64). */
export function explainHeadline(
  ranked: RankedRacket,
  hasTie: boolean,
): string {
  const base = `Esta foi a raquete com maior compatibilidade com o perfil que você informou.`;
  if (!hasTie) return base;
  return (
    base +
    ` Vale dizer com clareza: a segunda colocada ficou tecnicamente empatada com ela. ` +
    `Nesse caso a escolha é de preferência pessoal, e um teste em quadra resolve melhor que ` +
    `qualquer cálculo.`
  );
}

/** Comparação de conforto (§36) — sem linguagem clínica (§17). */
export function explainComfort(
  ranked: RankedRacket,
  profile: PlayerProfile,
  current: ScoredRacket | null,
): string[] {
  const out: string[] = [];
  const a = ranked.racket.attributes;

  if (profile.arm_sensitivity_score === 0) {
    out.push(
      'Você não relatou desconforto recorrente, então o conforto entrou na análise com peso ' +
        'padrão — sem descartar frames por rigidez.',
    );
  } else {
    out.push(
      `Você relatou desconforto em ${profile.discomfort_areas.join(', ')}. Isso elevou o peso do ` +
        `conforto na análise e excluiu frames rígidos e cordas de poliéster duras.`,
    );
    if (current && current.variant.specs.beam_width_mm !== null) {
      out.push(
        'Compare também com o perfil do quadro do seu equipamento atual antes de decidir: quadros ' +
          'mais largos tendem a ser mais rígidos.',
      );
    }
  }

  if (a.arm_friendliness_score >= 65) {
    out.push('O frame recomendado está entre os mais amigáveis ao braço do catálogo avaliado.');
  }

  out.push(
    'Equipamento adequado ajuda, mas não substitui a avaliação de um profissional de saúde.',
  );

  return out;
}
