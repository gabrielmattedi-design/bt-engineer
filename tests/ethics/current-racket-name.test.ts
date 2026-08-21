/**
 * O relatório não pode devolver uma versão que a pessoa nunca declarou.
 *
 * ═══ O DEFEITO QUE ESTE TESTE TRANCA ═════════════════════════════════════════════════════════
 *
 * O questionário promete, com estas palavras: "Não precisa saber o ano nem a versão: o que importa
 * é o modelo e o peso". A lista de busca cumpre — mostra "Blade 98 16×19 · 305 g", sem geração,
 * por decisão deliberada: ninguém sabe de que geração é a própria raquete, e ver um ano que não
 * bate faz a pessoa concluir que a dela não está no catálogo.
 *
 * O bloco "Sua raquete atual nesta análise" então devolvia `product_name`, o nome comercial
 * completo: "Wilson Blade 98 16×19 v10 (2026)". Reportado pelo usuário, com o print na tela.
 *
 * Duas coisas erradas ao mesmo tempo, e a segunda é a grave:
 *
 *   1. o relatório contradiz a promessa feita na pergunta;
 *   2. ele põe na boca do cliente um dado que ele não deu. A variante casada é uma escolha NOSSA
 *      entre gerações — se a pessoa joga com a v8, o relatório afirma "v10 (2026)" com a
 *      autoridade de quem está repetindo o que ela respondeu.
 *
 * Num produto pago que se vende como análise técnica verificada, afirmar por conta própria um
 * atributo do equipamento do cliente é exatamente o tipo de coisa que o sistema de proveniência
 * existe para impedir — só que na camada de apresentação, onde ele não alcançava.
 *
 * ═══ A ASSIMETRIA É PROPOSITAL ═══════════════════════════════════════════════════════════════
 *
 * As raquetes RECOMENDADAS continuam com o nome completo, com geração e ano, e devem continuar: a
 * pessoa vai comprar e precisa saber qual versão foi avaliada. O que ela DECLARA é um modelo; o
 * que nós INDICAMOS é um produto específico. Este teste protege um lado sem apagar o outro.
 */

import { describe, expect, it } from 'vitest';
import { buildPlayerProfile } from '@/recommendation/profile/build-profile';
import { recommend } from '@/recommendation';
import { serializeRecommendation } from '@/payments/entitlements';
import { currentRacketLabel } from '@/domain/racket';
import { PERSONAS } from '@/data/personas';
import { TEST_DATASET_VERSION, TEST_MODE, testRackets, testStrings } from '../helpers/catalog';

/** "v10", "Gen 4", "(2026)" — as marcas de geração que a pergunta prometeu não exigir. */
const MARCA_DE_GERACAO = /\bv\d+\b|\bgen\s*\d+\b|\(\s*(19|20)\d{2}\s*\)/i;

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

describe('nome da raquete atual no relatório', () => {
  it('nunca traz geração nem ano — a pergunta prometeu que não são necessários', () => {
    let verificadas = 0;

    for (const { persona, report } of analises) {
      const atual = report.current_racket_standing;
      if (!atual) continue;
      verificadas += 1;

      expect(
        atual.product_name,
        `${persona.id}: "${atual.product_name}" traz versão que a pessoa não declarou`,
      ).not.toMatch(MARCA_DE_GERACAO);

      // O texto corrido repete o nome; não adianta limpar o título e deixar a versão na frase.
      expect(atual.message, `${persona.id}: a mensagem traz a versão`).not.toMatch(
        MARCA_DE_GERACAO,
      );
    }

    // Sem isto o teste passaria vazio no dia em que nenhuma persona tivesse raquete atual.
    expect(verificadas, 'nenhuma persona com raquete atual — o teste não verificou nada').toBeGreaterThan(0);
  });

  it('usa exatamente o mesmo nome que a busca do questionário mostrou', () => {
    for (const { persona, result, report } of analises) {
      const atual = report.current_racket_standing;
      if (!atual) continue;

      const ranked = result.full_ranking.find(
        (r) => currentRacketLabel(r.racket.variant) === atual.product_name,
      );
      expect(
        ranked,
        `${persona.id}: "${atual.product_name}" não corresponde a nenhuma variante do catálogo`,
      ).toBeDefined();
    }
  });

  /**
   * O outro lado da assimetria. Se alguém "consertar" o pódio junto com este bloco, a pessoa perde
   * a informação de qual versão comprar — e aí o relatório passa a esconder um dado necessário em
   * vez de parar de inventar um desnecessário.
   */
  it('as recomendadas MANTÊM a geração, porque a pessoa vai comprar', () => {
    const comGeracao = analises.filter(({ report }) => {
      const primeira = report.podium[0];
      return primeira && !primeira.locked && MARCA_DE_GERACAO.test(primeira.product_name);
    });

    expect(
      comGeracao.length,
      'nenhuma recomendada trouxe geração — o nome completo sumiu do pódio',
    ).toBeGreaterThan(0);
  });
});
