import 'server-only';
import { podeRastrear, type ConsentState } from '@/lib/consent';

/**
 * API de Conversões do Meta — a compra enviada do SERVIDOR.
 *
 * ═══ O NÚMERO QUE FEZ ISTO DEIXAR DE SER OPCIONAL ════════════════════════════════════════════
 *
 * Em 10/09/2026, segundo dia da primeira campanha, o `/admin/funil` contava **16 compras** vindas
 * do tráfego pago. O Gerenciador de Anúncios mostrava **2**.
 *
 * O pixel do navegador enxergava 12,5% das vendas, e a campanha estava otimizando por compra em
 * cima disso — procurando compradores parecidos com dois, quando dezesseis tinham acontecido.
 * `docs/TRAFEGO_PAGO.md` §5-bis registrava a API de Conversões como "deliberadamente adiada"; o
 * motivo do adiamento acabou naquele dia.
 *
 * ═══ O QUE ELA RECUPERA, E O QUE NÃO ═════════════════════════════════════════════════════════
 *
 * Recupera, de quem **aceitou** o banner:
 *
 *   - quem fechou o navegador antes de voltar do gateway (o pixel dispara na volta, e não houve
 *     volta);
 *   - quem tem bloqueador de anúncio — que barra o script no navegador e não tem como barrar uma
 *     chamada entre servidores;
 *   - navegadores com prevenção de rastreamento, que é o padrão no iPhone.
 *
 * **Não recupera quem recusou o banner, e isso é decisão, não limitação.** Ver `enviarCompra`.
 *
 * ═══ POR QUE ELA NUNCA LANÇA, E NUNCA DEMORA ═════════════════════════════════════════════════
 *
 * Ela é chamada de dentro do webhook de pagamento. Se o Meta estiver fora do ar, o comprador ainda
 * precisa receber o acesso e o recibo — e um erro aqui faria o gateway reenfileirar um evento que
 * já foi processado. Mesma regra de `markFunnel`: medição não derruba produto.
 */

const VERSAO_DA_API = 'v21.0';

/**
 * Cinco segundos.
 *
 * O webhook responde ao gateway, e o gateway tem paciência finita. Esperar o Meta indefinidamente
 * transformaria uma indisponibilidade deles numa fila de reentregas nossa.
 */
const TIMEOUT_MS = 5000;

function token(): string {
  return process.env.META_CAPI_ACCESS_TOKEN ?? '';
}

function pixelId(): string {
  return process.env.NEXT_PUBLIC_META_PIXEL_ID ?? '';
}

/**
 * `true` quando o envio pelo servidor está ligado.
 *
 * É lido também pela página de resultado, para decidir se o pixel do NAVEGADOR ainda deve disparar
 * a compra — ver `enviarCompra`, seção da contagem dupla.
 */
export function capiConfigurada(): boolean {
  return token().length > 0 && pixelId().length > 0;
}

export type ContextoDeCompra = {
  readonly orderId: string;
  readonly valorEmReais: number;
  readonly consent: ConsentState;
  readonly fbc: string | null;
  readonly fbp: string | null;
  readonly sourceUrl: string | null;
};

export type ResultadoDoEnvio =
  | { readonly enviado: true }
  | { readonly enviado: false; readonly motivo: string };

/**
 * Manda uma compra para o Meta. Nunca lança.
 *
 * ═══ A TRAVA DE CONSENTIMENTO ════════════════════════════════════════════════════════════════
 *
 * Só sai com `aceito`. O banner pergunta na frente se pode medir; mandar do servidor o que o
 * navegador foi proibido de mandar seria responder "sim" por quem disse "não" — e o banner
 * deixaria de significar coisa alguma.
 *
 * Isso tem preço, e ele é conhecido: uma parte das vendas continua invisível para o Meta, e a
 * campanha otimiza com menos sinal do que poderia. O preço é aceito.
 *
 * ═══ A TRAVA DA CONTAGEM DUPLA ═══════════════════════════════════════════════════════════════
 *
 * Duas fontes podem mandar a MESMA compra: este envio e o pixel do navegador em
 * `purchase-pixel.tsx`. Contar duas vezes dobra o retorno aparente, e a decisão de escalar sai
 * desse número — é o defeito mais caro que esta parte do sistema pode ter.
 *
 * A defesa NÃO é o `event_id` de deduplicação do Meta, e sim algo mais simples de garantir: **as
 * duas fontes nunca estão ligadas ao mesmo tempo.** Quando `capiConfigurada()` é verdadeira, o
 * componente do navegador não dispara nada. Uma fonte, sempre.
 *
 * Ainda assim o `event_id` vai junto, com o id do pedido: se um dia alguém religar as duas, o Meta
 * deduplica em vez de dobrar. É cinto além do suspensório, e custa uma linha.
 */
export async function enviarCompra(ctx: ContextoDeCompra): Promise<ResultadoDoEnvio> {
  if (!capiConfigurada()) return { enviado: false, motivo: 'nao_configurada' };

  if (!podeRastrear(ctx.consent)) return { enviado: false, motivo: 'sem_consentimento' };

  /*
    A API exige pelo menos um identificador em `user_data`. Sem `fbc` nem `fbp` não há a quem
    atribuir, e o evento seria aceito e descartado do outro lado — um sucesso aparente.

    Note o que NÃO está aqui: IP, user-agent, e-mail com hash. Todos aumentariam a correspondência
    e todos são aceitos pelo Meta. `schema/campaigns.ts` diz que esta medição não guarda impressão
    digital, e a API de Conversões não é uma exceção a isso.
  */
  if (!ctx.fbc && !ctx.fbp) return { enviado: false, motivo: 'sem_identificador' };

  /*
    Valor ilegível não vira evento — mesma regra do pixel do navegador.

    A alternativa seria mandar zero ou o ticket médio, e as duas envenenam a única conta que
    importa: o retorno que decide escalar. Evento a menos deixa o número menor; evento com valor
    inventado deixa o número errado, que é pior e não parece.
  */
  if (!Number.isFinite(ctx.valorEmReais) || ctx.valorEmReais <= 0) {
    return { enviado: false, motivo: 'sem_valor' };
  }

  const user_data: Record<string, string> = {};
  if (ctx.fbc) user_data.fbc = ctx.fbc;
  if (ctx.fbp) user_data.fbp = ctx.fbp;

  const evento: Record<string, unknown> = {
    event_name: 'Purchase',
    event_time: Math.floor(Date.now() / 1000),
    event_id: ctx.orderId,
    action_source: 'website',
    user_data,
    custom_data: { value: ctx.valorEmReais, currency: 'BRL' },
  };
  if (ctx.sourceUrl) evento.event_source_url = ctx.sourceUrl;

  try {
    const resposta = await fetch(
      `https://graph.facebook.com/${VERSAO_DA_API}/${pixelId()}/events`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ data: [evento], access_token: token() }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );

    if (!resposta.ok) {
      /*
        O corpo do erro do Meta é lido e registrado de propósito.

        Um 400 aqui pode ser token expirado, pixel errado ou payload inválido — três consertos
        diferentes. Sem o motivo, a única saída seria adivinhar entre eles, que foi exatamente o
        que custou uma manhã quando o pixel não disparava.
      */
      const corpo = await resposta.text().catch(() => '');
      console.error(`[capi] Meta recusou a compra ${ctx.orderId}: ${resposta.status} ${corpo.slice(0, 300)}`);
      return { enviado: false, motivo: `http_${resposta.status}` };
    }

    return { enviado: true };
  } catch (error) {
    console.error('[capi] falha ao enviar a compra', ctx.orderId, error);
    return { enviado: false, motivo: 'erro_de_rede' };
  }
}
