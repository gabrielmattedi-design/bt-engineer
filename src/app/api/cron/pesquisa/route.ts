import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import {
  criarPesquisa,
  pedidosParaPesquisar,
  registrarEnvio,
  DIAS_DEPOIS_DA_COMPRA,
} from '@/database/repositories/pesquisa-repo';
import { sendEmail } from '@/email/send';
import { satisfactionSurveyEmail } from '@/email/templates';
import { SITE_URL } from '@/lib/site';
import { withAutoBootstrap } from '@/database/setup';

export const dynamic = 'force-dynamic';

/**
 * O disparo diário da pesquisa de satisfação.
 *
 * ═══ POR QUE UM CRON DO PRODUTO, E NÃO UMA TAREFA MINHA ══════════════════════════════════════
 *
 * Isto precisa rodar todo dia, para sempre, sem ninguém lembrar. Qualquer agendamento que dependa
 * de uma sessão de assistente, de uma aba aberta ou de alguém apertar um botão é um agendamento
 * que vai parar num dia qualquer e ninguém vai notar — porque o sintoma de um cron parado é a
 * ausência de e-mails, e ausência não gera alerta.
 *
 * ═══ O TETO POR EXECUÇÃO É PROTEÇÃO DE ENTREGA ═══════════════════════════════════════════════
 *
 * Ver `pesquisa-repo.pedidosParaPesquisar`. Resumo: um domínio que manda dez por dia e de repente
 * manda cento e vinte parece disparo em massa — e a reputação queimada levaria junto a entrega do
 * RELATÓRIO, que é o produto.
 */
const LIMITE_POR_EXECUCAO = Number(process.env.PESQUISA_LIMITE_DIARIO ?? 15);

/** Para onde vai o "sair" do `List-Unsubscribe`. Uma caixa que alguém lê, não um buraco. */
const CONTATO = process.env.CONTATO_EMAIL ?? 'contato@tennisengineer.com.br';

/**
 * Autenticação do cron.
 *
 * ⚠️ Sem `CRON_SECRET`, a rota RECUSA — e não libera. A Vercel manda o cabeçalho
 * `Authorization: Bearer <CRON_SECRET>` nos agendamentos dela, e essa é a única chamada legítima.
 *
 * Liberar quando o segredo não está configurado seria o padrão inseguro clássico: a rota funciona
 * em desenvolvimento, ninguém configura em produção, e um endereço público passa a disparar e-mail
 * para clientes reais a cada visita.
 */
function autorizado(req: Request): boolean {
  const esperado = process.env.CRON_SECRET;
  if (!esperado) return false;

  const recebido = req.headers.get('authorization') ?? '';
  const a = Buffer.from(recebido);
  const b = Buffer.from(`Bearer ${esperado}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: 'nao autorizado' }, { status: 401 });
  }

  const fila = await withAutoBootstrap(() => pedidosParaPesquisar(LIMITE_POR_EXECUCAO));

  let enviados = 0;
  const falhas: string[] = [];

  for (const pedido of fila) {
    /*
      Grava ANTES de enviar. Se o envio falhar, essa pessoa perde a pesquisa — perda pequena. Se
      fosse o contrário e a gravação falhasse, o pedido voltaria à fila e a pessoa receberia o mesmo
      e-mail todo dia. Entre perder um envio e virar spam para um cliente, o primeiro é barato.
    */
    const token = await criarPesquisa(pedido.orderId);
    if (token === null) {
      falhas.push(pedido.orderId);
      continue;
    }

    const email = satisfactionSurveyEmail({ url: `${SITE_URL}/avaliacao/${token}` });
    const r = await sendEmail({
      to: pedido.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
      /*
        `List-Unsubscribe` é invisível para quem lê e pesado para quem filtra: o Gmail o considera
        na entrega, e quem não encontra como sair marca como spam — o que custa reputação de
        domínio, a mesma que entrega o relatório.
      */
      headers: {
        'List-Unsubscribe': `<mailto:${CONTATO}?subject=sair>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });

    /*
      O resultado volta para a linha. Sem isto, a existência da linha significaria "foi tentado" e
      seria lida como "foi enviado" — e como a linha também é a trava que impede reenvio, uma recusa
      do provedor não atrasaria a pesquisa daquele cliente: eliminaria. O painel mostra as duas
      contagens separadas justamente porque elas não são a mesma coisa.
    */
    if (r.ok) {
      await registrarEnvio(token, { ok: true, id: r.id });
      enviados += 1;
    } else {
      await registrarEnvio(token, { ok: false, motivo: r.detail ?? r.reason });
      falhas.push(`${pedido.orderId}:${r.reason}`);
    }
  }

  console.log(
    `[pesquisa] fila ${fila.length}, enviados ${enviados}, falhas ${falhas.length}` +
      (falhas.length > 0 ? ` — ${falhas.join(', ')}` : ''),
  );

  return NextResponse.json({
    janelaEmDias: DIAS_DEPOIS_DA_COMPRA,
    naFila: fila.length,
    enviados,
    falhas: falhas.length,
  });
}

