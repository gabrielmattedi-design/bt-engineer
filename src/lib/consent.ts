/**
 * Consentimento para rastreamento de terceiro — §15, tráfego pago.
 *
 * ═══ POR QUE ISTO EXISTE, E O QUE ELE REVERTE ════════════════════════════════════════════════
 *
 * Até 08/09/2026 este produto não tinha rastreamento de terceiro NENHUM, e a página de privacidade
 * dizia isso por escrito: sem Google Analytics, sem pixel de rede social, sem script de terceiro. A
 * medição inteira era própria — `funnel_markers` e `visitor_campaigns` não guardam IP, referrer nem
 * impressão digital.
 *
 * O pixel do Meta reverte essa postura, e a reversão foi uma decisão explícita do dono para poder
 * comprar tráfego: sem sinal de conversão na plataforma, a campanha não otimiza por quem age no
 * site — ela vira compra de cliques. Ver `docs/TRAFEGO_PAGO.md` §5.
 *
 * Este arquivo existe para que a reversão seja CONTROLADA em vez de silenciosa. A regra é uma só:
 *
 *   > Nenhum script de terceiro carrega antes do aceite. Nem para "só medir página vista".
 *
 * ═══ POR QUE COOKIE, E NÃO localStorage ══════════════════════════════════════════════════════
 *
 * `localStorage` só existe no navegador. O cookie viaja na requisição, então o SERVIDOR também
 * consegue saber se pode ou não disparar um evento — que é o que permite, mais tarde, decidir se a
 * API de Conversões pode mandar a compra sem consultar o navegador de novo.
 *
 * Se o dia da API de Conversões chegar, a decisão já está tomada aqui, e não haverá a tentação de
 * mandar o evento "porque é servidor e ninguém vê".
 *
 * ═══ AUSENTE NÃO É "SIM" ═════════════════════════════════════════════════════════════════════
 *
 * Cookie ausente significa NÃO DECIDIDO, e não-decidido se comporta exatamente como recusa: nada
 * carrega. É a diferença entre pedir permissão e avisar que já foi feito — e é também o que a LGPD
 * espera de um tratamento que não é necessário para entregar o serviço.
 *
 * A recusa é gravada, e não apenas "não aceita". Sem gravar, quem recusa vê o banner em toda visita
 * e a recusa vira um pedido que o site ignora até cansar a pessoa.
 */

export const CONSENT_COOKIE = 'te_consent';

export type ConsentState = 'aceito' | 'recusado' | 'nao_decidido';

/**
 * Seis meses.
 *
 * Curto demais e a pessoa é perguntada de novo a cada duas semanas, o que é assédio disfarçado de
 * conformidade. Longo demais e um "sim" dado uma vez vira permanente. Seis meses é o intervalo em
 * que reperguntar ainda soa como revisão, e não como insistência.
 */
export const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

/** Lê o estado a partir de um `document.cookie` ou do cabeçalho `Cookie` — os dois têm o mesmo formato. */
export function parseConsent(cookieHeader: string | null | undefined): ConsentState {
  if (!cookieHeader) return 'nao_decidido';

  for (const parte of cookieHeader.split(';')) {
    const [nome, ...resto] = parte.trim().split('=');
    if (nome !== CONSENT_COOKIE) continue;

    const valor = resto.join('=');
    if (valor === 'aceito') return 'aceito';
    if (valor === 'recusado') return 'recusado';
    /*
      Valor desconhecido cai em não-decidido de propósito.

      Um cookie corrompido, de uma versão antiga ou escrito à mão não pode virar consentimento por
      acidente. O único jeito de chegar em `aceito` é o valor ser exatamente isso.
    */
    return 'nao_decidido';
  }

  return 'nao_decidido';
}

/** `true` só quando há aceite explícito. Toda decisão de carregar terceiro passa por aqui. */
export function podeRastrear(estado: ConsentState): boolean {
  return estado === 'aceito';
}
