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
      { source: 'instagram', campaign: null, content: null, visitors: 0, finished: 0, paid: 0 },
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
      { source: 'boca-a-boca', campaign: null, content: null, visitors: 3, finished: 2, paid: 1 },
      { source: 'instagram', campaign: 'agosto', content: null, visitors: 300, finished: 120, paid: 12 },
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
      { source: 'anuncio-ruim', campaign: 'teste', content: null, visitors: 200, finished: 10, paid: 0 },
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
      { source: 'a', campaign: null, content: null, visitors: 100, finished: 5, paid: 1 },
      { source: 'b', campaign: null, content: null, visitors: 100, finished: 90, paid: 1 },
    ]);

    expect(publico_errado!.conversion).toBeCloseTo(oferta_errada!.conversion, 5);
    expect(publico_errado!.finished).toBeLessThan(oferta_errada!.finished);
  });

  it('a mesma origem com campanhas diferentes são linhas separadas', () => {
    // Sem isso, duas campanhas do mesmo canal se somariam e a pior esconderia a melhor.
    const linhas = computeCampaigns([
      { source: 'instagram', campaign: 'agosto', content: null, visitors: 100, finished: 40, paid: 8 },
      { source: 'instagram', campaign: 'setembro', content: null, visitors: 90, finished: 30, paid: 1 },
    ]);
    expect(linhas).toHaveLength(2);
    expect(linhas.map((l) => l.campaign)).toEqual(['agosto', 'setembro']);
  });
});

/**
 * ═══ A JUNÇÃO NÃO PODE CREDITAR O PASSADO AO ANÚNCIO ═════════════════════════════════════════
 *
 * `computeCampaigns` só faz a aritmética sobre números já contados. Quem os conta é a consulta, e
 * é lá que mora o defeito que este bloco tranca.
 *
 * O caso que revelou, em 09/09/2026: o dono fez uma compra de teste e, horas depois, abriu o
 * questionário por um link `utm_content=reel-3-erros`. A tabela mostrou aquele criativo com uma
 * venda — anterior ao anúncio existir.
 *
 * Na campanha real não é caso de teste: é o cliente que já comprou, vê o anúncio, clica e começa
 * outro questionário. A compra velha vai para a coluna do criativo, o criativo parece o vencedor, e
 * a verba seguinte vai para ele. Nenhum teste de aritmética pega isso, porque a aritmética está
 * certa — o número que entra nela é que está errado.
 */
describe('a junção entre marcadores e campanha', () => {
  it('só conta marcador posterior à linha de campanha', async () => {
    const { readFileSync } = await import('node:fs');
    const fonte = readFileSync('src/database/repositories/campaign-repo.ts', 'utf8');
    const juncao = fonte.slice(fonte.indexOf('.leftJoin('), fonte.indexOf('.where('));

    expect(
      juncao.includes('gte(funnelMarkers.createdAt, visitorCampaigns.createdAt)'),
      'sem a restrição de tempo, uma compra anterior ao clique é creditada ao criativo',
    ).toBe(true);
  });
});
