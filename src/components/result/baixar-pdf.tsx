'use client';

import { useState } from 'react';

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

/** Largura da folha. 210mm é A4 — mantém a medida de linha que o relatório já tem na tela. */
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
  const [preparando, setPreparando] = useState(false);

  function imprimir() {
    setPreparando(true);

    /*
      O `requestAnimationFrame` duplo não é superstição.

      Entre marcar o estado e medir a página existe um render: o botão troca de texto, e no modo de
      impressão vários elementos somem. Medir antes de o navegador aplicar isso daria a altura da
      página ANTIGA — mais alta que a real — e o PDF sairia com uma faixa vazia no fim.
    */
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
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
            A limpeza acontece SEMPRE, e depois de `print()` retornar.

            `window.print()` bloqueia até a caixa de diálogo fechar, tanto no salvar quanto no
            cancelar. Deixar a regra de página injetada faria a próxima impressão — de qualquer
            página do site — herdar a altura deste relatório.
          */
          document.getElementById(ESTILO_ID)?.remove();
          setPreparando(false);
        }
      });
    });
  }

  return (
    <div className="te-sem-impressao">
      <button
        type="button"
        onClick={imprimir}
        disabled={preparando}
        className="flex min-h-[56px] w-full items-center justify-center rounded border-2
                   border-court px-6 font-semibold text-court transition-colors
                   hover:bg-court hover:text-paper disabled:opacity-60 sm:w-auto"
      >
        {preparando ? 'Preparando…' : 'Baixar em PDF'}
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
