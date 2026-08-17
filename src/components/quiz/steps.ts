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

/**
 * Perguntas são OBRIGATÓRIAS por padrão.
 *
 * O questionário inteiro pode ser atravessado sem responder nada, e o motor então trabalha com um
 * perfil vazio: produz um resultado, com aparência normal, apoiado em nada. Exigir resposta é o
 * que faz `unknown_answer_ratio` e a confiança do relatório significarem alguma coisa — se a
 * pessoa pode simplesmente pular, "não sei" deixa de ser uma informação e vira ausência de dado.
 *
 * `optional: true` fica reservado às perguntas em que NÃO responder é uma resposta legítima e
 * distinta — ver os poucos casos marcados abaixo. Marcar por conveniência anula a regra.
 */
export type Question =
  | {
      readonly kind: 'single';
      readonly optional?: boolean;
      /** Pergunta escondida quando devolve false. Some da etapa e da validação. */
      readonly showIf?: (a: QuestionnaireAnswers) => boolean;
      readonly key: keyof QuestionnaireAnswers;
      readonly title: string;
      readonly help?: string;
      readonly choices: readonly Choice[];
    }
  | {
      readonly kind: 'multi';
      readonly optional?: boolean;
      /** Pergunta escondida quando devolve false. Some da etapa e da validação. */
      readonly showIf?: (a: QuestionnaireAnswers) => boolean;
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
      readonly optional?: boolean;
      /** Pergunta escondida quando devolve false. Some da etapa e da validação. */
      readonly showIf?: (a: QuestionnaireAnswers) => boolean;
      readonly key: keyof QuestionnaireAnswers;
      readonly title: string;
      readonly help?: string;
      readonly min: number;
      readonly max: number;
      readonly step?: number;
      readonly unit: string;
    }
  | {
      /**
       * Seleção da raquete atual, buscando no NOSSO catálogo.
       *
       * Existem centenas de modelos no mundo, multiplicados por geração e por peso — pedir para
       * digitar seria pedir um dado que não temos como interpretar. Mas a comparação só é possível
       * contra uma variante cujas especificações nós conhecemos, então o universo real da pergunta
       * é exatamente o nosso catálogo. Buscar nele resolve o problema no tamanho certo.
       *
       * Quem não encontra a própria raquete responde em texto livre e o motor registra
       * `unrecognized`, reduzindo a confiança e dizendo isso ao usuário — em vez de fingir uma
       * comparação.
       */
      readonly kind: 'racket';
      readonly optional?: boolean;
      /** Pergunta escondida quando devolve false. Some da etapa e da validação. */
      readonly showIf?: (a: QuestionnaireAnswers) => boolean;
      readonly key: keyof QuestionnaireAnswers;
      readonly title: string;
      readonly help?: string;
    }
  | {
      /** Campo curto de uma linha — nome. O `text` abre um textarea de seis linhas. */
      readonly kind: 'shortText';
      readonly optional?: boolean;
      /** Pergunta escondida quando devolve false. Some da etapa e da validação. */
      readonly showIf?: (a: QuestionnaireAnswers) => boolean;
      readonly key: keyof QuestionnaireAnswers;
      readonly title: string;
      readonly help?: string;
      readonly placeholder: string;
      readonly maxLength: number;
    }
  | {
      readonly kind: 'text';
      readonly optional?: boolean;
      /** Pergunta escondida quando devolve false. Some da etapa e da validação. */
      readonly showIf?: (a: QuestionnaireAnswers) => boolean;
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
        key: 'sex',
        optional: true,
        title: 'Sexo biológico',
        help:
          'Opcional. Usamos só para afinar a leitura de altura e peso — a massa magra da parte ' +
          'superior do corpo difere na média, e é ela que sustenta o peso da raquete. Sua resposta ' +
          'sobre força pesa mais do que isto.',
        choices: [
          { value: 'feminino', label: 'Feminino' },
          { value: 'masculino', label: 'Masculino' },
          { value: 'prefiro_nao_dizer', label: 'Prefiro não dizer', hint: 'Seguimos só com altura, peso e força.' },
        ],
      },
      {
        kind: 'single',
        key: 'perceived_strength',
        title: 'Como você descreveria sua força física?',
        choices: [
          { value: 'abaixo', label: 'Abaixo da média', hint: 'Raquete pesada atrasa sua preparação; a bola do adversário costuma te empurrar.' },
          { value: 'media', label: 'Média', hint: 'Segura bola pesada sem sofrer, mas não sobra força para acelerar sempre.' },
          { value: 'acima', label: 'Acima da média', hint: 'Acelera o braço quando quer, mesmo em bola difícil.' },
          { value: 'bem_acima', label: 'Bem acima da média', hint: 'Treina força fora da quadra, ou é naturalmente muito forte.' },
        ],
      },
      {
        kind: 'single',
        key: 'fitness_level',
        title: 'E seu condicionamento?',
        /*
          Calibrado para o AMADOR DE CLUBE, não para o atleta profissional.

          A régua anterior colocava "sente o cansaço no terceiro set" no nível Moderado e usava
          "cansa antes do fim da partida" como sinal de força abaixo da média — mas cansar no
          terceiro set é o normal do público deste produto, não a exceção. Com aquela escala,
          quase todo mundo se classificava para baixo e recebia raquete mais leve do que precisa.

          Agora a referência é o efeito no JOGO, não a fadiga em si: todo mundo cansa; o que muda é
          se a qualidade da bola cai junto.
        */
        choices: [
          { value: 'sedentario', label: 'Só jogo tênis', hint: 'Nenhuma outra atividade na semana. Uma partida longa cobra caro no dia seguinte.' },
          { value: 'moderado', label: 'Jogo e me movimento', hint: 'Cansa no fim do segundo set e a bola perde qualidade, mas você termina bem.' },
          { value: 'bom', label: 'Aguento partida longa', hint: 'Cansa no terceiro set, como quase todo mundo, e ainda consegue bater igual.' },
          { value: 'atletico', label: 'Treino além do tênis', hint: 'Corrida, academia ou funcional na rotina. Três sets não mudam seu jogo.' },
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
          { value: 'nunca', label: 'Nunca fiz', hint: 'Aprendeu jogando, sem orientação formal.' },
          { value: 'ja_fiz', label: 'Já fiz', hint: 'Teve aulas no passado, hoje não faz.' },
          { value: 'atualmente', label: 'Faço atualmente', hint: 'Está sob orientação técnica agora.' },
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
          { value: 'amadores', label: 'Amadores ou internos', hint: 'Torneios do clube ou entre amigos.' },
          { value: 'regionais', label: 'Regionais', hint: 'Circuitos da cidade ou do estado, com ranking.' },
          { value: 'competitivo', label: 'Competitivo', hint: 'Compete com regularidade e treino estruturado.' },
        ],
      },
      {
        kind: 'single',
        key: 'perceived_level',
        title: 'Como você se classificaria?',
        choices: [
          { value: 'iniciante', label: 'Iniciante', hint: 'Ainda está aprendendo a bater com constância.' },
          { value: 'iniciante_avancado', label: 'Iniciante avançado', hint: 'Já sustenta trocas simples, mas erra bastante sob pressão.' },
          { value: 'intermediario', label: 'Intermediário', hint: 'Joga partidas, controla direção e mantém trocas.' },
          { value: 'intermediario_avancado', label: 'Intermediário avançado', hint: 'Varia efeitos e ritmo; tem golpes de ataque definidos.' },
          { value: 'avancado', label: 'Avançado', hint: 'Domina os fundamentos e compete com consistência.' },
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
        title: 'Consegue gerar spin quando quer?',
        help: 'Fazer a bola girar de propósito — subir e cair dentro —, não por acaso.',
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
          { value: 'dominar_fundo', label: 'Gosto de dominar do fundo', hint: 'Prefere ditar o ritmo trocando da linha de base.' },
          { value: 'muito_topspin', label: 'Jogo com muito topspin', hint: 'Bola alta sobre a rede, que cai e sobe muito após o quique.' },
          { value: 'mais_chapado', label: 'Bato mais chapado', hint: 'Bola reta e rápida, com pouca rotação.' },
          { value: 'atacar_cedo', label: 'Gosto de atacar cedo', hint: 'Pega a bola na subida para tirar tempo do adversário.' },
          { value: 'contra_atacar', label: 'Contra-ataco usando a força do adversário', hint: 'Devolve bem, defende e espera o erro do outro.' },
          { value: 'all_court', label: 'Jogo all court', hint: 'Transita entre fundo e rede conforme a jogada pede.' },
          { value: 'subir_rede', label: 'Gosto de subir à rede', hint: 'Procura finalizar no voleio sempre que possível.' },
          { value: 'sem_estilo', label: 'Ainda não tenho estilo definido' },
        ],
      },
      {
        kind: 'single',
        key: 'forehand_type',
        title: 'Seu forehand é…',
        choices: [
          { value: 'topspin_pesado', label: 'Topspin pesado', hint: 'Escova muito a bola; ela pula alto no campo do adversário.' },
          { value: 'topspin_moderado', label: 'Topspin moderado', hint: 'Alguma rotação, o suficiente para a bola entrar com margem.' },
          { value: 'mais_chapado', label: 'Mais chapado', hint: 'Pouca rotação, trajetória mais reta e rasante.' },
          { value: 'nao_sei', label: 'Não sei' },
        ],
      },
      {
        kind: 'single',
        key: 'backhand_hands',
        title: 'Seu backhand é…',
        choices: [
          { value: 'uma_mao', label: 'De uma mão', hint: 'Backhand executado com um braço só.' },
          { value: 'duas_maos', label: 'De duas mãos', hint: 'Backhand com as duas mãos na empunhadura.' },
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
          { value: 'lenta', label: 'Lenta', hint: 'Você guia a bola para dentro da quadra em vez de acelerar.' },
          { value: 'moderada', label: 'Moderada', hint: 'Acelera quando a bola vem fácil; nas difíceis, só devolve.' },
          { value: 'rapida', label: 'Rápida', hint: 'Acelera na maioria das bolas, inclusive em algumas difíceis.' },
          { value: 'muito_rapida', label: 'Muito rápida', hint: 'Bate forte por padrão; quem joga com você sente o peso da bola.' },
          { value: 'nao_sei', label: 'Não sei dizer' },
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
        title: 'Consegue jogar fundo quando quer?',
        help: 'Fazer a bola cair perto da linha de fundo e empurrar o adversário para trás.',
        choices: TRI,
      },
      {
        kind: 'multi',
        key: 'ball_tendency',
        title: 'Suas bolas costumam…',
        // Uma das perguntas de maior peso: o sintoma daqui é cruzado com swing e nível para
        // decidir a receita. Por isso cada alternativa precisa ser reconhecível sem vocabulário.
        help: 'Escolha até duas. Pense nos seus golpes de fundo em um jogo normal.',
        max: 2,
        choices: [
          { value: 'caem_curtas', label: 'Cair curtas', hint: 'Quicam perto da linha de saque e o adversário entra na quadra para atacar.' },
          { value: 'passam_da_linha', label: 'Sair pelo fundo', hint: 'Você acerta o golpe e a bola passa da linha de fundo.' },
          { value: 'vao_para_rede', label: 'Bater na rede', hint: 'A bola não sobe o suficiente e morre na fita.' },
          { value: 'variam_demais', label: 'Variar demais', hint: 'Uma curta, a seguinte longa — o mesmo golpe não repete.' },
          { value: 'geralmente_boa_profundidade', label: 'Cair perto do fundo', hint: 'Com regularidade, empurrando o adversário para trás.' },
        ],
      },
      {
        kind: 'multi',
        key: 'missing_attributes',
        // Não faltar nada é a resposta do jogador satisfeito — e ela precisa caber.
        optional: true,
        title: 'Você sente falta de…',
        help: 'Escolha até três, na ordem de importância para você. A ordem importa.',
        max: 3,
        ranked: true,
        choices: [
          { value: 'power', label: 'Potência', hint: 'Facilidade para mandar a bola ao fundo sem forçar o braço.' },
          { value: 'control', label: 'Controle', hint: 'A bola vai onde você mira e não sai da quadra.' },
          { value: 'spin', label: 'Spin', hint: 'Rotação: faz a bola cair dentro mesmo passando alto na rede.' },
          { value: 'stability', label: 'Estabilidade', hint: 'A raquete não torce nem vibra ao receber bola pesada.' },
          { value: 'comfort', label: 'Conforto', hint: 'Impacto macio, que não castiga cotovelo e ombro.' },
          { value: 'maneuverability', label: 'Manobrabilidade', hint: 'Facilidade de girar a raquete rápido — em voleios, defesa e bolas em cima.' },
          { value: 'precision', label: 'Precisão', hint: 'Acertar alvos pequenos, como a linha ou o canto.' },
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
        kind: 'racket',
        key: 'current_racket_id',
        /**
         * Opcional porque a resposta depende de uma informação que a pessoa pode simplesmente não
         * ter — e o custo de não responder recai sobre ela, de forma visível: sem a raquete atual
         * não há comparação, `transition_fit` sai do cálculo e a confiança do relatório cai. É um
         * incentivo honesto. Obrigar produziria a resposta errada, não a resposta ausente.
         */
        optional: true,
        title: 'Qual raquete você usa hoje?',
        help:
          'Digite a marca ou o modelo para buscar. Não precisa saber o ano nem a versão: o que ' +
          'importa é o modelo e o peso, e esses quase não mudam entre gerações. Se a sua não ' +
          'aparecer, você pode descrevê-la — nesse caso não conseguimos comparar as ' +
          'especificações, e dizemos isso no relatório.',
      },
      {
        kind: 'multi',
        key: 'current_racket_likes',
        // Pode não haver nada que se destaque; forçar uma escolha inventaria preferência.
        optional: true,
        title: 'O que você gosta na sua raquete atual?',
        help: 'Pode escolher mais de uma, ou seguir adiante sem responder.',
        max: 4,
        choices: [
          { value: 'gosto_da_potencia', label: 'Gosto da potência', hint: 'A bola sai forte sem que você precise forçar.' },
          { value: 'gosto_do_controle', label: 'Gosto do controle', hint: 'A bola vai onde você mira.' },
          { value: 'gosto_do_spin', label: 'Gosto do spin', hint: 'A raquete ajuda a girar a bola.' },
          { value: 'gosto_do_peso', label: 'Gosto do peso', hint: 'O peso parece certo para o seu braço.' },
          { value: 'gosto_da_estabilidade', label: 'Gosto da estabilidade', hint: 'Firme no impacto, mesmo contra bola pesada.' },
          { value: 'gosto_do_conforto', label: 'Gosto do conforto', hint: 'Não incomoda o braço mesmo jogando bastante.' },
          /*
            Marcar "nada" é diferente de não marcar nada.
            Quem passa direto pode ter pulado; quem escolhe aqui está dizendo que a raquete não
            tem ponto forte para ela — informação valiosa, e que antes não cabia em lugar nenhum.
          */
          { value: 'nao_gosto_de_nada', label: 'Não gosto de nada nela', hint: 'Nenhuma característica se destaca positivamente.' },
          { value: 'nao_sei', label: 'Não sei dizer', hint: 'Nunca comparou com outra raquete para saber o que é dela.' },
        ],
      },
      {
        kind: 'multi',
        key: 'current_racket_dislikes',
        // Idem: quem está contente com a raquete não tem o que marcar aqui.
        optional: true,
        title: 'E o que não gosta?',
        help: 'Esta resposta influencia bastante a recomendação — mas responda só se tiver certeza.',
        max: 4,
        choices: [
          { value: 'falta_estabilidade', label: 'Falta estabilidade', hint: 'A raquete torce ou treme em bolas fortes.' },
          { value: 'acho_pesada', label: 'Acho pesada', hint: 'Cansa o braço ou atrasa a preparação.' },
          { value: 'acho_leve', label: 'Acho leve', hint: 'Falta massa; a bola do adversário empurra a raquete.' },
          { value: 'dificuldade_acelerar', label: 'Sinto dificuldade para acelerar', hint: 'Custa girar a raquete a tempo em bolas rápidas.' },
          { value: 'falta_potencia', label: 'Falta potência', hint: 'Precisa forçar muito para chegar ao fundo.' },
          { value: 'falta_controle', label: 'Falta controle', hint: 'A bola sai mais do que deveria.' },
          { value: 'sinto_vibracao', label: 'Sinto vibração', hint: 'Tremor desconfortável no braço após o impacto.' },
          { value: 'muito_exigente', label: 'Parece muito exigente', hint: 'Só funciona bem quando você acerta o golpe em cheio.' },
          /*
            Simétrico ao "não gosto de nada nela" da pergunta anterior.
            Estar satisfeito é uma resposta, e uma que muda a recomendação: quem não tem queixa
            deve receber evolução, não troca de conceito.
          */
          { value: 'gosto_de_tudo', label: 'Gosto de tudo nela', hint: 'Nenhuma queixa — você trocaria só por algo claramente melhor.' },
          { value: 'nao_sei', label: 'Não sei dizer', hint: 'Nunca jogou com outra raquete para saber o que é dela.' },
        ],
      },
      {
        kind: 'number',
        key: 'current_tension_lbs',
        // A maioria dos jogadores não sabe a própria tensão — quem encordoa é a loja.
        optional: true,
        title: 'Em quantas libras você encordoa hoje?',
        help: 'Se não souber, siga adiante — a pergunta é opcional.',
        min: 35,
        max: 70,
        unit: 'lbs',
      },
      {
        kind: 'single',
        key: 'current_tension_feeling',
        // Depende de perceber a tensão como variável, o que nem todo jogador faz.
        optional: true,
        title: 'O que você acha da tensão atual?',
        help: 'Esta é a informação mais útil que você pode nos dar sobre tensão.',
        choices: [
          { value: 'muito_solta', label: 'Muito solta', hint: 'Bola sai demais e falta controle.' },
          { value: 'um_pouco_solta', label: 'Um pouco solta', hint: 'Sobra um pouco de potência.' },
          { value: 'ideal', label: 'Ideal', hint: 'Do jeito que você gosta.' },
          { value: 'um_pouco_dura', label: 'Um pouco dura', hint: 'Falta um pouco de profundidade ou conforto.' },
          { value: 'muito_dura', label: 'Muito dura', hint: 'Impacto seco; exige muito esforço para o fundo.' },
          { value: 'nao_sei', label: 'Não sei' },
        ],
      },
      {
        kind: 'single',
        key: 'string_breakage',
        title: 'Com que frequência você arrebenta cordas?',
        choices: [
          { value: 'nunca', label: 'Nunca' },
          { value: 'raramente', label: 'Raramente', hint: 'Uma ou duas vezes por ano.' },
          { value: 'a_cada_2_3_meses', label: 'A cada 2 ou 3 meses', hint: 'Ritmo comum de quem joga toda semana.' },
          { value: 'mensalmente', label: 'Mensalmente', hint: 'Desgaste alto — costuma indicar bastante rotação.' },
          { value: 'semanalmente', label: 'Semanalmente', hint: 'Desgaste muito alto; durabilidade da corda pesa na escolha.' },
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
        help:
          'Marque só onde o desconforto é ou foi recorrente. Se nunca teve, marque "nenhum" e ' +
          'siga — nas próximas perguntas a gente detalha o que você marcar aqui.',
        max: 3,
        choices: [
          { value: 'cotovelo', label: 'Cotovelo', hint: 'A famosa "epicondilite" — dor na parte de fora do cotovelo.' },
          { value: 'ombro', label: 'Ombro', hint: 'Aparece principalmente no saque e nas bolas altas.' },
          { value: 'punho', label: 'Punho', hint: 'Costuma vir do impacto descentralizado ou do backhand.' },
          { value: 'nenhum', label: 'Nenhum', hint: 'Você joga sem dor nas articulações.' },
        ],
      },
      /*
        ─── POR QUE UMA PERGUNTA VIROU QUATRO ─────────────────────────────────────────────────

        Marcar "ombro" era suficiente para o motor tratar conforto como prioridade máxima. Só que a
        primeira pergunta aceita "sente OU JÁ SENTIU", e quase todo jogador de clube com alguns anos
        de quadra já sentiu alguma coisa em algum lugar. Uma dor leve de três anos atrás, que pode
        nem ter vindo da raquete, passava a governar a recomendação inteira.

        As três perguntas seguintes separam quatro coisas que estavam coladas numa só:

          ESTÁ ou ESTEVE   um problema ativo muda o equipamento; um episódio encerrado informa
          HÁ QUANTO TEMPO  só se aplica a quem já não sente — quem sente hoje não tem o que datar
          QUÃO FORTE       incômodo e afastamento da quadra não podem pesar igual
          VEIO DO TÊNIS    é o filtro que faltava, e é o que mais separa os casos

        A última é a que o usuário pediu explicitamente, e ela é a mais discriminante das quatro: um
        cotovelo machucado na academia não diz nada sobre a raquete errada, enquanto o mesmo cotovelo
        machucado jogando é o sinal mais forte do questionário inteiro. Sem essa pergunta, o motor
        tratava os dois casos como idênticos — e escolhia equipamento pelo primeiro.

        Todas só existem para quem marcou uma área; quem respondeu "nenhum" não vê nenhuma delas.
      */
      {
        kind: 'single',
        key: 'discomfort_status',
        showIf: (a) => a.discomfort_areas.some((d) => d !== 'nenhum'),
        title: 'Esse desconforto é atual ou já passou?',
        help: 'Um problema ativo muda a recomendação. Um episódio encerrado só informa.',
        choices: [
          {
            value: 'atual',
            label: 'Sinto atualmente',
            hint: 'Aparece nos jogos ou treinos de agora, mesmo que de vez em quando.',
          },
          {
            value: 'passado',
            label: 'Já senti, não sinto mais',
            hint: 'Episódio encerrado — você joga sem essa dor hoje.',
          },
        ],
      },
      {
        kind: 'single',
        key: 'discomfort_when',
        // Só quem já não sente tem o quê datar. Para quem sente hoje, a resposta é "agora".
        showIf: (a) =>
          a.discomfort_areas.some((d) => d !== 'nenhum') && a.discomfort_status === 'passado',
        title: 'Há quanto tempo foi a última vez?',
        help: 'Quanto mais antigo, menos ele pesa na escolha do equipamento.',
        choices: [
          { value: 'ultimos_meses', label: 'Nos últimos meses', hint: 'Passou, mas foi recente.' },
          { value: 'ano_passado', label: 'No último ano', hint: 'Não voltou desde então.' },
          { value: 'ha_mais_tempo', label: 'Há mais de um ano', hint: 'Episódio antigo, já resolvido.' },
        ],
      },
      {
        kind: 'single',
        key: 'discomfort_intensity',
        showIf: (a) => a.discomfort_areas.some((d) => d !== 'nenhum'),
        title: 'Qual a intensidade?',
        help: 'Pense no pior momento, não na média.',
        choices: [
          { value: 'leve', label: 'Leve', hint: 'Incomoda, mas você joga normalmente.' },
          { value: 'moderada', label: 'Moderada', hint: 'Atrapalha alguns golpes ou encurta o treino.' },
          { value: 'forte', label: 'Forte', hint: 'Já te tirou da quadra, ou exigiu tratamento.' },
        ],
      },
      {
        kind: 'single',
        key: 'string_budget',
        optional: true,
        title: 'Quanto você pretende investir na corda?',
        help:
          'Opcional. Uma tripa natural custa quatro a seis vezes um multifilamento e dura menos — ' +
          'sem saber sua faixa, a gente estima pelo seu uso.',
        choices: [
          {
            value: 'economico',
            label: 'O mais econômico possível',
            hint: 'Prioriza custo por encordoamento. Ainda escolhemos a melhor da faixa para você.',
          },
          {
            value: 'equilibrado',
            label: 'Custo-benefício',
            hint: 'Paga um pouco mais por uma corda claramente melhor, dentro do razoável.',
          },
          {
            value: 'sem_limite',
            label: 'Quero a melhor, o preço é secundário',
            hint: 'Abre a porta para tripa natural e para os poliésters de topo.',
          },
        ],
      },
      {
        kind: 'single',
        key: 'discomfort_from_tennis',
        showIf: (a) => a.discomfort_areas.some((d) => d !== 'nenhum'),
        title: 'Você associa esse desconforto ao tênis?',
        help:
          'Se a origem é outra, o equipamento continua sendo escolhido com cuidado — mas deixa de ' +
          'ser tratado como a causa do problema.',
        choices: [
          {
            value: 'sim',
            label: 'Sim, apareceu jogando',
            hint: 'Surge ou piora durante e depois de jogar.',
          },
          {
            value: 'nao',
            label: 'Não, veio de outra coisa',
            hint: 'Academia, trabalho, uma lesão antiga sem relação com a quadra.',
          },
          {
            value: 'nao_sei',
            label: 'Não sei dizer',
            hint: 'Não dá para separar as causas com segurança.',
          },
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
          { value: 'potencializar', label: 'Quero potencializar meu jogo atual', hint: 'Manter o que funciona e refinar, sem mudar o estilo.' },
          { value: 'ganhar_potencia', label: 'Quero ganhar potência', hint: 'Chegar ao fundo com menos esforço.' },
          { value: 'ganhar_controle', label: 'Quero ganhar controle', hint: 'Errar menos e mirar melhor.' },
          { value: 'mais_spin', label: 'Quero gerar mais spin', hint: 'Mais rotação para ganhar margem sobre a rede.' },
          { value: 'atacar_mais', label: 'Quero atacar mais', hint: 'Assumir a iniciativa em vez de esperar o erro.' },
          { value: 'mais_conforto', label: 'Quero mais conforto', hint: 'Reduzir o impacto no braço.' },
          { value: 'mais_estabilidade', label: 'Quero mais estabilidade', hint: 'Sentir a raquete firme contra bolas pesadas.' },
          { value: 'mais_facil', label: 'Quero um equipamento mais fácil', hint: 'Mais tolerante a erros e menos exigente fisicamente.' },
          { value: 'mais_exigente', label: 'Quero evoluir para algo mais exigente', hint: 'Trocar tolerância por precisão, aceitando cobrar mais de você.' },
          { value: 'nao_sei', label: 'Ainda não sei' },
        ],
      },
      {
        kind: 'shortText',
        key: 'player_name',
        // Não entra em cálculo nenhum: serve só para personalizar o card do resultado.
        optional: true,
        title: 'Como podemos te chamar?',
        help: 'Só para personalizar o card do seu resultado. Pode deixar em branco.',
        maxLength: 24,
        placeholder: 'Seu primeiro nome',
      },
      {
        kind: 'text',
        key: 'free_text',
        // Declaradamente opcional no próprio enunciado.
        optional: true,
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

/**
 * Etapas visíveis, já com as PERGUNTAS condicionais filtradas.
 *
 * A filtragem acontece aqui e não na renderização para que a validação, o contador de progresso e a
 * tela enxerguem exatamente o mesmo conjunto. Uma pergunta escondida que ainda contasse como
 * obrigatória travaria a etapa sem nada aparecer na tela — o pior modo de falha possível num
 * formulário.
 */
export function visibleSteps(answers: QuestionnaireAnswers): readonly Step[] {
  return STEPS.filter((step) => !step.showIf || step.showIf(answers)).map((step) => ({
    ...step,
    questions: step.questions.filter((q) => !q.showIf || q.showIf(answers)),
  }));
}

/**
 * Uma pergunta está respondida quando o usuário DECIDIU algo — não quando o campo tem valor.
 *
 * A distinção importa em dois lugares que já morderam este produto:
 *
 *   • o slider de número mostra a posição do meio antes de qualquer interação, então "aparenta"
 *     estar preenchido enquanto o valor no estado ainda é `null`. É por isso que o teste é contra
 *     o estado e nunca contra o que está na tela;
 *
 *   • a raquete atual tem DOIS caminhos válidos — escolher no catálogo ou descrever em texto —, e
 *     qualquer um dos dois conclui a pergunta. Exigir o primeiro deixaria de fora exatamente quem
 *     tem uma raquete que não está no catálogo, que é o caso que o texto livre existe para cobrir.
 */
export function isAnswered(question: Question, answers: QuestionnaireAnswers): boolean {
  if (question.optional) return true;

  if (question.kind === 'racket') {
    const id = answers.current_racket_id;
    const free = answers.current_racket_free_text;
    return (typeof id === 'string' && id.length > 0) || (typeof free === 'string' && free.trim().length > 0);
  }

  const value = answers[question.key];

  switch (question.kind) {
    case 'single':
      return typeof value === 'string' && value.length > 0;
    case 'multi':
      return Array.isArray(value) && value.length > 0;
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'text':
    case 'shortText':
      return typeof value === 'string' && value.trim().length > 0;
  }
}

/** Perguntas obrigatórias ainda em branco na etapa, na ordem em que aparecem na tela. */
export function unansweredIn(step: Step, answers: QuestionnaireAnswers): readonly Question[] {
  return step.questions.filter((q) => !isAnswered(q, answers));
}
