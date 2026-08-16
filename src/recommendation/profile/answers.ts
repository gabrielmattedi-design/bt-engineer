/**
 * Forma tipada das respostas do questionário — docs/QUESTIONNAIRE.md.
 *
 * Esta é a fronteira entre a UI e o domínio. `null` significa "não respondeu"; `'nao_sei'` é uma
 * resposta legítima e distinta, que reduz a confiança sem ser tratada como erro (§24).
 */

export type TriState = 'sim' | 'as_vezes' | 'nao';

export type QuestionnaireAnswers = {
  // Etapa 1 — perfil físico
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  dominant_hand: 'destro' | 'canhoto' | null;
  perceived_strength: 'abaixo' | 'media' | 'acima' | 'bem_acima' | null;
  fitness_level: 'sedentario' | 'moderado' | 'bom' | 'atletico' | null;

  // Etapa 2 — experiência
  experience_duration: 'menos_6m' | '6_12m' | '1_2a' | '2_5a' | 'mais_5a' | null;
  frequency_per_week: number | null;
  has_lessons: 'nunca' | 'ja_fiz' | 'atualmente' | null;
  plays_matches: 'sim' | 'as_vezes' | 'nao' | null;
  tournament_experience: 'nunca' | 'amadores' | 'regionais' | 'competitivo' | null;
  perceived_level:
    | 'iniciante'
    | 'iniciante_avancado'
    | 'intermediario'
    | 'intermediario_avancado'
    | 'avancado'
    | null;

  // Calibração objetiva
  can_sustain_rally: TriState | null;
  can_direct_ball: TriState | null;
  can_generate_spin: TriState | null;
  can_vary_depth: TriState | null;
  reliable_second_serve: TriState | null;

  // Etapa 3 — estilo
  play_style: readonly string[];
  forehand_type: 'topspin_pesado' | 'topspin_moderado' | 'mais_chapado' | 'nao_sei' | null;
  backhand_hands: 'uma_mao' | 'duas_maos' | null;
  swing_length: 'curto' | 'medio' | 'longo' | 'nao_sei' | null;
  swing_speed: 'lenta' | 'moderada' | 'rapida' | 'muito_rapida' | 'nao_sei' | null;

  // Etapa 4 — comportamento das bolas
  depth_control: TriState | null;
  ball_tendency: readonly string[];
  /** Ordenadas por prioridade. A ordem é a entrada mais influente do vetor de necessidades. */
  missing_attributes: readonly string[];

  // Etapa 5 — raquete atual
  no_current_racket: boolean;
  current_racket_id: string | null;
  current_racket_free_text: string | null;
  current_racket_likes: readonly string[];
  current_racket_dislikes: readonly string[];

  // Etapa 6 — corda atual e conforto
  current_string_id: string | null;
  current_string_gauge: number | null;
  current_tension_lbs: number | null;
  current_tension_feeling:
    | 'muito_solta'
    | 'um_pouco_solta'
    | 'ideal'
    | 'um_pouco_dura'
    | 'muito_dura'
    | 'nao_sei'
    | null;
  string_breakage: 'nunca' | 'raramente' | 'a_cada_2_3_meses' | 'mensalmente' | 'semanalmente' | null;
  discomfort_areas: readonly string[];
  /** Ativo ou encerrado — a distinção que mais muda a recomendação. */
  discomfort_status: 'atual' | 'passado' | null;
  /**
   * Quando foi a última vez. Só perguntado a quem respondeu `passado`.
   *
   * `agora` permanece no tipo porque questionários já respondidos usaram esse valor, e um perfil
   * gravado não pode deixar de ser legível porque a pergunta mudou de forma.
   */
  discomfort_when: 'agora' | 'ultimos_meses' | 'ano_passado' | 'ha_mais_tempo' | null;
  /** Intensidade. "Incomoda" e "me tira da quadra" pedem respostas muito diferentes. */
  discomfort_intensity: 'leve' | 'moderada' | 'forte' | null;
  /**
   * O desconforto veio do tênis?
   *
   * É o filtro que faltava. Um cotovelo machucado na academia não diz nada sobre a raquete estar
   * errada; o mesmo cotovelo machucado jogando é o sinal mais forte do questionário. Sem esta
   * pergunta os dois casos entravam idênticos no motor.
   */
  discomfort_from_tennis: 'sim' | 'nao' | 'nao_sei' | null;
  /** Orçamento para a corda. Opcional — sem resposta, a necessidade é inferida do uso declarado. */
  string_budget: 'economico' | 'equilibrado' | 'sem_limite' | null;

  // Etapa 7 — objetivo e texto livre
  /**
   * Primeiro nome, só para personalizar o card compartilhável.
   *
   * Não entra em cálculo nenhum e não é obrigatório. Fica separado do resto do perfil por isso:
   * é dado de apresentação, não de análise.
   */
  player_name: string | null;
  objective: readonly string[];
  free_text: string | null;
};

export function emptyAnswers(): QuestionnaireAnswers {
  return {
    age: null,
    height_cm: null,
    weight_kg: null,
    dominant_hand: null,
    perceived_strength: null,
    fitness_level: null,
    experience_duration: null,
    frequency_per_week: null,
    has_lessons: null,
    plays_matches: null,
    tournament_experience: null,
    perceived_level: null,
    can_sustain_rally: null,
    can_direct_ball: null,
    can_generate_spin: null,
    can_vary_depth: null,
    reliable_second_serve: null,
    play_style: [],
    forehand_type: null,
    backhand_hands: null,
    swing_length: null,
    swing_speed: null,
    depth_control: null,
    ball_tendency: [],
    missing_attributes: [],
    no_current_racket: false,
    current_racket_id: null,
    current_racket_free_text: null,
    current_racket_likes: [],
    current_racket_dislikes: [],
    current_string_id: null,
    current_string_gauge: null,
    current_tension_lbs: null,
    current_tension_feeling: null,
    string_breakage: null,
    discomfort_areas: [],
    discomfort_status: null,
    discomfort_when: null,
    discomfort_intensity: null,
    discomfort_from_tennis: null,
    string_budget: null,
    objective: [],
    player_name: null,
    free_text: null,
  };
}

/**
 * Perguntas que contam para `unknown_answer_ratio`.
 *
 * Perguntas puladas por lógica condicional NÃO entram — apenas as efetivamente respondidas com
 * "não sei" ou deixadas em branco (docs/QUESTIONNAIRE.md, seção de confiança).
 */
export function countUnknowns(a: QuestionnaireAnswers): { unknown: number; answerable: number } {
  const base: Array<unknown> = [
    a.age,
    a.height_cm,
    a.weight_kg,
    a.perceived_strength,
    a.fitness_level,
    a.experience_duration,
    a.frequency_per_week,
    a.has_lessons,
    a.tournament_experience,
    a.perceived_level,
    a.can_sustain_rally,
    a.can_direct_ball,
    a.can_generate_spin,
    a.can_vary_depth,
    a.reliable_second_serve,
    a.forehand_type,
    a.backhand_hands,
    a.swing_length,
    a.swing_speed,
    a.depth_control,
  ];

  // Etapa de equipamento só é contabilizada se o jogador declarou ter raquete.
  if (!a.no_current_racket) {
    base.push(a.current_racket_id ?? a.current_racket_free_text);
    base.push(a.current_string_id);
    base.push(a.current_tension_lbs);
    base.push(a.current_tension_feeling);
    base.push(a.string_breakage);
  }

  let unknown = 0;
  for (const v of base) {
    if (v === null || v === undefined || v === 'nao_sei') unknown += 1;
  }
  return { unknown, answerable: base.length };
}
