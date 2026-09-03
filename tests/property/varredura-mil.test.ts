/**
 * A VARREDURA DE MIL PERFIS, COMO TESTE.
 *
 * O gerador e as invariantes moram em `tests/helpers/varredura.ts` — separados de propósito, para
 * que ferramentas de auditoria fora do Vitest possam importá-los. Um módulo que importa `vitest`
 * não pode ser carregado por um script `tsx`, e foi exatamente isso que travou a primeira medição
 * de cobertura.
 *
 * O cabeçalho daquele arquivo registra os três defeitos que esta varredura encontrou.
 */

import { describe, expect, it } from 'vitest';
import { auditar, gerar, type Falha } from '../helpers/varredura';


describe('varredura de mil perfis', () => {
  const { falhas, stats } = auditar(gerar(1000));

  /**
   * Uma asserção só, com TODAS as falhas na mensagem.
   *
   * Um `expect` por invariante daria nove falhas separadas para o mesmo perfil quebrado e
   * esconderia o padrão. O que interessa ao ler o erro é quantos perfis quebraram, por qual regra,
   * e o número de um exemplo para reproduzir.
   */
  it('nenhum perfil viola as invariantes do produto', () => {
    const porRegra = new Map<string, Falha[]>();
    for (const f of falhas) {
      const lista = porRegra.get(f.regra) ?? [];
      lista.push(f);
      porRegra.set(f.regra, lista);
    }

    const resumo = [...porRegra]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([regra, fs]) => {
        const exemplos = fs.slice(0, 3).map((f) => `#${f.n} ${f.detalhe}`).join(' | ');
        return `${fs.length}x ${regra} — ${exemplos}`;
      })
      .join('\n    ');

    expect(falhas.length, `\n    ${resumo}\n`).toBe(0);
  });

  /** Guardas da própria varredura: se ela parar de exercitar o motor, para de provar qualquer coisa. */
  it('a varredura exercita de fato o espaço do questionário', () => {
    expect(stats.perfis).toBe(1000);
    expect(stats.comDor, 'nenhum perfil com histórico articular').toBeGreaterThan(100);
    expect(stats.tetoAtivo, 'o teto de peso não restringiu ninguém').toBeGreaterThan(300);
  });

  /** A média é o sinal mais estável de calibração — um perfil oscila, mil não. */
  it('o match médio se mantém no patamar calibrado', () => {
    expect(stats.matchMedio, `média atual ${stats.matchMedio}`).toBeGreaterThan(80);
  });
});
