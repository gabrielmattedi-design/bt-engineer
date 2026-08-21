/**
 * O piso de demanda declarada — o que ele promete, e o que ele nunca pode quebrar.
 *
 * ═══ O DEFEITO QUE ORIGINOU O PISO ═══════════════════════════════════════════════════════════
 *
 * Relato do usuário, com o relatório aberto: "ordenei potência como prioridade 1, disse que quero
 * atacar mais, disse que o que mais gosto na minha raquete é a potência — e a recomendada veio
 * tendo potência como o pior atributo dela. Parece que não respeitou meu desejo."
 *
 * Nada estava quebrado, e é isso que tornava o defeito difícil de ver. `objective_fit` mede
 * DIREÇÃO (a raquete anda para o lado pedido em relação à referência?) e a penalização P6 cobra
 * contradição, também relativa à referência. Nenhum dos dois olhava a posição ABSOLUTA no eixo
 * pedido — então uma raquete um pouco mais potente que a atual passava limpa pelos dois estando no
 * terço de baixo do catálogo em potência.
 *
 * ═══ O QUE ESTE TESTE TRANCA ═════════════════════════════════════════════════════════════════
 *
 * Duas coisas, e a segunda vale mais que a primeira:
 *
 *   1. que o pedido forte seja atendido quando existe raquete segura que o atenda;
 *   2. que atender o pedido NÃO custe nenhuma das propriedades que o relatório usa para falar —
 *      ranking monotônico por fit, posição que significa posição, bloco da raquete atual de pé.
 *
 * O item 2 é o que derrubou a primeira implementação. Ela promovia ao topo quem passava do corte,
 * reordenando o ranking. Com a ordem não-monotônica, `buildCurrentStanding` — que conclui pelo
 * sinal de `gap = primeira − atual` — passava a dizer "a raquete que você já tem é a melhor opção"
 * na mesma página em que o relatório recomendava outra.
 */

import { describe, expect, it } from 'vitest';
import { buildPlayerProfile } from '@/recommendation/profile/build-profile';
import { recommend } from '@/recommendation';
import { serializeRecommendation } from '@/payments/entitlements';
import { buildCatalogScale } from '@/recommendation/engine/catalog-scale';
import { NEED_KEYS, NEED_TO_RACKET_ATTRIBUTE, type NeedKey } from '@/domain/player-profile';
import { PERSONAS } from '@/data/personas';
import { TEST_DATASET_VERSION, TEST_MODE, testRackets, testStrings } from '../helpers/catalog';

/** Os mesmos números de `rank-rackets.ts`. Duplicados de propósito: o teste é a régua externa. */
const ASK_STRONG = 20;
const FLOOR_POSITION = 60;
const SAFE_PHYSICAL = 70;
const SAFE_SKILL = 55;

const catalogo = testRackets();
const escala = buildCatalogScale(catalogo);

const posicao = (racket: (typeof catalogo)[number], need: NeedKey): number => {
  const attrKey = NEED_TO_RACKET_ATTRIBUTE[need];
  const attributes = racket.attributes;
  return escala.position(attrKey, attributes[attrKey as keyof typeof attributes] as number);
};

const analises = PERSONAS.map((persona) => {
  const profile = buildPlayerProfile(persona.answers);
  const result = recommend({
    profile,
    rackets: catalogo,
    strings: testStrings(),
    datasetVersion: TEST_DATASET_VERSION,
    mode: TEST_MODE,
    includeSetup: true,
  });
  const fortes = NEED_KEYS.filter((k) => profile.desired_change_vector[k] >= ASK_STRONG);
  return {
    persona,
    profile,
    result,
    fortes,
    report: serializeRecommendation(result, profile, ['racket_report_access']),
  };
});

describe('piso de demanda declarada', () => {
  it('a vencedora atende o pedido forte, ou não existia candidata segura que atendesse', () => {
    let comPedido = 0;

    for (const { persona, result, fortes } of analises) {
      if (fortes.length === 0) continue;
      comPedido += 1;

      const vencedora = result.full_ranking[0]!;
      const atende = fortes.every((need) => posicao(vencedora.racket, need) >= FLOOR_POSITION);
      if (atende) continue;

      /**
       * Não atendeu: a válvula precisa explicar por quê. Ou nenhuma candidata acima do corte era
       * segura, ou sobravam poucas demais para disputar um pódio. Sem uma dessas, o piso falhou.
       */
      const acima = result.full_ranking.filter((r) =>
        fortes.every((need) => posicao(r.racket, need) >= FLOOR_POSITION),
      );
      const seguras = acima.filter((r) => {
        const raw = (key: string) => r.breakdown.components.find((c) => c.key === key)?.raw ?? 0;
        return raw('physical_fit') >= SAFE_PHYSICAL && raw('skill_fit') >= SAFE_SKILL;
      });

      expect(
        seguras.length === 0 || acima.length < 10,
        `${persona.id}: pediu ${fortes.join('+')} com força, havia ${seguras.length} candidatas ` +
          `seguras acima do corte, e a vencedora ficou em ${fortes
            .map((n) => `${n} ${Math.round(posicao(vencedora.racket, n))}`)
            .join(', ')}`,
      ).toBe(true);
    }

    expect(comPedido, 'nenhuma persona declarou pedido forte — o teste não verificou nada')
      .toBeGreaterThan(0);
  });

  /**
   * A propriedade que a implementação por reordenação quebrava. `determinism.test.ts` também a
   * cobre; aqui ela é reafirmada junto do piso, que é quem tem motivo para quebrá-la de novo.
   */
  it('o ranking continua monotônico por fit, com o pódio saindo do topo', () => {
    for (const { persona, result } of analises) {
      for (let i = 1; i < result.full_ranking.length; i += 1) {
        expect(
          result.full_ranking[i]!.fit_score,
          `${persona.id}: posição ${i + 1} pontua acima da ${i}`,
        ).toBeLessThanOrEqual(result.full_ranking[i - 1]!.fit_score);
      }

      const melhor = Math.max(...result.full_ranking.map((r) => r.fit_score));
      expect(result.podium[0]!.fit_score, `${persona.id}: a 1ª não é a maior pontuação`).toBe(melhor);
    }
  });

  /**
   * A raquete atual é isenta do piso: ela é referência, não candidata. Excluí-la faria o bloco
   * "sua raquete atual nesta análise" sumir sem explicação justamente para quem tem uma raquete
   * pouco alinhada ao que pediu — que é quem mais precisa ler aquilo.
   */
  it('a raquete atual continua no ranking mesmo quando não atende o pedido', () => {
    let verificadas = 0;

    for (const { persona, profile, result } of analises) {
      const variantId = profile.current_racket?.variant_id;
      if (!variantId || profile.current_racket?.unrecognized) continue;
      if (!catalogo.some((r) => r.variant.id === variantId)) continue;
      verificadas += 1;

      expect(
        result.full_ranking.some((r) => r.racket.variant.id === variantId),
        `${persona.id}: a raquete atual saiu do ranking e o bloco de comparação some`,
      ).toBe(true);
    }

    expect(verificadas, 'nenhuma persona com raquete atual reconhecida').toBeGreaterThan(0);
  });

  /**
   * `candidates_evaluated` conta quem foi PONTUADA; o ranking pode ser menor porque o piso tirou
   * raquetes dele. Frase de posição precisa usar o tamanho do ranking — foi por isso que
   * `buildCurrentStanding` deixou de citar `candidates_evaluated`.
   */
  it('nenhuma frase de posição cita um denominador maior que o ranking', () => {
    for (const { persona, result, report } of analises) {
      expect(result.candidates_evaluated).toBeGreaterThanOrEqual(result.full_ranking.length);

      const atual = report.current_racket_standing;
      if (!atual) continue;

      /** "em 12º entre as 29 deste ranking" — o denominador de uma posição, não um peso em gramas. */
      for (const [frase, denominador] of atual.message.matchAll(/entre as (\d+)\b/g)) {
        expect(
          Number(denominador),
          `${persona.id}: "${frase}" promete mais posições do que o ranking tem`,
        ).toBeLessThanOrEqual(result.full_ranking.length);
      }

      expect(atual.rank, `${persona.id}: posição fora do ranking`).toBeLessThanOrEqual(
        result.full_ranking.length,
      );
    }
  });
});
