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
import { recommend, enrichProfileWithCatalog } from '@/recommendation';
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
