'use server';

import { revalidatePath } from 'next/cache';
import { isAuthenticated } from '../auth';
import { paymentProvider } from '@/payments/adapters';
import { processPaymentEvent, situacaoDosPedidos } from '@/database/repositories/commerce-repo';
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
      /*
        ⚠️ Esta frase já mentiu uma vez, em 21/09/2026.

        Ela dizia "o problema é o e-mail, não a venda" — afirmando que a concessão tinha acontecido.
        Não tinha: a reserva do evento existia e o trabalho nunca terminou, então `duplicate` cobria
        tanto "entregue" quanto "travado". O dono leu a frase, concluiu que a venda existia, e ela
        continuou não existindo.

        Hoje `processPaymentEvent` retoma sozinho a reserva abandonada, então `duplicate` voltou a
        significar só uma coisa. A frase não volta a afirmar a outra: ela manda CONFERIR, porque
        conferir custa um clique e a afirmação errada custou um cliente esperando.
      */
      return {
        ok:
          `Este pagamento já constava como processado — nada foi concedido de novo ` +
          `(pedido ${evento.orderId}). Confira em Vendas se a venda aparece: se aparecer, o que ` +
          `falta é só o e-mail; se não aparecer, me chame.`,
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

export type Orfa = {
  readonly pagamento: string;
  readonly pedido: string;
  readonly valorCentavos: number;
  readonly email: string | null;
  /** `ausente` = pedido nem existe aqui. `pendente` = existe e nunca foi marcado como pago. */
  readonly tipo: 'ausente' | 'pendente';
};

export type VarreduraResult =
  | { readonly ok: string; readonly orfas: readonly Orfa[]; readonly conferidos: number }
  | { readonly error: string };

/**
 * Confere TODOS os pagamentos aprovados pelo gateway contra os pedidos daqui.
 *
 * ═══ A PERGUNTA QUE ISTO RESPONDE ════════════════════════════════════════════════════════════
 *
 * Em 19/09/2026 uma venda se perdeu — pagamento aprovado, notificação nunca entregue, nada do lado
 * de cá. Ela apareceu porque o cliente reclamou. A pergunta seguinte foi: **e os que não
 * reclamaram?**
 *
 * Ela não tinha resposta. Uma venda perdida é invisível por construção: não existe pedido pago, e o
 * que sobra — um checkout sem desfecho — é idêntico a alguém que desistiu na tela de pagamento.
 * Nenhuma consulta ao nosso banco separa as duas coisas, porque a diferença está do lado de fora.
 *
 * A única conferência que fecha é a que um contador faria: pegar o extrato e bater linha a linha.
 * É isto.
 *
 * ─── DOIS TIPOS DE FALHA, E ELES PEDEM CONSERTOS DIFERENTES ───────────────────────────────
 *
 * `pendente` — o pedido existe e ficou preso em pendente. A notificação se perdeu. O botão de
 * recuperar resolve sozinho, e é o caso do dia 19.
 *
 * `ausente` — o gateway conhece um pedido que NÃO existe neste banco. É mais grave e mais
 * estranho: significa que o checkout cobrou sem gravar, ou que o pedido foi apagado depois.
 * Recuperar não resolve, porque não há o que conceder. Precisa de investigação.
 *
 * Misturar os dois numa lista só faria alguém clicar em recuperar dez vezes num caso que nenhum
 * clique conserta.
 */
export async function varrerPagamentosPerdidos(
  _prev: unknown,
  formData: FormData,
): Promise<VarreduraResult> {
  if (!(await isAuthenticated())) return { error: 'Sessão expirada. Entre novamente.' };

  const dias = Math.min(90, Math.max(1, Number(formData.get('dias') ?? 30)));
  const ate = new Date();
  const desde = new Date(ate.getTime() - dias * 86_400_000);

  const provider = paymentProvider();

  let aprovados;
  try {
    aprovados = await provider.pagamentosAprovados(desde, ate);
  } catch (error) {
    const detalhe = error instanceof Error ? error.message : String(error);
    return { error: `Não consegui conferir com o Mercado Pago: ${detalhe}` };
  }

  if (aprovados.length === 0) {
    return {
      ok: `O Mercado Pago não devolveu nenhum pagamento aprovado nos últimos ${dias} dias.`,
      orfas: [],
      conferidos: 0,
    };
  }

  const ids = [...new Set(aprovados.map((e) => e.orderId))];
  const daqui = await withAutoBootstrap(() => situacaoDosPedidos(ids));
  const porId = new Map(daqui.map((p) => [p.id, p]));

  const orfas: Orfa[] = [];
  for (const evento of aprovados) {
    const nosso = porId.get(evento.orderId);
    if (nosso?.status === 'paid') continue;

    orfas.push({
      pagamento: evento.providerPaymentId,
      pedido: evento.orderId,
      valorCentavos: nosso?.amountCents ?? 0,
      email: nosso?.email ?? null,
      tipo: nosso === undefined ? 'ausente' : 'pendente',
    });
  }

  console.info(
    `[varredura] ${aprovados.length} aprovados no gateway, ${orfas.length} sem venda registrada aqui`,
  );

  return {
    ok:
      orfas.length === 0
        ? `Conferi ${aprovados.length} pagamentos aprovados dos últimos ${dias} dias. ` +
          'Todos estão registrados aqui — nenhuma venda perdida.'
        : `Conferi ${aprovados.length} pagamentos aprovados dos últimos ${dias} dias e ` +
          `${orfas.length} não constam como venda aqui.`,
    orfas,
    conferidos: aprovados.length,
  };
}
