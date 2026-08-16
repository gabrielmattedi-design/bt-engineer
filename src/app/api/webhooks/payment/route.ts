import { NextResponse } from 'next/server';
import { paymentProvider } from '@/payments/adapters';
import { simulatedPaymentsAllowed } from '@/payments/mode';
import { processPaymentEvent } from '@/database/repositories/commerce-repo';

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
  if (provider.id === 'fake' && !simulatedPaymentsAllowed()) {
    return NextResponse.json({ error: 'provedor inválido para produção' }, { status: 500 });
  }

  const event = await provider.parseWebhook(request);
  if (!event) {
    return NextResponse.json({ error: 'assinatura inválida' }, { status: 400 });
  }

  const outcome = await processPaymentEvent(provider.id, event);

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
      return NextResponse.json({ ok: true, granted: outcome.granted });
  }
}
