/**
 * O PÓDIO E O RANKING SÃO DUAS LISTAS, E O RELATÓRIO PRECISA DIZER ISSO.
 *
 * ═══ O DEFEITO, LIDO NUM PDF DE CLIENTE ══════════════════════════════════════════════════════
 *
 * Página 9: "Sua Yonex EZONE 100 · 300 g ficou em 2º entre as 8 deste ranking, com os mesmos 80%
 * de compatibilidade da primeira — a diferença entre as duas é menor que um ponto."
 *
 * Página 10: "A 1ª colocada se destacou: das 8 raquetes avaliadas, nenhuma outra chegou perto o
 * bastante para ser considerada equivalente."
 *
 * Página 11, o pódio: 1º Yonex EZONE 100L · 80%, 2º Wilson Ultra 100L · 78%, 3º Babolat Pure Aero
 * Team · 77%. A raquete do jogador não aparece.
 *
 * Três afirmações no mesmo documento, duas delas se contradizendo e a terceira escondendo a razão.
 * Nenhuma delas era erro de conta:
 *
 *   • `full_ranking` é a ordem pura por encaixe. É de onde sai o "2º".
 *   • `podium` é uma seleção de três, com no máximo uma raquete por linha de produto (§29) e
 *     RENUMERADA de 1 a 3. EZONE 100L e EZONE 100 são a mesma linha `Yonex::EZONE`, então a do
 *     jogador é pulada — e some da única lista que ele vê.
 *   • `tied` em `buildSeparation` INCLUI a própria primeira, e o corte era `tied <= 2`. Com uma
 *     outra empatada, o texto de zero empatadas era impresso.
 *
 * Estes testes trancam as três coisas.
 */

import { describe, expect, it } from 'vitest';
import { recommend, enrichProfileWithCatalog } from '@/recommendation';
import { buildPlayerProfile } from '@/recommendation/profile/build-profile';
import { serializeRecommendation, type Entitlement } from '@/payments/entitlements';
import { buildSeparation } from '@/payments/podium-tie';
import { PERSONAS } from '@/data/personas';
import { TEST_DATASET_VERSION, TEST_MODE, testRackets, testStrings } from '../helpers/catalog';
import type { RankedRacket } from '@/domain/recommendation';

const RACKETS = testRackets();
const STRINGS = testStrings();
const TUDO: Entitlement[] = ['racket_report_access', 'full_setup_access', 'rank2_access', 'rank3_access'];

function analisar(answers: (typeof PERSONAS)[number]['answers']) {
  const profile = enrichProfileWithCatalog(buildPlayerProfile(answers), RACKETS, STRINGS);
  const result = recommend({
    profile,
    rackets: RACKETS,
    strings: STRINGS,
    datasetVersion: TEST_DATASET_VERSION,
    mode: TEST_MODE,
    includeSetup: true,
  });
  return { profile, result, payload: serializeRecommendation(result, profile, TUDO) };
}

describe('a posição citada e o pódio exibido', () => {
  /**
   * A varredura que achou o caso: cada persona × cada raquete do catálogo como atual.
   *
   * Medido antes do conserto: 10 das 1.034 combinações colocavam a raquete do jogador no top 3 do
   * ranking e fora do pódio, e em TODAS a 1ª colocada era da mesma linha. É raro — e chegou a um
   * cliente, que foi como apareceu.
   */
  it('quando a raquete do jogador some do pódio, o texto explica por quê', () => {
    let casos = 0;

    for (const persona of PERSONAS) {
      for (const racket of RACKETS) {
        const { result, payload } = analisar({
          ...persona.answers,
          current_racket_id: racket.variant.id,
          no_current_racket: false,
        });

        const standing = payload.current_racket_standing;
        if (!standing) continue;

        const noPodio = result.podium.some((e) => e.racket.variant.id === racket.variant.id);
        if (noPodio || standing.rank > 3) continue;

        casos++;
        /*
          Duas saídas aceitáveis, e nenhuma delas é o silêncio.

          Quem foi PULADA pela regra de família entra em modo família: sem posição, sem percentual,
          com a comparação entre as duas irmãs. Quem apenas ficou abaixo do corte mantém posição e
          percentual — ali não há contradição com o pódio — mas o texto precisa dizer que a regra
          de uma raquete por linha existe, senão a ausência dela continua sem explicação.
        */
        if (standing.family_match) {
          expect(standing.message, `${persona.id} + ${racket.variant.product_name}`).toMatch(
            /mesma linha da \d+ª colocada/,
          );
        } else {
          expect(
            standing.message,
            `${persona.id} + ${racket.variant.product_name}: ${standing.rank}º no ranking, fora do ` +
              'pódio, e o texto não avisa',
          ).toMatch(/uma raquete por linha/);
        }
      }
    }

    expect(casos, 'a varredura não encontrou o caso — o teste não prova nada').toBeGreaterThan(0);
  });

  /**
   * E o texto nunca pode afirmar uma posição de PÓDIO a partir da posição de ranking.
   *
   * O pódio renumera de 1 a 3. Dizer "ficou em 2º" e mostrar outra raquete no card "2" é a mesma
   * palavra para duas listas diferentes, e foi o que produziu a leitura de erro grave.
   */
  it('a posição citada é sempre a do ranking completo, e o texto diz de onde ela vem', () => {
    for (const persona of PERSONAS) {
      const { result, payload } = analisar(persona.answers);
      const standing = payload.current_racket_standing;
      if (!standing) continue;

      const noRanking = result.full_ranking.find(
        (r) => r.racket.variant.id === persona.answers.current_racket_id,
      );
      expect(standing.rank, persona.id).toBe(noRanking?.rank);
    }
  });
});

describe('a contagem de empatadas', () => {
  /** Monta um ranking com `quantasEmpatadas` raquetes dentro do limiar da primeira. */
  function ranking(total: number, quantasEmpatadas: number): RankedRacket[] {
    return RACKETS.slice(0, total).map((racket, i) => ({
      rank: i + 1,
      racket,
      // Empatadas ficam a 0,1 ponto; as demais, a 20.
      fit_score: i < quantasEmpatadas ? 90 - i * 0.1 : 70,
      breakdown: {
        final_score: 0, components: [], penalties: [], data_completeness: 1, gained: [], lost: [],
      },
      technical_tie_with_previous: false,
    }));
  }

  /**
   * `tied` conta a própria primeira. Um significa "nenhuma outra"; dois significa "uma outra".
   *
   * O corte era `tied <= 2` com o texto de zero empatadas — e foi assim que o relatório afirmou que
   * nenhuma outra havia chegado perto, duas páginas depois de dizer que a diferença para a raquete
   * do jogador era menor que um ponto.
   */
  it('com uma única empatada, o texto não diz que nenhuma chegou perto', () => {
    const sep = buildSeparation(ranking(8, 2))!;
    expect(sep.tied_with_first).toBe(2);
    expect(sep.message, 'ainda afirma que ninguém chegou perto').not.toMatch(/nenhuma outra/);
    expect(sep.message).toMatch(/apenas uma outra/);
  });

  it('sem nenhuma outra empatada, o texto continua o de sempre', () => {
    const sep = buildSeparation(ranking(8, 1))!;
    expect(sep.tied_with_first).toBe(1);
    expect(sep.message).toMatch(/nenhuma outra/);
  });
});

/**
 * ═══ MODO FAMÍLIA: A COMPARAÇÃO ENTRA NO LUGAR DO NÚMERO ═════════════════════════════════════
 *
 * Decisão do dono do produto, depois de ver a contradição impressa: quando a raquete do jogador é
 * irmã de linha de uma que está no pódio, o relatório não mostra posição nem percentual dela —
 * mostra o que separa as duas.
 *
 * O raciocínio dele, que é o mesmo que a implementação segue: "onde uma tem mais valências e a
 * outra tem mais dificuldade, e vice-versa, no fim isso pode se equilibrar por questão
 * matemática". É literalmente o que acontece — os índices exibidos são nivelados para somar o
 * mesmo em toda raquete, então duas variantes da mesma linha trocam pontos entre eixos e chegam ao
 * mesmo total. O agregado empata por construção; os eixos mostram a diferença.
 */
describe('quando a sua raquete é irmã de linha de uma do pódio', () => {
  /** Todas as combinações que entram em modo família, na varredura persona × raquete atual. */
  const casos = PERSONAS.flatMap((persona) =>
    RACKETS.map((racket) => {
      const { result, payload } = analisar({
        ...persona.answers,
        current_racket_id: racket.variant.id,
        no_current_racket: false,
      });
      return { id: `${persona.id}+${racket.variant.product_name}`, result, payload };
    }).filter((c) => c.payload.current_racket_standing?.family_match),
  );

  it('a varredura encontra o caso', () => {
    expect(casos.length, 'nenhuma combinação entra em modo família — os testes abaixo não provam nada')
      .toBeGreaterThan(0);
  });

  /** É o conserto inteiro: o número que colidia com o pódio não vai mais para a tela. */
  it('o texto não cita a posição nem o percentual da raquete do jogador', () => {
    for (const { id, payload } of casos) {
      const msg = payload.current_racket_standing!.message;
      expect(msg, `${id}: voltou a citar a posição`).not.toMatch(/ficou em \d+º/);
      expect(msg, `${id}: voltou a citar o percentual`).not.toMatch(/\d+\s?%/);
      expect(msg, `${id}: voltou a citar distância em pontos`).not.toMatch(/\d+ pontos? da primeira/);
    }
  });

  /**
   * E a irmã citada é MESMO a que está no pódio, na posição em que o pódio a mostra.
   *
   * Citar "1ª colocada" e o pódio exibir aquela raquete em outro card seria trocar uma contradição
   * por outra.
   */
  it('aponta a irmã pela posição que ela ocupa no pódio', () => {
    for (const { id, result, payload } of casos) {
      const fm = payload.current_racket_standing!.family_match!;
      const noPodio = result.podium.find((e) => e.racket.variant.product_name === fm.sibling_name);
      expect(noPodio, `${id}: a irmã citada não está no pódio`).toBeDefined();
      expect(noPodio!.rank, `${id}: posição da irmã não bate com o pódio`).toBe(fm.sibling_rank);
      expect(fm.family, `${id}: linha citada não é a da raquete do jogador`).toBe(
        result.full_ranking.find((r) => r.racket.variant.product_name.includes(fm.family))?.racket
          .variant.family ?? fm.family,
      );
    }
  });

  /**
   * Esconder o número não pode virar esconder a conclusão.
   *
   * A seção existe para responder "vale trocar?". Uma versão discreta que também deixasse de
   * responder isso seria omissão, não discrição — §58 vale nas duas direções.
   */
  it('continua dizendo se vale trocar', () => {
    for (const { id, payload } of casos) {
      const st = payload.current_racket_standing!;
      expect(st.verdict, id).toMatch(/keep|marginal|upgrade/);
      expect(st.message, `${id}: não conclui nada sobre a troca`).toMatch(
        /lado a lado|vantagem moderada|vantagem clara/,
      );
    }
  });

  /**
   * As duas colunas de eixos são o que substitui o percentual — e elas não podem se repetir.
   *
   * Um eixo em que as duas empatam não entra em lado nenhum; um eixo listado dos dois lados seria
   * contradição pura.
   */
  it('nenhum eixo aparece dos dois lados', () => {
    for (const { id, payload } of casos) {
      const fm = payload.current_racket_standing!.family_match!;
      for (const eixo of fm.your_edge) {
        expect(fm.sibling_edge, `${id}: "${eixo}" aparece dos dois lados`).not.toContain(eixo);
      }
    }
  });

  /**
   * ═══ A FRASE DE SALDO SÓ AFIRMA EQUILÍBRIO ONDE ELE EXISTE ═══════════════════════════════
   *
   * Pedida assim: "eu acho legal concluir que pro seu perfil no fim ela se equilibra, onde uma é
   * melhor a outra é pior". A observação é boa — e medida, ela é verdadeira em 12 de 12 casos no
   * que diz respeito à TROCA: nunca existe uma irmã que ganhe em todos os eixos.
   *
   * O que varia é o SALDO. Os gaps observados vão de 0 a 13 pontos. Com gap 0 as duas são de fato
   * equivalentes; com gap 13 a troca de eixos continua existindo e mesmo assim a do pódio ficou
   * claramente à frente. Usar a mesma frase nos dois transformaria uma observação verdadeira em
   * conforto falso — que é o oposto do que o §58 pede.
   */
  it('só diz "se equilibra" quando as duas estão de fato lado a lado', () => {
    let equilibradas = 0;
    let desequilibradas = 0;

    for (const { id, result, payload } of casos) {
      const st = payload.current_racket_standing!;
      const nota = st.family_match!.balance_note;
      if (!nota) continue;

      const gap = Math.round(result.full_ranking[0]!.fit_score) - Math.round(st.fit_score);
      if (st.verdict === 'keep') {
        equilibradas++;
        expect(nota, `${id}: gap ${gap} e não diz que se equilibra`).toMatch(/se equilibra/);
      } else {
        desequilibradas++;
        expect(nota, `${id}: gap ${gap} e afirma equilíbrio mesmo assim`).not.toMatch(/se equilibra/);
        expect(nota, `${id}: não diz para onde o saldo pende`).toMatch(/ficou à frente/);
      }
    }

    expect(equilibradas, 'nenhum caso equilibrado na varredura').toBeGreaterThan(0);
    expect(desequilibradas, 'nenhum caso desequilibrado na varredura').toBeGreaterThan(0);
  });

  /** Sem troca mútua não há saldo a concluir — e a frase some em vez de inventar uma. */
  it('não conclui nada quando um dos lados não tem eixo nenhum', () => {
    for (const { id, payload } of casos) {
      const fm = payload.current_racket_standing!.family_match!;
      if (fm.your_edge.length > 0 && fm.sibling_edge.length > 0) continue;
      expect(fm.balance_note, `${id}: concluiu equilíbrio sem troca de eixos`).toBeNull();
    }
  });

  /** Fora do modo família, nada muda: posição e percentual continuam na tela. */
  it('não vaza para quem não é irmã de linha', () => {
    for (const persona of PERSONAS) {
      const { result, payload } = analisar(persona.answers);
      const st = payload.current_racket_standing;
      if (!st) continue;
      const noPodio = result.podium.some(
        (e) => e.racket.variant.id === persona.answers.current_racket_id,
      );
      if (!noPodio) continue;
      expect(st.family_match, `${persona.id}: está no pódio e mesmo assim entrou em modo família`)
        .toBeNull();
    }
  });
});
