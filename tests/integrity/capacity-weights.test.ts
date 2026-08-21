/**
 * Os pesos da capacidade física precisam somar 1.00.
 *
 * ═══ O DEFEITO QUE ESTE TESTE TRANCA ═════════════════════════════════════════════════════════
 *
 * `computePhysicalCapacity` é uma média ponderada de cinco termos — força, preparo, porte, idade e
 * carga de jogo. O resultado é lido como uma nota de 0 a 100 e comparado com a posição de massa da
 * raquete: se os pesos não somam 1.00, a nota deixa de ser uma média e vira uma escala deslocada,
 * e TODA a comparação com o catálogo sai enviesada.
 *
 * Aconteceu. Ao rebalancear preparo contra carga de jogo, uma substituição automática não casou com
 * a indentação da linha do preparo: a carga subiu para 0.16 e o preparo continuou em 0.24. A soma
 * foi para 1.06 e a capacidade de todo mundo inflou cerca de 6%.
 *
 * O que torna esse defeito perigoso é como ele se apresenta: as 22 personas continuaram passando,
 * os 319 testes continuaram verdes, e a medição de impacto mostrou a capacidade subindo — que era
 * exatamente o formato do resultado esperado. Passaria por efeito pretendido.
 *
 * ═══ POR QUE O TESTE LÊ O CÓDIGO-FONTE ═══════════════════════════════════════════════════════
 *
 * Os pesos são literais dentro da função, não uma tabela exportada. Exportá-los só para poder
 * testá-los mudaria o desenho do módulo por causa do teste. Ler a fonte é feio e é honesto: falha
 * exatamente quando alguém mexe num literal e esquece do outro, que é o caso real.
 *
 * A alternativa comportamental — cravar capacidades esperadas para perfis fixos — não pega este
 * defeito: uma capacidade 6% maior é um número plausível, e o teste precisaria já saber o valor
 * certo para acusar o errado.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const FONTE = readFileSync(
  join(__dirname, '..', '..', 'src', 'recommendation', 'profile', 'build-profile.ts'),
  'utf8',
);

/** O corpo de `const base = ...` dentro de `computePhysicalCapacity`. */
function blocoDaCapacidade(): string {
  const inicio = FONTE.indexOf('function computePhysicalCapacity');
  expect(inicio, 'computePhysicalCapacity sumiu ou foi renomeada').toBeGreaterThan(-1);

  const base = FONTE.indexOf('const base =', inicio);
  expect(base, '`const base` sumiu de computePhysicalCapacity').toBeGreaterThan(-1);

  const fim = FONTE.indexOf(';', base);
  return FONTE.slice(base, fim);
}

describe('pesos da capacidade física', () => {
  it('somam exatamente 1.00', () => {
    const bloco = blocoDaCapacidade();
    const pesos = [...bloco.matchAll(/(\d*\.?\d+)\s*\*/g)].map((m) => Number(m[1]));

    expect(pesos.length, `esperava cinco termos, achei ${pesos.length}: ${pesos.join(', ')}`).toBe(
      5,
    );

    const soma = pesos.reduce((s, p) => s + p, 0);
    // Ponto flutuante: 0.3 + 0.18 + 0.22 + 0.14 + 0.16 não fecha em 1 exato.
    expect(soma, `pesos ${pesos.join(' + ')} = ${soma}`).toBeCloseTo(1, 6);
  });

  /**
   * Nenhum termo pode dominar sozinho.
   *
   * A capacidade existe para cruzar cinco evidências independentes. Um termo acima de 0.4 faria as
   * outras quatro virarem ornamento — e o modo mais provável de isso acontecer é alguém "ajustando"
   * um peso para fazer um caso específico passar, que é como este arquivo já quase saiu errado.
   */
  it('nenhum peso isolado domina a conta', () => {
    const pesos = [...blocoDaCapacidade().matchAll(/(\d*\.?\d+)\s*\*/g)].map((m) => Number(m[1]));
    for (const p of pesos) expect(p).toBeLessThanOrEqual(0.4);
  });
});
