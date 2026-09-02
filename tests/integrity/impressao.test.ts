/**
 * O relatório imprime em A4, e nada é partido ao meio.
 *
 * ═══ A IDA E VOLTA QUE ESTES TESTES REGISTRAM ════════════════════════════════════════════════
 *
 * O defeito de origem era paginação cega: título de seção no rodapé de uma folha e o conteúdo dele
 * na seguinte, tabela partida, card do pódio com a marca numa página e o modelo na outra.
 *
 * A primeira resposta foi PÁGINA ÚNICA — medir a altura do documento e injetar `@page { size }` com
 * ela, para que não existisse fronteira onde cortar. Funcionava no sentido literal e falhava no que
 * importa: 210 × 2.070 mm é dez vezes mais alto que largo, e todo visualizador ajusta a página à
 * janela. O relatório virava uma coluna fininha e ilegível, com margens enormes dos dois lados.
 * Medido pelo dono, no computador: "sai como página única, mas ficou horrível de enxergar".
 *
 * A resposta certa não era impedir o corte — era dizer ONDE ele pode acontecer.
 *
 * ═══ POR QUE ESTES TESTES SÃO DE FONTE ═══════════════════════════════════════════════════════
 *
 * Gerar um PDF de verdade exige subir o site e abrir um navegador — fora do caminho rápido, e um
 * teste que não roda não protege nada. O que dá para trancar sem isso é a REGRA que faz o mecanismo
 * funcionar, e é justamente ela que uma edição bem-intencionada desfaz sem perceber.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const css = readFileSync(join(ROOT, 'src', 'app', 'globals.css'), 'utf8');
const botao = readFileSync(join(ROOT, 'src', 'components', 'result', 'baixar-pdf.tsx'), 'utf8');

/** Só o bloco `@media print`, para não confundir regra de tela com regra de papel. */
const blocoPrint = /@media print \{[\s\S]*\n\}/.exec(css)?.[0] ?? '';

/** O arquivo sem comentários — eles citam de propósito o que foi removido, para explicar por quê. */
const semComentarios = (c: string): string =>
  c.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('a folha', () => {
  it('existe um bloco de impressão', () => {
    expect(blocoPrint, 'as regras de impressão sumiram').not.toBe('');
  });

  /**
   * A4, e não uma folha do tamanho do conteúdo.
   *
   * Uma folha com a altura do documento não tem onde cortar — e é ilegível, porque o visualizador
   * a encolhe até caber na janela. Este teste é o que impede a ideia de voltar.
   */
  it('a folha é A4', () => {
    const regra = /@page \{[^}]*\}/.exec(blocoPrint)?.[0] ?? '';
    expect(regra, 'a regra de página sumiu').not.toBe('');
    /*
      A conferência é sobre o `size`, e não sobre a regra inteira: a margem também é escrita em
      milímetros, e um teste que olhasse o bloco todo acusaria `margin: 14mm 12mm` como se fosse
      uma folha de tamanho livre.
    */
    const tamanho = /size:[^;]*/.exec(regra)?.[0] ?? '';
    expect(tamanho).toMatch(/A4/);
    expect(tamanho, 'folha de altura livre volta a produzir um PDF ilegível').not.toMatch(/\dmm/);
  });

  /**
   * A margem vem do `@page`, e é o único lugar de onde ela vale em TODA folha.
   *
   * `padding` no corpo aplica uma vez: a primeira página ganha respiro em cima, a última embaixo, e
   * as do meio ficam com texto encostado na borda do papel.
   */
  it('a margem vale em todas as páginas', () => {
    const regra = /@page \{[^}]*\}/.exec(blocoPrint)?.[0] ?? '';
    expect(regra).toMatch(/margin:\s*\d/);

    const corpo = /body \{[^}]*\}/.exec(blocoPrint)?.[0] ?? '';
    expect(corpo, 'a regra de body sumiu do bloco de impressão').not.toBe('');
    expect(corpo, 'margem no corpo só vale na primeira e na última folha').not.toMatch(/padding/);
  });

  /**
   * A armadilha circular do `100vh`.
   *
   * O relatório abre com `<main class="min-h-screen">`. Na tela isso não faz nada; na impressão,
   * `100vh` vira a altura da folha, e um `main` esticado até enchê-la empurra para além da borda
   * tudo o que estava fora dele.
   */
  it('altura de viewport não vale no papel', () => {
    const regra = /\.min-h-screen[^{]*\{[^}]*\}/.exec(blocoPrint)?.[0] ?? '';
    expect(regra, 'sem neutralizar min-h-screen nasce uma página quase vazia').not.toBe('');
    expect(regra).toMatch(/min-height:\s*0/);
  });
});

describe('o que não pode ser partido', () => {
  it('os elementos semânticos, os gráficos e as tabelas', () => {
    for (const alvo of ['section', 'table', 'tr', 'svg', 'img']) {
      expect(blocoPrint, `${alvo} pode ser cortado no meio`).toMatch(
        new RegExp(`(^|[\\s,])${alvo}[\\s,]`, 'm'),
      );
    }
    expect(blocoPrint).toContain('break-inside: avoid');
    expect(blocoPrint).toContain('page-break-inside: avoid');
  });

  /**
   * Os QUADROS — e eles eram a metade que faltava.
   *
   * O relatório quase não usa elemento semântico: o card da raquete, os do pódio, o de confiança e
   * os de setup são todos `div`. Apareceu partido no PDF de um cliente: a página 8 terminava em
   * "WILSON" e a 9 começava em "Wilson Clash 100 Pro v3", com a borda cortada no meio.
   */
  it('os quadros com borda arredondada', () => {
    expect(blocoPrint, 'os cards do relatório voltaram a poder ser cortados').toMatch(
      /\[class~='rounded'\]/,
    );
  });

  /** Título sozinho no pé da folha e linha órfã são o que resta depois que os blocos param de cortar. */
  it('título não fica órfão no pé da página', () => {
    expect(blocoPrint).toContain('break-after: avoid');
    expect(blocoPrint).toMatch(/orphans:\s*\d/);
    expect(blocoPrint).toMatch(/widows:\s*\d/);
  });

  it('o que só serve para clicar não vai para o papel', () => {
    // Botão impresso promete uma ação que o papel não tem; os seletores de raquete imprimiam uma
    // caixa vazia com um título solto em cima.
    for (const alvo of ['.te-sem-impressao', 'button', 'form', 'nav', 'header']) {
      expect(blocoPrint, `${alvo} continua sendo impresso`).toContain(alvo);
    }
  });

  /**
   * Os fundos precisam ser impressos, não descartados.
   *
   * O card compartilhável é verde com texto branco; sem o verde ele sai branco sobre branco.
   */
  it('as cores de fundo são preservadas', () => {
    expect(blocoPrint).toContain('print-color-adjust: exact');
  });
});

describe('o botão', () => {
  const codigo = semComentarios(botao);

  /**
   * Ele não mede nem injeta nada.
   *
   * Medir a altura e injetar `@page` era o mecanismo da página única. Com A4 estático no CSS, quem
   * imprime pelo Ctrl+P recebe exatamente o mesmo resultado — e o conserto deixa de depender de a
   * pessoa achar o botão certo.
   */
  it('não mede a página nem injeta estilo', () => {
    expect(codigo, 'a página única voltou pelo botão').not.toContain('scrollHeight');
    expect(codigo).not.toContain('createElement');
    expect(codigo).not.toContain('@page');
  });

  /**
   * `print()` roda DENTRO do clique, e o botão nunca fica desabilitado.
   *
   * A versão com `requestAnimationFrame` quebrava de duas formas, ambas lidas como "cliquei e não
   * aconteceu nada": fora do gesto do usuário a impressão pode ser recusada (o Safari é o rigoroso,
   * o Chrome não, e por isso o teste de desktop não pegava), e o quadro não dispara com a página em
   * segundo plano — deixando o estado "preparando" ligado e o botão morto.
   */
  it('imprime dentro do clique, sem esperar quadro', () => {
    expect(codigo, 'a impressão voltou a acontecer fora do gesto do usuário').not.toContain(
      'requestAnimationFrame',
    );
    expect(codigo).toContain('window.print()');
  });

  it('o botão não fica desabilitado', () => {
    expect(codigo).not.toMatch(/disabled=\{/);
  });

  /**
   * O endereço do relatório É a chave de acesso a ele, e o Chrome imprime isso no rodapé por conta
   * própria quando há margem. Não existe CSS que desligue — é opção de quem imprime, então a
   * instrução precisa dizer como tirar.
   */
  it('avisa como tirar o endereço do rodapé', () => {
    expect(botao).toMatch(/Cabeçalhos e rodapés/);
  });
});
