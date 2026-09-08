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

import { parseConsent, podeRastrear } from '@/lib/consent';

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
 * ═══ A CORRIDA QUE FAZIA O EVENTO DA CAMPANHA SUMIR ══════════════════════════════════════════
 *
 * A primeira versão desta função era: "se `window.fbq` não existe, não faz nada". O raciocínio
 * parecia sólido — `fbq` só nasce depois do aceite, então a ausência dele é a própria verificação
 * de consentimento, sem segunda fonte de verdade.
 *
 * Estava errado, e o defeito foi medido em 08/09/2026 com o site rodando: ao abrir `/questionario`
 * direto, a fila do `fbq` continha `init` e `PageView` e **não continha o `Lead`**.
 *
 * A causa é a ordem dos efeitos no React: os efeitos dos FILHOS rodam antes dos do pai. O
 * `ConsentBanner` mora no layout e precisa de dois renders — um para ler o cookie, outro para
 * injetar o script. O questionário monta e chama `Lead` antes disso. `fbq` ainda não existe, o
 * evento era descartado em silêncio, e a ausência de `fbq` estava significando duas coisas
 * diferentes: "a pessoa recusou" e "ainda não carregou".
 *
 * O efeito prático era o pior possível: **o evento pelo qual a campanha inteira otimiza quase
 * nunca dispararia**, sem erro em lugar nenhum. O Meta receberia PageView e concluiria que o site
 * não gera intenção.
 *
 * A correção separa as duas perguntas. Consentimento passa a ser lido do COOKIE, que é a fonte de
 * verdade real; a presença do `fbq` passa a ser só "já dá para enviar agora". Quem chega antes
 * espera numa fila e é despachado quando o script entra.
 */
const pendentes: { evento: string; parametros?: Record<string, unknown> }[] = [];

/**
 * Teto da fila.
 *
 * Ela só cresce na janela entre o aceite e o script entrar — uns poucos milissegundos, um punhado
 * de eventos. Um teto existe porque uma fila sem limite, num caso que ninguém previu (script
 * bloqueado por extensão e navegação longa numa SPA), vira vazamento de memória silencioso.
 */
const LIMITE_DA_FILA = 20;

function enviar(fbq: Fbq, evento: string, parametros?: Record<string, unknown>): void {
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

/** Dispara um evento — agora, ou assim que o pixel entrar. Sem consentimento, descarta. */
export function metaEvento(evento: string, parametros?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;

  /*
    O consentimento é lido do cookie, e não inferido da existência do `fbq`.

    É o que garante que a fila NUNCA guarde evento de quem recusou. Sem esta linha, alguém que
    recusa e depois muda de ideia na mesma visita veria os eventos anteriores ao "sim" serem
    enviados retroativamente — consentimento aplicado ao passado, que não é consentimento.
  */
  if (!podeRastrear(parseConsent(document.cookie))) return;

  const fbq = window.fbq;
  if (typeof fbq !== 'function') {
    if (pendentes.length < LIMITE_DA_FILA) pendentes.push({ evento, parametros });
    return;
  }

  enviar(fbq, evento, parametros);
}

/**
 * Despacha o que ficou na fila. Chamada pelo banner logo depois de injetar o pixel.
 *
 * Segura sozinha se o script não tiver entrado: nesse caso não faz nada e a fila continua
 * esperando, em vez de perder os eventos.
 */
export function metaDescarregarFila(): void {
  if (typeof window === 'undefined') return;

  const fbq = window.fbq;
  if (typeof fbq !== 'function') return;

  while (pendentes.length > 0) {
    const p = pendentes.shift();
    if (p) enviar(fbq, p.evento, p.parametros);
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
