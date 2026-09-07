/**
 * O veredicto sobre a raquete atual não pode contradizer o próprio cabeçalho.
 *
 * ═══ O DEFEITO QUE ESTE TESTE TRANCA ═════════════════════════════════════════════════════════
 *
 * Pego por leitura, com o relatório na tela:
 *
 *     Babolat Pure Drive · 300 g — 2º lugar, 88% de compatibilidade
 *     "A raquete que você já tem é A MELHOR OPÇÃO para o seu jogo entre as 8 deste ranking."
 *
 * O título e o corpo do MESMO card se contradiziam. A causa é aritmética: `gap` é a diferença
 * entre dois `fit_score` já arredondados, e a primeira marcava 88,45 contra 88,00 da atual — os
 * dois viram 88, o gap dá zero, e o ramo de gap zero assumia que zero significa primeiro lugar.
 *
 * Zero ali quer dizer outra coisa: "empatadas no número que exibimos". É informação boa e é
 * diferente, e a distinção importa porque o bloco do pódio, logo abaixo, afirma que a ordem entre
 * as duas está correta e que a 1ª realmente pontuou mais. Duas afirmações opostas na mesma página
 * não custam meia confiança cada — custam a confiança nas duas.
 */

import { describe, expect, it } from 'vitest';
import { buildCurrentStanding, serializeRecommendation } from '@/payments/entitlements';
import { buildPlayerProfile } from '@/recommendation/profile/build-profile';
import { recommend } from '@/recommendation';
import { PERSONAS } from '@/data/personas';
import type { PlayerProfile } from '@/domain/player-profile';
import type { RankedRacket, RecommendationResult } from '@/domain/recommendation';
import { TEST_DATASET_VERSION, TEST_MODE, testRackets, testStrings } from '../helpers/catalog';

const analises = PERSONAS.map((persona) => {
  const profile = buildPlayerProfile(persona.answers);
  const result = recommend({
    profile,
    rackets: testRackets(),
    strings: testStrings(),
    datasetVersion: TEST_DATASET_VERSION,
    mode: TEST_MODE,
    includeSetup: true,
  });
  return {
    persona,
    result,
    report: serializeRecommendation(result, profile, ['racket_report_access']),
  };
});

/** Frases que só podem sair para quem está REALMENTE em 1º. */
const AFIRMA_PRIMEIRO = /é a melhor opção|melhor opção para o seu jogo/i;

/**
 * O CENÁRIO EXATO DO DEFEITO, MONTADO À MÃO.
 *
 * Ele não existe entre as personas — medido, ZERO das 22 produz `gap === 0` —, e foi por isso que
 * o defeito passou. Um teste que só varre personas não cobre um ramo que nenhuma persona alcança.
 */
function cenario(primeiroFit: number, atualFit: number, atualRank: number) {
  const rackets = testRackets();
  const ranking: RankedRacket[] = rackets.slice(0, 8).map((racket, i) => ({
    rank: i + 1,
    racket,
    fit_score: i === 0 ? primeiroFit : i + 1 === atualRank ? atualFit : atualFit - i,
    breakdown: {
      final_score: 0, components: [], penalties: [], data_completeness: 1, gained: [], lost: [],
    },
    technical_tie_with_previous: false,
  }));
  const atual = ranking[atualRank - 1]!;

  /*
    O pódio faz parte do cenário, e não é enfeite do fixture.

    `buildCurrentStanding` consulta `result.podium` para saber se a raquete do jogador aparece na
    lista que ele de fato vê — quando não aparece, o texto precisa explicar por quê. Um fixture sem
    pódio mentia sobre o tipo e escondia esse ramo. Aqui o pódio é o topo do ranking, sem regra de
    família: é o caso em que a atual APARECE, que é o que estes testes medem.
  */
  const result = {
    full_ranking: ranking,
    podium: ranking.slice(0, 3),
  } as unknown as RecommendationResult;
  const profile = {
    current_racket: { variant_id: atual.racket.variant.id, unrecognized: false },
  } as unknown as PlayerProfile;

  return buildCurrentStanding(result, profile, ranking[0]!);
}

describe('o empate no arredondamento não vira "primeiro lugar"', () => {
  it('reproduz o caso relatado: 2º lugar com o mesmo 88% da primeira', () => {
    // 88,45 e 88,00 arredondam os dois para 88 — gap zero, mas a atual está em 2º.
    const standing = cenario(88.45, 88.0, 2)!;

    expect(standing.rank).toBe(2);
    expect(standing.fit_score).toBe(88);
    expect(standing.gap_to_first).toBe(0);
    expect(
      standing.message,
      'o card não pode chamar de "a melhor opção" uma raquete que ele mesmo exibe em 2º',
    ).not.toMatch(AFIRMA_PRIMEIRO);
    expect(standing.message, 'precisa dizer a posição real').toContain('2º');
    expect(standing.verdict).toBe('keep');
  });

  it('em 1º lugar de verdade, continua dizendo que é a melhor opção', () => {
    const standing = cenario(90.0, 90.0, 1)!;

    expect(standing.rank).toBe(1);
    expect(standing.gap_to_first).toBe(0);
    expect(standing.message).toMatch(AFIRMA_PRIMEIRO);
  });

  /**
   * Vencer o ranking não é o mesmo que estar satisfeito.
   *
   * A versão anterior terminava em "Nenhuma troca de quadro te levaria adiante daqui" — verdade, e
   * ainda assim um ponto final onde cabia um caminho: quem chegou incomodado com alguma coisa
   * continua incomodado depois de ler que está tudo certo. Aqui não há raquete melhor a oferecer,
   * então a resposta útil é o setup.
   */
  it('mesmo em 1º, o "não troque" é condicionado à satisfação', () => {
    const standing = cenario(90.0, 90.0, 1)!;

    expect(standing.message, 'precisa condicionar à satisfação').toMatch(
      /se você está satisfeito/i,
    );
    expect(standing.message, 'precisa dar um caminho a quem está incomodado').toMatch(
      /incomod/i,
    );
    expect(standing.message, 'e esse caminho é o setup').toContain('corda e a tensão');

    // Não pode terminar em ponto final incondicional.
    expect(standing.message).not.toMatch(/nenhuma troca de quadro te levaria adiante/i);
  });

  /**
   * O empate segue a MESMA escada dos outros casos: calibra a expectativa para baixo, oferece o
   * setup como caminho de maior retorno, e ainda assim deixa a porta aberta para quem chegou aqui
   * por um incômodo específico. A primeira versão dizia "não há ganho a buscar numa troca de
   * quadro" — o registro categórico que a 2.27.0 tinha acabado de remover dos outros quatro,
   * reintroduzido sem querer num ramo novo.
   */
  it('calibra a expectativa para baixo sem fechar a porta da troca', () => {
    const standing = cenario(88.45, 88.0, 2)!;

    expect(standing.message, 'precisa dizer que não se espera um salto').toContain(
      'Não espere um salto',
    );
    expect(standing.message, 'precisa oferecer o caminho mais barato').toContain(
      'corda e a tensão',
    );
    expect(standing.message, 'precisa abrir a porta para o incômodo específico').toContain(
      'incômodo específico',
    );

    // O que ele NÃO pode fazer: decidir pelo leitor, em nenhuma das duas direções.
    expect(standing.message).not.toMatch(/não há ganho|não paga a troca|não troque/i);
    expect(standing.message).not.toMatch(/vale a pena trocar|recomendamos a troca/i);
  });

  it('os quatro veredictos falam a mesma língua: nenhum decide pelo leitor', () => {
    const CATEGORICO = /não paga a troca|não há ganho a buscar|não troque de quadro/i;
    for (const [primeiro, atual, rank] of [
      [88.45, 88.0, 2],
      [90.0, 88.0, 3],
      [95.0, 89.0, 4],
      [99.0, 88.0, 6],
    ] as const) {
      const standing = cenario(primeiro, atual, rank)!;
      expect(
        standing.message,
        `gap ${standing.gap_to_first}: voltou a decidir pelo leitor — "${standing.message.slice(0, 70)}..."`,
      ).not.toMatch(CATEGORICO);
    }
  });
});

describe('o card da raquete atual bate com o próprio número', () => {
  it('só diz "a melhor opção" quando a raquete está de fato em 1º', () => {
    let verificadas = 0;

    for (const { persona, report } of analises) {
      const atual = report.current_racket_standing;
      if (!atual) continue;
      verificadas += 1;

      if (AFIRMA_PRIMEIRO.test(atual.message)) {
        expect(
          atual.rank,
          `${persona.id}: o card diz "a melhor opção" mas exibe ${atual.rank}º lugar`,
        ).toBe(1);
      }
    }

    expect(
      verificadas,
      'nenhuma persona com raquete atual — o teste não verificou nada',
    ).toBeGreaterThan(0);
  });

  it('empate no número exibido, fora do 1º lugar, é dito como empate e não como vitória', () => {
    for (const { persona, report } of analises) {
      const atual = report.current_racket_standing;
      if (!atual) continue;
      if (atual.gap_to_first !== 0 || atual.rank === 1) continue;

      expect(
        atual.message,
        `${persona.id}: empate em ${atual.rank}º descrito como se fosse o primeiro lugar`,
      ).not.toMatch(AFIRMA_PRIMEIRO);
      expect(
        atual.message,
        `${persona.id}: o empate precisa dizer a posição real`,
      ).toContain(`${atual.rank}º`);
    }
  });

  it('o veredicto é coerente com o gap que o próprio card exibe', () => {
    for (const { persona, report, result } of analises) {
      const atual = report.current_racket_standing;
      if (!atual) continue;

      /*
        `above_ceiling` fica FORA desta regra, e é a única exceção.

        Os três vereditos abaixo respondem "vale a pena trocar?", e a resposta sai do tamanho do
        gap. `above_ceiling` responde outra pergunta — "por que a minha raquete não está no pódio?"
        — e nesse ramo o gap perdeu o significado por construção: desde 07/09/2026 a atual acima do
        teto sai do pódio, então `podium[0]` pode pontuar MENOS que ela e o gap chega a ser
        negativo. Cobrar coerência de sinal de um número que o próprio desenho tornou inaplicável
        reprovaria o comportamento certo.

        A checagem que sobrevive: quando o veredicto é `above_ceiling`, a raquete não pode estar no
        pódio. Se um dia estiver, o ramo disparou onde não devia.
      */
      if (atual.verdict === 'above_ceiling') {
        expect(
          result.podium.some((e) => e.racket.variant.id === persona.answers.current_racket_id),
          `${persona.id}: veredicto above_ceiling com a raquete DENTRO do pódio`,
        ).toBe(false);
        continue;
      }

      // `keep` até 3 pontos, `marginal` até 8, `upgrade` daí em diante.
      const esperado = atual.gap_to_first < 4 ? 'keep' : atual.gap_to_first < 9 ? 'marginal' : 'upgrade';
      expect(
        atual.verdict,
        `${persona.id}: gap ${atual.gap_to_first} deveria ser "${esperado}", veio "${atual.verdict}"`,
      ).toBe(esperado);
    }
  });

  it('a posição exibida é a mesma do ranking completo', () => {
    for (const { persona, result, report } of analises) {
      const atual = report.current_racket_standing;
      if (!atual) continue;

      const noRanking = result.full_ranking.find((r) => r.rank === atual.rank);
      expect(noRanking, `${persona.id}: posição ${atual.rank} não existe no ranking`).toBeDefined();
      expect(
        Math.round(noRanking!.fit_score),
        `${persona.id}: o match exibido não bate com o do ranking`,
      ).toBe(atual.fit_score);
    }
  });
});
