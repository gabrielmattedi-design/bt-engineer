'use client';

/**
 * Abre a impressão do relatório.
 *
 * ═══ O QUE ESTE BOTÃO JÁ FOI, E POR QUE DEIXOU DE SER ════════════════════════════════════════
 *
 * Ele media a altura do documento e injetava `@page { size: 210mm <altura>mm }` para produzir UMA
 * folha contínua, sem fronteira onde cortar. A ideia resolvia o problema errado.
 *
 * O que ela produzia era uma folha de 210 por ~2.070 mm — dez vezes mais alta que larga. Nenhum
 * visualizador de PDF mostra isso de forma útil: todos ajustam a página à janela, e ajustar uma
 * página dez vezes mais alta que larga significa reduzir a largura a um décimo. O relatório saía
 * numa coluna fininha no meio da tela, com margens enormes dos dois lados e texto ilegível.
 * Relatado assim, depois de medido no computador: "sai como página única, mas ficou horrível de
 * enxergar".
 *
 * O defeito original — seções partidas ao meio entre duas folhas — era real. A página única foi uma
 * resposta desproporcional a ele: em vez de dizer ao navegador ONDE não cortar, tirou dele a
 * possibilidade de cortar. E o preço foi um documento que ninguém consegue ler.
 *
 * ═══ O QUE FICOU NO LUGAR ════════════════════════════════════════════════════════════════════
 *
 * A4 normal, e as regras de quebra em `globals.css` dizendo o que não pode ser partido: seção,
 * quadro, tabela, linha de tabela e gráfico. O navegador continua paginando — ele só passa a
 * escolher as fronteiras entre os blocos, em vez de no meio deles.
 *
 * Por isso este componente não mede nada nem injeta nada. `@page` é estático, mora no CSS junto das
 * demais regras de impressão, e aqui sobrou uma chamada. Quem imprime pelo Ctrl+P recebe exatamente
 * o mesmo resultado — o que é bom: o conserto deixou de depender de a pessoa achar o botão certo.
 */
export function BaixarPdf() {
  return (
    <div className="te-sem-impressao">
      {/*
        Sem estado, sem `disabled` e sem espera.

        Não existe trabalho entre o clique e a caixa de impressão. Uma versão anterior marcava
        "Preparando…" e desabilitava o botão enquanto esperava dois quadros de animação — e quando
        o quadro não vinha (página em segundo plano, economia de bateria), o botão ficava
        desabilitado para sempre. "Não responde" é indistinguível de "quebrou" para quem está do
        outro lado.
      */}
      <button
        type="button"
        onClick={() => window.print()}
        className="flex min-h-[56px] w-full items-center justify-center rounded border-2
                   border-court px-6 font-semibold text-court transition-colors
                   hover:bg-court hover:text-paper sm:w-auto"
      >
        Baixar em PDF
      </button>

      {/*
        A instrução existe porque o passo seguinte não é óbvio.

        O botão abre a caixa de impressão do navegador, e quem esperava um download fica sem saber o
        que fazer com uma tela de impressora. A segunda frase cobre o cabeçalho e o rodapé que o
        Chrome imprime por conta própria: o endereço do relatório É a chave de acesso a ele, e
        impresso no pé da página viaja junto em qualquer cópia que circule. Não dá para desligar
        isso por CSS — é uma opção de quem imprime, então ela precisa ser dita.
      */}
      <p className="mt-2 text-xs text-graphite">
        Abre a janela de impressão. Em &quot;Destino&quot;, escolha{' '}
        <strong className="text-ink">Salvar como PDF</strong>. Se aparecer o endereço no rodapé,
        desmarque <strong className="text-ink">Cabeçalhos e rodapés</strong> em mais configurações.
      </p>
    </div>
  );
}
