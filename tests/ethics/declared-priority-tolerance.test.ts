/**
 * A TOLERÂNCIA POR POSIÇÃO: o que você declarou em 1º lugar entra nas 10 melhores raquetes
 * compatíveis com o seu perfil naquele aspecto; o 2º nas 15; o 3º nas 20.
 *
 * ═══ POR QUE POSIÇÃO, E NÃO UM PISO ABSOLUTO ═══════════════════════════════════════════════
 *
 * Três versões anteriores deste filtro usaram pisos absolutos — posição 60 do catálogo, média do
 * catálogo, "não pior que a sua raquete atual". Todas partilhavam o mesmo defeito: piso absoluto
 * pode ser IMPOSSÍVEL de cumprir. Nas palavras do usuário: "se a raquete é a primeira colocada em
 * spin e o cliente pede spin em primeiro lugar, não tem como dar outra".
 *
 * Uma tolerância por posição nunca tem esse problema — as dez melhores sempre existem — e se ajusta
 * sozinha ao catálogo: se todas as raquetes adequadas ao jogador são fracas em potência, o topo
 * delas continua sendo a melhor resposta possível, sem o filtro desligar.
 *
 * Medido em 660 perfis com prioridade declarada:
 *
 *     a vencedora já cumpria ................. 74,7%
 *     custo de exigir ....................... mediana 4,9 pontos de match, p90 9,7
 *
 * Contra a regra absoluta que ela substituiu: mediana 23 pontos, p90 35.
 *
 * ═══ O QUE O TESTE EXIGE, E O QUE NÃO ════════════════════════════════════════════════════
 *
 * Exige que a prioridade 1 seja respeitada sempre que houver campo — é a promessa. Não exige as
 * três: elas entram uma a uma e só enquanto o conjunto restante continuar viável, porque exigir as
 * três de uma vez é conjuntivo e colapsa, deixando nem a primeira protegida.
 */

import { describe, expect, it } from 'vitest';
import { buildPlayerProfile } from '@/recommendation/profile/build-profile';
import { recommend } from '@/recommendation';
import {
  FLOOR_SAFE_PHYSICAL,
  FLOOR_SAFE_SKILL,
} from '@/recommendation/engine/rank-rackets';
import { NEED_TO_RACKET_ATTRIBUTE, type NeedKey } from '@/domain/player-profile';
import { PERSONAS } from '@/data/personas';
import { TEST_DATASET_VERSION, TEST_MODE, testRackets, testStrings } from '../helpers/catalog';

/** As mesmas folgas de `PRIORITY_TOLERANCE`. Duplicadas: o teste é a régua externa. */
const TOLERANCIA = [10, 15, 20];

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
  return { persona, profile, result };
});

const compativeis = (result: (typeof analises)[number]['result']) =>
  result.full_ranking.filter((r) => {
    const raw = (key: string) => r.breakdown.components.find((c) => c.key === key)?.raw ?? 0;
    return raw('physical_fit') >= FLOOR_SAFE_PHYSICAL && raw('skill_fit') >= FLOOR_SAFE_SKILL;
  });

describe('tolerância por posição no que foi declarado', () => {
  it('a prioridade 1 entra nas 10 melhores compatíveis, quando existe campo', () => {
    let verificados = 0;

    for (const { persona, profile, result } of analises) {
      const primeira = profile.declared_priorities[0];
      if (!primeira) continue;

      const campo = compativeis(result);
      if (campo.length < TOLERANCIA[0]!) continue;
      verificados += 1;

      const attrKey = NEED_TO_RACKET_ATTRIBUTE[primeira as NeedKey];
      const valor = (r: (typeof campo)[number]) => r.racket.attributes[attrKey] as number;
      const topo = [...campo].sort((a, b) => valor(b) - valor(a)).slice(0, TOLERANCIA[0]!);

      const vencedora = result.full_ranking[0]!;
      const posicao =
        [...campo].sort((a, b) => valor(b) - valor(a))
          .findIndex((r) => r.racket.variant.id === vencedora.racket.variant.id) + 1;

      expect(
        topo.some((r) => r.racket.variant.id === vencedora.racket.variant.id),
        `${persona.id}: declarou ${primeira} em 1º e a recomendada é a ${posicao}ª entre as ` +
          `${campo.length} compatíveis nesse aspecto`,
      ).toBe(true);
    }

    expect(verificados, 'nenhuma persona com prioridade e campo — nada verificado')
      .toBeGreaterThan(0);
  });

  /**
   * A tolerância escolhe DENTRO do que é compatível, nunca contra. Se ela pudesse promover uma
   * raquete inadequada, viraria o dano que já foi medido ao subir `objective_fit` para 50%:
   * p02 caindo de nível 82 para 35, p04 de físico 100 para 40.
   */
  it('nenhuma vencedora é incompatível com o perfil que a recebeu', () => {
    for (const { persona, result } of analises) {
      const raw = (key: string) =>
        result.full_ranking[0]!.breakdown.components.find((c) => c.key === key)?.raw ?? 0;
      expect(raw('physical_fit'), `${persona.id}: físico`).toBeGreaterThan(50);
      expect(raw('skill_fit'), `${persona.id}: nível`).toBeGreaterThan(50);
    }
  });

  /**
   * A PREMISSA: o eixo declarado em 1º nunca fica abaixo da raquete média do catálogo.
   *
   * ═══ POR QUE A TOLERÂNCIA SOZINHA NÃO BASTAVA ══════════════════════════════════════════
   *
   * Exigência do usuário: "não posso pedir potência, e o sistema não só tirar potência comparado
   * à minha atual, mas também me entregar potência abaixo da média".
   *
   * A tolerância é RELATIVA — top-10 do pool compatível com o jogador. Se o pool inteiro é fraco
   * naquele eixo, o topo dele continua abaixo da média do catálogo. Medido nas 22 personas com
   * potência forçada em 1º: só a tolerância deixava 6 perfis EXATAMENTE em cima da média, todos na
   * mesma raquete equilibrada; com a premissa, 1. Nas personas como elas de fato respondem, 1
   * abaixo da média antes e ZERO depois, ao custo de 0,1 ponto de match médio.
   *
   * O teste é condicional por isso, e a condição é a mesma que o motor usa: só cobra quando a
   * saída existe. Sem ela, promover uma raquete que o corpo não sustenta para cumprir um número
   * seria o dano já medido ao subir `objective_fit` para 50% (p04, físico 100 -> 40).
   */
  it('o eixo declarado em 1º não fica abaixo da média do catálogo, quando dá', () => {
    let verificados = 0;

    for (const { persona, profile, result } of analises) {
      const primeira = profile.declared_priorities[0];
      if (!primeira) continue;

      const attrKey = NEED_TO_RACKET_ATTRIBUTE[primeira as NeedKey];
      const banda = result.attribute_bands[attrKey];
      const media = result.attribute_means[attrKey];
      if (!banda || media === undefined || banda[1] <= banda[0]) continue;

      const posicao = (r: { racket: { attributes: Record<string, unknown> } }) =>
        ((r.racket.attributes[attrKey] as number) - banda[0]) / (banda[1] - banda[0]) * 100;

      const campo = compativeis(result);
      // A saída existe? Só então a promessa é cobrável — e o motor usa exatamente este critério.
      if (!campo.some((r) => posicao(r) >= media)) continue;
      verificados += 1;

      const vencedora = result.full_ranking[0]!;
      expect(
        Math.round(posicao(vencedora)),
        `${persona.id}: declarou ${primeira} em 1º e a recomendada entrega ` +
          `${Math.round(posicao(vencedora))} de 100 nesse eixo, contra ${Math.round(media)} da ` +
          `raquete média — existindo candidata compatível acima da média`,
      ).toBeGreaterThanOrEqual(Math.round(media));
    }

    expect(verificados, 'nenhuma persona com prioridade e saída — nada verificado')
      .toBeGreaterThan(0);
  });

  /** A raquete atual é isenta: sem ela no ranking, o bloco de comparação some do relatório. */
  it('a raquete atual continua no ranking mesmo fora da tolerância', () => {
    let verificadas = 0;

    for (const { persona, profile, result } of analises) {
      const id = profile.current_racket?.variant_id;
      if (!id || profile.current_racket?.unrecognized) continue;
      if (!testRackets().some((r) => r.variant.id === id)) continue;
      verificadas += 1;

      expect(
        result.full_ranking.some((r) => r.racket.variant.id === id),
        `${persona.id}: a raquete atual saiu do ranking`,
      ).toBe(true);
    }

    expect(verificadas, 'nenhuma persona com raquete atual reconhecida').toBeGreaterThan(0);
  });
});
