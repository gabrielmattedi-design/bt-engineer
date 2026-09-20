import { describe, expect, it } from 'vitest';
import { emptyAnswers } from '@/recommendation/profile/answers';
import { buildPlayerProfile } from '@/recommendation/profile/build-profile';
import { recommend } from '@/recommendation';
import { TEST_DATASET_VERSION, TEST_MODE, testRackets, testStrings } from '../helpers/catalog';

/**
 * ═══ UM LAUDO QUE NÃO DÁ PARA EXECUTAR NÃO É UM LAUDO ════════════════════════════════════════
 *
 * ⚠️ CASO REAL (20/09/2026)
 *
 * Cliente com desconforto em cotovelo e ombro recebeu **tripa natural**. Tecnicamente é a resposta
 * certa — amigabilidade ao braço 100 de 100, a corda mais macia do catálogo — e o laudo avisava:
 *
 *   "Disponibilidade menor no Brasil — confirme com seu encordoador antes de encomendar."
 *
 * O aviso estava certo e não resolvia nada. Tripa natural custa várias vezes um multifilamento,
 * some de estoque e sofre com a umidade do saibro. O cliente ficou com um laudo impecável e nenhum
 * caminho para executá-lo — e ele já tinha pesquisado multifilamentos por conta própria, o que fez
 * a recomendação parecer desligada da realidade em que ele compra.
 *
 * Um aviso sem saída não é informação, é obstáculo: diz que a pessoa não vai conseguir comprar e
 * não diz o que comprar.
 */
describe('alternativa praticável quando a corda indicada tem barreira', () => {
  const strings = testStrings();
  const rackets = testRackets();

  /** Um jogador de braço sensível — o perfil que atrai as cordas mais macias e mais caras. */
  function perfilComBracoSensivel() {
    const answers = {
      ...emptyAnswers(),
      age: 58,
      height_cm: 178,
      weight_kg: 82,
      dominant_hand: 'destro',
      perceived_strength: 'media',
      fitness_level: 'moderado',
      experience_duration: 'mais_5a',
      frequency_per_week: 2,
      has_lessons: 'ja_fiz',
      plays_matches: 'sim',
      tournament_experience: 'amadores',
      perceived_level: 'iniciante_avancado',
      can_sustain_rally: 'as_vezes',
      can_direct_ball: 'as_vezes',
      can_generate_spin: 'nao',
      can_vary_depth: 'nao',
      reliable_second_serve: 'nao',
      play_style: ['mais_chapado'],
      forehand_type: 'mais_chapado',
      backhand_hands: 'duas_maos',
      swing_length: 'nao_sei',
      swing_speed: 'nao_sei',
      depth_control: 'as_vezes',
      missing_attributes: ['spin', 'comfort', 'precision'],
      current_tension_lbs: null,
      current_tension_feeling: 'nao_sei',
      string_breakage: 'nunca',
      discomfort_areas: ['cotovelo', 'ombro'],
      discomfort_status: 'passado',
      discomfort_when: 'mais_de_1_ano',
      discomfort_intensity: 'moderada',
      discomfort_from_tennis: 'sim',
      /*
        Sem restrição de orçamento — é o que abre a porta para a faixa "ultra".

        Não é detalhe do teste: é a condição em que o defeito aparece. Quem declara bolso apertado
        já é empurrado para longe da tripa natural pelo eixo de custo, e nunca vê o problema. O
        cliente de 20/09 estava exatamente aqui: sem restrição declarada, e por isso recebeu a
        corda tecnicamente melhor e comercialmente impraticável.
      */
      string_budget: 'sem_limite',
      objective: ['mudar'],
    } as never;

    return buildPlayerProfile(answers);
  }

  const resultado = recommend({
    profile: perfilComBracoSensivel(),
    rackets,
    strings,
    datasetVersion: TEST_DATASET_VERSION,
    mode: TEST_MODE,
    includeSetup: true,
  });

  /**
   * O perfil precisa mesmo acionar a proteção — senão o teste passaria por não exercitar nada.
   *
   * 68 foi o valor medido para cotovelo + ombro com intensidade moderada e origem no tênis. Bem
   * acima do piso de 25 em que o motor começa a penalizar rigidez.
   */
  it('o perfil de fato aciona a proteção de braço', () => {
    expect(perfilComBracoSensivel().arm_sensitivity_score).toBeGreaterThan(25);
  });

  /**
   * A regra: SE a corda indicada tem barreira prática, TEM que existir um caminho alternativo.
   *
   * O condicional é rede de segurança, não o objetivo: o teste abaixo EXIGE que este perfil caia
   * numa corda com barreira, senão ele estaria passando sem exercitar o caminho novo — que foi
   * exatamente o que aconteceu na primeira versão dele, com a vencedora saindo budget.
   */
  it('quando a indicada é cara ou escassa, o laudo oferece um caminho executável', () => {
    const rec = resultado.string_recommendation;
    expect(rec, 'o motor não recomendou corda para este perfil').not.toBeNull();
    if (!rec) return;

    const escassa = rec.variant.availability_warning !== null;
    const cara = rec.variant.model.price_tier === 'ultra';
    expect(
      escassa || cara,
      'este perfil deixou de cair numa corda com barreira — o teste parou de exercitar o caminho',
    ).toBe(true);

    const alt = rec.alternativa_pratica;
    expect(
      alt,
      'a corda indicada tem barreira prática e o laudo não ofereceu alternativa nenhuma',
    ).toBeTruthy();
    if (!alt) return;

    // A alternativa não pode carregar a mesma barreira que ela existe para contornar.
    expect(alt.modelo).not.toBe(`${rec.variant.model.brand} ${rec.variant.model.model}`);
    expect(alt.espessura_mm).toBeGreaterThan(0);

    /*
      A diferença de pontos é o que transforma a alternativa em ESCOLHA. Sem ela, "existe uma opção
      mais barata" é palpite do sistema; com ela, a pessoa decide com o mesmo critério que o motor
      usou. Nunca negativa: a alternativa é, por construção, uma corda que pontuou menos.
    */
    expect(alt.diferenca).toBeGreaterThanOrEqual(0);
    expect(alt.motivo.length).toBeGreaterThan(10);
  });
});
