/**
 * Ética comercial — docs/TEST_STRATEGY.md §7, §30 e §58.
 *
 * "Não criar opções artificiais só para vender o upsell. As três precisam ser boas opções reais."
 *
 * A primeira leitura desta regra foi um corte: quem não atingisse `MIN_PODIUM_FIT` sumia do pódio.
 * Ela protegia escondendo — e escondendo protegia demais, porque o usuário deixava de saber que
 * existiam alternativas avaliadas. Um pódio de uma raquete só não é prudência, é informação
 * sonegada.
 *
 * A proteção mudou de forma: o pódio traz as três melhores REAIS, cada uma com seu fit visível
 * antes de qualquer pagamento, e um aviso explícito quando a diferença para a 1ª é grande. Quem
 * desbloqueia sabendo que a opção marca 71% fez uma escolha informada.
 *
 * O que este teste tranca é que a informação chegue ANTES da cobrança, e que nada de identificável
 * vaze de uma opção bloqueada.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildPlayerProfile } from '@/recommendation/profile/build-profile';
import { recommend } from '@/recommendation';
import { serializeRecommendation } from '@/payments/entitlements';
import { PERSONAS } from '@/data/personas';
import { TEST_DATASET_VERSION, TEST_MODE, testRackets, testStrings } from '../helpers/catalog';

function runAll() {
  return PERSONAS.map((persona) => {
    const profile = buildPlayerProfile(persona.answers);
    return {
      persona,
      result: recommend({
        profile,
        rackets: testRackets(),
        strings: testStrings(),
        datasetVersion: TEST_DATASET_VERSION,
        mode: TEST_MODE,
        includeSetup: true,
      }),
    };
  });
}

describe('qualidade do pódio (§30)', () => {
  const runs = runAll();

  it('o pódio está sempre ordenado por compatibilidade decrescente', () => {
    for (const { persona, result } of runs) {
      for (let i = 1; i < result.podium.length; i += 1) {
        expect(result.podium[i]!.fit_score, `${persona.id}: rank ${i + 1}`).toBeLessThanOrEqual(
          result.podium[i - 1]!.fit_score,
        );
      }
    }
  });

  it('o upsell só é ofertado quando existe alternativa real a desbloquear', () => {
    for (const { persona, result } of runs) {
      expect(result.top3_offer_available, persona.id).toBe(result.podium.length >= 2);
    }
  });

  /**
   * O número precisa estar na tela ANTES da cobrança — é ele que transforma o desbloqueio numa
   * escolha informada em vez de uma aposta.
   */
  it('a opção bloqueada mostra o próprio fit e avisa quando é bem mais fraca', () => {
    for (const { persona, result } of runs) {
      const report = serializeRecommendation(result, buildPlayerProfile(
        PERSONAS.find((p) => p.id === persona.id)!.answers,
      ), ['racket_report_access']);

      for (const entry of report.podium) {
        if (!entry.locked) continue;

        expect(entry.fit_score, `${persona.id}: rank ${entry.rank}`).toBeGreaterThan(0);
        expect(entry).not.toHaveProperty('product_name');
        expect(entry).not.toHaveProperty('brand');

        const gap = report.podium[0]!.fit_score - entry.fit_score;
        if (gap >= 6) {
          expect(entry.quality_note, `${persona.id}: rank ${entry.rank} sem aviso`).toBeTruthy();
        }
      }
    }
  });

  it('o pódio não repete a mesma família salvo quando o peso é o eixo do objetivo', () => {
    for (const { persona, result } of runs) {
      const wantsWeightAxis = PERSONAS.find((p) => p.id === persona.id)!.answers.missing_attributes
        .some((a) => a === 'maneuverability' || a === 'stability');
      if (wantsWeightAxis) continue;

      const families = result.podium.map((p) => `${p.racket.variant.brand}::${p.racket.variant.family}`);
      expect(new Set(families).size, persona.id).toBe(families.length);
    }
  });

  it('empates técnicos são sinalizados e não escondidos (§62)', () => {
    for (const { result } of runs) {
      for (let i = 1; i < result.full_ranking.length; i += 1) {
        const diff = result.full_ranking[i - 1]!.fit_score - result.full_ranking[i]!.fit_score;
        expect(result.full_ranking[i]!.technical_tie_with_previous).toBe(diff < 2.0);
      }
    }
  });
});

describe('ausência de dark patterns (§58)', () => {
  const FORBIDDEN = [
    'última chance',
    'ultima chance',
    'oferta expira',
    'apenas hoje',
    'restam apenas',
    'vagas limitadas',
    'de R$',
    'por apenas',
    'preço original',
  ];

  function collectSource(dir: string): string[] {
    const out: string[] = [];
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return out;
    }
    for (const entry of entries) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) out.push(...collectSource(full));
      else if (/\.tsx?$/.test(entry)) out.push(full);
    }
    return out;
  }

  /**
   * Remove comentários antes de varrer.
   *
   * O que o §58 proíbe é a LINGUAGEM EXIBIDA ao usuário. Um comentário documentando "aqui não
   * usamos 'última chance'" é o oposto de um dark pattern, e um scanner ingênuo o acusaria —
   * criando o incentivo perverso de não documentar a regra para o teste passar.
   */
  function renderedText(file: string): string {
    return readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .toLowerCase();
  }

  it('nenhum componente contém linguagem de falsa escassez ou urgência', () => {
    const root = join(__dirname, '..', '..', 'src');
    const offenders: string[] = [];
    for (const file of [...collectSource(join(root, 'components')), ...collectSource(join(root, 'app'))]) {
      const source = renderedText(file);
      for (const term of FORBIDDEN) {
        if (source.includes(term)) offenders.push(`${file}: "${term}"`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('não existe cronômetro regressivo em nenhum componente', () => {
    const root = join(__dirname, '..', '..', 'src');
    const offenders: string[] = [];
    for (const file of collectSource(root)) {
      const source = readFileSync(file, 'utf8');
      if (/countdown|contagem regressiva|timeLeft|expiresIn/i.test(source)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
