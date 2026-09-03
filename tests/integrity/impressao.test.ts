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
  it('os gráficos e as tabelas', () => {
    for (const alvo of ['table', 'tr', 'svg', 'img']) {
      expect(blocoPrint, `${alvo} pode ser cortado no meio`).toMatch(
        new RegExp(`(^|[\\s,])${alvo}[\\s,]`, 'm'),
      );
    }
    expect(blocoPrint).toContain('break-inside: avoid');
    expect(blocoPrint).toContain('page-break-inside: avoid');
  });

  /**
   * ═══ E `section` NÃO PODE VOLTAR PARA A LISTA ════════════════════════════════════════════
   *
   * Ela esteve lá, e foi removida por causar o defeito que deveria evitar.
   *
   * A regra era uma aposta: "seções são mais curtas que uma folha, então proteger a seção inteira
   * protege tudo dentro dela". A aposta valeu enquanto valeu. Quando a seção da raquete atual passou
   * a carregar o setup completo — três quadros, três blocos de explicação e a ressalva —, ela cruzou
   * a altura da página, e o Chrome não degrada como a documentação sugere: com um ancestral `avoid`
   * mais alto que a folha, ele empurra o conteúdo para fora da caixa em vez de refluir. O relato foi
   * "as páginas ficaram meio cortadas, mesmo no computador".
   *
   * A proteção real é a das camadas menores, e ela continua toda aqui — tabela, linha, quadro
   * arredondado, título que não fica órfão. Uma quebra entre dois parágrafos da mesma seção é o
   * único corte que este teste aceita, porque é o único que um documento impresso pode ter sem
   * parecer mal montado.
   */
  it('a seção inteira NÃO é marcada como indivisível', () => {
    /*
      A conferência é por REGRA, e a regra é o par "lista de seletores + corpo".

      Uma versão anterior deste teste usava uma expressão sobre o bloco inteiro e capturava só a
      última linha de seletores antes da chave — com `section` três linhas acima, ela passava.
      Partir em `}` e ler cada regra separada é o que garante que a lista inteira seja olhada.
    */
    const semComentariosNoBloco = semComentarios(blocoPrint);
    const regras = semComentariosNoBloco.split('}');

    for (const regra of regras) {
      if (!regra.includes('break-inside: avoid')) continue;
      const seletores = regra.slice(0, regra.indexOf('{'));
      expect(
        seletores,
        'section voltou a ser indivisível — uma seção mais alta que a folha volta a ser cortada',
      ).not.toMatch(/(^|[\s,])section([\s,]|$)/);
    }
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

  /**
   * ═══ O CONTÊINER GRANDE NÃO PINTA CAIXA NO PAPEL ═════════════════════════════════════════
   *
   * A seção da raquete atual é a única `rounded-2xl` do relatório e a mais comprida: veredicto,
   * comparação entre irmãs de linha, setup do quadro atual e a ressalva. Ela passa de uma folha —
   * o que está certo, e é por isso que `section` saiu da lista de indivisíveis.
   *
   * O que sobrava era feio de um jeito específico. Medido num PDF gerado do relatório real: a
   * página 9 abria com uma CASQUINHA VAZIA de trinta pixels — fundo, borda arredondada e nenhuma
   * linha de texto. Era o `padding-bottom` mais a borda de baixo da seção transbordando sozinhos.
   *
   * Não existe CSS para "não deixe fragmento menor que X". Existe não ter caixa para fragmentar.
   */
  it('o contêiner grande não pinta caixa no papel', () => {
    const regra = /\[class\*='rounded-2xl'\][^{]*\{[^}]*\}/.exec(blocoPrint)?.[0] ?? '';
    expect(regra, 'a caixa grande voltou a ser pintada — e a casquinha vazia com ela').not.toBe('');
    expect(regra).toMatch(/background:\s*transparent/);
    expect(regra).toMatch(/border:\s*0/);
  });

  /**
   * ═══ O PARÁGRAFO DE ABERTURA VIAJA COM O TÍTULO ══════════════════════════════════════════
   *
   * `break-after: avoid` no `h2` impede a quebra IMEDIATAMENTE depois dele, e só isso. Com uma
   * linha de apoio embaixo, a regra fica satisfeita com o par título+apoio no pé da folha e manda o
   * conteúdo para a página seguinte — que é o mesmo defeito com um passo a mais.
   *
   * Medido: a página 8 terminava em "O pódio da sua análise" mais o subtítulo, e os três cards
   * abriam a 9. Encadeando um nível, o bloco inteiro passou para a mesma folha.
   */
  it('o parágrafo logo abaixo do título não se separa do que vem depois', () => {
    const regra = /h1 \+ p,[\s\S]{0,80}?\{[^}]*\}/.exec(blocoPrint)?.[0] ?? '';
    expect(regra, 'o título voltou a poder ficar sozinho com o subtítulo no pé da folha').not.toBe('');
    expect(regra).toMatch(/break-after:\s*avoid/);
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

/**
 * ═══ O DEGRAU DO PÓDIO NÃO PODE CORTAR TEXTO ═════════════════════════════════════════════════
 *
 * O pódio já teve três formas, e as duas primeiras falharam de maneiras opostas. Vale registrar as
 * três porque cada conserto parecia óbvio e produziu o defeito seguinte.
 *
 *   1. BASE alinhada + altura MÍNIMA decrescente. O degrau some quando o texto cresce: os três
 *      passam do próprio mínimo, empatam de altura e o pódio sai reto.
 *
 *   2. TOPO alinhado + recuo fixo + altura mínima. Conserta o degrau e quebra a base — `min-height`
 *      é um mínimo, e basta um card estourar o dele para o pé descer sozinho.
 *
 *   3. BASE alinhada + altura FIXA decrescente, com `overflow-y-auto` como válvula. Na tela o
 *      excedente rolava; no PAPEL não existe rolagem, e a válvula virou tesoura. Foi o que o dono
 *      do produto viu no PDF: a terceira tag do 1º card cortada ao meio, e o texto do 3º truncado.
 *      Uma tag pela metade é pior do que qualquer desalinhamento.
 *
 * A forma que funciona não mede a caixa por fora: as três ESTICAM até a mesma altura e o degrau vem
 * de um recuo ACIMA de cada uma. O recuo é fixo, então o topo escalona sempre; a caixa cresce com o
 * conteúdo, então a base continua alinhada e nada é cortado.
 *
 * Verificado num navegador, em modo de impressão, sobre os 10 perfis simulados: bases idênticas,
 * topos estritamente decrescentes e `scrollHeight === clientHeight` nos 30 cards. O que este teste
 * tranca é a REGRA que faz isso valer — as três marcas cuja ausência devolveria um dos defeitos.
 */
describe('o pódio impresso', () => {
  const podio = readFileSync(
    join(ROOT, 'src', 'components', 'result', 'podium.tsx'),
    'utf8',
  );
  const codigo = semComentarios(podio);

  /** Sem `items-stretch` as caixas voltam a ter alturas independentes e a base se desfaz. */
  it('as três caixas esticam até a mesma altura', () => {
    expect(codigo, 'o grid do pódio deixou de esticar as caixas').toContain('sm:items-stretch');
  });

  /**
   * O degrau tem de ser RECUO, não altura. Uma altura precisa adivinhar o tamanho do conteúdo e
   * corta quando erra; um recuo não tem opinião sobre o conteúdo.
   */
  it('o degrau é recuo acima da caixa, não altura da caixa', () => {
    const steps = /const STEPS = \{[\s\S]*?\} as const;/.exec(codigo)?.[0] ?? '';
    expect(steps, 'não achei a tabela de degraus').not.toBe('');
    expect(steps, 'o degrau voltou a ser altura fixa').not.toMatch(/sm:h-\[/);
    expect(steps, 'o degrau voltou a ser altura mínima').not.toMatch(/sm:min-h-\[/);
    expect(steps, 'o degrau deixou de ser recuo').toMatch(/sm:pt-/);
  });

  /**
   * `overflow` de rolagem na CAIXA é a tesoura do papel. Se algum dia o conteúdo estourar de novo,
   * a resposta é deixar a caixa crescer — nunca esconder o excedente.
   *
   * A checagem é sobre o `<article>`, e não sobre o arquivo inteiro, porque existe um
   * `overflow-hidden` legítimo mais abaixo: ele recorta o BORRÃO decorativo do card bloqueado, que
   * não tem texto de relatório embaixo. Proibir a palavra no arquivo todo proibiria o recorte certo
   * junto com o errado.
   */
  it('a caixa do card não esconde o próprio conteúdo', () => {
    const article = /<article\s+className=\{cn\(([\s\S]*?)\)\}/.exec(codigo)?.[1] ?? '';
    expect(article, 'não achei as classes do card').not.toBe('');
    expect(article, 'voltou o overflow que cortava o texto na impressão').not.toMatch(/overflow/);
    // E ela cresce até preencher o que sobra abaixo do recuo — é o que alinha as bases.
    expect(article, 'a caixa deixou de esticar').toMatch(/flex-1/);
  });
});

/**
 * ═══ A LEGENDA E A EXPLICAÇÃO FALAM DA MESMA LINHA ═══════════════════════════════════════════
 *
 * O gráfico tem uma linha cinza cujo significado o leitor não consegue deduzir sozinho, e ela é a
 * régua contra a qual ele julga todo o resto. Por isso ela é nomeada duas vezes: na legenda, ao
 * lado do traço, e na frase abaixo do gráfico que explica por que ela muda de perfil para perfil.
 *
 * As duas eram strings soltas, e discordaram. A legenda dizia "Média do catálogo para você"; a nota
 * abaixo abria com "é a média de todas as raquetes que analisamos" — uma descrição pessoal e uma
 * impessoal da mesma linha, a três centímetros de distância. Quem leu reparou na hora.
 *
 * O conserto não foi reescrever as duas em sintonia, porque sintonia escrita à mão dura até a
 * próxima edição. Foi uma constante só, usada nos dois lugares. Este teste tranca isso.
 */
describe('a linha de referência do radar', () => {
  const radar = readFileSync(join(ROOT, 'src', 'components', 'result', 'radar.tsx'), 'utf8');
  const codigo = semComentarios(radar);

  it('o nome da linha existe uma vez só, como constante', () => {
    const decl = /const CATALOGO_LABEL = '([^']+)';/.exec(codigo);
    expect(decl, 'a constante do rótulo sumiu').not.toBeNull();

    const nome = decl![1]!;
    // O nome não pode estar escrito à mão em lugar nenhum além da própria declaração.
    const ocorrencias = codigo.split(nome).length - 1;
    expect(ocorrencias, `"${nome}" foi escrito à mão fora da constante`).toBe(1);
  });

  it('a legenda e a nota usam a mesma constante', () => {
    // Na série do gráfico...
    expect(codigo, 'a legenda deixou de usar a constante').toMatch(/label:\s*CATALOGO_LABEL/);
    // ...e no parágrafo que explica a linha.
    expect(codigo, 'a nota deixou de usar a constante').toMatch(/\{CATALOGO_LABEL\}/);
  });

  /**
   * "para o seu NÍVEL" foi cogitado e descartado: o nível é um dos termos do encaixe, e nem o
   * dominante. Prometer nível convidaria a leitura de que dois jogadores do mesmo nível veem a
   * mesma linha, e eles não veem — capacidade física, swing, sensibilidade no braço e estilo
   * também entram.
   */
  it('o rótulo promete o perfil inteiro, não só o nível', () => {
    const nome = /const CATALOGO_LABEL = '([^']+)';/.exec(codigo)?.[1] ?? '';
    expect(nome, 'o rótulo estreitou para nível').not.toMatch(/n[íi]vel/i);
    expect(nome).toMatch(/perfil/i);
  });
});
