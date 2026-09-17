import { describe, expect, it } from 'vitest';
import { montarFinanceiro } from '@/lib/financeiro';

/**
 * A tela financeira decide se o negócio está ganhando dinheiro. Os casos abaixo são os que
 * devolvem um número plausível e errado — que é o único tipo de erro que ninguém vai atrás.
 */

const dia = (d: string, pedidos: number, centavos: number) => ({ dia: d, pedidos, centavos });

describe('montarFinanceiro', () => {
  it('junta faturamento e gasto, e ordena do mais recente para o mais antigo', () => {
    const r = montarFinanceiro(
      [dia('2026-09-15', 9, 52989), dia('2026-09-16', 13, 64987)],
      new Map([
        ['2026-09-15', 11063],
        ['2026-09-16', 12617],
      ]),
    );

    expect(r.dias.map((d) => d.dia)).toEqual(['2026-09-16', '2026-09-15']);
    expect(r.dias[0]?.lucroCentavos).toBe(64987 - 12617);
    expect(r.faturamentoCentavos).toBe(52989 + 64987);
    expect(r.gastoCentavos).toBe(11063 + 12617);
    expect(r.lucroCentavos).toBe(52989 + 64987 - 11063 - 12617);
    expect(r.pedidos).toBe(22);
    expect(r.diasSemGasto).toBe(0);
  });

  it('⚠️ mostra o dia em que se gastou e NÃO se vendeu', () => {
    /*
      O dia de prejuízo puro é o mais importante da série, e é justamente o que desapareceria se a
      lista viesse só de `orders`. Sumindo da tela, o total de gasto pararia de fechar com a fatura
      do Meta e o lucro sairia alto demais.
    */
    const r = montarFinanceiro([dia('2026-09-16', 13, 64987)], new Map([
      ['2026-09-16', 12617],
      ['2026-09-11', 5791],
    ]));

    expect(r.dias.map((d) => d.dia)).toEqual(['2026-09-16', '2026-09-11']);
    const vazio = r.dias[1];
    expect(vazio?.pedidos).toBe(0);
    expect(vazio?.faturamentoCentavos).toBe(0);
    expect(vazio?.lucroCentavos).toBe(-5791);
    expect(r.gastoCentavos).toBe(12617 + 5791);
  });

  it('gasto ausente não vira zero — o lucro do dia fica null', () => {
    const r = montarFinanceiro([dia('2026-09-17', 6, 29994)], new Map());

    expect(r.dias[0]?.gastoCentavos).toBeNull();
    expect(r.dias[0]?.lucroCentavos).toBeNull();
    expect(r.diasSemGasto).toBe(1);
  });

  it('⚠️ o total de lucro NÃO soma dia sem gasto informado', () => {
    /*
      Se o total fosse "faturamento inteiro − gasto parcial", o lucro sairia inflado e continuaria
      plausível. `diasSemGasto` é o que deixa o total legível: dá para ver o que falta nele.
    */
    const r = montarFinanceiro(
      [dia('2026-09-16', 13, 64987), dia('2026-09-17', 6, 29994)],
      new Map([['2026-09-16', 12617]]),
    );

    expect(r.faturamentoCentavos).toBe(64987 + 29994);
    expect(r.lucroCentavos).toBe(64987 - 12617); // o dia 17 fica fora
    expect(r.diasSemGasto).toBe(1);
  });

  it('gasto ZERO é diferente de gasto ausente', () => {
    const r = montarFinanceiro([dia('2026-09-16', 13, 64987)], new Map([['2026-09-16', 0]]));

    expect(r.dias[0]?.gastoCentavos).toBe(0);
    expect(r.dias[0]?.lucroCentavos).toBe(64987);
    expect(r.diasSemGasto).toBe(0);
  });

  it('acha os extremos, e o pior lucro pode ser negativo', () => {
    const r = montarFinanceiro(
      [dia('2026-09-13', 20, 91980), dia('2026-09-11', 4, 19996), dia('2026-09-16', 13, 64987)],
      new Map([
        ['2026-09-13', 15682],
        ['2026-09-11', 25000],
        ['2026-09-16', 12617],
      ]),
    );

    expect(r.melhorFaturamento?.dia).toBe('2026-09-13');
    expect(r.melhorLucro?.dia).toBe('2026-09-13');
    expect(r.piorLucro?.dia).toBe('2026-09-11');
    expect(r.piorLucro?.lucroCentavos).toBe(19996 - 25000);
  });

  it('lista vazia não lança, e devolve null nos extremos', () => {
    const r = montarFinanceiro([], new Map());

    expect(r.dias).toEqual([]);
    expect(r.faturamentoCentavos).toBe(0);
    expect(r.lucroCentavos).toBe(0);
    expect(r.melhorFaturamento).toBeNull();
    expect(r.melhorLucro).toBeNull();
    expect(r.piorLucro).toBeNull();
  });

  it('só faturamento, sem gasto nenhum: extremos de lucro ficam null', () => {
    const r = montarFinanceiro([dia('2026-09-16', 13, 64987)], new Map());

    expect(r.melhorFaturamento?.dia).toBe('2026-09-16');
    expect(r.melhorLucro).toBeNull();
    expect(r.piorLucro).toBeNull();
  });
});
