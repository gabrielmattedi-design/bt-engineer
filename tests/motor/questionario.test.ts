/**
 * O questionário e o motor falam a mesma língua.
 *
 * As perguntas vivem em `src/questionario/etapas.ts`; os valores que o motor aceita vivem em
 * `src/motor/jogador.ts`. São duas listas, e elas divergem em silêncio: uma opção nova na tela que
 * o motor não conhece seria recusada no servidor DEPOIS de a pessoa responder tudo. O Tennis
 * Engineer pagou por um primo disso — `frequency_per_week` guardava a string do botão num campo
 * tipado número, e funcionava por coincidência.
 *
 * O teste sorteia respostas A PARTIR DAS OPÇÕES DA TELA e confere que o motor aceita todas.
 */

import { describe, expect, it } from 'vitest';
import { carregarCatalogo, recomendar } from '@/motor';
import { ETAPAS, etapasVisiveis, pendentes, type Pergunta } from '@/questionario/etapas';
import { paraRespostas, respostasVazias, type RespostasDoQuestionario } from '@/questionario/respostas';

const catalogo = carregarCatalogo();

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Responde como a tela deixaria: só as perguntas visíveis, só com opções que ela oferece. */
function responder(sorte: () => number): RespostasDoQuestionario {
  const r = respostasVazias() as Record<string, unknown>;
  // As condicionais dependem de respostas anteriores: percorre até estabilizar.
  for (let volta = 0; volta < 3; volta += 1) {
    for (const etapa of etapasVisiveis(r as RespostasDoQuestionario)) {
      for (const p of etapa.perguntas) {
        if (r[p.chave] !== null && !(Array.isArray(r[p.chave]) && (r[p.chave] as unknown[]).length === 0)) continue;
        r[p.chave] = valor(p, sorte);
      }
    }
  }
  return r as RespostasDoQuestionario;
}

function valor(p: Pergunta, sorte: () => number): unknown {
  const um = <T,>(xs: readonly T[]) => xs[Math.floor(sorte() * xs.length)]!;
  switch (p.tipo) {
    case 'unica': {
      const v = um(p.opcoes).valor;
      return p.numerica ? Number(v) : v;
    }
    case 'multipla': {
      if (p.exclusiva && sorte() < 0.3) return [p.exclusiva];
      const livres = p.opcoes.map((o) => o.valor).filter((v) => v !== p.exclusiva);
      const k = 1 + Math.floor(sorte() * p.max);
      return [...livres].sort(() => sorte() - 0.5).slice(0, k);
    }
    case 'numero':
      return p.min + Math.floor(sorte() * (p.max - p.min + 1));
    case 'raquete':
      return um(catalogo).id;
    case 'texto':
      return sorte() < 0.5 ? null : 'uma raquete qualquer';
  }
}

describe('o questionário', () => {
  it('toda pergunta tem uma chave que existe nas respostas, e nenhuma chave se repete', () => {
    const chaves = ETAPAS.flatMap((e) => e.perguntas.map((p) => p.chave));
    expect(new Set(chaves).size).toBe(chaves.length);
    for (const c of chaves) expect(c in respostasVazias()).toBe(true);
  });

  it('vazio, ele tem pendências e o motor recusa', () => {
    expect(pendentes(respostasVazias()).length).toBeGreaterThan(20);
    expect(paraRespostas(respostasVazias()).ok).toBe(false);
  });

  /**
   * A regra que importa: o que a tela dá por completo, o motor aceita — em 1.000 questionários
   * respondidos só com as opções da própria tela.
   */
  it('1.000 questionários completos pela tela: o motor aceita todos, e recomenda', () => {
    const sorte = rng(20260925);
    const recusados: string[] = [];
    for (let i = 0; i < 1000; i += 1) {
      const r = responder(sorte);
      expect(pendentes(r), `#${i} ficou com pendência`).toEqual([]);
      const c = paraRespostas(r);
      if (!c.ok) {
        recusados.push(`#${i}: ${c.invalidas.join(', ')}`);
        continue;
      }
      expect(recomendar(c.respostas, catalogo).podio.length).toBe(3);
    }
    expect(recusados).toEqual([]);
  });

  it('"nenhum desses" não chega ao motor como item de lista', () => {
    const r = responder(rng(1));
    r.dor_areas = ['nenhuma'];
    r.bolas = ['boa_profundidade'];
    const c = paraRespostas(r);
    expect(c.ok).toBe(true);
    if (c.ok) {
      expect(c.respostas.dor_areas).toEqual([]);
      expect(c.respostas.bolas).toEqual([]);
      expect(c.respostas.dor_quando).toBeNull();
    }
  });

  it('um valor que a tela não oferece é recusado, e não coagido', () => {
    const r = responder(rng(2));
    r.forca = 'hercules';
    const c = paraRespostas(r);
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.invalidas).toContain('forca');
  });

  it('quem não tem raquete não é cobrado pelas perguntas sobre ela', () => {
    const r = responder(rng(3));
    r.raquete_tipo = 'nenhuma';
    r.raquete_id = null;
    r.nao_gosta = [];
    const visiveis = etapasVisiveis(r).flatMap((e) => e.perguntas.map((p) => p.chave));
    expect(visiveis).not.toContain('raquete_id');
    expect(visiveis).not.toContain('nao_gosta');
    expect(paraRespostas(r).ok).toBe(true);
  });
});
