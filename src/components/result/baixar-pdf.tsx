'use client';

/**
 * Gera o PDF do relatório em UMA página contínua.
 *
 * ═══ O PROBLEMA QUE ISTO RESOLVE ═════════════════════════════════════════════════════════════
 *
 * Salvar a página pelo navegador produzia um PDF paginado em A4, e a paginação cortava conteúdo no
 * meio: um título de seção no rodapé de uma folha e o conteúdo dele na seguinte, uma tabela partida
 * entre duas páginas, um quadro que começava e terminava vazio.
 *
 * Não é um defeito do navegador — ele fatia uma coluna contínua em retângulos de tamanho fixo, e as
 * fronteiras caem onde caírem. Um relatório desenhado para rolagem não tem onde ser cortado.
 *
 * ═══ COMO ELE FAZ ISSO SEM GERADOR DE PDF NO SERVIDOR ════════════════════════════════════════
 *
 * A folha passa a ter a altura do conteúdo. `@page { size: <largura> <altura> }` aceita medida
 * livre, e o navegador respeita: com a altura exata do documento, existe uma página só e não há
 * fronteira onde cortar.
 *
 * A altura não dá para escrever no CSS porque ela depende do relatório — muda com o número de
 * seções, com o tamanho do texto e com a largura da tela. Por isso ela é MEDIDA no clique e
 * injetada como regra, um instante antes de imprimir.
 *
 * A alternativa seria um gerador de PDF rodando no servidor: uma dependência pesada, com custo por
 * execução, para produzir o que o próprio navegador já sabe fazer.
 *
 * ═══ POR QUE `margin: 0` ═════════════════════════════════════════════════════════════════════
 *
 * É o que remove o cabeçalho e o rodapé que o Chrome imprime por conta própria — a URL completa e
 * "Página 1 de 1". A URL importa: ela É a chave de acesso ao relatório, e impressa no rodapé ela
 * viaja junto em qualquer cópia que circule. O respiro volta como padding no próprio conteúdo.
 */

/**
 * Largura da folha. 210mm é A4 — mantém a medida de linha que o relatório já tem na tela.
 *
 * ─── O QUE ISTO PRESSUPÕE ────────────────────────────────────────────────────────────────────
 *
 * A altura é medida na tela, com a largura da JANELA; a impressão acontece com a largura da FOLHA
 * (210mm = 794px). Se o relatório mudasse de altura ao mudar de largura, a medida não serviria e o
 * conteúdo estouraria a folha.
 *
 * Ele não muda: a coluna é `max-w-3xl` (768px), estreita o bastante para caber em 794px sem
 * refluir. Medido em 794, 1024, 1280 e 1600px de janela — 7.743px de altura nos quatro.
 *
 * Isso é uma PROPRIEDADE do relatório, não do mecanismo. Uma seção nova em duas colunas a partir
 * de `lg:` quebraria a premissa, e o sintoma seria uma segunda página só em telas largas. Não dá
 * para medir na largura da folha por JavaScript: as media queries do Tailwind respondem à janela,
 * e nenhuma mudança no documento as engana.
 */
const LARGURA_MM = 210;

/**
 * Teto de altura, em milímetros.
 *
 * O formato PDF não aceita página acima de 200 polegadas (5.080 mm) — acima disso o arquivo sai
 * corrompido ou truncado, dependendo do visualizador. Um relatório completo fica perto de 3.000 mm,
 * então a folga é boa; a trava existe para o dia em que não for.
 *
 * Estourando o teto, o certo é NÃO impedir a impressão: ela volta a ser paginada, que é pior que
 * uma página só e muito melhor que um arquivo quebrado.
 */
const ALTURA_MAX_MM = 4800;

const ESTILO_ID = 'te-pagina-unica';

export function BaixarPdf() {
  /**
   * Tudo acontece DENTRO do clique, sem esperar quadro nenhum.
   *
   * ═══ O QUE ISTO CONSERTOU: O BOTÃO QUE NÃO RESPONDIA ═════════════════════════════════════════
   *
   * A versão anterior marcava um estado "preparando", esperava dois `requestAnimationFrame` e só
   * então chamava `window.print()`. Duas coisas ruins saíam disso, e as duas aparecem como "cliquei
   * e não aconteceu nada":
   *
   *   • `print()` deixava de rodar dentro do gesto do usuário. Navegadores — o Safari em especial —
   *     tratam a impressão como ação privilegiada e podem recusá-la fora do clique. O Chrome
   *     aceitava, e por isso o defeito não aparecia em teste de desktop.
   *
   *   • `requestAnimationFrame` NÃO dispara com a página em segundo plano ou com o quadro
   *     estrangulado (economia de bateria, aba oculta). Quando o callback não vinha, o estado
   *     "preparando" ficava ligado para sempre — e o botão, que fica desabilitado nesse estado,
   *     virava um botão morto. Sem erro no console, sem nada.
   *
   * A espera não comprava nada. Ela existia para "deixar o render acontecer antes de medir", só que
   * o que mudava no render era o RÓTULO do botão, dentro de uma caixa de altura fixa — a altura do
   * documento é a mesma antes e depois. E as regras de impressão que escondem elementos só valem
   * DURANTE a impressão, então nunca entraram na medida de qualquer forma.
   *
   * Lendo `scrollHeight` de forma síncrona, o próprio navegador resolve o layout pendente antes de
   * responder. A medida é a mesma, e `print()` continua no gesto.
   */
  function imprimir() {
    try {
      const alturaPx = Math.ceil(document.documentElement.scrollHeight);
      // 96 px por polegada é a referência de CSS; 25.4 mm por polegada, a de medida.
      const alturaMm = Math.min(ALTURA_MAX_MM, Math.ceil((alturaPx / 96) * 25.4) + 10);

      document.getElementById(ESTILO_ID)?.remove();
      const estilo = document.createElement('style');
      estilo.id = ESTILO_ID;
      estilo.textContent = `@page { size: ${LARGURA_MM}mm ${alturaMm}mm; margin: 0; }`;
      document.head.appendChild(estilo);

      window.print();
    } finally {
      /*
        A limpeza acontece SEMPRE.

        No Chrome, `print()` bloqueia até a caixa fechar e isto roda depois. No Safari ela retorna
        na hora e a regra sai antes de a folha ser gerada — o que não é problema: a altura já foi
        aplicada quando a impressão começou.

        Deixar a regra injetada faria a próxima impressão, de qualquer página do site, herdar a
        altura deste relatório.
      */
      document.getElementById(ESTILO_ID)?.remove();
    }
  }

  return (
    <div className="te-sem-impressao">
      {/*
        Sem estado de "preparando", e isso é uma decisão.

        Não há espera para sinalizar: entre o clique e a caixa de impressão não existe trabalho
        assíncrono nenhum. Um rótulo que muda e volta no mesmo instante não informa nada — e o
        `disabled` que vinha junto era justamente o que transformava uma falha silenciosa num botão
        permanentemente morto.
      */}
      <button
        type="button"
        onClick={imprimir}
        className="flex min-h-[56px] w-full items-center justify-center rounded border-2
                   border-court px-6 font-semibold text-court transition-colors
                   hover:bg-court hover:text-paper sm:w-auto"
      >
        Baixar em PDF
      </button>

      {/*
        A instrução existe porque o passo seguinte não é óbvio.

        O botão abre a caixa de impressão do navegador, e quem esperava um download fica sem saber o
        que fazer com uma tela de impressora. Uma linha resolve, e ela some do próprio PDF.
      */}
      <p className="mt-2 text-xs text-graphite">
        Abre a janela de impressão. Em &quot;Destino&quot;, escolha{' '}
        <strong className="text-ink">Salvar como PDF</strong> — o arquivo sai em página única, sem
        cortes.
      </p>
    </div>
  );
}
