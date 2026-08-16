import { clamp, round } from '@/domain/scores';
import { NEED_KEYS, type NeedKey } from '@/domain/player-profile';
import type { QuestionnaireAnswers } from './answers';

/**
 * Vetor de necessidades — o que o jogo desta pessoa PEDE de uma raquete.
 *
 * ═══ O DEFEITO QUE ESTE MÓDULO CORRIGE ═══════════════════════════════════════════════════════
 *
 * A versão anterior somava bônus a partir de uma base 50 e quase nunca subtraía. Cada sinal que a
 * pessoa dava — o que sente falta, o objetivo, como as bolas se comportam, o que não gosta na
 * raquete — empurrava algum eixo para cima. Ninguém empurrava nada para baixo.
 *
 * O resultado, visível no radar: um hexágono quase perfeito, alto em tudo. E um perfil que pede
 * tudo não pede nada — se todo usuário precisa de mais potência E mais controle E mais spin E mais
 * estabilidade, o vetor deixa de discriminar e a recomendação passa a ser decidida só por nível e
 * físico. Duas pessoas com jogos opostos recebiam a mesma raquete.
 *
 * ═══ AS QUATRO MUDANÇAS ══════════════════════════════════════════════════════════════════════
 *
 * 1. CONTRASTE. O vetor passa a ser lido como PRIORIDADE RELATIVA, não como nível absoluto. Depois
 *    de somar tudo, o perfil é recentrado na própria média e amplificado. Quem pediu tudo volta
 *    para o neutro — que é a leitura honesta de "não tenho preferência forte" — e quem pediu duas
 *    coisas específicas recebe um vetor afiado nelas.
 *
 * 2. TROCAS EXPLÍCITAS. Vários sinais agora empurram um eixo para cima E outro para baixo, porque é
 *    assim que a física da raquete funciona: quem pede padrão aberto para spin abre mão de
 *    precisão; quem pede massa para estabilidade abre mão de manobrabilidade. Somar os dois lados
 *    era o que produzia o hexágono cheio.
 *
 * 3. CRUZAMENTOS. Um mesmo sintoma tem causas diferentes conforme o resto do perfil, e receitas
 *    opostas. "Minhas bolas caem curtas" com swing lento pede POTÊNCIA; com swing rápido, quase
 *    sempre pede ÂNGULO DE SAÍDA — mais spin e mais lançamento —, e dar potência a quem já tem
 *    swing rápido só aumenta o erro para fora. A versão anterior tratava os dois casos igual.
 *
 * 4. PESOS. Nem todo sinal vale o mesmo. O que a pessoa reclama da raquete que usa hoje é o dado
 *    mais concreto que ela consegue dar — ela sente aquilo toda semana. O que ela "sente falta"
 *    numa lista abstrata é mais fraco, e o objetivo declarado é o mais sujeito a aspiração.
 */

/**
 * Peso de cada FONTE de sinal, do mais concreto ao mais aspiracional.
 *
 * A ordem não é arbitrária: ela reflete o quanto cada resposta está ancorada em experiência
 * vivida. Reclamar que a raquete "treme em bola pesada" é um relato de quadra. Marcar
 * "estabilidade" numa lista de atributos é reconhecimento de vocabulário. Dizer que quer "evoluir
 * para algo mais exigente" é intenção — legítima, e a menos verificável das três.
 */
export const SIGNAL_WEIGHT = {
  /** Reclamação sobre a raquete atual: o jogador convive com o problema. */
  dislike: 1.0,
  /** Comportamento observável das bolas — sintoma concreto, mas com várias causas possíveis. */
  ballTendency: 0.9,
  /** Cruzamento de duas respostas: mais específico que qualquer uma delas sozinha. */
  crossed: 1.0,
  /** Atributo que a pessoa diz sentir falta, ponderado pela ordem de prioridade. */
  missing: 0.75,
  /** Objetivo declarado. */
  objective: 0.6,
} as const;

/** Bônus por posição na lista ordenada de "sente falta de" (§14). */
const PRIORITY_BONUS = [26, 16, 9] as const;

type Delta = Partial<Record<NeedKey, number>>;

/**
 * Alvo de amplitude do vetor final, em pontos acima e abaixo do neutro.
 *
 * 35 coloca a necessidade mais forte perto de 85 e a mais fraca perto de 15 — uma forma que se lê
 * como perfil, não como mancha. Subir mais transformaria diferença pequena em veredicto.
 */
const TARGET_SPREAD = 35;

/**
 * Amplificação máxima. Protege contra transformar ruído em perfil.
 *
 * Quem deu um único sinal fraco tem desvios de 2 ou 3 pontos; multiplicá-los por 15 produziria um
 * radar dramático apoiado em quase nada. Com o teto, esse perfil continua discreto — e é isso que
 * a confiança do relatório já diz em palavras.
 */
const MAX_GAIN = 4;

/** Abaixo deste desvio, o perfil é genuinamente neutro e não há o que amplificar. */
const MIN_SIGNAL = 2;

function add(into: Record<NeedKey, number>, delta: Delta, weight: number): void {
  for (const [key, value] of Object.entries(delta)) {
    into[key as NeedKey] += (value ?? 0) * weight;
  }
}

/**
 * Trocas que a física da raquete impõe.
 *
 * Cada entrada diz: "para ganhar X, abre-se mão de Y". Sem elas o vetor só cresce, e o motor perde
 * a informação mais útil que existe — o que a pessoa está disposta a PERDER.
 */
const DISLIKE_DELTA: Readonly<Record<string, Delta>> = {
  falta_estabilidade: { stability: 30, forgiveness: 8, maneuverability: -12 },
  acho_pesada: { maneuverability: 30, stability: -14, power: 6 },
  acho_leve: { stability: 26, maneuverability: -16 },
  dificuldade_acelerar: { maneuverability: 28, stability: -10 },
  falta_potencia: { power: 30, control: -12 },
  falta_controle: { control: 30, power: -14, precision: 10 },
  sinto_vibracao: { comfort: 32, stability: 6 },
  muito_exigente: { forgiveness: 28, precision: -12, power: 8 },
};

/**
 * O que a pessoa GOSTA na raquete atual não é um pedido — é uma restrição.
 *
 * Ela não quer mais daquilo; ela não quer PERDER aquilo. Tratar como pedido faria o motor procurar
 * um extremo que ela não pediu; ignorar (que era o caso: o campo era coletado e nunca lido) produz
 * o erro oposto e mais grave, que foi relatado em teste — "eu disse que gostava da potência da
 * minha e recebi uma que perde muito em potência".
 *
 * Por isso o efeito aqui é pequeno e o trabalho pesado fica na penalização P9, que cobra da
 * raquete recomendada quando ela perde terreno num eixo declarado como preservado.
 */
const LIKE_TO_NEED: Readonly<Record<string, NeedKey>> = {
  gosto_da_potencia: 'power',
  gosto_do_controle: 'control',
  gosto_do_spin: 'spin',
  gosto_do_peso: 'stability',
  gosto_da_estabilidade: 'stability',
  gosto_do_conforto: 'comfort',
};

/** Eixos que o jogador declarou querer PRESERVAR. Alimenta a penalização P9. */
export function preservedNeeds(a: QuestionnaireAnswers): readonly NeedKey[] {
  /**
   * "Gosto de tudo nela" preserva TODOS os eixos.
   *
   * Quem responde isso não está sem opinião — está dizendo que a raquete atual está boa e que a
   * troca só se justifica por algo claramente melhor. Preservar tudo faz o motor procurar evolução
   * em vez de conceito novo, que é exatamente o pedido.
   */
  if (a.current_racket_dislikes.includes('gosto_de_tudo')) return NEED_KEYS;

  const out = new Set<NeedKey>();
  for (const like of a.current_racket_likes) {
    const need = LIKE_TO_NEED[like];
    if (need) out.add(need);
  }
  return [...out];
}

const isFastSwing = (a: QuestionnaireAnswers): boolean =>
  a.swing_speed === 'rapida' || a.swing_speed === 'muito_rapida';

const isSlowSwing = (a: QuestionnaireAnswers): boolean =>
  a.swing_speed === 'lenta' || a.swing_length === 'curto';

const isAdvanced = (a: QuestionnaireAnswers): boolean =>
  a.perceived_level === 'intermediario_avancado' || a.perceived_level === 'avancado';

const isBeginner = (a: QuestionnaireAnswers): boolean =>
  a.perceived_level === 'iniciante' || a.perceived_level === 'iniciante_avancado';

/**
 * Cruzamentos — o mesmo sintoma com receitas diferentes conforme o resto do perfil.
 *
 * Esta é a parte que faz o vetor deixar de ser uma soma de opiniões e passar a ser um diagnóstico.
 * Cada regra abaixo corresponde a um raciocínio que um bom técnico faria antes de sugerir uma
 * raquete, e que a versão anterior não fazia por tratar cada resposta isoladamente.
 */
function crossedSignals(a: QuestionnaireAnswers): Delta[] {
  const out: Delta[] = [];
  const short = a.ball_tendency.includes('caem_curtas');
  const long = a.ball_tendency.includes('passam_da_linha');
  const erratic = a.ball_tendency.includes('variam_demais');

  // Bola curta: potência resolve quem não gera velocidade; para quem já gera, o problema é ângulo.
  if (short && isSlowSwing(a)) out.push({ power: 26, forgiveness: 8, control: -10 });
  if (short && isFastSwing(a)) out.push({ spin: 24, power: -6, precision: -8 });
  if (short && !isSlowSwing(a) && !isFastSwing(a)) out.push({ power: 14 });

  // Bola longa: quem bate chapado precisa de frame contido; quem gira precisa de padrão que segure.
  if (long && a.forehand_type === 'mais_chapado') out.push({ control: 28, power: -18, precision: 12 });
  if (long && (a.forehand_type === 'topspin_pesado' || a.forehand_type === 'topspin_moderado')) {
    out.push({ control: 20, spin: 14, power: -12 });
  }
  if (long && a.forehand_type === 'nao_sei') out.push({ control: 20, power: -10 });

  /**
   * Inconstância tem duas leituras opostas.
   *
   * No iniciante é o ponto de impacto que varia: pede tolerância — área útil grande, frame que
   * perdoa. No avançado a técnica já é estável, e a variação vem de o frame não devolver a mesma
   * resposta em impactos diferentes: pede precisão e massa, não perdão.
   */
  if (erratic && isBeginner(a)) out.push({ forgiveness: 26, maneuverability: 10, precision: -12 });
  if (erratic && isAdvanced(a)) out.push({ precision: 22, stability: 16, forgiveness: -14 });
  if (erratic && !isBeginner(a) && !isAdvanced(a)) out.push({ forgiveness: 14, stability: 8 });

  // Falta de profundidade declarada na pergunta direta, e não deduzida do comportamento da bola.
  if (a.depth_control === 'nao') {
    out.push(isSlowSwing(a) ? { power: 22, forgiveness: 8 } : { spin: 16, power: 10 });
  }
  if (a.depth_control === 'as_vezes') {
    out.push(isSlowSwing(a) ? { power: 11, forgiveness: 4 } : { spin: 8, power: 5 });
  }

  // Quem não consegue gerar spin não deve receber padrão denso, qualquer que seja o resto.
  if (a.can_generate_spin === 'nao') out.push({ spin: 20, precision: -10 });

  // Quebra de corda frequente indica atrito alto e swing acelerado — padrão aberto é o remédio.
  if (a.string_breakage === 'semanalmente' || a.string_breakage === 'mensalmente') {
    out.push({ spin: 14, comfort: 6 });
  }

  // Braço sensível em quem bate forte: conforto sem abrir mão de massa, que é o que absorve choque.
  if (a.discomfort_areas.some((d) => d !== 'nenhum') && isFastSwing(a)) {
    out.push({ comfort: 26, stability: 10, maneuverability: -8 });
  }

  return out;
}

const OBJECTIVE_DELTA: Readonly<Record<string, Delta>> = {
  mais_potencia: { power: 24, control: -10 },
  mais_controle: { control: 24, power: -12, precision: 8 },
  mais_spin: { spin: 24, precision: -8 },
  mais_conforto: { comfort: 24, stability: 6 },
  mais_estabilidade: { stability: 24, maneuverability: -12 },
  atacar_mais: { power: 16, stability: 10, forgiveness: -8 },
  mais_facil: { forgiveness: 24, maneuverability: 12, precision: -14 },
  mais_exigente: { control: 18, precision: 16, stability: 10, forgiveness: -18 },
};

export type NeedsResult = {
  readonly needs: Record<NeedKey, number>;
  /** Quanto sinal útil a pessoa deu, 0–1. Alimenta a confiança e o texto do relatório. */
  readonly definition: number;
};

export function computeNeeds(
  a: QuestionnaireAnswers,
  armSensitivity: number,
): NeedsResult {
  const raw: Record<NeedKey, number> = {
    power: 0,
    control: 0,
    spin: 0,
    comfort: 0,
    stability: 0,
    maneuverability: 0,
    forgiveness: 0,
    precision: 0,
  };

  // 1. O que incomoda na raquete de hoje — o sinal mais concreto.
  for (const dislike of a.current_racket_dislikes) {
    const delta = DISLIKE_DELTA[dislike];
    if (delta) add(raw, delta, SIGNAL_WEIGHT.dislike);
  }

  // 2. Cruzamentos: sintoma + contexto.
  for (const delta of crossedSignals(a)) add(raw, delta, SIGNAL_WEIGHT.crossed);

  // 3. Atributos que a pessoa sente falta, na ordem que ela priorizou.
  a.missing_attributes.forEach((attr, index) => {
    if (!(NEED_KEYS as readonly string[]).includes(attr)) return;
    add(raw, { [attr as NeedKey]: PRIORITY_BONUS[index] ?? 5 }, SIGNAL_WEIGHT.missing);
  });

  // 4. Objetivo declarado.
  for (const objective of a.objective) {
    const delta = OBJECTIVE_DELTA[objective];
    if (delta) add(raw, delta, SIGNAL_WEIGHT.objective);
  }

  // 5. O que a pessoa gosta: impede que o eixo seja lido como "pode perder".
  for (const need of preservedNeeds(a)) {
    raw[need] = Math.max(raw[need], 0);
  }

  /**
   * ─── CONTRASTE ─────────────────────────────────────────────────────────────────────────────
   *
   * Recentra na média e amplifica. É o passo que transforma "quero tudo" em "não tenho preferência
   * forte", e "quero estas duas coisas" num vetor que o motor consegue seguir.
   */
  const values = NEED_KEYS.map((k) => raw[k]);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const deviations = NEED_KEYS.map((k) => raw[k] - mean);
  const spread = Math.max(...deviations.map(Math.abs));

  const needs: Record<NeedKey, number> = { ...raw };

  if (spread < MIN_SIGNAL) {
    for (const k of NEED_KEYS) needs[k] = 50;
  } else {
    const gain = Math.min(TARGET_SPREAD / spread, MAX_GAIN);
    for (const k of NEED_KEYS) {
      needs[k] = round(clamp(50 + (raw[k] - mean) * gain, 0, 100));
    }
  }

  /**
   * O piso de conforto vem DEPOIS do contraste, e não antes, porque ele não é uma preferência.
   *
   * Quem relata dor no cotovelo não está dizendo que prefere conforto a controle — está dizendo
   * que existe um limite físico. Passar isso pelo contraste permitiria que outro pedido forte o
   * empurrasse para baixo, que é exatamente o que não pode acontecer.
   */
  if (armSensitivity >= 60) needs.comfort = Math.max(needs.comfort, 80);

  /**
   * `definition` mede a força do sinal ORIGINAL, antes da amplificação.
   *
   * Medi-la depois seria circular: o contraste existe justamente para levar todo perfil com algum
   * sinal até a amplitude alvo, então o valor final é ~1 para quase todo mundo e não informa nada.
   * O que o relatório precisa saber é quanto a pessoa de fato diferenciou — e isso está no desvio
   * bruto, que é pequeno para quem respondeu pouco e grande para quem deu sinais consistentes.
   */
  const definition = round(clamp(spread / TARGET_SPREAD, 0, 1), 3);

  return { needs, definition };
}
