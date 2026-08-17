/**
 * Nenhum resultado é reaproveitado entre pessoas, e nenhum relatório antigo se disfarça de novo.
 *
 * ═══ A PERGUNTA DO USUÁRIO ═══════════════════════════════════════════════════════════════════
 *
 * "Se eu respondi no motor antigo e outro usuário, por coincidência, responder exatamente as
 * mesmas perguntas, ele vai perceber que já existe essa resposta e devolver o mesmo resultado? Se
 * for isso, as novas atualizações vão carregar erro das antigas."
 *
 * A preocupação está certa: um cache por respostas transformaria cada correção de motor em algo que
 * só vale para quem chegou depois de uma limpeza de cache, e o primeiro relatório errado
 * contaminaria todos os iguais a ele para sempre.
 *
 * ═══ O QUE ESTE TESTE TRANCA ═════════════════════════════════════════════════════════════════
 *
 * 1. `recommend()` é função pura do par (perfil, catálogo). Rodar de novo recalcula de verdade — não
 *    existe memória entre chamadas, então dois envios iguais são dois cálculos, ambos com o código
 *    publicado no momento.
 * 2. Toda análise carimba a versão do motor que a produziu, e o relatório DECLARA quando essa versão
 *    ficou para trás. É o que impede um resultado congelado de se passar por atual.
 */

import { describe, expect, it } from 'vitest';

import { buildPlayerProfile } from '@/recommendation/profile/build-profile';
import { recommend } from '@/recommendation';
import { serializeRecommendation } from '@/payments/entitlements';
import { RECOMMENDATION_ENGINE_VERSION } from '@/recommendation/config/version';
import { PERSONAS } from '@/data/personas';
import { TEST_DATASET_VERSION, TEST_MODE, testRackets, testStrings } from '../helpers/catalog';

const persona = PERSONAS[0]!;

function run() {
  const profile = buildPlayerProfile(persona.answers);
  return {
    profile,
    result: recommend({
      profile,
      rackets: testRackets(),
      strings: testStrings(),
      datasetVersion: TEST_DATASET_VERSION,
      mode: TEST_MODE,
      includeSetup: true,
    }),
  };
}

describe('sem reaproveitamento de resultado', () => {
  /**
   * Respostas iguais dão resultado igual porque a CONTA é a mesma, não porque alguém guardou a
   * resposta anterior. A distinção importa: uma conta refeita acompanha a versão do motor; uma
   * resposta guardada, não.
   */
  it('duas execuções idênticas recalculam, e chegam ao mesmo lugar', () => {
    const a = run().result;
    const b = run().result;

    expect(b.podium.map((e) => e.racket.variant.id)).toEqual(
      a.podium.map((e) => e.racket.variant.id),
    );
    expect(b.podium.map((e) => e.fit_score)).toEqual(a.podium.map((e) => e.fit_score));
    // Objetos distintos: o segundo cálculo produziu estrutura nova, não devolveu a primeira.
    expect(b).not.toBe(a);
    expect(b.podium[0]).not.toBe(a.podium[0]);
  });

  it('toda análise carimba a versão do motor que a produziu', () => {
    expect(run().result.engine_version).toBe(RECOMMENDATION_ENGINE_VERSION);
  });

  /** Recém-calculado é a versão do dia — nada a declarar. */
  it('análise da versão atual não exibe aviso de desatualização', () => {
    const { profile, result } = run();
    const report = serializeRecommendation(result, profile, ['racket_report_access']);
    expect(report.analysis_outdated).toBeNull();
  });

  /**
   * O caso que motivou tudo: um relatório gravado meses atrás, aberto hoje. Os números continuam
   * sendo os que a pessoa recebeu — o que não pode acontecer é o rodapé dizer uma versão enquanto a
   * página é montada por outra, sem ninguém avisar.
   */
  it('análise gravada por versão anterior declara a diferença sem alterar o resultado', () => {
    const { profile, result } = run();
    const antiga = { ...result, engine_version: '1.0.0' };

    const atual = serializeRecommendation(result, profile, ['racket_report_access']);
    const report = serializeRecommendation(antiga, profile, ['racket_report_access']);

    expect(report.analysis_outdated).not.toBeNull();
    expect(report.analysis_outdated!.stored).toBe('1.0.0');
    expect(report.analysis_outdated!.current).toBe(RECOMMENDATION_ENGINE_VERSION);
    expect(report.analysis_outdated!.message).toContain('refaça o questionário');

    // O aviso NÃO mexe no que foi entregue: mesmo pódio, mesmas pontuações.
    expect(report.podium.map((e) => e.fit_score)).toEqual(atual.podium.map((e) => e.fit_score));
    expect(report.engine_version).toBe('1.0.0');
  });
});
