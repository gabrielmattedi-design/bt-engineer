/**
 * Versionamento do motor (§61).
 *
 * Toda recomendação grava estas versões. É o que permite reproduzir um relatório antigo, comparar
 * calibrações no simulador e responder "por que a recomendação mudou?".
 *
 * REGRA: qualquer alteração em fórmula, peso ou faixa de referência DEVE incrementar a versão
 * correspondente. O teste tests/unit/methodology-parity.test.ts existe para lembrar disso.
 */

export const RECOMMENDATION_ENGINE_VERSION = '1.5.0';
export const STRING_ENGINE_VERSION = '2.1.0';
export const QUESTIONNAIRE_VERSION = '1.3.0';
