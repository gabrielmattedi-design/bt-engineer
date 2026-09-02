/**
 * "Tá, mas o que eu faço com a raquete que eu já tenho?"
 *
 * ═══ A PERGUNTA QUE O RELATÓRIO NÃO RESPONDIA ════════════════════════════════════════════════
 *
 * O bloco da raquete atual dizia a posição dela no ranking e a distância para a primeira, e parava.
 * Para quem não vai trocar de quadro agora — a maioria, porque quadro custa caro — o produto
 * terminava numa constatação sem saída.
 *
 * Corda e tensão movem eixos reais, custam uma fração de um quadro e se desfazem no encordoamento
 * seguinte. Vender o diagnóstico e sonegar o remédio barato é exatamente o desenho que §58 e §62
 * proíbem — e era o desenho que estava no ar.
 *
 * Estes testes trancam as três coisas que fazem o bloco ser honesto: ele exige o setup pago, ele
 * nunca aparece sem a ressalva de até onde vai, e ele não é oferecido quando não teria o que dizer.
 */

import { describe, expect, it } from 'vitest';
import {
  buildCatalogScale,
  computeTension,
  enrichProfileWithCatalog,
  recommend,
  selectStringVariant,
} from '@/recommendation';
import type { PlayerProfile } from '@/domain/player-profile';
import { buildPlayerProfile } from '@/recommendation/profile/build-profile';
import { serializeRecommendation, type Entitlement } from '@/payments/entitlements';
import { PERSONAS } from '@/data/personas';
import { TEST_DATASET_VERSION, TEST_MODE, testRackets, testStrings } from '../helpers/catalog';

const RACKETS = testRackets();
const STRINGS = testStrings();

const TUDO: Entitlement[] = [
  'racket_report_access',
  'full_setup_access',
  'rank2_access',
  'rank3_access',
];
const SO_RAQUETE: Entitlement[] = ['racket_report_access'];

function analisar(persona: (typeof PERSONAS)[number], granted: Entitlement[]) {
  const profile = enrichProfileWithCatalog(buildPlayerProfile(persona.answers), RACKETS, STRINGS);
  const result = recommend({
    profile,
    rackets: RACKETS,
    strings: STRINGS,
    datasetVersion: TEST_DATASET_VERSION,
    mode: TEST_MODE,
    includeSetup: true,
  });
  return { profile, result, payload: serializeRecommendation(result, profile, granted) };
}

/** As personas que têm raquete reconhecida — as únicas em que o bloco pode existir. */
const COM_RAQUETE = PERSONAS.filter((p) => p.answers.current_racket_id && !p.answers.no_current_racket);

describe('o bloco da raquete atual', () => {
  it('existe para quem tem raquete e comprou o setup', () => {
    expect(COM_RAQUETE.length, 'nenhuma persona tem raquete — o teste não prova nada').toBeGreaterThan(0);
    const comBloco = COM_RAQUETE.filter((p) => analisar(p, TUDO).payload.current_racket_setup);
    expect(comBloco.length).toBeGreaterThan(0);
  });

  /**
   * §32 — dado premium não é escondido por CSS, ele NÃO É CONSTRUÍDO.
   *
   * Este bloco entrega marca, modelo, espessura e tensão: é o produto `full_setup` inteiro,
   * aplicado a outro quadro. Sem o entitlement ele não pode chegar ao cliente de forma nenhuma.
   */
  it('não é construído sem o setup pago', () => {
    for (const persona of COM_RAQUETE) {
      expect(analisar(persona, SO_RAQUETE).payload.current_racket_setup, persona.id).toBeNull();
    }
  });

  /**
   * A ressalva é obrigatória, e é o que separa uma análise de um argumento de venda.
   *
   * Corda e tensão não movem peso, balanço, tamanho de cabeça nem rigidez — que é onde a diferença
   * para a recomendada mora. Um bloco só com ganhos prometeria o que não pode cumprir (§58).
   */
  it('nunca aparece sem dizer até onde vai', () => {
    for (const persona of COM_RAQUETE) {
      const bloco = analisar(persona, TUDO).payload.current_racket_setup;
      if (!bloco) continue;
      expect(bloco.ceiling_note.length, persona.id).toBeGreaterThan(80);
    }
  });

  /**
   * Quando a raquete atual JÁ É a recomendada, o setup principal é o dela — e dois blocos com a
   * mesma corda fariam a pessoa procurar a diferença entre duas coisas idênticas.
   */
  it('não se repete quando a raquete atual é a própria recomendada', () => {
    for (const persona of COM_RAQUETE) {
      const { result, payload } = analisar(persona, TUDO);
      const vencedoraId = result.podium[0]?.racket.variant.id;
      if (vencedoraId !== persona.answers.current_racket_id) continue;
      expect(payload.current_racket_setup, persona.id).toBeNull();
    }
  });

  /** O que o bloco promete é o mesmo cálculo — então os números precisam ser números de verdade. */
  it('entrega corda, espessura e tensão completas', () => {
    for (const persona of COM_RAQUETE) {
      const bloco = analisar(persona, TUDO).payload.current_racket_setup;
      if (!bloco) continue;
      expect(bloco.string_brand, persona.id).not.toBe('');
      expect(bloco.gauge_mm).toBeGreaterThan(1);
      expect(bloco.tension_lbs).toBeGreaterThan(30);
      expect(bloco.tension_range_lbs[0]).toBeLessThanOrEqual(bloco.tension_lbs);
      expect(bloco.tension_range_lbs[1]).toBeGreaterThanOrEqual(bloco.tension_lbs);
      /*
        Rótulo em português, e não o valor do enum.

        O card de corda do relatório imprimia `co_polyester` para quem tinha pago pela análise —
        o `Record<StringType, string>` do domínio existe para que uma categoria nova não possa
        nascer sem nome legível.
      */
      expect(bloco.string_type, persona.id).not.toMatch(/_/);
    }
  });
});

describe('a leitura do peso', () => {
  /**
   * ═══ POR QUE ESTA NOTA PRECISA EXISTIR ═══════════════════════════════════════════════════
   *
   * O ranking ordena por inércia de swing (peso × distribuição), e não por peso na balança. É a
   * grandeza certa — e produz resultados que contradizem a leitura ingênua do número de gramas:
   *
   *     Wilson Clash 100 Pro   305 g · 310 mm  →  índice 32,4
   *     Babolat Pure Aero Lite 270 g · 330 mm  →  índice 43,5
   *
   * Quem lê "recomendamos 305 g" depois de jogar com 285 g conclui que estão pedindo mais esforço
   * dele. Estão pedindo menos, e não havia como saber pela página.
   */
  /**
   * A nota afirma uma CONTRADIÇÃO — "a mais pesada é a que gira mais fácil" —, e a contradição
   * precisa existir de verdade. Se ela aparecesse sem isso, o relatório estaria explicando um
   * fenômeno que não está na tela, o que é pior do que não explicar nada.
   *
   * Há duas referências possíveis, e a nota usa a primeira que serve: a raquete atual do jogador
   * (a melhor, porque ele já a sentiu na mão) ou a mais leve do próprio pódio. O teste aceita
   * qualquer uma — o que ele não aceita é nenhuma das duas.
   */
  it('só aparece quando a contradição entre peso e esforço existe mesmo', () => {
    for (const persona of PERSONAS) {
      const { result, payload } = analisar(persona, TUDO);
      if (!payload.weight_reading) continue;

      const primeira = result.podium[0]!;
      const pesoNovo = primeira.racket.variant.specs.unstrung_weight_g!;
      const inerciaNova = primeira.racket.attributes.swing_index;

      const candidatos = [
        result.full_ranking.find((r) => r.racket.variant.id === persona.answers.current_racket_id),
        [...result.podium].sort(
          (a, b) =>
            (a.racket.variant.specs.unstrung_weight_g ?? 0) -
            (b.racket.variant.specs.unstrung_weight_g ?? 0),
        )[0],
      ];

      const contradiz = candidatos.some((c) => {
        const peso = c?.racket.variant.specs.unstrung_weight_g;
        const inercia = c?.racket.attributes.swing_index;
        return peso != null && inercia != null && pesoNovo > peso && inerciaNova <= inercia;
      });

      expect(contradiz, `${persona.id}: nota de peso sem contradição que a sustente`).toBe(true);
    }
  });

  it('não é genérica — cita gramas e o índice', () => {
    const comNota = PERSONAS.map((p) => analisar(p, TUDO).payload.weight_reading).filter(
      (n): n is string => n !== null,
    );
    expect(comNota.length, 'nenhuma persona produz a nota — o teste não prova nada').toBeGreaterThan(0);
    for (const nota of comNota) {
      expect(nota).toMatch(/\d+ g/);
      expect(nota).toMatch(/inércia/);
    }
  });
});

/**
 * ═══ UMA RAQUETE, UMA RESPOSTA ═══════════════════════════════════════════════════════════════
 *
 * Relatado com o relatório aberto: a raquete do jogador ficou no pódio, ele usou o seletor para
 * calcular o setup em cima dela, e a página passou a mostrar DUAS cordas diferentes para a MESMA
 * raquete — as duas de poliéster, na mesma tensão, modelos diferentes.
 *
 * Eram dois defeitos somados, e os dois testados aqui:
 *
 *   1. CÁLCULO. `withSetupFor` recalcula o setup quando o seletor muda de alvo, e não passava a
 *      régua do catálogo para `selectStringVariant` — um argumento que era OPCIONAL e mudava o
 *      resultado. Hoje é obrigatório: esquecê-lo não compila.
 *
 *   2. DUPLICAÇÃO. `current_racket_setup` é gravado quando a atual não é a vencedora, e o seletor
 *      pode apontar para ela depois, sem que o valor gravado saiba disso.
 */
describe('a mesma raquete nunca recebe duas cordas', () => {
  /**
   * A régua do catálogo NÃO é um detalhe de afinação — ela muda a corda escolhida.
   *
   * Este teste existe para que ninguém volte a torná-la opcional "porque não deve fazer diferença".
   * Se um dia ela realmente não fizer, este teste falha e a conversa acontece na mesa, não no
   * relatório de um cliente.
   */
  it('a régua do catálogo muda a corda escolhida', () => {
    const escala = buildCatalogScale(RACKETS);
    let divergiram = 0;

    for (const persona of PERSONAS) {
      const profile = enrichProfileWithCatalog(buildPlayerProfile(persona.answers), RACKETS, STRINGS);
      const alvo = recommend({
        profile,
        rackets: RACKETS,
        strings: STRINGS,
        datasetVersion: TEST_DATASET_VERSION,
        mode: TEST_MODE,
        includeSetup: true,
      }).podium[0];
      if (!alvo) continue;

      const comRegua = selectStringVariant(profile, alvo.racket, STRINGS, escala, TEST_MODE);
      /*
        A régua "vazia" é a de um catálogo de uma raquete só — o mais perto que dá de chegar do
        estado antigo agora que o argumento é obrigatório. Se ela produzisse sempre a mesma corda,
        a régua não estaria fazendo nada.
      */
      const semRegua = selectStringVariant(
        profile,
        alvo.racket,
        STRINGS,
        buildCatalogScale([alvo.racket]),
        TEST_MODE,
      );
      if (comRegua?.variant.variant.id !== semRegua?.variant.variant.id) divergiram++;
    }

    expect(divergiram, 'a régua virou enfeite — ou o cálculo mudou de forma').toBeGreaterThan(0);
  });

  /**
   * Quando o setup principal já aponta para a raquete do jogador, o bloco separado não existe — e
   * no lugar dele fica uma frase dizendo por quê. Silêncio aqui seria lido como entrega faltando.
   */
  it('o bloco some quando o setup já é o da raquete atual, e a página diz isso', () => {
    for (const persona of COM_RAQUETE) {
      const { result, payload } = analisar(persona, TUDO);
      const atualId = persona.answers.current_racket_id;
      if (payload.setup_for_variant_id !== atualId) continue;

      expect(payload.current_racket_setup, `${persona.id}: raquete com dois setups`).toBeNull();
      expect(payload.current_racket_setup_note, `${persona.id}: sumiço sem explicação`).not.toBeNull();
      expect(result.podium.length).toBeGreaterThan(0);
    }
  });

  /**
   * ═══ E A AUSÊNCIA NUNCA É MUDA ═══════════════════════════════════════════════════════════
   *
   * A home, o comparativo de planos e a descrição do produto anunciam "corda e tensão para a
   * raquete que você já tem". Quem paga e não encontra a seção conclui que o produto não entregou.
   *
   * Relatado assim, com dois testes lado a lado: "no meu teste pessoal apareceu, mas no teste
   * infantil não apareceu essa seção, não sei porquê". A página não respondia — agora responde.
   */
  it('quem comprou o setup sempre recebe o bloco OU a explicação', () => {
    for (const persona of PERSONAS) {
      const { payload } = analisar(persona, TUDO);
      const temUmDosDois =
        payload.current_racket_setup !== null || payload.current_racket_setup_note !== null;
      expect(temUmDosDois, `${persona.id}: nem o bloco nem o motivo da falta`).toBe(true);
    }
  });

  /** E quem não comprou não recebe nem um nem outro: a explicação não pode virar teaser (§32). */
  it('quem não comprou não recebe nem o bloco nem a explicação', () => {
    for (const persona of PERSONAS) {
      const { payload } = analisar(persona, SO_RAQUETE);
      expect(payload.current_racket_setup, persona.id).toBeNull();
      expect(payload.current_racket_setup_note, persona.id).toBeNull();
    }
  });
});

/**
 * ═══ A MATRIZ INTEIRA: NUNCA UM SILÊNCIO ═════════════════════════════════════════════════════
 *
 * A pergunta que originou este bloco foi feita assim: "se minha raquete ficar em primeiro; se ficar
 * em segundo ou terceiro; se ela não aparecer; se quem preencher não disser qual raquete usa — o
 * sistema está preparado para todas essas situações e outras que eu possa não ter pensado?".
 *
 * Estava para quatro delas. A varredura achou duas que não:
 *
 *   • raquete em 1º E o seletor de setup movido para outra posição do pódio — o bloco nunca tinha
 *     sido calculado (porque ela era a vencedora) e o aviso caía num `return null` final;
 *   • análise gravada antes desta seção existir — mesmo `return null`.
 *
 * Nos dois a página não mostrava nem o bloco nem o motivo. A invariante abaixo é o que impede que
 * um terceiro caso desses nasça sem ninguém ver: quem comprou o setup recebe SEMPRE uma das duas
 * coisas.
 */
describe('todas as situações da raquete atual', () => {
  const escala = buildCatalogScale(RACKETS);

  /** Reproduz o que `withSetupFor` faz quando o jogador aponta o seletor para outra posição. */
  function comSetupEm(result: ReturnType<typeof analisar>['result'], profile: PlayerProfile, id: string | null) {
    if (!id) return result;
    const alvo = result.podium.find((e) => e.racket.variant.id === id);
    if (!alvo || alvo.rank === 1) return result;
    const corda = selectStringVariant(profile, alvo.racket, STRINGS, escala, TEST_MODE);
    if (!corda) return result;
    return {
      ...result,
      string_recommendation: corda,
      tension: computeTension(alvo.racket, corda.variant, profile),
      setup_for_variant_id: id,
    };
  }

  /**
   * Cada raquete do catálogo declarada como atual, com o seletor em cada posição do pódio — mais o
   * caso sem raquete e o de relatório antigo. É a varredura que achou os dois buracos.
   */
  it('bloco OU explicação, em toda combinação', () => {
    const perfilBase = PERSONAS.find((p) => p.answers.current_racket_id)!;
    let combinacoes = 0;

    for (const racket of RACKETS.slice(0, 12)) {
      const answers = { ...perfilBase.answers, current_racket_id: racket.variant.id };
      const profile = enrichProfileWithCatalog(buildPlayerProfile(answers), RACKETS, STRINGS);
      const base = recommend({
        profile,
        rackets: RACKETS,
        strings: STRINGS,
        datasetVersion: TEST_DATASET_VERSION,
        mode: TEST_MODE,
        includeSetup: true,
      });

      // O seletor pode estar no padrão ou em qualquer posição do pódio.
      const alvos = [null, ...base.podium.map((e) => e.racket.variant.id)];
      for (const alvo of alvos) {
        const payload = serializeRecommendation(comSetupEm(base, profile, alvo), profile, TUDO);
        combinacoes++;
        expect(
          payload.current_racket_setup !== null || payload.current_racket_setup_note !== null,
          `${racket.variant.id} com setup em ${alvo ?? 'padrão'}: nem bloco nem motivo`,
        ).toBe(true);
      }

      /*
        Relatório ANTIGO: a chave não existe no resultado gravado.

        `undefined` e `null` precisam continuar significando coisas diferentes — é o que separa
        "análise anterior a esta seção" de "não houve o que calcular".
      */
      const antigo = { ...base, current_racket_setup: undefined };
      const doAntigo = serializeRecommendation(antigo, profile, TUDO);
      expect(doAntigo.current_racket_setup, `${racket.variant.id}: bloco fabricado sobre análise antiga`).toBeNull();
      expect(doAntigo.current_racket_setup_note, `${racket.variant.id}: análise antiga em silêncio`).not.toBeNull();
    }

    expect(combinacoes, 'a varredura não cobriu nada').toBeGreaterThan(30);
  });

  /**
   * Com a raquete em 1º e o seletor movido, o bloco APARECE — e não vira um aviso.
   *
   * Este era o caso silencioso, e a correção certa não era escrever mais um texto: era calcular o
   * setup da raquete atual sempre, e deixar a decisão de exibir com o relatório. Quem move o
   * seletor para explorar outro quadro continua vendo o que fazer com o próprio.
   */
  it('raquete em 1º com o seletor movido recebe o bloco, não um aviso', () => {
    const perfilBase = PERSONAS.find((p) => p.answers.current_racket_id)!;
    let testados = 0;

    for (const racket of RACKETS) {
      const answers = { ...perfilBase.answers, current_racket_id: racket.variant.id };
      const profile = enrichProfileWithCatalog(buildPlayerProfile(answers), RACKETS, STRINGS);
      const base = recommend({
        profile,
        rackets: RACKETS,
        strings: STRINGS,
        datasetVersion: TEST_DATASET_VERSION,
        mode: TEST_MODE,
        includeSetup: true,
      });
      if (base.podium[0]?.racket.variant.id !== racket.variant.id) continue;

      const segunda = base.podium[1]?.racket.variant.id;
      if (!segunda) continue;

      const payload = serializeRecommendation(comSetupEm(base, profile, segunda), profile, TUDO);
      expect(payload.current_racket_setup, `${racket.variant.id}: sumiu ao mover o seletor`).not.toBeNull();
      testados++;
      if (testados >= 3) break;
    }

    expect(testados, 'nenhuma raquete venceu o próprio ranking — o teste não prova nada').toBeGreaterThan(0);
  });
});
