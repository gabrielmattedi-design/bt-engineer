/**
 * Versionamento do motor (§61).
 *
 * Toda recomendação grava estas versões. É o que permite reproduzir um relatório antigo, comparar
 * calibrações no simulador e responder "por que a recomendação mudou?".
 *
 * REGRA: qualquer alteração em fórmula, peso ou faixa de referência DEVE incrementar a versão
 * correspondente. O teste tests/unit/methodology-parity.test.ts existe para lembrar disso.
 */

export const RECOMMENDATION_ENGINE_VERSION = '2.31.0';
/*
  2.3.0 — categoria `polyamide_monofilament` (ago/2026).

  Não é ajuste de peso: é um arquétipo NOVO na tabela de tipos, com faixa de tensão e deslocamento
  próprios. Toda corda de poliamida passa a ser pontuada por ele, então relatórios anteriores não
  são reproduzíveis com esta versão — que é exatamente o que o número serve para registrar.
*/
export const STRING_ENGINE_VERSION = '2.3.0';
export const QUESTIONNAIRE_VERSION = '1.3.0';
