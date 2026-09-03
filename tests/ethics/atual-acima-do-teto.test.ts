/**
 * A RAQUETE ATUAL PODE VENCER ACIMA DO TETO — MAS NÃO EM SILÊNCIO.
 *
 * ═══ O CASO ══════════════════════════════════════════════════════════════════════════════════
 *
 * A raquete atual é isenta do teto de peso em `applyWeightCeiling`. A isenção é deliberada e está
 * documentada lá: ela é referência do relatório, não candidata, e removê-la esconderia da pessoa a
 * comparação que explica o teto.
 *
 * O que ninguém tinha olhado é que a isenção a mantém no RANKING, e do ranking ela sai em 1º lugar
 * quando pontua mais. Aí o produto recomenda um quadro que ele mesmo calculou ser pesado demais
 * para aquele corpo — e recomenda calado. Numa varredura de 1000 perfis: 68 casos. O pior:
 *
 *     #748 — 15 anos, 1,48 m, 43 kg, teto calculado de 288 g
 *            1ª colocada: Wilson Blade 98 18×20, 305 g (a atual), 17 g acima do teto
 *            match 71,5% — abaixo do piso de 75 — e percentil 9 em spin
 *            spin era a prioridade nº 1 declarada
 *
 * O perfil #748 é o mesmo defeito que apareceu como "a Blade 18×20 traindo quem pediu spin": não
 * eram dois problemas, era um. A raquete não foi ESCOLHIDA por spin — ela entrou pela porta da
 * isenção e ganhou por ser a atual, com `transition_fit` 100 e sem a penalidade de conflito de
 * objetivo que as alternativas levaram.
 *
 * ═══ A DECISÃO — NEM EXCLUIR, NEM REBAIXAR ═══════════════════════════════════════════════════
 *
 * Eu havia proposto duas saídas, e o dono escolheu uma terceira, melhor que as duas:
 *
 *   "não excluiria nem rebaixaria automaticamente a raquete atual. Deixaria ela vencer, mas
 *    mudaria a natureza da recomendação (...) E o pódio comercial deveria mostrar a melhor
 *    alternativa dentro do teto imediatamente abaixo."
 *
 * O número é verdadeiro: aquele quadro obteve mesmo o maior match técnico. Rebaixá-lo faria o
 * relatório mentir sobre o próprio cálculo para salvar uma regra; excluí-lo esconderia da pessoa
 * que a raquete que ela já tem é a que melhor a atende. O que muda é o SIGNIFICADO da 1ª posição —
 * e o que vem logo abaixo dela.
 *
 * Estes testes trancam as duas metades.
 */

import { describe, expect, it } from 'vitest';
import { loadRacketCatalog, loadStringCatalog, DATASET_VERSION } from '@/data/load';
import { scoreRackets } from '@/recommendation/normalize/racket-attributes';
import { recommend, enrichProfileWithCatalog } from '@/recommendation';
import { buildPlayerProfile } from '@/recommendation/profile/build-profile';
import { serializeRecommendation, type Entitlement } from '@/payments/entitlements';
import { emptyAnswers, type QuestionnaireAnswers } from '@/recommendation/profile/answers';
import type { ReportPayload } from '@/payments/entitlements';

const rackets = scoreRackets(loadRacketCatalog());
const strings = loadStringCatalog();
const TUDO: Entitlement[] = [
  'racket_report_access',
  'full_setup_access',
  'rank2_access',
  'rank3_access',
];

/**
 * O #748 da varredura, transcrito.
 *
 * Fica escrito à mão em vez de sair do sorteador de propósito: o sorteador é determinístico, mas a
 * numeração dos perfis muda sempre que ele muda — e ele já mudou. Um teste ancorado em "o perfil
 * 748" apontaria, depois da próxima correção, para outra pessoa.
 */
const P748: Partial<QuestionnaireAnswers> = {
  age: 15,
  height_cm: 148,
  weight_kg: 43,
  dominant_hand: 'destro',
  sex: 'prefiro_nao_dizer',
  perceived_strength: 'acima',
  fitness_level: 'bom',
  experience_duration: '6_12m',
  frequency_per_week: 5,
  has_lessons: 'atualmente',
  plays_matches: 'sim',
  tournament_experience: 'nunca',
  perceived_level: 'avancado',
  can_sustain_rally: 'sim',
  can_direct_ball: 'sim',
  can_generate_spin: 'sim',
  can_vary_depth: 'sim',
  reliable_second_serve: 'sim',
  play_style: ['mais_chapado'],
  forehand_type: 'topspin_moderado',
  backhand_hands: 'uma_mao',
  swing_length: 'medio',
  swing_speed: 'moderada',
  depth_control: 'as_vezes',
  ball_tendency: ['caem_curtas'],
  missing_attributes: ['spin', 'maneuverability'],
  discomfort_areas: ['nenhum'],
  string_breakage: 'raramente',
  string_budget: 'equilibrado',
  objective: ['mais_exigente'],
  current_racket_id: 'wilson-blade-98-18x20-v10-2026',
};

function analisar(extra: Partial<QuestionnaireAnswers> = {}) {
  const answers = { ...emptyAnswers(), ...P748, ...extra } as QuestionnaireAnswers;
  const profile = enrichProfileWithCatalog(buildPlayerProfile(answers), rackets, strings);
  const atual = rackets.find((r) => r.variant.id === answers.current_racket_id);
  const result = recommend({
    profile,
    rackets,
    strings,
    datasetVersion: DATASET_VERSION,
    mode: 'permissive',
    includeSetup: true,
    ...(atual ? { currentRacket: atual } : {}),
  });
  const payload = serializeRecommendation(result, profile, TUDO) as ReportPayload;
  return { profile, result, payload, atual };
}

describe('o caso que originou a regra', () => {
  /** A premissa do teste. Se ela cair, os outros passam por vacuidade — por isso é explícita. */
  it('a raquete atual vence, e está acima do teto', () => {
    const { profile, result, atual } = analisar();
    const primeira = result.podium[0]!;

    expect(atual, 'a Blade 98 18×20 saiu do catálogo').toBeDefined();
    expect(primeira.racket.variant.id, 'a atual deixou de vencer').toBe(atual!.variant.id);

    const teto = profile.frame_weight_ceiling_g;
    const peso = primeira.racket.variant.specs.unstrung_weight_g;
    expect(teto, 'o perfil deixou de ter teto').not.toBeNull();
    expect(peso).not.toBeNull();
    expect(peso!, `${peso} g deixou de exceder o teto de ${teto} g`).toBeGreaterThan(teto!);
  });
});

describe('a natureza da recomendação muda', () => {
  it('o relatório diz que a 1ª está acima da faixa de peso', () => {
    const { payload } = analisar();
    expect(payload.current_above_ceiling, 'a atual venceu acima do teto EM SILÊNCIO').not.toBeNull();
  });

  /**
   * "Acima da faixa" sem quantidade não deixa ninguém decidir: 2 g e 32 g acima pedem reações
   * diferentes, e as duas acontecem na varredura.
   */
  it('o aviso traz os gramas — o peso, o teto e a diferença', () => {
    const { profile, payload, result } = analisar();
    const nota = payload.current_above_ceiling!;
    const teto = profile.frame_weight_ceiling_g!;
    const peso = result.podium[0]!.racket.variant.specs.unstrung_weight_g!;

    expect(nota, 'falta o peso do quadro').toContain(`${peso} g`);
    expect(nota, 'falta o teto calculado').toContain(`${teto} g`);
    expect(nota, 'falta a diferença').toContain(`${peso - teto} g a mais`);
  });

  /** As três coisas a verificar em quadra são as que o peso extra ameaça — não uma ressalva vaga. */
  it('nomeia o que avaliar em quadra', () => {
    const { payload } = analisar();
    const nota = payload.current_above_ceiling!.toLowerCase();
    for (const termo of ['fadiga', 'manobrabilidade', 'conforto']) {
      expect(nota, `o aviso não menciona ${termo}`).toContain(termo);
    }
  });

  /** E aponta a saída pelo nome, senão levanta um problema sem oferecer alternativa. */
  it('aponta a alternativa pelo nome', () => {
    const { payload, result } = analisar();
    expect(payload.current_above_ceiling!).toContain(result.podium[1]!.racket.variant.product_name);
  });

  it('some quando a atual cabe no teto', () => {
    /* Mesmo perfil, corpo de adulto: o teto sobe e passa a comportar os 305 g. */
    const { payload, profile } = analisar({ age: 32, height_cm: 183, weight_kg: 84 });
    expect(profile.frame_weight_ceiling_g!).toBeGreaterThanOrEqual(305);
    expect(payload.current_above_ceiling, 'o aviso apareceu sem o teto ter sido excedido').toBeNull();
  });

  it('some quando a 1ª não é a raquete atual', () => {
    const { payload, result, atual } = analisar({
      current_racket_id: null,
      no_current_racket: true,
    });
    expect(atual).toBeUndefined();
    expect(result.podium[0]).toBeDefined();
    expect(payload.current_above_ceiling).toBeNull();
  });
});

describe('a alternativa comercial', () => {
  /**
   * A metade que o texto sozinho não resolve. Ela precisa CABER no teto — é o único motivo de
   * existir nesta posição.
   */
  it('a 2ª colocada está dentro do teto', () => {
    const { profile, result } = analisar();
    const teto = profile.frame_weight_ceiling_g!;
    const segunda = result.podium[1];

    expect(segunda, 'não sobrou alternativa nenhuma').toBeDefined();
    expect(
      segunda!.racket.variant.specs.unstrung_weight_g!,
      'a alternativa também está acima do teto',
    ).toBeLessThanOrEqual(teto);
  });

  /**
   * ═══ A DIVERSIDADE DE FAMÍLIA CEDE NESTA POSIÇÃO ═══════════════════════════════════════════
   *
   * O pódio evita repetir família. Aqui isso trabalhava contra o leitor: a atual é uma Wilson
   * Blade, e a melhor alternativa dentro do teto é a Wilson Blade 100L — 285 g, percentil 76 em
   * spin contra 9 da atual. A regra de diversidade a pulava e entregava a 3ª melhor.
   *
   * Quando a 1ª é um quadro que a pessoa não deveria manter, a 2ª é a recomendação de verdade, e
   * variedade de marca não vale mais que ser a melhor opção viável.
   */
  it('a melhor alternativa entra mesmo sendo da família da atual', () => {
    const { result } = analisar();
    const primeira = result.podium[0]!;
    const segunda = result.podium[1]!;

    expect(segunda.racket.variant.family, 'a diversidade de família voltou a pular a melhor').toBe(
      primeira.racket.variant.family,
    );
    expect(segunda.racket.variant.product_name).toContain('100L');
  });

  /** E ela é de fato a melhor dentro do teto, não uma qualquer que coube. */
  it('é a melhor pontuada entre as que cabem no teto', () => {
    const { profile, result } = analisar();
    const teto = profile.frame_weight_ceiling_g!;
    const primeira = result.podium[0]!;

    const melhorDentro = result.full_ranking.find((e) => {
      const g = e.racket.variant.specs.unstrung_weight_g;
      return e.racket.variant.id !== primeira.racket.variant.id && g !== null && g <= teto;
    });

    expect(melhorDentro, 'nenhuma raquete do catálogo cabe no teto deste perfil').toBeDefined();
    expect(result.podium[1]!.racket.variant.id).toBe(melhorDentro!.racket.variant.id);
  });

  /**
   * O pedido que o motor não atendeu, e por quê — vale registrar para que ninguém "conserte" isto
   * depois achando que é defeito.
   *
   * Spin era a prioridade nº 1 desta pessoa, e a 1ª colocada marca percentil 9 em spin. Não é o
   * ranking ignorando o pedido: o objetivo declarado é "evoluir para algo mais exigente", que pesa
   * 0,32 no score, e os quadros leves e cheios de spin levam penalidade de conflito de objetivo
   * (16,4 pontos na alternativa) por serem justamente os mais tolerantes. O perfil pede duas coisas
   * que a física da raquete não entrega juntas, e o motor resolveu a favor do objetivo.
   *
   * A alternativa dentro do teto é quem devolve o spin — percentil 76 contra 9 —, e é ela que o
   * aviso aponta.
   *
   * Nota sobre o número: esta transcrição marca 75,7% de match, e o #748 do sorteador marcava
   * 71,5%. A diferença vem dos campos que o sorteador preenche e que não estão transcritos aqui, e
   * ela não é o que este teste tranca — por isso o `low_match_note` não é afirmado. O que importa,
   * e é o que está preso abaixo, é a inversão de spin entre a 1ª e a alternativa.
   */
  it('a alternativa devolve o spin que a 1ª não entrega', () => {
    const { result } = analisar();
    const spinPrimeira = result.podium[0]!.racket.attributes.spin_score;
    const spinSegunda = result.podium[1]!.racket.attributes.spin_score;

    expect(spinSegunda, 'a alternativa não é melhor em spin que a atual').toBeGreaterThan(
      spinPrimeira,
    );
  });
});
