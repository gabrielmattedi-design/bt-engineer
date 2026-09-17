import { describe, expect, it } from 'vitest';
import {
  calcularLucro,
  emReais,
  lerDinheiroEmCentavos,
  lerTaxaPercentual,
} from '@/lib/lucro';

/**
 * O lucro do dia decide orçamento, e orçamento errado custa dinheiro de verdade.
 *
 * Estes testes existem porque a alternativa era o dono dividir à mão no celular — e porque a
 * leitura de dinheiro digitado tem uma ambiguidade de fator mil que passa despercebida.
 */

describe('lerDinheiroEmCentavos', () => {
  it('lê vírgula decimal, que é como o brasileiro escreve', () => {
    expect(lerDinheiroEmCentavos('126,17')).toBe(12617);
    expect(lerDinheiroEmCentavos('0,99')).toBe(99);
  });

  it('lê ponto decimal, porque o teclado do celular só oferece ponto', () => {
    expect(lerDinheiroEmCentavos('126.17')).toBe(12617);
  });

  it('⚠️ trata 3 dígitos depois do separador como MILHAR, não decimal', () => {
    /*
      É a armadilha inteira. `parseFloat("1.234")` devolve 1.234 — um real e vinte e três. Se o
      dono digitar mil duzentos e trinta e quatro reais de gasto e o painel ler R$ 1,23, o CAC sai
      mil vezes menor, parece excelente e manda escalar.
    */
    expect(lerDinheiroEmCentavos('1.234')).toBe(123400);
    expect(lerDinheiroEmCentavos('1,234')).toBe(123400);
    expect(Number.parseFloat('1.234')).toBeCloseTo(1.234); // o que NÃO se usa aqui
  });

  it('com os dois separadores, o último é o decimal', () => {
    expect(lerDinheiroEmCentavos('1.234,56')).toBe(123456);
    expect(lerDinheiroEmCentavos('1,234.56')).toBe(123456);
  });

  it('completa o centavo faltante em vez de encurtar o valor', () => {
    expect(lerDinheiroEmCentavos('126,5')).toBe(12650);
    expect(lerDinheiroEmCentavos('126')).toBe(12600);
  });

  it('aceita R$ e espaços, que é o que sai de um copiar e colar', () => {
    expect(lerDinheiroEmCentavos('R$ 126,17')).toBe(12617);
    expect(lerDinheiroEmCentavos('  126,17  ')).toBe(12617);
  });

  it('devolve null para o que não é dinheiro, em vez de NaN', () => {
    for (const ruim of ['', '   ', 'abc', '-5', '1..2', '1,2,3', '12.34.56', undefined]) {
      expect(lerDinheiroEmCentavos(ruim)).toBeNull();
    }
  });

  it('a regra do milhar vale para qualquer separador, e isto foi um teste meu errado', () => {
    /*
      Eu havia posto `"12,345"` na lista de inválidos acima. O teste falhou devolvendo 1234500, e
      quem estava errado era o teste: 3 dígitos depois do separador é MILHAR pela regra escrita em
      `lucro.ts`, e "12,345" é a mesma forma de "1.234" e "1,234", que os testes acima já tratam
      como milhar. Manter a exceção teria criado duas regras para o mesmo formato.
    */
    expect(lerDinheiroEmCentavos('12,345')).toBe(1234500);
    expect(lerDinheiroEmCentavos('12.345')).toBe(1234500);
  });
});

describe('lerTaxaPercentual', () => {
  it('lê porcentagem com vírgula ou ponto, com ou sem o símbolo', () => {
    expect(lerTaxaPercentual('5,53')).toBeCloseTo(5.53);
    expect(lerTaxaPercentual('5.53')).toBeCloseTo(5.53);
    expect(lerTaxaPercentual('5,53%')).toBeCloseTo(5.53);
    expect(lerTaxaPercentual('0')).toBe(0);
  });

  it('recusa o que não pode ser taxa', () => {
    for (const ruim of ['', '-1', '101', 'abc', undefined]) {
      expect(lerTaxaPercentual(ruim)).toBeNull();
    }
  });
});

describe('calcularLucro', () => {
  it('fecha o dia 16/09 com a taxa informada', () => {
    const r = calcularLucro({
      receitaCentavos: 64987,
      gastoCentavos: 12617,
      taxaPercentual: 5.53,
      clientes: 13,
    });
    expect(r.taxaCentavos).toBe(3594);
    expect(r.lucroCentavos).toBe(64987 - 3594 - 12617);
    expect(r.antesDasTaxas).toBe(false);
    expect(r.cacCentavos).toBe(971); // R$ 9,71 — o número que a série já usava
    expect(r.roas).toBeCloseTo(5.15, 2);
  });

  it('sem taxa, devolve lucro BRUTO e se declara assim', () => {
    const r = calcularLucro({
      receitaCentavos: 64987,
      gastoCentavos: 12617,
      taxaPercentual: null,
      clientes: 13,
    });
    expect(r.taxaCentavos).toBeNull();
    expect(r.antesDasTaxas).toBe(true);
    expect(r.lucroCentavos).toBe(64987 - 12617);
  });

  it('NÃO esconde prejuízo atrás de zero', () => {
    const r = calcularLucro({
      receitaCentavos: 5000,
      gastoCentavos: 20000,
      taxaPercentual: null,
      clientes: 1,
    });
    expect(r.lucroCentavos).toBe(-15000);
  });

  it('zero cliente devolve CAC null, e não Infinity', () => {
    const r = calcularLucro({
      receitaCentavos: 0,
      gastoCentavos: 12617,
      taxaPercentual: null,
      clientes: 0,
    });
    expect(r.cacCentavos).toBeNull();
    expect(r.lucroCentavos).toBe(-12617);
  });

  it('gasto zero devolve ROAS null, e não Infinity', () => {
    const r = calcularLucro({
      receitaCentavos: 64987,
      gastoCentavos: 0,
      taxaPercentual: null,
      clientes: 13,
    });
    expect(r.roas).toBeNull();
    expect(r.cacCentavos).toBe(0);
  });

  it('não aceita entrada negativa virando lucro inflado', () => {
    const r = calcularLucro({
      receitaCentavos: -1000,
      gastoCentavos: -1000,
      taxaPercentual: null,
      clientes: -5,
    });
    expect(r.receitaCentavos).toBe(0);
    expect(r.gastoCentavos).toBe(0);
    expect(r.lucroCentavos).toBe(0);
    expect(r.cacCentavos).toBeNull();
  });
});

describe('emReais', () => {
  it('formata no padrão brasileiro, inclusive negativo', () => {
    expect(emReais(123456)).toBe('1.234,56');
    expect(emReais(971)).toBe('9,71');
    expect(emReais(-15000)).toBe('-150,00');
    expect(emReais(0)).toBe('0,00');
  });
});
