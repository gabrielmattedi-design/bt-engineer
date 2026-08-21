/**
 * A frase do card de compartilhamento não pode sair cortada.
 *
 * ═══ O DEFEITO ═══════════════════════════════════════════════════════════════════════════════
 *
 * `<text>` de SVG NÃO quebra linha. Não existe `width`, não existe `overflow`, não existe
 * reticências automáticas: o que passa da borda do `viewBox` simplesmente some, cortado no meio da
 * palavra.
 *
 * A frase de perfil era um `<text>` só, começando em x=80 num card de 1080 de largura. "Agressor
 * de linha de base que quer firmeza no controle" tem 54 caracteres e cabem cerca de 44 — quem
 * compartilhasse esse card publicava uma frase truncada sobre si mesmo.
 *
 * O que torna o defeito ruim é ONDE ele aparece: depois de tudo estar correto no servidor, no
 * artefato mais público do produto, na peça que existe justamente para circular. Nada no sistema
 * acusava, porque do ponto de vista do código estava tudo certo — o corte é do renderizador.
 *
 * ═══ POR QUE SOBRE A FUNÇÃO, E NÃO SOBRE O PIXEL ═════════════════════════════════════════════
 *
 * Medir texto renderizado exigiria rasterizar o SVG num navegador dentro do teste. O que precisa
 * ficar travado é mais simples e mais estável: nenhuma linha ultrapassa o orçamento, e nada é
 * perdido em silêncio.
 */

import { describe, expect, it } from 'vitest';

import { racketNameSize, wrapPhrase } from '@/components/result/share-card';
import { loadRacketCatalog } from '@/data/load';

/** O mesmo orçamento do componente. Ver a nota em `PHRASE_MAX_CHARS`. */
const MAX = 44;
const LINHAS = 2;

describe('quebra da frase do card', () => {
  it('divide entre palavras, sem partir nenhuma', () => {
    const linhas = wrapPhrase('Agressor de linha de base que quer firmeza no controle');

    expect(linhas).toEqual(['Agressor de linha de base que quer firmeza', 'no controle']);
    // Recompor as linhas devolve a frase: nada foi perdido nem duplicado.
    expect(linhas.join(' ')).toBe('Agressor de linha de base que quer firmeza no controle');
  });

  it('deixa frase curta numa linha só', () => {
    expect(wrapPhrase('Curto')).toEqual(['Curto']);
  });

  it('não inventa linha para frase vazia', () => {
    expect(wrapPhrase('')).toEqual([]);
    expect(wrapPhrase('   ')).toEqual([]);
  });

  /**
   * Duas linhas é o teto físico: a terceira invadiria os rótulos do radar, que começam em y≈476.
   * Estourar para três não seria "mais informação", seria texto por cima do gráfico.
   */
  it('nunca passa do número de linhas que cabem', () => {
    const longa =
      'Intermediário que busca mais spin sem perder o controle da bola profunda no fundo de quadra';
    const linhas = wrapPhrase(longa);

    expect(linhas.length).toBeLessThanOrEqual(LINHAS);
    // Cortou: as reticências avisam que há mais, em vez de sumir com o resto em silêncio.
    expect(linhas[linhas.length - 1]).toMatch(/…$/);
  });

  it('nenhuma linha estoura o orçamento de caracteres', () => {
    const frases = [
      'Agressor de linha de base que quer firmeza no controle',
      'Intermediário que busca mais spin sem perder o controle da bola profunda',
      'Iniciante que precisa de tolerância e conforto acima de qualquer outra coisa',
      'Competitivo com sensibilidade no braço buscando reduzir desconforto sem perder controle',
    ];

    for (const frase of frases) {
      for (const linha of wrapPhrase(frase)) {
        // A exceção documentada: uma palavra sozinha maior que a linha sai inteira, sem partir.
        if (linha.split(/\s+/).length === 1) continue;
        expect(linha.length, `"${linha}" (${linha.length})`).toBeLessThanOrEqual(MAX);
      }
    }
  });

  /**
   * Partir palavra ao meio é exatamente o que a versão sem quebra fazia. Uma palavra maior que a
   * linha inteira não existe nas frases de perfil, e se um dia existir é melhor ela estourar
   * visivelmente do que sair como um fragmento sem sentido.
   */
  it('palavra maior que a linha sai inteira, nunca partida', () => {
    const linhas = wrapPhrase('Palavraabsurdamentelongaquenaocabeemumalinha e depois texto');
    expect(linhas[0]).toBe('Palavraabsurdamentelongaquenaocabeemumalinha');
  });

  /** O componente precisa continuar consumindo a função — senão o defeito volta sem aviso. */
  it('o card usa a quebra em vez de imprimir a frase direto', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const fonte = readFileSync(
      join(__dirname, '..', '..', 'src', 'components', 'result', 'share-card.tsx'),
      'utf8',
    );

    expect(fonte).toContain('wrapPhrase(data.phrase)');
    expect(fonte).toContain('phraseLines.map');
    // `{data.phrase}` solto dentro de um <text> é o defeito original.
    expect(fonte).not.toMatch(/>\s*\{data\.phrase\}\s*</);
  });
});

/**
 * O nome da raquete e o número do match dividem a mesma linha do card.
 *
 * ═══ O DEFEITO, MEDIDO ═══════════════════════════════════════════════════════════════════════
 *
 * `<text>` de SVG não encolhe e não reticencia: ele atravessa o que estiver do lado. "Wilson Blade
 * 98 18x20 v10 (2026)" — 32 caracteres, nem o maior do catálogo — renderizava 809 px de largura em
 * corpo 42 e terminava em x=889, contra o "97%" começando em x=847. Quarenta e dois pixels por
 * cima do número que é o ponto do card.
 *
 * O teste anda sobre o CATÁLOGO REAL, e não sobre uma lista de exemplos: quem quebra isto de novo
 * é uma raquete nova com nome comprido, e a lista de exemplos não saberia dela.
 */
describe('corpo do nome da raquete no card', () => {
  /** O mesmo orçamento do componente. Ver a nota em `racketNameSize`. */
  const BUDGET_PX = 686;
  const CHAR_EM = 0.6;

  it('todo nome do catálogo cabe na linha, sem invadir o match', () => {
    const nomes = loadRacketCatalog().map((v) => v.product_name);

    expect(nomes.length, 'catálogo vazio — o teste não verificou nada').toBeGreaterThan(0);

    for (const nome of nomes) {
      const largura = nome.length * CHAR_EM * racketNameSize(nome);
      expect(Math.round(largura), `"${nome}" (${nome.length} caracteres)`).toBeLessThanOrEqual(
        BUDGET_PX,
      );
    }
  });

  /**
   * O piso existe para o nome que ainda não entrou no catálogo. Ele não pode ser furado, senão o
   * card volta a exibir nome ilegível — e o teto não pode ser furado, senão um nome curto vira
   * manchete maior que o resto do bloco.
   */
  it('respeita teto e piso mesmo nos extremos', () => {
    expect(racketNameSize('Yonex EZONE 98')).toBe(42);
    expect(racketNameSize('X')).toBe(42);
    expect(racketNameSize('N'.repeat(200))).toBe(26);
  });

  /** O caso exato que o usuário veria: o nome que estourava, agora dentro do orçamento. */
  it('o nome que sobrepunha o match agora cabe', () => {
    const nome = 'Wilson Blade 98 18x20 v10 (2026)';
    expect(racketNameSize(nome)).toBeLessThan(42);
    expect(nome.length * CHAR_EM * racketNameSize(nome)).toBeLessThanOrEqual(BUDGET_PX);
  });

  /** Se o componente parar de chamar a função, o defeito volta sem nada acusar. */
  it('o card usa o corpo calculado em vez de um número fixo', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const fonte = readFileSync(
      join(__dirname, '..', '..', 'src', 'components', 'result', 'share-card.tsx'),
      'utf8',
    );

    expect(fonte).toContain('racketNameSize(data.racketName)');
  });
});
