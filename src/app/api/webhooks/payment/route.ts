import { NextResponse } from 'next/server';
import { paymentProvider } from '@/payments/adapters';
import { simulatedPaymentsAllowed } from '@/payments/mode';
import { processPaymentEvent } from '@/database/repositories/commerce-repo';
import { sendEmail } from '@/email/send';
import { reportReadyEmail } from '@/email/templates';
import { SITE_URL } from '@/lib/site';
import { contextoDoPedido, registrarEnvio } from '@/database/repositories/meta-repo';
import { enviarCompra } from '@/lib/meta-capi';

export const dynamic = 'force-dynamic';

/**
 * Webhook de pagamento — §33, docs/MONETIZATION.md §5.
 *
 * Esta rota é a única origem COMERCIAL de entitlement: nenhuma página, Server Action ou componente
 * concede acesso, e um teste de arquitetura garante isso.
 *
 * Existe uma segunda origem, deliberada e não comercial: `coupon-repo.grantEntitlements`, o cupom
 * de acesso. Ela concede sem pedido e deixa `granted_by_order_id` NULO — é essa coluna que
 * distingue as duas, e é por ela que o funil separa comprador de convidado. O comentário anterior
 * dizia "a ÚNICA origem em todo o sistema", o que era falso desde que o cupom existe: quem lesse
 * esta linha concluiria que acesso implica pagamento, e decidiria errado a partir disso.
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

  const parsed = await provider.parseWebhook(request);

  /*
    ═══ IGNORAR NÃO É FALHAR ══════════════════════════════════════════════════════════════════

    O Mercado Pago manda uma notificação de `merchant_order` junto de CADA pagamento. Ela não nos
    interessa, e descartá-la é o comportamento certo — mas descartar com `400` diz ao gateway
    "falhei, tente de novo". Ele reenfileira, reenvia, marca a entrega como falha, e se persistir
    desativa a notificação.

    Foi o que produziu `0% de notificações entregues` no painel, com o webhook funcionando. E,
    porque o painel mostrava `400` em tudo, a leitura óbvia foi "a assinatura está errada" — a
    investigação inteira foi por esse caminho por causa de um código de status mal escolhido.

    200 aqui significa "recebi, decidi, não precisa reenviar".
  */
  if (parsed.kind === 'ignored') {
    return NextResponse.json({ ok: true, ignored: parsed.reason });
  }

  if (parsed.kind === 'invalid') {
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
      `[webhook] notificação recusada — provedor ${provider.id}, motivo: ${parsed.reason}, ` +
        `assinatura ${request.headers.get('x-signature') ? 'presente' : 'ausente'}.`,
    );
    // 400 só aqui, onde é verdade: a notificação chegou e não pôde ser aceita.
    return NextResponse.json({ error: parsed.reason }, { status: 400 });
  }

  const event = parsed.event;
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
    case 'processed': {
      /*
        ═══ A COMPRA VAI PARA O META DAQUI, E NÃO DO NAVEGADOR ══════════════════════════════════

        Este é o único ponto do sistema em que temos certeza de que a compra aconteceu — o gateway
        acabou de confirmar. O navegador do comprador pode nunca voltar, pode ter bloqueador, pode
        ser um iPhone com prevenção de rastreamento; nada disso alcança uma chamada entre
        servidores.

        Foi medido: em 10/09/2026 o funil contava 16 compras da campanha e o Meta enxergava 2.

        `enviarCompra` nunca lança e recusa sozinha quem não consentiu. O `await` é deliberado —
        sem ele a função serverless pode encerrar antes de a requisição sair, e o evento se perde
        justamente nos dias de maior volume.
      */
      const ctx = await contextoDoPedido(event.orderId);
      if (ctx) {
        const envio = await enviarCompra({
          orderId: event.orderId,
          valorEmReais: ctx.amountCents / 100,
          consent: ctx.consent,
          fbc: ctx.fbc,
          fbp: ctx.fbp,
          sourceUrl: ctx.sourceUrl,
        });
        /*
          O motivo da NÃO-ida também vira log.

          "Não enviou" tem causas que exigem consertos opostos — sem consentimento é o sistema
          funcionando, token expirado é incidente. Sem distinguir as duas no log, a única saída
          seria adivinhar, que é o erro que este arquivo inteiro tenta não repetir.
        */
        if (!envio.enviado) {
          console.info(`[capi] compra ${event.orderId} não enviada: ${envio.motivo}`);
        }
        /*
          E o desfecho vai para o BANCO, não só para o log.

          Log de servidor só é lido por quem está num computador com acesso à Vercel. O dono opera
          do celular, e por dois dias a única resposta que existia para "a API de Conversões está
          funcionando?" foi "abra o Gerenciador de Eventos num desktop". Gravado aqui, o mesmo fato
          vira uma linha do `/admin/funil`.
        */
        await registrarEnvio(event.orderId, envio);
      }

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
}
