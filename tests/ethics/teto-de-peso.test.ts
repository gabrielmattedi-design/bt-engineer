/**
 * O TETO DE PESO ESTÁTICO: nenhum quadro acima do que o corpo do jogador sustenta.
 *
 * ═══ O DEFEITO QUE ORIGINOU A REGRA ══════════════════════════════════════════════════════════
 *
 * Um menino de 12 anos, 1,52 m e 52 kg recebia quadros de 295 a 305 g. Não foi um caso de borda:
 * numa varredura de 405 combinações de respostas para esse porte, a MEDIANA do peso recomendado era
 * 300 g e 69% das respostas ficavam em 295 g ou mais.
 *
 * E o motor não estava com defeito de pontuação. Os dois quadros de 300 g que sobravam para ele
 * marcavam 77 e 84 de 100 em encaixe físico — acima do piso de 70. O ranking ordena por INÉRCIA DE
 * SWING (peso × balanço), que é a grandeza certa e que não conhece o braço do outro lado:
 *
 *     Wilson Clash 100 Pro   305 g · 310 mm  →  índice 32,4
 *     Babolat Pure Aero Lite 270 g · 330 mm  →  índice 43,5
 *
 * O quadro 35 g mais pesado tem inércia MENOR. Para um adulto isso é informação boa. Para quem tem
 * 52 kg é uma raquete de 305 g na mão de quem não tem ombro para 305 g em balanço nenhum.
 *
 * O que faltava não era coeficiente — era um NÃO. Ver `frameWeightCeiling` (build-profile.ts) para
 * a fórmula e `applyWeightCeiling` (rank-rackets.ts) para por que ele é aplicado DEPOIS da
 * pontuação, e não junto dos filtros duros.
 */

import { describe, expect, it } from 'vitest';
import { recommend, enrichProfileWithCatalog } from '@/recommendation';
import { serializeRecommendation, type Entitlement } from '@/payments/entitlements';
import {
  buildPlayerProfile,
  frameWeightCeiling,
} from '@/recommendation/profile/build-profile';
import { emptyAnswers, type QuestionnaireAnswers } from '@/recommendation/profile/answers';
import { PERSONAS } from '@/data/personas';
import { TEST_DATASET_VERSION, TEST_MODE, testRackets, testStrings } from '../helpers/catalog';

const CATALOGO = testRackets();
const CORDAS = testStrings();

/** Respostas plausíveis e completas, para que só o corpo varie entre os perfis medidos. */
function respostas(extra: Partial<QuestionnaireAnswers>): QuestionnaireAnswers {
  return {
    ...emptyAnswers(),
    dominant_hand: 'destro',
    experience_duration: '1_2a',
    frequency_per_week: 2,
    has_lessons: 'atualmente',
    plays_matches: 'as_vezes',
    tournament_experience: 'nunca',
    perceived_level: 'intermediario',
    can_sustain_rally: 'as_vezes',
    can_direct_ball: 'as_vezes',
    can_generate_spin: 'as_vezes',
    can_vary_depth: 'nao',
    reliable_second_serve: 'nao',
    swing_length: 'medio',
    swing_speed: 'moderada',
    depth_control: 'as_vezes',
    no_current_racket: true,
    // Controle e precisão são o pedido do caso original, e é o pedido que reduzia o campo a dois
    // quadros de 300 g. Mantido para que o teste exercite a interação entre as duas regras.
    missing_attributes: ['control', 'precision'],
    objective: ['more_control'],
    discomfort_areas: ['nenhum'],
    discomfort_status: null,
    ...extra,
  } as QuestionnaireAnswers;
}

function pesosDoPodio(a: QuestionnaireAnswers): number[] {
  const resultado = recommend({
    profile: buildPlayerProfile(a),
    rackets: CATALOGO,
    datasetVersion: TEST_DATASET_VERSION,
    mode: TEST_MODE,
  });
  return resultado.podium
    .map((p) => p.racket.variant.specs.unstrung_weight_g)
    .filter((g): g is number => g !== null);
}

const MENINO_12 = respostas({
  age: 12,
  height_cm: 152,
  weight_kg: 52,
  sex: 'masculino',
  perceived_strength: 'media',
  fitness_level: 'moderado',
});

describe('a fórmula', () => {
  /**
   * Os alvos foram fixados pelo dono do produto, perfil por perfil. O teste é se UMA reta atende
   * todos ao mesmo tempo — se um dia ela deixar de atender, a discussão volta para a mesa em vez de
   * o número mudar sozinho.
   *
   * O catálogo é granular (270, 275, 280, 285, 295, 300, 305, 310, 315), então a conferência é por
   * faixa: o que importa é qual degrau o teto libera, não o grama exato.
   */
  it.each([
    { quem: 'rapaz de 16 anos, 68 kg', a: { age: 16, weight_kg: 68, sex: 'masculino' as const }, faixa: [308, 312] },
    { quem: 'mulher de 45 anos, 54 kg', a: { age: 45, weight_kg: 54, sex: 'feminino' as const }, faixa: [285, 292] },
    { quem: 'mulher de 35 anos, 63 kg', a: { age: 35, weight_kg: 63, sex: 'feminino' as const }, faixa: [295, 299] },
    { quem: 'menino de 12 anos, 52 kg', a: { age: 12, weight_kg: 52, sex: 'masculino' as const }, faixa: [290, 294] },
  ])('$quem', ({ a, faixa }) => {
    const teto = frameWeightCeiling({ age: a.age, weight_kg: a.weight_kg, sex: a.sex });
    expect(teto).not.toBeNull();
    expect(teto!).toBeGreaterThanOrEqual(faixa[0]!);
    expect(teto!).toBeLessThanOrEqual(faixa[1]!);
  });

  /**
   * A ponta de baixo do questionário encosta no chão do catálogo sem passar por baixo dele.
   *
   * É esta propriedade que garante que o teto nunca zere as candidatas sozinho: o menor corpo que
   * o formulário aceita (35 kg) ainda libera os quadros mais leves que existem (270 g).
   */
  it('o menor corpo possível ainda alcança o quadro mais leve do catálogo', () => {
    const teto = frameWeightCeiling({ age: 10, weight_kg: 35, sex: 'feminino' });
    const maisLeve = Math.min(
      ...CATALOGO.map((r) => r.variant.specs.unstrung_weight_g).filter(
        (g): g is number => g !== null,
      ),
    );
    expect(teto!).toBeGreaterThanOrEqual(maisLeve);
  });

  /**
   * Na ponta de cima o teto sai de cena. Ele existe para proteger quem tem pouco corpo, não para
   * dizer a quem tem muito que precisa de mais peso.
   */
  it('não restringe nada acima de 78 kg', () => {
    const maisPesado = Math.max(
      ...CATALOGO.map((r) => r.variant.specs.unstrung_weight_g).filter(
        (g): g is number => g !== null,
      ),
    );
    for (const kg of [78, 92, 120, 150]) {
      const teto = frameWeightCeiling({ age: 35, weight_kg: kg, sex: 'masculino' });
      expect(teto!, `${kg} kg`).toBeGreaterThanOrEqual(maisPesado);
    }
  });

  /** Sem peso declarado não há reta. Limitar uma pessoa imaginária é pior do que não limitar. */
  it('sem peso não há teto', () => {
    expect(frameWeightCeiling({ age: 30, weight_kg: null, sex: 'masculino' })).toBeNull();
  });

  /**
   * O fator por sexo existe e é pequeno — pedido nestes termos: "mesmo que não tão alto". Ele
   * precisa ser diferente de zero (senão a decisão não foi implementada) e não pode chegar a um
   * degrau inteiro do catálogo na maior parte da faixa.
   */
  it('o fator por sexo é real e é modesto', () => {
    const dela = frameWeightCeiling({ age: 35, weight_kg: 62, sex: 'feminino' })!;
    const dele = frameWeightCeiling({ age: 35, weight_kg: 62, sex: 'masculino' })!;
    expect(dela).toBeLessThan(dele);
    expect(dele - dela).toBeLessThanOrEqual(8);
  });

  /**
   * Menor de 16 tem um limite próprio ALÉM da reta, porque a reta lê o corpo de hoje e não lê o
   * osso. Um garoto grande de 13 anos ganharia pela reta um teto de adulto.
   */
  it('menor de 16 não passa de 300 g, por maior que seja', () => {
    expect(frameWeightCeiling({ age: 13, weight_kg: 75, sex: 'masculino' })!).toBeLessThanOrEqual(300);
    expect(frameWeightCeiling({ age: 15, weight_kg: 95, sex: 'masculino' })!).toBeLessThanOrEqual(300);
    // E aos 16 o limite de idade sai: é o mesmo corte de `ageFactor` e o do mercado de quadros.
    expect(frameWeightCeiling({ age: 16, weight_kg: 75, sex: 'masculino' })!).toBeGreaterThan(300);
  });
});

describe('o ranking respeita o teto', () => {
  it('o caso original não recebe mais 295 g nem 305 g', () => {
    const pesos = pesosDoPodio(MENINO_12);
    expect(pesos.length).toBeGreaterThan(0);
    const teto = frameWeightCeiling(MENINO_12)!;
    for (const g of pesos) expect(g, `pódio: ${pesos.join('/')}`).toBeLessThanOrEqual(teto);
  });

  /**
   * ═══ A ORDEM ENTRE O TETO E O PISO DE DEMANDA ════════════════════════════════════════════
   *
   * O piso de demanda declarada escolhe as melhores no eixo pedido DENTRO do que sobrou. Se ele
   * rodasse primeiro, o teto chegaria depois a um campo já reduzido — no caso original, a duas
   * raquetes de 300 g — e teria que escolher entre esvaziar a análise e se desligar. Um limite que
   * se desliga quando é acionado não é um limite.
   *
   * Este perfil declara controle e precisão de propósito: é a combinação que produzia aquele campo.
   */
  it('o pedido declarado escolhe DENTRO do teto, não contra ele', () => {
    const pesos = pesosDoPodio(MENINO_12);
    expect(pesos.every((g) => g <= frameWeightCeiling(MENINO_12)!)).toBe(true);
    expect(pesos.length).toBeGreaterThanOrEqual(2); // a oferta do Top 3 continua existindo (§30)
  });

  /**
   * ═══ POR QUE O TETO NÃO PODE SER APLICADO ANTES DA PONTUAÇÃO ═════════════════════════════
   *
   * Esta foi a primeira implementação, e ela estava errada de um jeito que só apareceu medindo
   * perfil por perfil: a atleta de 30 anos e 68 kg (teto 303 g) recebia um quadro de 285 g — mais
   * leve do que o da mulher de 54 kg, cujo teto é 289 g.
   *
   * A causa é que quase tudo que o motor calcula é RELATIVO ao conjunto pontuado
   * (`catalogReference`, `objectiveRescaler`, `equalizers`, `componentMeans`). Encolher o pool não
   * remove candidatas — reescreve o significado das notas que sobram: com o campo cortado em 303 g,
   * um quadro de 285 g deixava de ser leve e virava "o mais pesado disponível".
   *
   * A monotonicidade abaixo é a assinatura do defeito. Ela não pode voltar.
   */
  it('mais corpo nunca recebe raquete mais leve que menos corpo', () => {
    const atleta = respostas({
      age: 30, height_cm: 172, weight_kg: 68, sex: 'feminino',
      perceived_strength: 'bem_acima', fitness_level: 'atletico',
      frequency_per_week: 5, swing_speed: 'rapida',
    });
    const fraca = respostas({
      age: 45, height_cm: 158, weight_kg: 54, sex: 'feminino',
      perceived_strength: 'abaixo', fitness_level: 'sedentario',
    });

    const daAtleta = pesosDoPodio(atleta)[0]!;
    const daFraca = pesosDoPodio(fraca)[0]!;
    expect(daAtleta, `atleta ${daAtleta} g contra ${daFraca} g`).toBeGreaterThanOrEqual(daFraca);
  });

  /**
   * O teto não pode esvaziar a análise de ninguém — §62 e §69. É a mesma promessa que o resto do
   * motor faz: toda pessoa que responde recebe uma resposta.
   */
  it('nenhuma persona fica sem pódio', () => {
    for (const persona of PERSONAS) {
      const resultado = recommend({
        profile: buildPlayerProfile(persona.answers),
        rackets: CATALOGO,
        datasetVersion: TEST_DATASET_VERSION,
        mode: TEST_MODE,
      });
      expect(resultado.podium.length, persona.id).toBeGreaterThan(0);
    }
  });

  /**
   * E respeita o teto para TODAS elas — a garantia vale para o catálogo inteiro de perfis de
   * validação, não só para o caso que a originou.
   */
  it('nenhuma persona recebe quadro acima do próprio teto', () => {
    for (const persona of PERSONAS) {
      const profile = buildPlayerProfile(persona.answers);
      const teto = profile.frame_weight_ceiling_g;
      if (teto === null) continue;

      const resultado = recommend({
        profile,
        rackets: CATALOGO,
        datasetVersion: TEST_DATASET_VERSION,
        mode: TEST_MODE,
      });

      for (const p of resultado.podium) {
        const g = p.racket.variant.specs.unstrung_weight_g;
        // A raquete ATUAL é isenta: no relatório ela é referência, não candidata.
        if (g === null || p.racket.variant.id === profile.current_racket?.variant_id) continue;
        expect(g, `${persona.id} — teto ${teto} g`).toBeLessThanOrEqual(teto);
      }
    }
  });
});

/**
 * ═══ O AVISO DE MIGRAÇÃO JUVENIL ═════════════════════════════════════════════════════════════
 *
 * O teto resolve a metade técnica do problema do jovem: ele não recebe mais um quadro que o corpo
 * não sustenta. A outra metade é de honestidade, e nenhum número resolve.
 *
 * Este catálogo é de quadros ADULTOS — 27 polegadas, 270 g para cima. Para um menino de 12 anos
 * com 52 kg, a melhor resposta DENTRO dele pode não ser a melhor resposta que existe: raquetes
 * juvenis de 25 e 26 polegadas seguem sendo escolha legítima nessa fase, e esta análise não as
 * avalia. Apresentar como completo um universo que sabidamente não é o dele violaria §62.
 *
 * O aviso é o que fecha esse vão. Ele não retira a recomendação — diz o que ela é: a melhor entre
 * as adultas, para alguém que ainda está atravessando a passagem entre as duas categorias.
 */
describe('o aviso de migração juvenil', () => {
  const TUDO: Entitlement[] = [
    'racket_report_access',
    'full_setup_access',
    'rank2_access',
    'rank3_access',
  ];

  function aviso(a: QuestionnaireAnswers): string | null {
    const profile = enrichProfileWithCatalog(buildPlayerProfile(a), CATALOGO, null);
    const resultado = recommend({
      profile,
      rackets: CATALOGO,
      datasetVersion: TEST_DATASET_VERSION,
      mode: TEST_MODE,
    });
    return serializeRecommendation(resultado, profile, TUDO).junior_transition;
  }

  it('aparece para o jovem pequeno para o catálogo adulto', () => {
    expect(aviso(MENINO_12)).not.toBeNull();
  });

  /**
   * E NÃO aparece para o jovem grande — a distinção que evita o alarme falso.
   *
   * Um rapaz de 15 anos com 72 kg tem o teto travado em 300 g pela regra ETÁRIA, não pelo porte:
   * ele está inteiramente à vontade num quadro adulto, e um aviso de "talvez você ainda precise de
   * uma raquete juvenil" seria simplesmente falso sobre ele. Por isso a condição é o teto abaixo
   * de 300 g — que é o que descreve quem ainda é pequeno —, e não a idade sozinha.
   */
  it('não aparece para o jovem já grande', () => {
    const rapaz = respostas({
      age: 15, height_cm: 180, weight_kg: 72, sex: 'masculino',
      perceived_strength: 'acima', fitness_level: 'bom',
    });
    expect(aviso(rapaz)).toBeNull();
  });

  it('não aparece para adulto nenhum', () => {
    for (const kg of [50, 63, 78, 92]) {
      const adulto = respostas({
        age: 35, height_cm: 170, weight_kg: kg, sex: 'feminino',
        perceived_strength: 'media', fitness_level: 'moderado',
      });
      expect(aviso(adulto), `${kg} kg`).toBeNull();
    }
  });

  /**
   * O texto precisa dizer as duas coisas que o tornam honesto: que o catálogo é adulto, e que a
   * alternativa juvenil continua legítima. Sem a primeira o aviso não explica nada; sem a segunda
   * ele assusta sem oferecer saída.
   */
  it('diz o que o catálogo é e o que ele não avalia', () => {
    const texto = aviso(MENINO_12)!;
    expect(texto).toMatch(/adult/i);
    expect(texto).toMatch(/juven/i);
    expect(texto).toMatch(/27 polegadas|25 e 26 polegadas/);
  });
});

/**
 * ═══ O FATOR DE CAPACIDADE (v2.38.0) ═════════════════════════════════════════════════════════
 *
 * O teto era só PORTE, e por isso era inerte em quem mais precisava dele: a reta satura em 320 g,
 * o quadro mais pesado do catálogo tem 315 g, e a partir de 73 kg ele deixava de cortar qualquer
 * coisa. Varridos 58 perfis, era inerte em 56.
 *
 * A pontuação também não compensava. Medida a cadeia: `ageFactor` (1.00 … 0.65) entra em
 * `physical_capacity_score` com peso 0.14, que entra em `handlingCapacity` com 0.45 — 2,2 pontos de
 * capacidade entre 25 e 72 anos, contra a zona morta de 13 de `physicalFit`. Em grade, 25a e 72a
 * recebiam a MESMA raquete, o mesmo peso e a mesma inércia. A idade estava na fórmula e fora da
 * decisão.
 *
 * O que estes testes trancam não são os coeficientes — são as três propriedades que fazem o fator
 * ser um refinamento e não um veto etário.
 */
describe('o fator de capacidade', () => {
  const corpo = { age: 62, weight_kg: 78, sex: 'masculino' as const };

  /** Ele só APERTA. Nenhuma resposta pode liberar mais quadro do que o porte já autorizou. */
  it('nunca afrouxa o teto de porte', () => {
    const porte = frameWeightCeiling(corpo)!;
    for (const fitness of ['sedentario', 'moderado', 'bom', 'atletico'] as const) {
      for (const speed of ['lenta', 'moderada', 'rapida', 'muito_rapida'] as const) {
        const teto = frameWeightCeiling({ ...corpo, fitness_level: fitness, swing_speed: speed })!;
        expect(teto, `${fitness}/${speed} afrouxou o teto`).toBeLessThanOrEqual(porte);
      }
    }
  });

  /**
   * IDADE NÃO É VETO — a propriedade que o pedido do dono do produto fixou nestes termos:
   * "não necessariamente idade como veto".
   *
   * Um jogador de 62 anos com preparo bom e swing rápido tem de sair praticamente com o teto
   * intacto. Quem chega ao limite de 10% chegou SOMANDO preparo e swing, que são medidas diretas
   * que o questionário já faz — nunca pelo número da certidão.
   */
  it('idade sozinha quase não aperta; o que aperta é o que a pessoa respondeu sobre si', () => {
    const emForma = frameWeightCeiling({ ...corpo, fitness_level: 'bom', swing_speed: 'rapida' })!;
    const parado = frameWeightCeiling({ ...corpo, fitness_level: 'sedentario', swing_speed: 'lenta' })!;
    const jovemParado = frameWeightCeiling({
      ...corpo, age: 25, fitness_level: 'sedentario', swing_speed: 'lenta',
    })!;

    // O veterano em forma perde no máximo um degrau do catálogo.
    expect(frameWeightCeiling(corpo)! - emForma).toBeLessThanOrEqual(8);
    // E o sedentário de swing lento perde MUITO mais, aos 62 como aos 25.
    expect(emForma - parado).toBeGreaterThan(15);
    expect(jovemParado).toBeLessThan(emForma);
  });

  /**
   * O silêncio não desconta — a mesma regra de `armSensitivity`.
   *
   * É o que mantém a reta de porte verificável isoladamente: quem chama a função só com um corpo
   * recebe o teto de porte puro, e os casos de fronteira acima continuam medindo a reta, não o
   * fator.
   */
  it('sem respostas sobre preparo e swing, o teto é o do porte', () => {
    expect(frameWeightCeiling({ age: 30, weight_kg: 80, sex: 'masculino' })).toBe(
      frameWeightCeiling({
        age: 30, weight_kg: 80, sex: 'masculino',
        fitness_level: 'bom', swing_speed: 'rapida',
      }),
    );
  });

  /**
   * O PISO: o fator não pode apertar o teto até o ponto em que o catálogo não tem o que responder.
   *
   * Sem ele, a persona p07 (29 anos, 55 kg, sedentária, swing lento) recebia teto de 275 g,
   * sobravam 3 quadros de 47, `CEILING_MIN_SURVIVORS` desligava o teto inteiro — e ela terminava
   * com 285 g, acima do teto que o próprio relatório dela declarava. Um número que o motor não
   * honra é pior que um teto mais frouxo.
   */
  it('nenhuma persona recebe quadro acima do teto que o relatório dela declara', () => {
    for (const persona of PERSONAS) {
      const profile = enrichProfileWithCatalog(
        buildPlayerProfile(persona.answers), CATALOGO, CORDAS,
      );
      const teto = profile.frame_weight_ceiling_g;
      if (teto === null) continue;

      const r = recommend({
        profile, rackets: CATALOGO, strings: CORDAS,
        datasetVersion: TEST_DATASET_VERSION, mode: TEST_MODE, includeSetup: false,
      });
      for (const e of r.podium) {
        const g = e.racket.variant.specs.unstrung_weight_g;
        if (g === null) continue;
        expect(g, `${persona.id} — teto ${teto} g`).toBeLessThanOrEqual(teto);
      }
    }
  });

  /** E o piso nunca SOBE um teto: para um corpo pequeno, quem manda continua sendo a reta. */
  it('o piso não levanta o teto de um corpo pequeno', () => {
    const teto = frameWeightCeiling({
      age: 10, weight_kg: 35, sex: 'feminino',
      fitness_level: 'sedentario', swing_speed: 'lenta',
    })!;
    expect(teto).toBeLessThanOrEqual(frameWeightCeiling({ age: 10, weight_kg: 35, sex: 'feminino' })!);
    expect(teto).toBeLessThan(280);
  });
});
