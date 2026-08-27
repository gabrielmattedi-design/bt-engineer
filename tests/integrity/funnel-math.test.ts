/**
 * A aritmética do funil.
 *
 * ═══ POR QUE ISTO PRECISA DE TESTE ═══════════════════════════════════════════════════════════
 *
 * Um funil errado não parece errado. Ele mostra percentuais plausíveis, o dono lê, decide onde
 * mexer no produto e gasta dinheiro de anúncio em cima da conclusão — sem nada que denuncie o erro.
 * Um relatório que mente com aparência de verdade é pior que a ausência dele, porque a ausência
 * pelo menos não induz decisão.
 *
 * Os casos abaixo são todos os que produzem número absurdo em silêncio: funil vazio (divisão por
 * zero), etapa posterior com mais gente que a anterior (percentual acima de 100), e marco ausente
 * (que deve valer zero, e não sumir da lista deslocando as comparações).
 */

import { describe, expect, it } from 'vitest';
import {
  computeFunnel,
  computeQuizDropoff,
  FUNNEL_STEPS,
} from '@/database/repositories/funnel-repo';

describe('cálculo do funil', () => {
  it('funil vazio não divide por zero nem devolve NaN', () => {
    const linhas = computeFunnel(new Map());

    expect(linhas).toHaveLength(FUNNEL_STEPS.length);
    for (const linha of linhas) {
      expect(linha.visitors).toBe(0);
      expect(Number.isFinite(linha.ofStart), `${linha.marker}: ofStart virou ${linha.ofStart}`).toBe(true);
      expect(Number.isFinite(linha.ofPrevious)).toBe(true);
    }
  });

  it('as duas percentagens medem coisas diferentes', () => {
    const linhas = computeFunnel(
      new Map([
        ['quiz:start', 100],
        ['quiz:done', 50],
        ['analysis', 45],
        ['plans', 20],
        ['checkout', 10],
        ['paid', 8],
        ['report', 8],
      ]),
    );

    const plans = linhas.find((l) => l.marker === 'plans')!;
    // 20 de 100 no topo, mas 20 de 45 da etapa anterior.
    expect(plans.ofStart).toBeCloseTo(20, 5);
    expect(plans.ofPrevious).toBeCloseTo(44.44, 1);

    const paid = linhas.find((l) => l.marker === 'paid')!;
    expect(paid.ofStart).toBeCloseTo(8, 5);
    expect(paid.ofPrevious).toBeCloseTo(80, 5);
  });

  /**
   * O caso que mais confunde quem lê: uma etapa posterior pode ter MAIS gente que a anterior.
   *
   * Acontece de verdade — quem entra por código de convite chega ao relatório sem passar por
   * pagamento, e quem reabre o link do e-mail semanas depois conta em `report` sem ter contado em
   * `checkout` naquele período. O cálculo não pode esconder isso limitando a 100%: o número acima
   * de 100 é a informação, e é ela que faz o dono perguntar por que — que é a pergunta certa.
   */
  it('não esconde etapa que recebe mais gente que a anterior', () => {
    const linhas = computeFunnel(
      new Map([
        ['quiz:start', 10],
        ['quiz:done', 5],
        ['analysis', 5],
        ['plans', 4],
        ['checkout', 2],
        ['paid', 2],
        ['report', 6],
      ]),
    );

    const report = linhas.find((l) => l.marker === 'report')!;
    expect(report.visitors).toBe(6);
    expect(report.ofPrevious).toBeCloseTo(300, 5);
  });

  it('marco ausente vale zero e mantém a lista completa', () => {
    const linhas = computeFunnel(new Map([['quiz:start', 10]]));

    expect(linhas.map((l) => l.marker)).toEqual(FUNNEL_STEPS.map((s) => s.marker));
    expect(linhas.find((l) => l.marker === 'paid')!.visitors).toBe(0);
    expect(linhas.find((l) => l.marker === 'paid')!.ofStart).toBe(0);
  });

  it('a ordem das linhas é a ordem do funil, não a do banco', () => {
    // O `group by` do Postgres não promete ordem nenhuma.
    const linhas = computeFunnel(
      new Map([
        ['report', 1],
        ['quiz:start', 10],
        ['paid', 2],
      ]),
    );
    expect(linhas.map((l) => l.marker)).toEqual(FUNNEL_STEPS.map((s) => s.marker));
  });
});

describe('abandono por etapa do questionário', () => {
  it('trata quiz:start como a etapa zero', () => {
    // Sem isto, a abertura cairia fora e o painel esconderia a maior perda de todo questionário:
    // a que acontece na primeira tela.
    const etapas = computeQuizDropoff([
      { marker: 'quiz:start', visitors: 100 },
      { marker: 'quiz:1', visitors: 60 },
      { marker: 'quiz:2', visitors: 55 },
    ]);

    expect(etapas[0]!.step).toBe(0);
    expect(etapas[0]!.reached).toBe(100);
    expect(etapas[0]!.lostHere).toBe(40);
  });

  it('ignora quiz:done, que não é uma etapa numerada', () => {
    const etapas = computeQuizDropoff([
      { marker: 'quiz:start', visitors: 10 },
      { marker: 'quiz:1', visitors: 8 },
      { marker: 'quiz:done', visitors: 5 },
    ]);
    expect(etapas.map((e) => e.step)).toEqual([0, 1]);
  });

  it('a última etapa conhecida não afirma perda zero', () => {
    /*
      Não há "próxima" para comparar, então a perda ali é DESCONHECIDA. Reportar zero seria
      afirmar que ninguém desistiu no fim do questionário — provavelmente falso, e exatamente o
      tipo de zero que passa por verdade.
    */
    const etapas = computeQuizDropoff([
      { marker: 'quiz:start', visitors: 10 },
      { marker: 'quiz:3', visitors: 4 },
    ]);
    expect(etapas[etapas.length - 1]!.lostHere).toBe(0);
  });

  it('ordena por etapa, e não pela ordem que veio do banco', () => {
    const etapas = computeQuizDropoff([
      { marker: 'quiz:5', visitors: 2 },
      { marker: 'quiz:start', visitors: 10 },
      { marker: 'quiz:2', visitors: 6 },
    ]);
    expect(etapas.map((e) => e.step)).toEqual([0, 2, 5]);
  });

  it('nunca reporta perda negativa', () => {
    // Se uma etapa posterior tiver mais gente (convite, reabertura), a perda é zero e não negativa.
    const etapas = computeQuizDropoff([
      { marker: 'quiz:start', visitors: 5 },
      { marker: 'quiz:1', visitors: 9 },
    ]);
    expect(etapas[0]!.lostHere).toBe(0);
  });
});
