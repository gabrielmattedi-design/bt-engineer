'use client';

import { useEffect } from 'react';
import { metaCompra } from '@/lib/meta-pixel';

/**
 * O evento de COMPRA do pixel — disparado uma vez, na volta do pagamento.
 *
 * ═══ POR QUE ELE NÃO PODE SAIR DO WEBHOOK, QUE SERIA O LUGAR CERTO ═══════════════════════════
 *
 * Quem confirma o pagamento é o Mercado Pago chamando o nosso servidor. Nesse instante o navegador
 * da pessoa não está na conversa, e o pixel do Meta é código de navegador — não há de onde disparar.
 *
 * Mandar do servidor exigiria a API de Conversões, que foi deliberadamente adiada
 * (`docs/TRAFEGO_PAGO.md` §5-bis). Então o evento sai daqui: da primeira vez que o comprador vê o
 * relatório, logo depois de voltar do gateway.
 *
 * **O que se perde:** quem paga e fecha o navegador antes de voltar não gera evento. Na prática o
 * gateway devolve quase todo mundo, mas o número do Meta será sempre um pouco MENOR que o do
 * `/admin/funil`. Os dois estão certos, contando coisas diferentes — e saber disso antes evita
 * procurar defeito onde não há.
 *
 * ═══ AS DUAS TRAVAS CONTRA CONTAR A MESMA COMPRA DUAS VEZES ══════════════════════════════════
 *
 * Contagem dupla não é um detalhe estético: ela infla o retorno que o Meta calcula, e a decisão de
 * escalar sairia de um número que o dinheiro não sustenta.
 *
 *   1. **O sinal de que a compra ACABOU de acontecer** vem na URL, posto pela página de retorno no
 *      instante do redirecionamento. Reabrir o relatório uma semana depois — o que qualquer
 *      comprador faz — não traz esse sinal, e portanto não dispara nada.
 *
 *   2. **A marca no `localStorage`** cobre o que a primeira não cobre: recarregar a página com o
 *      parâmetro ainda na barra de endereço. Sem ela, um F5 contaria outra venda.
 *
 * As duas juntas cobrem os casos reais. Um comprador determinado a inflar o próprio pixel ainda
 * conseguiria, editando a URL noutro navegador — e não há por que se defender disso: ele
 * estragaria só a própria medição, sem ganhar nada.
 */
export function PurchasePixel({
  publicId,
  valorEmReais,
}: {
  readonly publicId: string;
  /** `null` quando o valor não pôde ser lido — ver o comentário do efeito. */
  readonly valorEmReais: number | null;
}) {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('compra') !== '1') return;

    const chave = `te_purchase_${publicId}`;
    try {
      if (window.localStorage.getItem(chave)) return;
      window.localStorage.setItem(chave, '1');
    } catch {
      /*
        Navegador com armazenamento bloqueado (aba privada em alguns casos, política corporativa).

        Seguimos e disparamos assim mesmo: perder uma conversão é pior que contá-la duas vezes num
        caso raro, e o parâmetro da URL já é a trava principal.
      */
    }

    /*
      Sem valor legível, o evento NÃO é enviado.

      A alternativa seria mandar zero ou o ticket médio, e as duas envenenam a única conta que
      importa: o retorno que decide escalar. Um evento a menos deixa o número menor; um evento com
      valor inventado deixa o número errado, que é pior e não parece.
    */
    if (valorEmReais === null || valorEmReais <= 0) return;

    metaCompra(valorEmReais);

    /*
      Limpa o `?compra=1` da barra de endereço, sem recarregar.

      Duas razões: o endereço do relatório é a chave de acesso a ele e circula em conversas, então
      quanto menos ruído carregar melhor; e um link copiado com o parâmetro tentaria disparar de
      novo no navegador de quem recebesse.
    */
    url.searchParams.delete('compra');
    window.history.replaceState(null, '', url.toString());
  }, [publicId, valorEmReais]);

  return null;
}
