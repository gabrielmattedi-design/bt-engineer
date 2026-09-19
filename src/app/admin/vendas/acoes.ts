'use server';

import { revalidatePath } from 'next/cache';
import { isAuthenticated } from '../auth';
import { paymentProvider } from '@/payments/adapters';
import { processPaymentEvent } from '@/database/repositories/commerce-repo';
import { concluirCompra } from '@/payments/concluir-compra';
import { withAutoBootstrap } from '@/database/setup';

export type RecuperacaoResult = { ok: string } | { error: string };

/**
 * Recupera uma compra que o gateway confirmou e a notificação nunca entregou.
 *
 * ═══ O INCIDENTE QUE FEZ ISTO EXISTIR ════════════════════════════════════════════════════════
 *
 * 19/09/2026, 14:35:54. Cartão aprovado, R$ 49,99 na conta, comprovante no celular do cliente — e
 * nada do lado de cá: sem pedido, sem relatório, sem linha em Vendas. Os pagamentos das 15:48,
 * 16:06, 16:29, 17:18 e 17:23 entraram normalmente, então não era o webhook quebrado; foi UM evento
 * que se perdeu entre o Mercado Pago e o servidor.
 *
 * E não havia nada a fazer. O sistema tinha um único caminho para conceder compra — a notificação —
 * e quando ela não chega, a compra simplesmente não existe. A saída disponível era conceder por
 * cupom de acesso, que entrega o relatório e deixa a venda fora do faturamento para sempre: o
 * cliente atendido, a receita invisível, e a conciliação com o Mercado Pago quebrada.
 *
 * ═══ POR QUE ISTO NÃO É UM BOTÃO DE "MARCAR COMO PAGO" ═══════════════════════════════════════
 *
 * Nada aqui aceita a palavra de quem clica. O que se digita é o **id do pagamento**; quem diz se
 * ele existe, de quanto é, a que pedido pertence e se foi aprovado é a **API do Mercado Pago**.
 *
 * A diferença importa: um botão que marcasse pedido como pago a partir de um formulário seria a
 * mesma porta que a assinatura do webhook existe para fechar, aberta do lado de dentro do painel.
 * Aqui a autoridade continua sendo o gateway — o painel só escolhe qual pagamento consultar.
 *
 * Depois disso o caminho é EXATAMENTE o da notificação: mesmo `processPaymentEvent`, mesma
 * idempotência por `mp:<pagamento>:<estado>`, mesmo `concluirCompra`. Recuperar um pagamento que o
 * webhook já processou colide na chave única e devolve "duplicate", sem conceder nada de novo — dá
 * para clicar duas vezes sem medo.
 */
export async function recuperarPagamento(
  _prev: unknown,
  formData: FormData,
): Promise<RecuperacaoResult> {
  if (!(await isAuthenticated())) return { error: 'Sessão expirada. Entre novamente.' };

  /*
    Só dígitos: o id do Mercado Pago é numérico, e o valor costuma vir copiado de um comprovante,
    de uma notificação ou de uma URL — com espaço, quebra de linha ou o rótulo colado junto.
    Recortar aqui evita uma consulta que falharia por causa de um espaço invisível.
  */
  const id = String(formData.get('pagamento') ?? '').replace(/\D/g, '');
  if (id.length < 6) {
    return { error: 'Digite o número da transação do Mercado Pago (só números).' };
  }

  const provider = paymentProvider();

  let evento;
  try {
    evento = await provider.eventoDePagamento(id);
  } catch (error) {
    /*
      O motivo INTEIRO vai para a tela — ao contrário de tudo que é voltado ao visitante. Quem está
      aqui já se autenticou como dono e é exatamente quem precisa do detalhe para consertar; a causa
      mais provável é token de outra aplicação, e ela é indistinguível de "id errado" sem o texto.
    */
    const detalhe = error instanceof Error ? error.message : String(error);
    return { error: `Não consegui falar com o Mercado Pago: ${detalhe}` };
  }

  if (!evento) {
    return {
      error:
        `O Mercado Pago não devolveu o pagamento ${id}. Confira o número da transação — e, se ` +
        'ele estiver certo, o MERCADOPAGO_ACCESS_TOKEN pode ser de outra aplicação.',
    };
  }

  /*
    Estado não-pago para e explica. Um pagamento em análise antifraude vira `pending` no nosso mapa,
    e conceder aí seria entregar o produto antes de o dinheiro ser nosso — o erro caro desta tela.
  */
  if (evento.status !== 'paid') {
    return {
      error:
        `O pagamento ${id} está como "${evento.status}" no Mercado Pago, não como pago. ` +
        'Nada foi concedido.',
    };
  }

  const outcome = await withAutoBootstrap(() => processPaymentEvent(provider.id, evento));
  console.info(`[recuperacao] ${evento.providerEventId} → ${outcome.kind} (pedido ${evento.orderId})`);

  switch (outcome.kind) {
    case 'duplicate':
      return {
        ok:
          `Este pagamento já tinha sido processado — nada foi concedido de novo. ` +
          `Se o cliente ainda não recebeu, o problema é o e-mail, não a venda (pedido ${evento.orderId}).`,
      };

    case 'unknown_order':
      /*
        O pagamento existe no Mercado Pago e o pedido dele não existe aqui. É outra falha, anterior
        a esta — o checkout não chegou a gravar — e nenhuma recuperação por id resolve. Dizer isso
        com todas as letras evita a próxima meia hora tentando o mesmo botão.
      */
      return {
        error:
          `O Mercado Pago conhece o pagamento ${id}, mas o pedido ${evento.orderId} não existe ` +
          'neste banco. A falha foi antes, no checkout. Este caminho não resolve — me chame.',
      };

    case 'illegal_transition':
      return {
        error:
          `O pedido ${evento.orderId} está em "${outcome.from}" e não aceita ir para ` +
          `"${outcome.to}". Nada foi alterado.`,
      };

    case 'processed': {
      const { recibo, meta } = await concluirCompra(evento.orderId, outcome);
      revalidatePath('/admin/vendas');
      revalidatePath('/admin/funil');

      return {
        ok:
          `Compra recuperada: pedido ${evento.orderId} concedido. ` +
          (recibo
            ? 'O e-mail com o relatório foi enviado ao cliente.'
            : '⚠️ O acesso foi liberado, mas o e-mail NÃO saiu — mande o link do relatório à mão.') +
          (meta ? '' : ' A conversão não foi para o Meta (veja o motivo em Funil).'),
      };
    }
  }
}
