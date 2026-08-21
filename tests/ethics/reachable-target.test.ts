/**
 * O alvo do trilho não pode apontar para fora do que existe para o jogador.
 *
 * ═══ O DEFEITO, MEDIDO ═══════════════════════════════════════════════════════════════════════
 *
 * O tracejado marcava o pedido cru — posição de partida mais a mudança pedida. Medido em 566
 * perfis simulados, ele apontava acima do teto alcançável em 70% deles e ficava colado no fim da
 * escala em 49%, com excesso médio de 20 pontos. A faixa laranja pintava então um vão de 23,7
 * pontos em média: uma distância que NENHUMA escolha de raquete podia fechar, cobrada da
 * recomendada como se fosse falha dela.
 *
 * Relato do usuário: "o que a raquete entrega de potência ficou muito longe da linha laranja,
 * descredibiliza a análise". Estava certo, e a causa não era o motor — a vencedora tem posição
 * média 69 no eixo mais pedido, e o eixo pedido não é o pior atributo dela em nenhum dos 566
 * perfis. Era a linha marcando um ponto inalcançável.
 *
 * ═══ POR QUE UM TESTE, E NÃO SÓ O COMENTÁRIO ═════════════════════════════════════════════════
 *
 * Porque o teto depende de quem é "plausível para este jogador", e essa definição mora no motor
 * (`FLOOR_SAFE_PHYSICAL` / `FLOOR_SAFE_SKILL`). No dia em que ela mudar lá, o gráfico não pode
 * continuar desenhando o teto da definição antiga sem nada acusar.
 */

import { describe, expect, it } from 'vitest';
import { buildPlayerProfile } from '@/recommendation/profile/build-profile';
import { recommend } from '@/recommendation';
import { serializeRecommendation } from '@/payments/entitlements';
import { FLOOR_SAFE_PHYSICAL, FLOOR_SAFE_SKILL } from '@/recommendation/engine/rank-rackets';
import { PERSONAS } from '@/data/personas';
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

/** Só os eixos de bola têm trilho; os de encaixe trazem `market: null`. */
const trilhos = analises.flatMap(({ persona, result, report }) =>
  report.radar
    .filter((a) => a.market !== null)
    .map((a) => ({ persona, result, axis: a, m: a.market! })),
);

describe('alvo alcançável no trilho de mercado', () => {
  it('o teste enxerga trilhos — senão ele passa vazio', () => {
    expect(trilhos.length).toBeGreaterThan(0);
  });

  it('o alvo desenhado nunca passa do teto do perfil', () => {
    for (const { persona, axis, m } of trilhos) {
      if (m.reach === null) continue;
      expect(
        m.ask,
        `${persona.id}/${axis.key}: alvo em ${m.ask} com teto ${m.reach}`,
      ).toBeLessThanOrEqual(m.reach);
    }
  });

  /** O alvo é o pedido quando o pedido cabe, e o teto quando não cabe. Nunca um terceiro número. */
  it('o alvo é exatamente o menor entre o pedido e o teto', () => {
    for (const { persona, axis, m } of trilhos) {
      const esperado = m.reach === null ? m.asked : Math.min(m.asked, m.reach);
      expect(m.ask, `${persona.id}/${axis.key}`).toBe(esperado);
    }
  });

  /**
   * O teto precisa ser ALCANÇÁVEL de verdade: tem que existir no ranking uma raquete plausível
   * para o perfil que chegue lá. Um teto tirado de raquete que não serve ao jogador seria o mesmo
   * defeito de antes, com outro número.
   */
  it('o teto corresponde a uma raquete que serve ao jogador', () => {
    let verificados = 0;

    for (const { persona, result, axis, m } of trilhos) {
      if (m.reach === null) continue;

      const plausiveis = result.full_ranking.filter((r) => {
        const raw = (key: string) => r.breakdown.components.find((c) => c.key === key)?.raw ?? 0;
        return raw('physical_fit') >= FLOOR_SAFE_PHYSICAL && raw('skill_fit') >= FLOOR_SAFE_SKILL;
      });

      expect(
        plausiveis.length,
        `${persona.id}/${axis.key}: teto ${m.reach} sem nenhuma candidata plausível`,
      ).toBeGreaterThan(0);
      verificados += 1;
    }

    expect(verificados, 'nenhum teto verificado').toBeGreaterThan(0);
  });

  /**
   * A recomendada pode ficar abaixo do alvo — é o vão que o gráfico existe para mostrar. O que ela
   * não pode é ficar acima do TETO, porque o teto é o máximo entre as plausíveis e ela é uma delas
   * sempre que serve ao jogador. Passar dele significaria que o teto foi calculado errado.
   */
  it('a recomendada não ultrapassa o próprio teto quando é plausível', () => {
    for (const { persona, result, axis, m } of trilhos) {
      if (m.reach === null) continue;

      const vencedora = result.full_ranking[0]!;
      const raw = (key: string) =>
        vencedora.breakdown.components.find((c) => c.key === key)?.raw ?? 0;
      const plausivel =
        raw('physical_fit') >= FLOOR_SAFE_PHYSICAL && raw('skill_fit') >= FLOOR_SAFE_SKILL;
      if (!plausivel) continue;

      expect(
        m.recommended,
        `${persona.id}/${axis.key}: recomendada em ${m.recommended} acima do teto ${m.reach}`,
      ).toBeLessThanOrEqual(m.reach);
    }
  });
});
