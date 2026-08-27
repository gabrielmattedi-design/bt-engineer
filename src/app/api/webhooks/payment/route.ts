import { NextResponse } from 'next/server';
import { paymentProvider } from '@/payments/adapters';
import { simulatedPaymentsAllowed } from '@/payments/mode';
import { processPaymentEvent } from '@/database/repositories/commerce-repo';
import { sendEmail } from '@/email/send';
import { reportReadyEmail } from '@/email/templates';
import { SITE_URL } from '@/lib/site';

export const dynamic = 'force-dynamic';

/**
 * Webhook de pagamento — §33, docs/MONETIZATION.md §5.
 *
 * Esta rota é a ÚNICA origem de entitlement em todo o sistema. Nenhuma página, Server Action ou
 * componente concede acesso; um teste de arquitetura garante isso.
 *
 * ─── SOBRE OS CÓDIGOS DE RESPOSTA ────────────────────────────────────────────────────────────
 *
 * Devolvemos 200 para quase tudo, inclusive pedido desconhecido e transição ilegal. Isso é
 * deliberado: um status de erro faz o gateway reenfileirar e reenviar o mesmo evento indefinidamente,
 * e nenhuma dessas situações melhora com repetição. 200 significa "recebi e decidi", não "deu tudo
 * certo".
 *
 * A única exceção é assinatura inválida, que responde 400: aí o remetente não é o gateway, e vale
 * dizer isso alto.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const provider = paymentProvider();

  // Trava de cinto e suspensório: o adapter simulado já lança quando não está autorizado, mas se
  // alguém registrar outro adapter permissivo, esta linha continua valendo.
  if (provider.id === 'fake' && !(await simulatedPaymentsAllowed())) {
    return NextResponse.json({ error: 'provedor inválido para produção' }, { status: 500 });
  }

  const event = await provider.parseWebhook(request);
  if (!event) {
    /*
      ═══ POR QUE ESTA LINHA DE LOG EXISTE ══════════════════════════════════════════════════════

      Uma recusa silenciosa aqui é indistinguível, de fora, de o gateway nunca ter chamado. E as
      duas causas exigem investigações opostas: uma se resolve no segredo do webhook, a outra na URL
      de notificação. Sem registro, a única saída era adivinhar entre as duas.

      Aconteceu de verdade (ago/2026): um pagamento aprovado que não liberou o relatório, e nenhuma
      forma de saber se a notificação chegou. Uma linha de log teria fechado a questão em segundos.

      O que vai para o log é só o suficiente para decidir: nada do corpo, que carrega dados do
      comprador.
    */
    console.error(
      `[webhook] notificação recusada — provedor ${provider.id}, ` +
        `assinatura ${request.headers.get('x-signature') ? 'presente' : 'ausente'}. ` +
        'Confira MERCADOPAGO_WEBHOOK_SECRET contra a assinatura secreta da aplicação.',
    );
    return NextResponse.json({ error: 'assinatura inválida' }, { status: 400 });
  }

  const outcome = await processPaymentEvent(provider.id, event);
  // O caminho feliz também deixa rastro: sem ele, "chegou e foi ignorado" some do log tão
  // silenciosamente quanto a recusa, e a diferença entre os dois é o diagnóstico inteiro.
  console.info(`[webhook] ${event.providerEventId} → ${outcome.kind} (pedido ${event.orderId})`);

  switch (outcome.kind) {
    case 'duplicate':
      // Reentrega do gateway. Absorvida sem conceder nada de novo.
      return NextResponse.json({ ok: true, duplicate: true });
    case 'unknown_order':
      return NextResponse.json({ ok: true, ignored: 'pedido desconhecido' });
    case 'illegal_transition':
      return NextResponse.json({
        ok: true,
        ignored: `transição ilegal ${outcome.from} → ${outcome.to}`,
      });
    case 'processed':
      /*
        ═══ O RECIBO SAI DEPOIS DA CONCESSÃO, E SUA FALHA NÃO DERRUBA O WEBHOOK ═══════════════

        O acesso já está gravado quando chegamos aqui. Se o envio falhar — provedor fora, chave
        expirada, e-mail recusado — o certo é responder 200 mesmo assim: um erro faria o gateway
        reenviar o evento, e reenvio é justamente o que a idempotência absorve sem reconceder
        nada. O resultado seria o gateway tentando para sempre um e-mail que não vai passar, e
        marcando nosso webhook como problemático.
      */
      if (outcome.receipt) {
        const mail = reportReadyEmail({
          url: `${SITE_URL}/resultado/${outcome.receipt.publicId}`,
          productName: outcome.receipt.productName,
          amountCents: outcome.receipt.amountCents,
        });
        const sent = await sendEmail({ to: outcome.receipt.email, ...mail });
        if (!sent.ok && sent.reason === 'rejected') {
          console.error(`[webhook] recibo não enviado para o pedido ${event.orderId}: ${sent.detail}`);
        }
      }
      return NextResponse.json({ ok: true, granted: outcome.granted });
  }
}
