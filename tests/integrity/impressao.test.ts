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
 * ═══ E O DEFEITO QUE ESSA VERIFICAÇÃO NÃO PEGOU ══════════════════════════════════════════════
 *
 * As três rotas acima não incluíam a que importa. Na PÁGINA DO RELATÓRIO, com entitlements, o PDF
 * continuava saindo em 2 páginas — e a causa não estava na medição nem no `@page`, mas em
 * `min-h-screen` (ver o teste "altura de viewport não vale no papel"). Medir a rota parecida com a
 * de verdade não é medir a de verdade.
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

  /**
   * A armadilha circular: `100vh` na impressão é a altura da FOLHA que acabamos de calcular.
   *
   * O relatório abre com `<main class="min-h-screen">`. Na tela isso não faz nada — `100vh` é a
   * janela, e o conteúdo é muito mais alto. Na impressão, `100vh` vira a folha, o `main` estica até
   * enchê-la, e o que estava fora dele é empurrado para além da borda: nasce a segunda página.
   *
   * É a armadilha porque fixar a altura da folha é o próprio ato que cria o excesso. Medido no
   * relatório real, com entitlements (01/set/2026): conteúdo de 7.833px → folha de 2.083mm; o `main`
   * ia de 7.801px para 7.872px e os 32px restantes do `body` estouravam. 2 páginas → 1 com a regra.
   *
   * A primeira verificação da página única não pegou isto porque rodou em `/`, `/catálogo` e
   * `/termos`, onde a diferença entre `body` e `main` é zero e o estouro não aparece.
   */
  it('altura de viewport não vale no papel', () => {
    const regra = /\.min-h-screen[^{]*\{[^}]*\}/.exec(blocoPrint)?.[0] ?? '';
    expect(regra, 'sem neutralizar min-h-screen o relatório volta a sair em 2 páginas').not.toBe(
      '',
    );
    expect(regra).toMatch(/min-height:\s*0/);
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
   * `print()` roda DENTRO do clique — sem `requestAnimationFrame` no meio.
   *
   * ═══ O DEFEITO QUE ISTO TRANCA: O BOTÃO QUE NÃO RESPONDE ═════════════════════════════════
   *
   * A versão anterior esperava dois quadros antes de imprimir, e isso quebrava de duas formas que
   * chegam ao usuário como "cliquei e não aconteceu nada":
   *
   *   • fora do gesto do usuário, a impressão pode ser recusada pelo navegador — o Safari é o
   *     rigoroso aqui, e o Chrome não, e é por isso que o teste de desktop não pegava;
   *   • `requestAnimationFrame` não dispara com a página em segundo plano ou com o quadro
   *     estrangulado, e o estado "preparando" ficava ligado para sempre, deixando o botão
   *     desabilitado — morto, sem erro nenhum no console.
   *
   * A espera não comprava nada: o que mudava no render era o rótulo do botão, dentro de uma caixa
   * de altura fixa, e as regras de impressão só valem durante a impressão.
   */
  it('imprime dentro do clique, sem esperar quadro', () => {
    /*
      Só o CÓDIGO. O comentário do arquivo cita `requestAnimationFrame` para explicar por que ele
      saiu — e um teste que acusasse a própria explicação obrigaria a apagar a explicação para
      passar, que é o oposto do que este repositório faz.
    */
    const codigo = botao.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(
      codigo,
      'a impressão voltou a acontecer fora do gesto do usuário',
    ).not.toContain('requestAnimationFrame');
  });

  /**
   * Sem `disabled`, um clique que falhe em silêncio não deixa o botão inutilizável.
   *
   * Era o `disabled={preparando}` que transformava uma falha invisível num botão permanentemente
   * morto — e "não responde mais" é indistinguível de "o site quebrou" para quem está do outro lado.
   */
  it('o botão não fica desabilitado', () => {
    expect(botao).not.toMatch(/disabled=\{/);
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
