/**
 * Ética comercial — docs/TEST_STRATEGY.md §7, §30 e §58.
 *
 * "Não criar opções artificiais só para vender o upsell. As três precisam ser boas opções reais."
 *
 * Este teste existe porque a pressão comercial para preencher o pódio é real e permanente. Aqui ela
 * é impossível: se a terceira opção não for boa, o upsell simplesmente não é ofertado.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MIN_PODIUM_FIT } from '@/domain/reference-ranges';
import { buildPlayerProfile } from '@/recommendation/profile/build-profile';
import { recommend } from '@/recommendation';
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

  it('nenhuma raquete no pódio fica abaixo do fit mínimo', () => {
    for (const { persona, result } of runs) {
      for (const p of result.podium) {
        expect(p.fit_score, `${persona.id}: rank ${p.rank}`).toBeGreaterThanOrEqual(MIN_PODIUM_FIT);
      }
    }
  });

  it('o upsell do Top 3 só é ofertado quando existem 3 opções realmente boas', () => {
    for (const { persona, result } of runs) {
      if (result.top3_offer_available) {
        expect(result.podium.length, persona.id).toBe(3);
        expect(result.podium[2]!.fit_score).toBeGreaterThanOrEqual(MIN_PODIUM_FIT);
      } else {
        // Sem três boas opções, não há oferta — e isso é o comportamento correto.
        const hasThreeGood =
          result.podium.length === 3 && (result.podium[2]?.fit_score ?? 0) >= MIN_PODIUM_FIT;
        expect(hasThreeGood, persona.id).toBe(false);
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
