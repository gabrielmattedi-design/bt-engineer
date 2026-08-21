/**
 * A PREMISSA: quem pede mais de um aspecto não recebe menos que a média nele.
 *
 * ═══ NAS PALAVRAS DO USUÁRIO ═════════════════════════════════════════════════════════════════
 *
 * "Precisamos estabelecer alguma premissa para atender o desejo do usuário: não posso pedir
 * potência, e o sistema não só tirar potência comparada à minha atual, mas também me entregar
 * potência abaixo da média."
 *
 * ═══ POR QUE O PISO CONJUNTIVO NÃO BASTAVA ═══════════════════════════════════════════════════
 *
 * O corte de 60 em TODOS os eixos pedidos colapsa conforme a pessoa declara mais prioridades —
 * medido nos 616 perfis com pedido forte, ele desligava em 162 dos 266 que declaram duas e em
 * TODOS os 65 que declaram três, porque sobravam 0,3 candidatas em média. Quem mais declarou
 * sobre o que quer era exatamente quem não recebia efeito nenhum.
 *
 * A premissa abandona a conjunção e garante o pedido MAIS FORTE, contra a média do catálogo
 * naquele eixo. Medido: a vencedora fica abaixo dessa média em 14 de 686 perfis (2,0%).
 *
 * ═══ POR QUE NÃO É UMA GARANTIA ABSOLUTA ═════════════════════════════════════════════════════
 *
 * Porque não pode ser. Existem perfis para os quais nenhuma raquete acima da média no eixo pedido
 * é segura: neste catálogo a potência correlaciona +0,77 com tamanho de cabeça e −0,85 com peso,
 * então as mais potentes são quadros de 105 a 108 pol² feitos para quem está começando. Oferecer
 * um deles a um jogador avançado atenderia o pedido e estragaria a recomendação — foi medido, e é
 * o mesmo dano que derrubou a alternativa de subir `objective_fit` a 50% (p02 nível 82 -> 35).
 *
 * Quando a válvula segura, o relatório deve DIZER isso — e é por isso que este teste verifica a
 * válvula em vez de exigir o piso sempre.
 */

import { describe, expect, it } from 'vitest';
import { buildPlayerProfile } from '@/recommendation/profile/build-profile';
import { recommend } from '@/recommendation';
import { buildCatalogScale } from '@/recommendation/engine/catalog-scale';
import {
  FLOOR_SAFE_PHYSICAL,
  FLOOR_SAFE_SKILL,
} from '@/recommendation/engine/rank-rackets';
import { NEED_KEYS, NEED_TO_RACKET_ATTRIBUTE, type NeedKey } from '@/domain/player-profile';
import { PERSONAS } from '@/data/personas';
import { TEST_DATASET_VERSION, TEST_MODE, testRackets, testStrings } from '../helpers/catalog';

/** O mesmo limiar de `FLOOR_ASK_STRONG`. Duplicado: o teste é a régua externa. */
const ASK_STRONG = 20;

const catalogo = testRackets();
const escala = buildCatalogScale(catalogo);

const valorDe = (racket: { attributes: Record<string, unknown> }, need: NeedKey): number => {
  const attrKey = NEED_TO_RACKET_ATTRIBUTE[need];
  return racket.attributes[attrKey] as number;
};

/** A média do CATÁLOGO no eixo, em posição — não a média do ranking, que o filtro empurra. */
const mediaDoCatalogo = (need: NeedKey): number => {
  const attrKey = NEED_TO_RACKET_ATTRIBUTE[need];
  const soma = catalogo.reduce((acc, r) => acc + valorDe(r, need), 0);
  return escala.position(attrKey, soma / catalogo.length);
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
  const principal =
    fortes.length === 0
      ? null
      : fortes.reduce((a, b) =>
          profile.desired_change_vector[a] >= profile.desired_change_vector[b] ? a : b,
        );
  return { persona, profile, result, principal };
});

describe('premissa do pedido declarado', () => {
  it('a vencedora não fica abaixo da média no que a pessoa mais pediu — ou a válvula explica', () => {
    let comPedido = 0;

    for (const { persona, result, principal } of analises) {
      if (principal === null) continue;
      comPedido += 1;

      const attrKey = NEED_TO_RACKET_ATTRIBUTE[principal];
      const media = mediaDoCatalogo(principal);
      const vencedora = result.full_ranking[0]!;
      const posicao = escala.position(attrKey, valorDe(vencedora.racket, principal));

      if (posicao >= media - 1) continue;

      /**
       * Abaixo da média: só é aceitável se NENHUMA candidata acima dela serve ao jogador. Essa é a
       * única desculpa — e ela é verificável, não uma cláusula de escape.
       */
      const acimaDaMedia = result.full_ranking.filter(
        (r) => escala.position(attrKey, valorDe(r.racket, principal)) >= media,
      );
      const seguras = acimaDaMedia.filter((r) => {
        const raw = (key: string) => r.breakdown.components.find((c) => c.key === key)?.raw ?? 0;
        return raw('physical_fit') >= FLOOR_SAFE_PHYSICAL && raw('skill_fit') >= FLOOR_SAFE_SKILL;
      });

      expect(
        seguras.length,
        `${persona.id}: pediu ${principal} com força, recebeu posição ${Math.round(posicao)} ` +
          `contra média ${Math.round(media)}, e existiam ${seguras.length} candidatas seguras acima`,
      ).toBe(0);
    }

    expect(comPedido, 'nenhuma persona com pedido forte — o teste não verificou nada')
      .toBeGreaterThan(0);
  });

  /**
   * A válvula não pode ser desligada por engano. Se alguém baixar os mínimos de segurança para
   * fazer a premissa valer sempre, volta o dano medido: quadro de 108 pol² para jogador avançado.
   */
  it('nenhuma vencedora é insegura para o perfil que a recebeu', () => {
    for (const { persona, result } of analises) {
      const vencedora = result.full_ranking[0]!;
      const raw = (key: string) =>
        vencedora.breakdown.components.find((c) => c.key === key)?.raw ?? 0;

      expect(raw('physical_fit'), `${persona.id}: físico da vencedora`).toBeGreaterThan(50);
      expect(raw('skill_fit'), `${persona.id}: nível da vencedora`).toBeGreaterThan(50);
    }
  });
});
