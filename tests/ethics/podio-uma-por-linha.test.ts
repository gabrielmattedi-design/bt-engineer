/**
 * TRÊS VAGAS NO PÓDIO, TRÊS LINHAS DIFERENTES. SEM EXCEÇÃO.
 *
 * ═══ O CASO ══════════════════════════════════════════════════════════════════════════════════
 *
 * Relatado com o relatório na tela:
 *
 *     1º Babolat Pure Drive   81%
 *     2º Yonex EZONE 100      81%
 *     3º Yonex EZONE 100L     79%
 *
 * Duas das três recomendações são a mesma raquete em dois pesos. O pódio tem três vagas; gastar
 * duas na mesma linha custa uma alternativa de verdade.
 *
 * ═══ AS DUAS CAUSAS, MEDIDAS EM 1000 PERFIS ══════════════════════════════════════════════════
 *
 * Acontecia em 49 de 1000, por dois caminhos independentes:
 *
 * 1. `wantsWeightChange` (46 casos) — a regra de uma raquete por linha era DESLIGADA quando o
 *    jogador pedia mudança forte de manobrabilidade ou estabilidade. Existia desde o primeiro
 *    commit do motor, e a intenção era defensável: a versão L e a regular de uma linha diferem
 *    justamente em peso, então mostrar as duas seria oferecer a escolha de peso. O efeito na tela é
 *    o print acima. Exceção removida.
 *
 * 2. A inserção da ALTERNATIVA (3 casos) — quando a raquete atual está acima do teto, a melhor
 *    opção dentro do teto é inserida no topo do pódio. A filtragem olhava só o id repetido, não a
 *    família, e o laço que montou o resto do pódio não sabia que ela viria. Defeito introduzido em
 *    07/09/2026 e achado na varredura seguinte.
 *
 * Depois das duas correções: 0 de 1000, com 986 pódios ainda de três raquetes.
 */

import { describe, expect, it } from 'vitest';
import { loadRacketCatalog, loadStringCatalog, DATASET_VERSION } from '@/data/load';
import { scoreRackets } from '@/recommendation/normalize/racket-attributes';
import { recommend, enrichProfileWithCatalog } from '@/recommendation';
import { buildPlayerProfile } from '@/recommendation/profile/build-profile';
import { PERSONAS } from '@/data/personas';

const rackets = scoreRackets(loadRacketCatalog());
const strings = loadStringCatalog();

/** Persona × cada raquete do catálogo como atual: cobre o caminho da alternativa. */
const cenarios = PERSONAS.flatMap((persona) =>
  rackets.map((atual) => {
    const answers = { ...persona.answers, current_racket_id: atual.variant.id, no_current_racket: false };
    const profile = enrichProfileWithCatalog(buildPlayerProfile(answers), rackets, strings);
    const result = recommend({
      profile, rackets, strings, datasetVersion: DATASET_VERSION,
      mode: 'permissive', includeSetup: true,
    });
    return { id: `${persona.id}+${atual.variant.product_name}`, profile, result };
  }),
);

const linhaDe = (r: { variant: { brand: string; family: string } }): string =>
  `${r.variant.brand}::${r.variant.family}`;

describe('o pódio nunca traz duas da mesma linha', () => {
  it('a varredura cobre o caso', () => {
    expect(cenarios.length, 'nenhum cenário montado').toBeGreaterThan(100);
  });

  it('nenhuma linha ocupa duas vagas', () => {
    for (const { id, result } of cenarios) {
      const linhas = result.podium.map((e) => linhaDe(e.racket));
      expect(
        new Set(linhas).size,
        `${id}: ${result.podium.map((e) => e.racket.variant.product_name).join(' | ')}`,
      ).toBe(linhas.length);
    }
  });

  /**
   * A regra não pode ser cumprida esvaziando o pódio.
   *
   * Um pódio de uma raquete satisfaz "uma por linha" trivialmente e é péssimo produto. Esta
   * asserção é o contrapeso: a diversidade se paga com variedade, não com ausência.
   */
  it('a maioria esmagadora continua com três raquetes', () => {
    const cheios = cenarios.filter((c) => c.result.podium.length === 3).length;
    expect(cheios / cenarios.length, 'o pódio encolheu para cumprir a regra').toBeGreaterThan(0.9);
  });

  /**
   * E o caso 2 especificamente: com a atual ACIMA do teto, a alternativa entra no topo — e ainda
   * assim nenhuma linha se repete. É o cenário que meu próprio conserto quebrou.
   */
  it('vale também quando a alternativa é inserida no topo', () => {
    const comAlternativa = cenarios.filter(({ profile, result }) => {
      const teto = profile.frame_weight_ceiling_g;
      const atualId = profile.current_racket?.variant_id;
      if (teto === null || !atualId) return false;
      const atual = rackets.find((r) => r.variant.id === atualId);
      const acima = (atual?.variant.specs.unstrung_weight_g ?? 0) > teto;
      return acima && !result.podium.some((e) => e.racket.variant.id === atualId);
    });
    expect(comAlternativa.length, 'nenhum cenário exercita a inserção da alternativa').toBeGreaterThan(0);
    for (const { id, result } of comAlternativa) {
      const linhas = result.podium.map((e) => linhaDe(e.racket));
      expect(new Set(linhas).size, `${id}`).toBe(linhas.length);
    }
  });
});
