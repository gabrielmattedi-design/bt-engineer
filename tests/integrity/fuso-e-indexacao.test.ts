/**
 * Duas invariantes que quebram em silêncio, e nada no produto denuncia.
 *
 * A primeira é o FUSO. `toLocaleString('pt-BR')` escolhe idioma, não fuso — formata no relógio de
 * quem executa, que em produção é um servidor em UTC. O resultado é uma data em português, com
 * aparência correta, três horas adiantada. "Comprado às 19:16" para uma compra das 16:16.
 *
 * A segunda é a INDEXAÇÃO. O acesso ao relatório é o próprio endereço: quem tem o link tem a
 * página, porque o link do e-mail precisa abrir em qualquer aparelho. Uma dessas URLs indexada
 * deixa de ser privada sem que ninguém perceba.
 *
 * Nenhuma das duas aparece rodando o site: a data parece certa, e a página indexada só é
 * descoberta por quem a encontrar numa busca.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dataCurta, dataLonga, hora } from '@/lib/datas';

const ROOT = join(__dirname, '..', '..');

describe('datas em horário do Brasil', () => {
  // 27/08/2026 22:16 UTC = 19:16 em Brasília. A diferença cruza o DIA na formatação curta.
  const instante = new Date('2026-08-27T22:16:00Z');

  it('a hora é a de Brasília, não a do servidor', () => {
    expect(hora(instante)).toBe('19:16');
  });

  it('a data longa acompanha o mesmo fuso', () => {
    expect(dataLonga(instante)).toContain('27');
    expect(dataLonga(instante)).toContain('agosto');
  });

  /**
   * O caso que mais engana: perto da meia-noite, o fuso errado muda o DIA.
   *
   * 02:30 UTC do dia 28 é 23:30 do dia 27 no Brasil. Formatado em UTC, a compra aparece no dia
   * seguinte — e aí o erro deixa de parecer de formato e passa a parecer erro do banco.
   */
  it('não empurra a compra para o dia seguinte', () => {
    const madrugada = new Date('2026-08-28T02:30:00Z');
    expect(dataCurta(madrugada)).toContain('27/08/2026');
    expect(hora(madrugada)).toBe('23:30');
  });

  it('nenhuma tela formata data por conta própria', () => {
    /*
      Uma chamada solta a `toLocaleDateString` volta a formatar no fuso do servidor. O helper existe
      justamente para que a decisão do fuso more num lugar só — quatro telas com quatro cópias foi
      como o defeito nasceu.
    */
    const suspeitos: string[] = [];
    for (const arquivo of varrer(join(ROOT, 'src'))) {
      if (arquivo.endsWith(join('lib', 'datas.ts'))) continue;
      const fonte = readFileSync(arquivo, 'utf8');
      if (/toLocaleDateString|toLocaleTimeString/.test(fonte)) {
        suspeitos.push(arquivo.replace(ROOT, ''));
      }
    }
    expect(suspeitos, 'use os helpers de @/lib/datas').toEqual([]);
  });
});

describe('páginas privadas fora do índice', () => {
  const privadas = [
    join('resultado', '[sessionId]'),
    join('analise', '[sessionId]'),
    join('planos', '[sessionId]'),
    join('retorno', '[sessionId]'),
    'minhas-analises',
  ];

  for (const rota of privadas) {
    it(`/${rota.replace(/\\/g, '/')} declara noindex`, () => {
      const fonte = readFileSync(join(ROOT, 'src', 'app', rota, 'page.tsx'), 'utf8');
      expect(fonte, 'esta URL é o conteúdo de uma pessoa e não pode ser indexada').toMatch(
        /robots:\s*\{\s*index:\s*false/,
      );
    });
  }

  it('o robots.txt bloqueia as mesmas rotas', () => {
    const fonte = readFileSync(join(ROOT, 'src', 'app', 'robots.ts'), 'utf8');
    for (const rota of ['/resultado/', '/analise/', '/planos/', '/retorno/', '/entrar/', '/admin']) {
      expect(fonte, `${rota} não está no disallow`).toContain(`'${rota}'`);
    }
  });

  it('o sitemap não lista nenhuma rota privada', () => {
    const fonte = readFileSync(join(ROOT, 'src', 'app', 'sitemap.ts'), 'utf8');
    for (const rota of ['/resultado', '/analise', '/planos', '/retorno', '/minhas-analises']) {
      expect(fonte, `${rota} não pode estar no sitemap`).not.toContain(`${rota}`);
    }
  });
});

function varrer(dir: string): string[] {
  const { readdirSync, statSync, existsSync } = require('node:fs') as typeof import('node:fs');
  if (!existsSync(dir)) return [];
  const saida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const full = join(dir, entrada);
    if (statSync(full).isDirectory()) saida.push(...varrer(full));
    else if (full.endsWith('.ts') || full.endsWith('.tsx')) saida.push(full);
  }
  return saida;
}
