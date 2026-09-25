/**
 * O catálogo no mapa — as afirmações medidas da proposta, trancadas contra o dado.
 *
 * Se o catálogo mudar e uma delas deixar de valer, o teste falha, e é esse o aviso: o desenho do
 * motor (dois eixos, três faixas) foi decidido em cima destes números, e não vale por fé.
 */

import { describe, expect, it } from 'vitest';
import { carregarCatalogo, montarRaquete, type LinhaDoCatalogo } from '@/motor/catalogo';
import { faixaDoPreco } from '@/motor/faixas';
import fonte from '@/catalogo/raquetes.json';

const catalogo = carregarCatalogo();

function correlacao(x: number[], y: number[]): number {
  const mx = x.reduce((a, b) => a + b) / x.length;
  const my = y.reduce((a, b) => a + b) / y.length;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < x.length; i += 1) {
    sxy += (x[i]! - mx) * (y[i]! - my);
    sxx += (x[i]! - mx) ** 2;
    syy += (y[i]! - my) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy);
}

describe('o catálogo', () => {
  it('carrega as 35 raquetes da planilha, com ids únicos', () => {
    expect(catalogo).toHaveLength(35);
    expect(new Set(catalogo.map((r) => r.id)).size).toBe(35);
  });

  /**
   * Um termo que as escalas não conhecem derruba o carregamento. Virar valor médio em silêncio
   * mudaria a raquete de lado no mapa sem que ninguém visse.
   */
  it('recusa um EVA ou uma face que as escalas não conhecem', () => {
    const base = (fonte.raquetes as unknown as LinhaDoCatalogo[])[0]!;
    expect(() => montarRaquete({ ...base, nucleo_eva: 'gel' })).toThrow(/nucleo_eva/);
    expect(() => montarRaquete({ ...base, fibra_face: 'grafeno' })).toThrow(/fibra_face/);
  });

  it('não confunde 12K com 2K nem 24K com 4K', () => {
    const face = (id: string) => catalogo.find((r) => r.id === id)!.face;
    expect(face('ZAND-ZBRUXO')).toBe(0.7); // carbono 12K
    expect(face('MORMAII-VINIFONT-II')).toBe(0.9); // carbono 24k
    expect(face('AMA-MEDUSA')).toBe(0.55); // Carbono 6k
  });
});

describe('dois eixos, e não cinco — §3.1 da proposta', () => {
  /**
   * A decisão inteira de desenhar o mapa em dois eixos se apoia nisto: resposta e inércia são
   * independentes (r = −0,01 nas 35). Se um catálogo novo os tornar correlacionados, o mapa passa a
   * mostrar uma dimensão como se fossem duas — e é hora de revisar o desenho, não de seguir.
   */
  it('resposta e inércia são independentes no catálogo', () => {
    const r = correlacao(catalogo.map((x) => x.resposta), catalogo.map((x) => x.inercia));
    expect(Math.abs(r)).toBeLessThan(0.2);
  });

  /**
   * Validação cruzada: sem usar o nível que o fabricante indica, a firmeza e a inércia já o
   * acompanham. Não é para concordar sempre — macia não é sinônimo de iniciante —, mas uma
   * correlação que despencasse diria que as escalas de §2.1 estão lendo o catálogo errado.
   */
  it('o mapa acompanha o nível que o fabricante indica', () => {
    const exigencia = catalogo.map((x) => 0.7 * x.resposta + 0.3 * x.inercia);
    expect(correlacao(exigencia, catalogo.map((x) => x.nivel_fabricante))).toBeGreaterThan(0.5);
  });
});

describe('três faixas do mesmo tamanho — §4.5', () => {
  /**
   * A regra é o tamanho, não os valores de R$ 1.500 e R$ 2.200. Quando o catálogo crescer torto,
   * este teste falha, e é esse o aviso para refazer os cortes em `src/motor/faixas.ts`.
   */
  it('as três faixas diferem em no máximo 2 raquetes', () => {
    const cotadas = catalogo.filter((r) => r.faixa !== null);
    const tamanhos = [1, 2, 3].map((f) => cotadas.filter((r) => r.faixa === f).length);
    expect(tamanhos).toEqual([12, 10, 10]);
    expect(Math.max(...tamanhos) - Math.min(...tamanhos)).toBeLessThanOrEqual(2);
  });

  it('o limite inferior é inclusivo', () => {
    expect(faixaDoPreco(1499.9)).toBe(1);
    expect(faixaDoPreco(1500)).toBe(2);
    expect(faixaDoPreco(2200)).toBe(3);
  });

  it('raquete sem preço não tem faixa', () => {
    const semPreco = catalogo.filter((r) => r.preco_brl === null).map((r) => r.id).sort();
    expect(semPreco).toEqual(['AMA-KRONOS', 'AMA-POSION BEE', 'MORMAII-VITÓRIA M III']);
    expect(catalogo.filter((r) => r.faixa === null)).toHaveLength(3);
  });
});
