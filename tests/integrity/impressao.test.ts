/**
 * O PDF do relatório sai em UMA página.
 *
 * ═══ O DEFEITO QUE ISTO CONSERTOU ════════════════════════════════════════════════════════════
 *
 * Salvo pelo navegador, o relatório saía paginado em A4 e a paginação cortava conteúdo: título de
 * seção no rodapé de uma folha com o conteúdo dele na seguinte, tabela partida ao meio, um quadro
 * que começava e terminava vazio. Não é defeito do navegador — ele fatia uma coluna contínua em
 * retângulos fixos, e as fronteiras caem onde caírem.
 *
 * A solução é dar à folha a altura do conteúdo: com `@page { size }` medido no clique, existe uma
 * página só e não há fronteira onde cortar. Verificado em três rotas (medido, ago/2026):
 * home 5 páginas → 1, catálogo 7 → 1, termos 2 → 1.
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
const botao = readFileSync(
  join(ROOT, 'src', 'components', 'result', 'baixar-pdf.tsx'),
  'utf8',
);

/** Só o bloco `@media print`, para não confundir regra de tela com regra de papel. */
const blocoPrint = /@media print \{[\s\S]*\n\}/.exec(css)?.[0] ?? '';

describe('regras de impressão', () => {
  it('existe um bloco de impressão', () => {
    expect(blocoPrint, 'as regras de impressão sumiram').not.toBe('');
  });

  /**
   * ESTE é o teste que importa mais, e o menos óbvio.
   *
   * A altura da folha é medida NA TELA, antes de imprimir. Qualquer margem que só exista no modo de
   * impressão cresce depois da medição: o conteúdo estoura a folha calculada e nasce uma segunda
   * página quase vazia — o defeito que a página única existe para evitar.
   *
   * Medido: com 12mm em cima e embaixo, um documento de 1.093mm saía em 2 páginas em vez de 1.
   *
   * O respiro não faz falta porque já existe — o container do relatório tem padding próprio, na
   * tela, e portanto já entra na medida.
   */
  it('o corpo NÃO ganha margem só na impressão', () => {
    const corpo = /body \{[^}]*\}/.exec(blocoPrint)?.[0] ?? '';
    expect(corpo, 'a regra de body sumiu do bloco de impressão').not.toBe('');
    expect(
      corpo,
      'margem que só existe ao imprimir cresce depois da medição e cria uma segunda página',
    ).not.toMatch(/padding|margin/);
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
   * O navegador remove fundos por padrão para economizar tinta. Aqui o fundo carrega informação: o
   * card compartilhável é verde com texto branco, e sem o verde ele sai branco sobre branco.
   */
  it('as cores de fundo são preservadas', () => {
    expect(blocoPrint).toContain('print-color-adjust: exact');
  });

  it('nada se parte ao meio, mesmo em impressão paginada', () => {
    // A regra fica mesmo com página única, porque protege quem imprime pelo Ctrl+P direto.
    expect(blocoPrint).toContain('break-inside: avoid');
    expect(blocoPrint).toContain('page-break-inside: avoid');
  });
});

describe('o botão que gera a página única', () => {
  it('mede a altura real do documento', () => {
    // Uma altura fixa serviria para um relatório só: ela muda com o número de seções, o tamanho do
    // texto e a largura da tela.
    expect(botao).toContain('scrollHeight');
  });

  /**
   * `margin: 0` é o que remove o cabeçalho e o rodapé que o Chrome imprime sozinho — a URL completa
   * e "Página 1 de 1".
   *
   * A URL importa mais que a estética: ela É a chave de acesso ao relatório, e impressa no rodapé
   * viaja junto em qualquer cópia que circule.
   */
  it('zera a margem da folha, tirando a URL do rodapé', () => {
    expect(botao).toMatch(/margin:\s*0/);
  });

  /**
   * O formato PDF não aceita página acima de 200 polegadas. Estourando, o arquivo sai corrompido ou
   * truncado conforme o visualizador — e voltar a paginar é muito melhor que entregar um arquivo
   * quebrado.
   */
  it('tem teto de altura, abaixo do limite do formato', () => {
    const teto = /ALTURA_MAX_MM = (\d+)/.exec(botao)?.[1];
    expect(teto, 'o teto de altura sumiu').toBeTruthy();
    expect(Number(teto)).toBeLessThan(5080);
  });

  /**
   * A regra injetada precisa sair depois de imprimir.
   *
   * Deixá-la faria a próxima impressão — de qualquer página do site — herdar a altura deste
   * relatório, e o `finally` é o que garante isso mesmo quando a pessoa cancela a caixa de diálogo.
   */
  it('limpa a regra injetada em qualquer desfecho', () => {
    expect(botao).toContain('finally');
    expect(botao).toMatch(/getElementById\(ESTILO_ID\)\?\.remove\(\)/);
  });
});
