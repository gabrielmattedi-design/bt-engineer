/**
 * A aritmética da atribuição de campanha.
 *
 * ═══ POR QUE ISTO PRECISA DE TESTE ═══════════════════════════════════════════════════════════
 *
 * Esta tabela vai ser lida para decidir onde colocar dinheiro de anúncio. Um número errado aqui
 * não parece errado — parece uma recomendação. E a decisão que ele induz custa dinheiro real, todo
 * dia, até alguém desconfiar.
 *
 * Os casos abaixo são os que produzem conclusão errada em silêncio: divisão por zero, ordenação
 * que faz amostra minúscula parecer a melhor campanha, e origem que trouxe gente e não converteu
 * — a que MAIS precisa aparecer, e a que uma consulta descuidada esconde.
 */

import { describe, expect, it } from 'vitest';
import { computeCampaigns } from '@/database/repositories/campaign-repo';

describe('desempenho por origem', () => {
  it('origem sem visitante não divide por zero', () => {
    const linhas = computeCampaigns([
      { source: 'instagram', campaign: null, visitors: 0, finished: 0, paid: 0 },
    ]);
    expect(Number.isFinite(linhas[0]!.conversion)).toBe(true);
    expect(linhas[0]!.conversion).toBe(0);
  });

  /**
   * O teste que protege a decisão mais cara.
   *
   * Uma origem com 3 visitantes e 1 pagante marca 33% — o maior percentual da tabela. Se a
   * ordenação fosse por conversão, ela apareceria no topo e a campanha de 300 visitantes a 4%
   * ficaria embaixo. Desligar a segunda para investir na primeira seria trocar um resultado
   * medido por um acaso de amostra pequena.
   */
  it('ordena por volume, e não deixa amostra minúscula encabeçar a lista', () => {
    const linhas = computeCampaigns([
      { source: 'boca-a-boca', campaign: null, visitors: 3, finished: 2, paid: 1 },
      { source: 'instagram', campaign: 'agosto', visitors: 300, finished: 120, paid: 12 },
    ]);

    expect(linhas[0]!.source, 'a campanha de 300 pessoas precisa vir primeiro').toBe('instagram');
    expect(linhas[0]!.conversion).toBeCloseTo(4, 5);
    expect(linhas[1]!.conversion).toBeCloseTo(33.33, 1);
  });

  /**
   * A origem que só queima dinheiro é a que mais precisa aparecer — e é a que some quando a
   * consulta filtra por conversão em vez de listar tudo.
   */
  it('origem com zero pagantes continua na tabela', () => {
    const linhas = computeCampaigns([
      { source: 'anuncio-ruim', campaign: 'teste', visitors: 200, finished: 10, paid: 0 },
    ]);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]!.paid).toBe(0);
    expect(linhas[0]!.conversion).toBe(0);
  });

  /**
   * As colunas do meio existem para separar dois fracassos diferentes com a mesma conversão.
   *
   * Ambas convertem 1%. Uma perde a pessoa dentro do questionário — anúncio que promete outra
   * coisa. A outra leva todo mundo até o fim e não vende — público certo, oferta errada. A
   * conversão sozinha diz que as duas vão mal; só `finished` diz o que consertar.
   */
  it('distingue quem abandona o questionário de quem termina e não paga', () => {
    const [publico_errado, oferta_errada] = computeCampaigns([
      { source: 'a', campaign: null, visitors: 100, finished: 5, paid: 1 },
      { source: 'b', campaign: null, visitors: 100, finished: 90, paid: 1 },
    ]);

    expect(publico_errado!.conversion).toBeCloseTo(oferta_errada!.conversion, 5);
    expect(publico_errado!.finished).toBeLessThan(oferta_errada!.finished);
  });

  it('a mesma origem com campanhas diferentes são linhas separadas', () => {
    // Sem isso, duas campanhas do mesmo canal se somariam e a pior esconderia a melhor.
    const linhas = computeCampaigns([
      { source: 'instagram', campaign: 'agosto', visitors: 100, finished: 40, paid: 8 },
      { source: 'instagram', campaign: 'setembro', visitors: 90, finished: 30, paid: 1 },
    ]);
    expect(linhas).toHaveLength(2);
    expect(linhas.map((l) => l.campaign)).toEqual(['agosto', 'setembro']);
  });
});
