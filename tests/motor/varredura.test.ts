/**
 * Dois mil perfis, as invariantes do motor.
 *
 * O desenho é o de `tests/property/varredura-mil.test.ts` do tênis, e pela mesma razão: os casos
 * escolhidos a dedo só encontram o que já foi imaginado. A primeira execução desta varredura achou
 * três defeitos que nenhum caso de `podio.test.ts` mostrava:
 *
 *   1. 1ªs colocadas com nota −44. A penalidade de transição não tinha teto, e o motor punia em até
 *      82 pontos o movimento de sair de uma raquete atual inadequada.
 *   2. 60 pódios de duas raquetes, todos na faixa 1. A premissa do 1º pedido deixava três
 *      candidatas, duas da mesma marca, e o limite por marca derrubava a terceira.
 *   3. Mormaii Kicks e Quicksand Kombat nunca aparecem em pódio nenhum. Não é defeito do motor — é
 *      o catálogo, e está registrado em `tetoDeInercia` —, mas só a varredura mostra.
 *
 * A semente é fixa: o perfil #91 é sempre o mesmo, e a mensagem de falha traz o número.
 */

import { describe, expect, it } from 'vitest';
import { carregarCatalogo, MAX_POR_MARCA, recomendar } from '@/motor';
import { sortearPerfis } from './sorteio';

const catalogo = carregarCatalogo();
const casos = sortearPerfis(2000).map((p, i) => ({ i, p, r: recomendar(p, catalogo) }));

function violacoes(teste: (c: (typeof casos)[number]) => boolean): number[] {
  return casos.filter((c) => !teste(c)).map((c) => c.i);
}

describe('em 2.000 perfis', () => {
  it('o pódio sempre tem três raquetes', () => {
    expect(violacoes((c) => c.r.podio.length === 3)).toEqual([]);
  });

  it('nenhuma raquete do pódio fere um filtro de segurança', () => {
    expect(
      violacoes(({ r }) =>
        r.podio.every(
          (a) =>
            a.ponto.resposta <= r.perfil.teto.resposta &&
            a.ponto.inercia <= r.perfil.teto.inercia &&
            !(r.perfil.iniciante && a.raquete.nivel_fabricante >= 4),
        ),
      ),
    ).toEqual([]);
  });

  it('o pódio sai da faixa pedida ou, no máximo, de um degrau abaixo — nunca acima', () => {
    expect(
      violacoes(({ p, r }) =>
        r.podio.every((a) => a.raquete.faixa !== null && a.raquete.faixa <= p.faixa && a.raquete.faixa >= p.faixa - 1),
      ),
    ).toEqual([]);
  });

  it('a descida só acontece quando a faixa pedida não tem três raquetes seguras', () => {
    expect(
      violacoes(({ p, r }) => {
        if (!r.desceu_de_faixa) return true;
        const segurasNaPedida = catalogo.filter(
          (x) => x.faixa === p.faixa && r.excluidas[x.id] === undefined,
        ).length;
        return segurasNaPedida < 3;
      }),
    ).toEqual([]);
  });

  it(`três modelos distintos, no máximo ${MAX_POR_MARCA} por marca, sem gêmeas`, () => {
    expect(
      violacoes(({ r }) => {
        const ids = r.podio.map((a) => a.raquete.id);
        const marcas = new Map<string, number>();
        for (const a of r.podio) marcas.set(a.raquete.marca, (marcas.get(a.raquete.marca) ?? 0) + 1);
        const semGemeas = r.podio.every((a, i) =>
          r.podio.every((b, j) => i === j || a.raquete.resposta !== b.raquete.resposta || a.raquete.inercia !== b.raquete.inercia),
        );
        return new Set(ids).size === ids.length && Math.max(...marcas.values()) <= MAX_POR_MARCA && semGemeas;
      }),
    ).toEqual([]);
  });

  it('o pódio vem em ordem de nota, e a nota fica entre 0 e 100', () => {
    expect(
      violacoes(({ r }) =>
        r.podio.every((a, i) => a.nota >= 0 && a.nota <= 100 && (i === 0 || r.podio[i - 1]!.nota >= a.nota)),
      ),
    ).toEqual([]);
  });

  it('raquete sem preço nunca entra no pódio', () => {
    expect(violacoes(({ r }) => r.podio.every((a) => a.raquete.preco_brl !== null))).toEqual([]);
  });

  it('quem declara raquete atual reconhecível sempre recebe veredicto', () => {
    expect(
      violacoes(({ p, r }) => {
        const a = p.raquete_atual;
        const reconhecivel =
          a.tipo === 'catalogo' || (a.tipo === 'descrita' && (a.peso_g !== null || a.face !== null || a.material !== null));
        return reconhecivel === (r.veredicto.tipo !== 'sem_raquete');
      }),
    ).toEqual([]);
  });

  it('"troque já" sempre nomeia o filtro de segurança que a atual fere', () => {
    expect(
      violacoes(({ r }) => r.veredicto.tipo !== 'troque_ja' || r.veredicto.motivo !== null),
    ).toEqual([]);
  });

  it('o motor é determinístico', () => {
    for (const { p, r } of casos.slice(0, 50)) {
      expect(recomendar(p, catalogo)).toEqual(r);
    }
  });

  /**
   * Não é invariante, é termômetro. Perfis sorteados são mais contraditórios que pessoas reais, e
   * 10,1% deles terminam com encaixe fraco. Se passar de 15%, algo no motor mudou de natureza.
   */
  it('encaixe fraco fica abaixo de 15% dos perfis sorteados', () => {
    const fracos = casos.filter((c) => c.r.encaixe_fraco).length;
    expect(fracos / casos.length).toBeLessThan(0.15);
  });
});
