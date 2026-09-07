/**
 * PURE DRIVE E PURE AERO NÃO SÃO A MESMA RAQUETE.
 *
 * ═══ O QUE O RELATÓRIO DIZIA ═════════════════════════════════════════════════════════════════
 *
 * "Tecnicamente idêntica à 3ª (Babolat Pure Aero): mesmas especificações publicadas, mesmo
 * resultado na análise. Escolha por preço, disponibilidade ou preferência de marca."
 *
 * As duas primeiras frases são verdadeiras — neste catálogo as duas publicam 300 g, balanço 320 mm,
 * 100 pol², 16×19 e viga 23/26/23, campo a campo. A terceira era um absurdo: as duas são Babolat,
 * então "preferência de marca" não separa nada, e o conselho contrariava o que qualquer pessoa que
 * joga sabe. Uma é a linha de POTÊNCIA da marca; a outra é a de SPIN.
 *
 * ═══ O QUE NÃO PODIA SER A SOLUÇÃO ═══════════════════════════════════════════════════════════
 *
 * Inventar uma largura de viga, uma rigidez ou um índice qualquer para "separar" as duas. Seria
 * fabricar dado — §69 — e contaminaria todos os scores com um número que ninguém publicou.
 *
 * A saída foi declarar o POSICIONAMENTO da linha (`domain/racket-lines.ts`): informação pública do
 * fabricante, sem unidade, que não entra em nenhuma média e não altera score nenhum. Ela só faz
 * duas coisas, e estes testes trancam as duas.
 *
 * ═══ EPÍLOGO (07/09/2026) — O EMPATE ERA CEGUEIRA, NÃO SEMELHANÇA ════════════════════════════
 *
 * O catálogo ganhou swingweight e RA MEDIDOS em laboratório, e o par que originou este arquivo
 * deixou de empatar: Pure Aero 320 kg·cm² / RA 66 contra Pure Drive 317 / RA 69. Nunca foram a
 * mesma raquete — as seis especificações publicadas é que não davam para distinguir.
 *
 * Antes da medição havia TRÊS grupos de vetor de atributos idêntico no catálogo (as duas Babolat
 * de 300 g, as duas Team, e HEAD Speed MP com Yonex Percept 100). Depois: ZERO. O último par
 * estava a 11 pontos de swingweight de distância.
 *
 * Isso muda o que estes testes podem provar. O posicionamento de linha continua certo e continua
 * valendo para qualquer raquete futura que entre sem medição — mas o catálogo real não produz mais
 * o cenário sozinho. Por isso os dois testes abaixo passaram a CONSTRUIR o empate em vez de
 * esperá-lo: um teste que depende de o catálogo ter gêmeas por acaso não testa a regra, testa a
 * coincidência. Foi assim que ele já quebrou uma vez, e agora quebraria de novo por um motivo que
 * é uma boa notícia.
 */

import { describe, expect, it } from 'vitest';
import { recommend, enrichProfileWithCatalog } from '@/recommendation';
import { buildPlayerProfile } from '@/recommendation/profile/build-profile';
import { serializeRecommendation, type Entitlement } from '@/payments/entitlements';
import { emptyAnswers, type QuestionnaireAnswers } from '@/recommendation/profile/answers';
import { LINE_ORIENTATION, lineOrientation } from '@/domain/racket-lines';
import { PERSONAS } from '@/data/personas';
import { TEST_DATASET_VERSION, TEST_MODE, testRackets, testStrings } from '../helpers/catalog';

const RACKETS = testRackets();
const STRINGS = testStrings();

/**
 * Catálogo com um empate CONSTRUÍDO entre a Pure Drive e a Pure Aero de 300 g.
 *
 * Dá à Pure Drive as ESPECIFICAÇÕES e os ATRIBUTOS da Pure Aero, preservando só a identidade —
 * id, nome e `family`, que é o que o posicionamento de linha consulta. O resultado é exatamente a
 * situação que o catálogo produzia sozinho antes da medição: duas raquetes de linhas diferentes,
 * indistinguíveis por dado.
 *
 * ═══ POR QUE AS SPECS PRECISAM VIR JUNTO, E NÃO SÓ OS ATRIBUTOS ══════════════════════════════
 *
 * A primeira versão copiava apenas `attributes`, e as duas continuaram com fit diferente (84,40
 * contra 82,88). O motivo é que o `fit_score` não sai só dos atributos: `fit-components` e
 * `penalties` chamam `computeSwingIndex(specs)` DIRETO nas especificações. Como o swingweight
 * agora mora ali, a Pure Drive mantinha os seus 317 enquanto os atributos diziam ser a Pure Aero
 * — uma raquete que não existe, e um empate que nunca se formava.
 *
 * Construir em vez de procurar é o ponto. Enquanto o empate vinha do catálogo, estes testes
 * dependiam de duas raquetes continuarem publicando as mesmas seis especificações — uma condição
 * que nada garante e que a medição desfez. A regra sob teste ("quando duas linhas têm
 * posicionamento declarado e ele difere, o card diz qual é qual") não depende disso, e agora o
 * teste também não.
 */
function catalogoComGemeas(): typeof RACKETS {
  const aero = RACKETS.find((r) => r.variant.product_name === 'Babolat Pure Aero (2026)')!;
  const drive = RACKETS.find((r) => r.variant.product_name === 'Babolat Pure Drive (2025)')!;
  const gemea = {
    ...aero,
    variant: {
      ...aero.variant,
      id: drive.variant.id,
      slug: drive.variant.slug,
      product_name: drive.variant.product_name,
      family: drive.variant.family,
      model: drive.variant.model,
    },
  };
  return RACKETS.map((r) => (r.variant.id === drive.variant.id ? gemea : r));
}
const TUDO: Entitlement[] = ['racket_report_access', 'full_setup_access', 'rank2_access', 'rank3_access'];

/** Jogador com swing formado, para que as duas Babolat de 300 g fiquem no páreo. */
function jogador(pedido: readonly string[]): QuestionnaireAnswers {
  return {
    ...emptyAnswers(),
    age: 30, height_cm: 180, weight_kg: 80, sex: 'masculino',
    perceived_strength: 'acima', fitness_level: 'bom', dominant_hand: 'destro',
    experience_duration: 'mais_5a', frequency_per_week: 3, has_lessons: 'ja_fiz',
    plays_matches: 'sim', tournament_experience: 'amadores',
    perceived_level: 'intermediario_avancado',
    can_sustain_rally: 'sim', can_direct_ball: 'sim', can_generate_spin: 'as_vezes',
    can_vary_depth: 'as_vezes', reliable_second_serve: 'as_vezes',
    swing_length: 'longo', swing_speed: 'rapida', depth_control: 'as_vezes',
    no_current_racket: true, discomfort_areas: ['nenhum'],
    missing_attributes: [...pedido],
    objective: [pedido[0] === 'spin' ? 'more_spin' : 'more_power'],
  } as QuestionnaireAnswers;
}

function posicaoDe(answers: QuestionnaireAnswers, family: string): number {
  const catalogo = catalogoComGemeas();
  const profile = enrichProfileWithCatalog(buildPlayerProfile(answers), catalogo, STRINGS);
  const r = recommend({
    profile, rackets: catalogo, strings: STRINGS,
    datasetVersion: TEST_DATASET_VERSION, mode: TEST_MODE, includeSetup: true,
  });
  return r.full_ranking.findIndex((x) => x.racket.variant.family === family) + 1;
}

describe('a tabela de linhas', () => {
  /** Ela descreve posicionamento, não medida — e por isso não pode virar um score. */
  it('todo eixo declarado é um eixo de necessidade do jogador', () => {
    const validos = ['power', 'spin', 'control', 'comfort'];
    for (const [linha, eixo] of Object.entries(LINE_ORIENTATION)) {
      expect(validos, `${linha} declara um eixo que o questionário não conhece`).toContain(eixo);
    }
  });

  /**
   * As linhas all-round ficam FORA de propósito.
   *
   * HEAD Speed, Radical e Boom são vendidas pelo fabricante como polivalentes. Atribuir um eixo a
   * elas seria decidir por ele — e uma orientação errada é pior que orientação nenhuma, porque
   * ordena com falsa confiança.
   */
  it('não inventa posicionamento para linha all-round', () => {
    for (const linha of ['Speed', 'Radical', 'Boom']) {
      expect(lineOrientation(linha), `${linha} ganhou um eixo que o fabricante não declara`).toBeNull();
    }
  });

  it('linha desconhecida não quebra nada', () => {
    expect(lineOrientation(null)).toBeNull();
    expect(lineOrientation('Linha Que Não Existe')).toBeNull();
  });
});

describe('o desempate segue o eixo que o jogador pediu', () => {
  /**
   * O par que originou a regra. As duas empatam ponto a ponto — o que muda é o que a pessoa pediu.
   */
  it('spin em 1º põe a Pure Aero na frente; potência em 1º, a Pure Drive', () => {
    const comSpin = jogador(['spin', 'power']);
    const comPotencia = jogador(['power', 'spin']);

    expect(posicaoDe(comSpin, 'Pure Aero')).toBeLessThan(posicaoDe(comSpin, 'Pure Drive'));
    expect(posicaoDe(comPotencia, 'Pure Drive')).toBeLessThan(posicaoDe(comPotencia, 'Pure Aero'));
  });

  /**
   * E ele NÃO reordena nada que não esteja exatamente empatado.
   *
   * O posicionamento é um critério de desempate, não um peso. Se ele passasse por cima de diferença
   * real de encaixe, teria virado o que a tabela promete não ser: uma nota inventada.
   */
  it('nunca inverte duas raquetes com fit diferente', () => {
    for (const persona of PERSONAS) {
      const profile = enrichProfileWithCatalog(buildPlayerProfile(persona.answers), RACKETS, STRINGS);
      const r = recommend({
        profile, rackets: RACKETS, strings: STRINGS,
        datasetVersion: TEST_DATASET_VERSION, mode: TEST_MODE, includeSetup: true,
      });
      for (let i = 1; i < r.full_ranking.length; i++) {
        expect(
          r.full_ranking[i - 1]!.fit_score,
          `${persona.id}: ranking deixou de ser monotônico em ${i}`,
        ).toBeGreaterThanOrEqual(r.full_ranking[i]!.fit_score);
      }
    }
  });
});

describe('o texto do card gêmeo', () => {
  /**
   * Duas Babolat não se escolhem "por preferência de marca". Quando as duas linhas têm
   * posicionamento declarado e ele difere, o card diz qual é qual.
   */
  it('explica o que separa as linhas em vez de mandar escolher por marca', () => {
    /*
      A varredura é sobre as PERSONAS, e não sobre um perfil montado à mão.

      A versão anterior deste teste usava um jogador construído aqui, e ele deixou de produzir card
      gêmeo quando a premissa do piso de demanda foi corrigida — o guard acusou ("nenhum card gêmeo
      no cenário") e o teste falhou por não ter o que provar, que é exatamente o comportamento
      desejado. Varrer as personas tira o teste da dependência de um perfil específico continuar
      caindo no caso.
    */
    const cards: string[] = [];
    const catalogo = catalogoComGemeas();
    for (const persona of PERSONAS) {
      const profile = enrichProfileWithCatalog(buildPlayerProfile(persona.answers), catalogo, STRINGS);
      const r = recommend({
        profile, rackets: catalogo, strings: STRINGS,
        datasetVersion: TEST_DATASET_VERSION, mode: TEST_MODE, includeSetup: true,
      });
      for (const e of serializeRecommendation(r, profile, TUDO).podium) {
        const d = (e as { distinction?: { identical_twin?: boolean; headline: string } }).distinction;
        if (d?.identical_twin) cards.push(d.headline);
      }
    }

    expect(cards.length, 'nenhum card gêmeo em nenhuma persona — o teste não prova nada')
      .toBeGreaterThan(0);

    // Duas raquetes da MESMA marca nunca se escolhem por "preferência de marca".
    const mesmaMarca = cards.filter((h) => /Babolat/.test(h));
    expect(mesmaMarca.length, 'nenhum par da mesma marca na varredura').toBeGreaterThan(0);
    for (const h of mesmaMarca) {
      expect(h, 'duas Babolat separadas por preferência de marca').toMatch(
        /linha de (potência|spin|controle|conforto)/,
      );
    }
  });

  /**
   * O empate técnico continua sendo DITO. Ele é verdade e é o limite honesto de seis
   * especificações — o conserto foi parar de fingir que, além dos dados, também não há diferença.
   */
  it('continua declarando o empate técnico', () => {
    const profile = enrichProfileWithCatalog(
      buildPlayerProfile(jogador(['power', 'spin'])), RACKETS, STRINGS,
    );
    const r = recommend({
      profile, rackets: RACKETS, strings: STRINGS,
      datasetVersion: TEST_DATASET_VERSION, mode: TEST_MODE, includeSetup: true,
    });
    const payload = serializeRecommendation(r, profile, TUDO);

    for (const e of payload.podium) {
      const d = (e as { distinction?: { identical_twin?: boolean; headline: string } }).distinction;
      if (!d?.identical_twin) continue;
      expect(d.headline).toMatch(/mesmas especificações publicadas/);
    }
  });
});
