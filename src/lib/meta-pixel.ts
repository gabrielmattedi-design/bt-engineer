/**
 * Eventos do pixel do Meta — a camada fina entre o produto e o `fbq`.
 *
 * ═══ POR QUE TODO EVENTO PASSA POR AQUI ══════════════════════════════════════════════════════
 *
 * Porque `fbq` pode não existir, e vai não existir na maioria das execuções: sem consentimento o
 * script nunca é carregado. Se cada tela chamasse `window.fbq(...)` direto, cada tela precisaria
 * lembrar de checar — e a que esquecesse quebraria em produção justamente para quem RECUSOU o
 * rastreamento, que é o pior grupo possível para se quebrar.
 *
 * Com esta função no meio, chamar um evento sem consentimento é um no-op silencioso. As telas
 * chamam sempre; a decisão de disparar mora num lugar só.
 *
 * ═══ O NOME DO EVENTO DE OTIMIZAÇÃO ══════════════════════════════════════════════════════════
 *
 * A campanha otimiza por INÍCIO DE QUESTIONÁRIO, não por compra — não há volume de compra em
 * R$ 490 de verba para o algoritmo aprender (`docs/TRAFEGO_PAGO.md` §3). No vocabulário do Meta o
 * evento padrão mais próximo disso é `Lead`: alguém demonstrou intenção sem ter pago.
 *
 * Usar um evento PADRÃO e não um customizado importa: os padrões já são otimizáveis na criação da
 * campanha, enquanto um customizado exige configuração manual no Gerenciador de Eventos e falha em
 * silêncio quando alguém esquece.
 */

/**
 * ═══ NENHUM EVENTO DAQUI PODE CARREGAR RESPOSTA DO QUESTIONÁRIO ══════════════════════════════
 *
 * Esta é a regra mais importante deste arquivo, e ela não é sobre marketing.
 *
 * O questionário pergunta sobre **dor no cotovelo e sensibilidade no braço**. Isso é dado de saúde.
 * Mandar para o Meta seria, ao mesmo tempo:
 *
 *   - uma quebra do que a página de privacidade promete por escrito ("nós nunca enviamos ao Meta o
 *     que você respondeu, o seu resultado, o seu e-mail ou o seu nome");
 *   - uma violação da política de dados sensíveis das ferramentas comerciais do Meta, que pode
 *     derrubar a conta de anúncios inteira.
 *
 * A tentação é real e tem cara de boa ideia: mandar o nível do jogador, o objetivo ou a faixa de
 * preço "melhoraria a segmentação". O ganho é marginal e o risco não é.
 *
 * **Os eventos daqui carregam apenas constantes escritas neste arquivo.** Nada que venha do perfil,
 * das respostas ou do resultado. `tests/ethics/consentimento.test.ts` trava isso estruturalmente:
 * este módulo não pode importar nada de `recommendation/` nem de `domain/`.
 *
 * Se algum dia for preciso mandar valor de compra, mande o VALOR — nunca o que foi comprado.
 */

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? '';

/** `true` quando existe um id configurado. Sem id, nada é carregado nem em desenvolvimento. */
export function pixelConfigurado(): boolean {
  return META_PIXEL_ID.trim().length > 0;
}

type Fbq = (comando: string, evento: string, parametros?: Record<string, unknown>) => void;

declare global {
  interface Window {
    fbq?: Fbq;
  }
}

/**
 * Dispara um evento, se — e somente se — o pixel estiver carregado.
 *
 * Não recebe o estado de consentimento de propósito: `window.fbq` só existe se o consentimento
 * já foi dado, então a presença dele É a verificação. Passar o estado junto criaria duas fontes
 * de verdade que podem discordar.
 */
export function metaEvento(evento: string, parametros?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;

  const fbq = window.fbq;
  if (typeof fbq !== 'function') return;

  try {
    fbq('track', evento, parametros);
  } catch (error) {
    /*
      Engolir o erro é deliberado, pelo mesmo motivo de `markFunnel`: medição não pode derrubar o
      produto. Um bloqueador de anúncio que substitui `fbq` por algo que lança não pode impedir
      alguém de responder o questionário.
    */
    console.error('[pixel] falha ao enviar evento', evento, error);
  }
}

/** Início do questionário — o evento pelo qual a campanha otimiza. */
export function metaInicioDeQuestionario(): void {
  metaEvento('Lead', { content_name: 'questionario' });
}

/** Compra confirmada. Vale para histórico e atribuição; não é o evento de otimização desta campanha. */
export function metaCompra(valorEmReais: number): void {
  metaEvento('Purchase', { value: valorEmReais, currency: 'BRL' });
}
