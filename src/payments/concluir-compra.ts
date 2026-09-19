import 'server-only';
import type { WebhookOutcome } from '@/database/repositories/commerce-repo';
import { contextoDoPedido, registrarEnvio } from '@/database/repositories/meta-repo';
import { enviarCompra } from '@/lib/meta-capi';
import { sendEmail } from '@/email/send';
import { reportReadyEmail } from '@/email/templates';
import { SITE_URL } from '@/lib/site';

/**
 * O que acontece DEPOIS de uma compra ser concedida: a conversão vai para o Meta e o recibo para o
 * comprador.
 *
 * ═══ POR QUE ISTO SAIU DE DENTRO DO WEBHOOK ══════════════════════════════════════════════════
 *
 * Porque passou a existir um segundo caminho que concede compra: a recuperação manual em
 * `/admin/vendas`, para quando o gateway confirmou o pagamento e a notificação não chegou.
 *
 * Duplicar estas trinta linhas no caminho novo criaria a pior espécie de divergência: a compra
 * recuperada entraria no banco, o cliente receberia o relatório, e a conversão nunca chegaria ao
 * Meta — ou o contrário. Nenhum dos dois daria erro, e a diferença só apareceria semanas depois,
 * num CAC que não fecha.
 *
 * Uma função, dois chamadores, o mesmo desfecho.
 *
 * ─── E POR QUE ELA NUNCA LANÇA ───────────────────────────────────────────────────────────────
 *
 * O acesso JÁ está gravado quando se chega aqui. Uma falha de e-mail ou do Meta não pode derrubar
 * quem chamou: no webhook, um erro faria o gateway reenviar para sempre um e-mail que não passa; na
 * recuperação, faria a tela dizer que falhou uma concessão que funcionou.
 */
export async function concluirCompra(
  orderId: string,
  outcome: Extract<WebhookOutcome, { kind: 'processed' }>,
): Promise<{ readonly recibo: boolean; readonly meta: boolean }> {
  let meta = false;

  /*
    ═══ A COMPRA VAI PARA O META DAQUI, E NÃO DO NAVEGADOR ═══════════════════════════════════

    Este é o único ponto do sistema em que temos certeza de que a compra aconteceu — o gateway
    acabou de confirmar. O navegador do comprador pode nunca voltar, pode ter bloqueador, pode ser
    um aparelho com prevenção de rastreamento; nada disso alcança uma chamada entre servidores.

    Foi medido: em 10/09/2026 o funil contava 16 compras da campanha e o Meta enxergava 2.

    `enviarCompra` nunca lança e recusa sozinha quem não consentiu.
  */
  const ctx = await contextoDoPedido(orderId);
  if (ctx) {
    const envio = await enviarCompra({
      orderId,
      valorEmReais: ctx.amountCents / 100,
      consent: ctx.consent,
      fbc: ctx.fbc,
      fbp: ctx.fbp,
      sourceUrl: ctx.sourceUrl,
    });

    /*
      O motivo da NÃO-ida também vira log. "Não enviou" tem causas que exigem consertos opostos —
      sem consentimento é o sistema funcionando, token expirado é incidente.
    */
    if (!envio.enviado) {
      console.info(`[capi] compra ${orderId} não enviada: ${envio.motivo}`);
    }

    /*
      E o desfecho vai para o BANCO, não só para o log: é o que vira uma linha de `/admin/funil`
      para quem opera do celular.
    */
    await registrarEnvio(orderId, envio);
    meta = envio.enviado;
  }

  if (!outcome.receipt) return { recibo: false, meta };

  const mail = reportReadyEmail({
    url: `${SITE_URL}/resultado/${outcome.receipt.publicId}`,
    productName: outcome.receipt.productName,
    amountCents: outcome.receipt.amountCents,
  });
  const sent = await sendEmail({ to: outcome.receipt.email, ...mail });
  if (!sent.ok && sent.reason === 'rejected') {
    console.error(`[compra] recibo não enviado para o pedido ${orderId}: ${sent.detail}`);
  }

  return { recibo: sent.ok, meta };
}
