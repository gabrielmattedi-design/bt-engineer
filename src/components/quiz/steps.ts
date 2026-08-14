/**
 * Definição declarativa do questionário — docs/QUESTIONNAIRE.md.
 *
 * As perguntas vivem em DADOS, não em JSX. Isso permite: renderizar uma pergunta por tela sem
 * duplicar markup, aplicar lógica condicional num único lugar, calcular o progresso real, e
 * versionar o questionário (§61) sem tocar em componentes.
 */

import type { QuestionnaireAnswers } from '@/recommendation/profile/answers';

export type Choice = {
  readonly value: string;
  readonly label: string;
  /** Frase curta de apoio — o usuário médio não sabe responder "comprimento do swing" sem referência. */
  readonly hint?: string;
};

export type Question =
  | {
      readonly kind: 'single';
      readonly key: keyof QuestionnaireAnswers;
      readonly title: string;
      readonly help?: string;
      readonly choices: readonly Choice[];
    }
  | {
      readonly kind: 'multi';
      readonly key: keyof QuestionnaireAnswers;
      readonly title: string;
      readonly help?: string;
      readonly max: number;
      /** true = a ORDEM de seleção importa (§14: prioridades ordenadas). */
      readonly ranked?: boolean;
      readonly choices: readonly Choice[];
    }
  | {
      readonly kind: 'number';
      readonly key: keyof QuestionnaireAnswers;
      readonly title: string;
      readonly help?: string;
      readonly min: number;
      readonly max: number;
      readonly step?: number;
      readonly unit: string;
    }
  | {
      readonly kind: 'text';
      readonly key: keyof QuestionnaireAnswers;
      readonly title: string;
      readonly help?: string;
      readonly placeholder: string;
      readonly maxLength: number;
    };

export type Step = {
  readonly id: string;
  readonly label: string;
  readonly questions: readonly Question[];
  /** Etapa pulada quando retorna false — lógica condicional (docs/QUESTIONNAIRE.md). */
  readonly showIf?: (a: QuestionnaireAnswers) => boolean;
  /** Aviso exibido no topo da etapa. */
  readonly notice?: string;
};

const TRI: readonly Choice[] = [
  { value: 'sim', label: 'Sim' },
  { value: 'as_vezes', label: 'Às vezes' },
  { value: 'nao', label: 'Não' },
];

export const STEPS: readonly Step[] = [
  {
    id: 'fisico',
    label: 'Perfil físico',
    questions: [
      { kind: 'number', key: 'age', title: 'Qual sua idade?', min: 10, max: 90, unit: 'anos' },
      { kind: 'number', key: 'height_cm', title: 'Sua altura', min: 140, max: 210, unit: 'cm' },
      { kind: 'number', key: 'weight_kg', title: 'Seu peso', min: 35, max: 150, unit: 'kg' },
      {
        kind: 'single',
        key: 'dominant_hand',
        title: 'Mão dominante',
        choices: [
          { value: 'destro', label: 'Destro' },
          { value: 'canhoto', label: 'Canhoto' },
        ],
      },
      {
        kind: 'single',
        key: 'perceived_strength',
        title: 'Como você descreveria sua força física?',
        choices: [
          { value: 'abaixo', label: 'Abaixo da média' },
          { value: 'media', label: 'Média' },
          { value: 'acima', label: 'Acima da média' },
          { value: 'bem_acima', label: 'Bem acima da média' },
        ],
      },
      {
        kind: 'single',
        key: 'fitness_level',
        title: 'E seu condicionamento?',
        choices: [
          { value: 'sedentario', label: 'Sedentário' },
          { value: 'moderado', label: 'Moderado' },
          { value: 'bom', label: 'Bom' },
          { value: 'atletico', label: 'Atlético' },
        ],
      },
    ],
  },

  {
    id: 'experiencia',
    label: 'Experiência',
    questions: [
      {
        kind: 'single',
        key: 'experience_duration',
        title: 'Há quanto tempo você joga?',
        choices: [
          { value: 'menos_6m', label: 'Menos de 6 meses' },
          { value: '6_12m', label: '6 a 12 meses' },
          { value: '1_2a', label: '1 a 2 anos' },
          { value: '2_5a', label: '2 a 5 anos' },
          { value: 'mais_5a', label: 'Mais de 5 anos' },
        ],
      },
      {
        kind: 'single',
        key: 'frequency_per_week',
        title: 'Quantas vezes por semana você joga?',
        choices: [
          { value: '1', label: '1×' },
          { value: '2', label: '2×' },
          { value: '3', label: '3×' },
          { value: '4', label: '4×' },
          { value: '5', label: '5× ou mais' },
        ],
      },
      {
        kind: 'single',
        key: 'has_lessons',
        title: 'Você faz ou já fez aulas?',
        choices: [
          { value: 'nunca', label: 'Nunca fiz' },
          { value: 'ja_fiz', label: 'Já fiz' },
          { value: 'atualmente', label: 'Faço atualmente' },
        ],
      },
      {
        kind: 'single',
        key: 'plays_matches',
        title: 'Você joga partidas regularmente?',
        choices: [
          { value: 'sim', label: 'Sim' },
          { value: 'as_vezes', label: 'Às vezes' },
          { value: 'nao', label: 'Não' },
        ],
      },
      {
        kind: 'single',
        key: 'tournament_experience',
        title: 'Participa ou já participou de torneios?',
        choices: [
          { value: 'nunca', label: 'Nunca' },
          { value: 'amadores', label: 'Amadores ou internos' },
          { value: 'regionais', label: 'Regionais' },
          { value: 'competitivo', label: 'Competitivo' },
        ],
      },
      {
        kind: 'single',
        key: 'perceived_level',
        title: 'Como você se classificaria?',
        choices: [
          { value: 'iniciante', label: 'Iniciante' },
          { value: 'iniciante_avancado', label: 'Iniciante avançado' },
          { value: 'intermediario', label: 'Intermediário' },
          { value: 'intermediario_avancado', label: 'Intermediário avançado' },
          { value: 'avancado', label: 'Avançado' },
        ],
      },
    ],
  },

  {
    id: 'calibracao',
    label: 'Calibração',
    notice:
      'Sem julgamento — estas perguntas só nos ajudam a calibrar a análise. Elas pesam mais que a ' +
      'autoavaliação, porque são mais fáceis de responder com precisão.',
    questions: [
      {
        kind: 'single',
        key: 'can_sustain_rally',
        title: 'Consegue sustentar trocas de fundo de 10 ou mais bolas?',
        choices: TRI,
      },
      {
        kind: 'single',
        key: 'can_direct_ball',
        title: 'Consegue direcionar a bola com intenção (cruzado ou paralela)?',
        choices: TRI,
      },
      {
        kind: 'single',
        key: 'can_generate_spin',
        title: 'Consegue gerar spin conscientemente?',
        help: 'Fazer a bola girar de propósito, não por acaso.',
        choices: TRI,
      },
      {
        kind: 'single',
        key: 'can_vary_depth',
        title: 'Consegue variar a profundidade da bola?',
        choices: TRI,
      },
      {
        kind: 'single',
        key: 'reliable_second_serve',
        title: 'Você tem um segundo saque confiável?',
        choices: TRI,
      },
    ],
  },

  {
    id: 'estilo',
    label: 'Estilo de jogo',
    questions: [
      {
        kind: 'multi',
        key: 'play_style',
        title: 'Qual descrição mais combina com você?',
        help: 'Escolha até duas.',
        max: 2,
        choices: [
          { value: 'dominar_fundo', label: 'Gosto de dominar do fundo' },
          { value: 'muito_topspin', label: 'Jogo com muito topspin' },
          { value: 'mais_chapado', label: 'Bato mais chapado' },
          { value: 'atacar_cedo', label: 'Gosto de atacar cedo' },
          { value: 'contra_atacar', label: 'Contra-ataco usando a força do adversário' },
          { value: 'all_court', label: 'Jogo all court' },
          { value: 'subir_rede', label: 'Gosto de subir à rede' },
          { value: 'sem_estilo', label: 'Ainda não tenho estilo definido' },
        ],
      },
      {
        kind: 'single',
        key: 'forehand_type',
        title: 'Seu forehand é…',
        choices: [
          { value: 'topspin_pesado', label: 'Topspin pesado' },
          { value: 'topspin_moderado', label: 'Topspin moderado' },
          { value: 'mais_chapado', label: 'Mais chapado' },
          { value: 'nao_sei', label: 'Não sei' },
        ],
      },
      {
        kind: 'single',
        key: 'backhand_hands',
        title: 'Seu backhand é…',
        choices: [
          { value: 'uma_mao', label: 'De uma mão' },
          { value: 'duas_maos', label: 'De duas mãos' },
        ],
      },
      {
        kind: 'single',
        key: 'swing_length',
        title: 'Como é o comprimento do seu swing?',
        choices: [
          { value: 'curto', label: 'Curto', hint: 'Preparação compacta, pouco loop.' },
          { value: 'medio', label: 'Médio', hint: 'Preparação equilibrada.' },
          { value: 'longo', label: 'Longo', hint: 'Preparação ampla, loop grande.' },
          { value: 'nao_sei', label: 'Não sei' },
        ],
      },
      {
        kind: 'single',
        key: 'swing_speed',
        title: 'E a velocidade do seu swing?',
        choices: [
          { value: 'lenta', label: 'Lenta', hint: 'Priorizo colocar a bola na quadra.' },
          { value: 'moderada', label: 'Moderada', hint: 'Acelero quando a bola permite.' },
          { value: 'rapida', label: 'Rápida', hint: 'Acelero na maioria das bolas.' },
          { value: 'muito_rapida', label: 'Muito rápida', hint: 'Bato forte por padrão.' },
          { value: 'nao_sei', label: 'Não sei' },
        ],
      },
    ],
  },

  {
    id: 'bolas',
    label: 'Comportamento das bolas',
    questions: [
      {
        kind: 'single',
        key: 'depth_control',
        title: 'Você consegue gerar profundidade com facilidade?',
        choices: TRI,
      },
      {
        kind: 'multi',
        key: 'ball_tendency',
        title: 'Suas bolas costumam…',
        help: 'Escolha até duas.',
        max: 2,
        choices: [
          { value: 'caem_curtas', label: 'Cair curtas' },
          { value: 'passam_da_linha', label: 'Passar da linha' },
          { value: 'vao_para_rede', label: 'Ir para a rede' },
          { value: 'variam_demais', label: 'Variar demais' },
          { value: 'geralmente_boa_profundidade', label: 'Geralmente têm boa profundidade' },
        ],
      },
      {
        kind: 'multi',
        key: 'missing_attributes',
        title: 'Você sente falta de…',
        help: 'Escolha até três, na ordem de importância para você. A ordem importa.',
        max: 3,
        ranked: true,
        choices: [
          { value: 'power', label: 'Potência' },
          { value: 'control', label: 'Controle' },
          { value: 'spin', label: 'Spin' },
          { value: 'stability', label: 'Estabilidade' },
          { value: 'comfort', label: 'Conforto' },
          { value: 'maneuverability', label: 'Manobrabilidade' },
          { value: 'precision', label: 'Precisão' },
        ],
      },
    ],
  },

  {
    id: 'equipamento',
    label: 'Equipamento atual',
    showIf: (a) => !a.no_current_racket,
    questions: [
      {
        kind: 'multi',
        key: 'current_racket_likes',
        title: 'O que você gosta na sua raquete atual?',
        help: 'Pode escolher mais de uma. Se não tiver raquete própria, siga adiante.',
        max: 4,
        choices: [
          { value: 'gosto_da_potencia', label: 'Gosto da potência' },
          { value: 'gosto_do_controle', label: 'Gosto do controle' },
          { value: 'gosto_do_spin', label: 'Gosto do spin' },
          { value: 'gosto_do_peso', label: 'Gosto do peso' },
          { value: 'gosto_da_estabilidade', label: 'Gosto da estabilidade' },
          { value: 'gosto_do_conforto', label: 'Gosto do conforto' },
        ],
      },
      {
        kind: 'multi',
        key: 'current_racket_dislikes',
        title: 'E o que não gosta?',
        help: 'Esta resposta influencia bastante a recomendação.',
        max: 4,
        choices: [
          { value: 'falta_estabilidade', label: 'Falta estabilidade' },
          { value: 'acho_pesada', label: 'Acho pesada' },
          { value: 'acho_leve', label: 'Acho leve' },
          { value: 'dificuldade_acelerar', label: 'Sinto dificuldade para acelerar' },
          { value: 'falta_potencia', label: 'Falta potência' },
          { value: 'falta_controle', label: 'Falta controle' },
          { value: 'sinto_vibracao', label: 'Sinto vibração' },
          { value: 'muito_exigente', label: 'Parece muito exigente' },
        ],
      },
      {
        kind: 'number',
        key: 'current_tension_lbs',
        title: 'Em quantas libras você encordoa hoje?',
        help: 'Se não souber, siga adiante — a pergunta é opcional.',
        min: 35,
        max: 70,
        unit: 'lbs',
      },
      {
        kind: 'single',
        key: 'current_tension_feeling',
        title: 'O que você acha da tensão atual?',
        help: 'Esta é a informação mais útil que você pode nos dar sobre tensão.',
        choices: [
          { value: 'muito_solta', label: 'Muito solta' },
          { value: 'um_pouco_solta', label: 'Um pouco solta' },
          { value: 'ideal', label: 'Ideal' },
          { value: 'um_pouco_dura', label: 'Um pouco dura' },
          { value: 'muito_dura', label: 'Muito dura' },
          { value: 'nao_sei', label: 'Não sei' },
        ],
      },
      {
        kind: 'single',
        key: 'string_breakage',
        title: 'Com que frequência você arrebenta cordas?',
        choices: [
          { value: 'nunca', label: 'Nunca' },
          { value: 'raramente', label: 'Raramente' },
          { value: 'a_cada_2_3_meses', label: 'A cada 2 ou 3 meses' },
          { value: 'mensalmente', label: 'Mensalmente' },
          { value: 'semanalmente', label: 'Semanalmente' },
        ],
      },
    ],
  },

  {
    id: 'conforto',
    label: 'Conforto',
    notice:
      'Não fazemos diagnóstico. Equipamento adequado ajuda, mas não substitui a avaliação de um ' +
      'profissional de saúde.',
    questions: [
      {
        kind: 'multi',
        key: 'discomfort_areas',
        title: 'Você sente ou já sentiu desconforto recorrente em…',
        max: 3,
        choices: [
          { value: 'cotovelo', label: 'Cotovelo' },
          { value: 'ombro', label: 'Ombro' },
          { value: 'punho', label: 'Punho' },
          { value: 'nenhum', label: 'Nenhum' },
        ],
      },
    ],
  },

  {
    id: 'objetivo',
    label: 'Objetivo',
    questions: [
      {
        kind: 'multi',
        key: 'objective',
        title: 'Você quer potencializar seu jogo atual ou mudar alguma característica dele?',
        help: 'Escolha até duas.',
        max: 2,
        choices: [
          { value: 'potencializar', label: 'Quero potencializar meu jogo atual' },
          { value: 'ganhar_potencia', label: 'Quero ganhar potência' },
          { value: 'ganhar_controle', label: 'Quero ganhar controle' },
          { value: 'mais_spin', label: 'Quero gerar mais spin' },
          { value: 'atacar_mais', label: 'Quero atacar mais' },
          { value: 'mais_conforto', label: 'Quero mais conforto' },
          { value: 'mais_estabilidade', label: 'Quero mais estabilidade' },
          { value: 'mais_facil', label: 'Quero um equipamento mais fácil' },
          { value: 'mais_exigente', label: 'Quero evoluir para algo mais exigente' },
          { value: 'nao_sei', label: 'Ainda não sei' },
        ],
      },
      {
        kind: 'text',
        key: 'free_text',
        title: 'Existe mais alguma coisa sobre seu jogo que você acha importante nos contar?',
        help: 'Opcional. Quanto mais específico, melhor a análise.',
        maxLength: 1200,
        placeholder:
          'Meu forehand é meu principal golpe e uso bastante spin. Meu backhand de duas mãos ' +
          'costuma ficar curto. Atualmente uso uma raquete de 300 g, gosto dela, mas queria um ' +
          'pouco mais de estabilidade sem perder manobrabilidade.',
      },
    ],
  },
];

export function visibleSteps(answers: QuestionnaireAnswers): readonly Step[] {
  return STEPS.filter((step) => !step.showIf || step.showIf(answers));
}
