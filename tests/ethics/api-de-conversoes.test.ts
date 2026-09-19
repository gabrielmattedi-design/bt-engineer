/**
 * A API de Conversões — as travas que decidem se uma compra sai daqui.
 *
 * ═══ POR QUE ESTE ARQUIVO ESTÁ EM `ethics/` E NÃO EM `integrity/` ════════════════════════════
 *
 * Porque a trava principal não é técnica. Este envio sai do SERVIDOR, onde nada do navegador o
 * impede: nem bloqueador, nem prevenção de rastreamento, nem cookie recusado. O único obstáculo
 * entre uma compra e o Meta é uma linha de código nossa que decide não mandar.
 *
 * O banner pergunta, na frente, se pode medir. Mandar do servidor o que o navegador foi proibido de
 * mandar responderia "sim" por quem disse "não" — e o banner deixaria de significar coisa alguma.
 *
 * A segunda trava é aritmética e igualmente cara: contar a mesma venda duas vezes dobra o retorno
 * aparente, e a decisão de escalar sai desse número.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const ORIGINAL = { ...process.env };

function configurar(): void {
  process.env.META_CAPI_ACCESS_TOKEN = 'token-de-teste';
  process.env.NEXT_PUBLIC_META_PIXEL_ID = '1053602054128829';
}

/** Um contexto que passaria em tudo — cada teste estraga só a parte que quer medir. */
function contextoValido() {
  return {
    orderId: '11111111-1111-1111-1111-111111111111',
    valorEmReais: 29.99,
    consent: 'aceito' as const,
    fbc: 'fb.1.1788900000000.abc123',
    fbp: null,
    sourceUrl: 'https://tennisengineer.com.br/planos/abc',
  };
}

beforeEach(() => {
  vi.resetModules();
  configurar();
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.unstubAllGlobals();
});

describe('a trava de consentimento', () => {
  it('não envia a compra de quem recusou', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const { enviarCompra } = await import('@/lib/meta-capi');
    const r = await enviarCompra({ ...contextoValido(), consent: 'recusado' });

    expect(r).toEqual({ enviado: false, motivo: 'sem_consentimento' });
    expect(
      fetchSpy,
      'o servidor mandou a compra de quem recusou o banner — a permissão virou enfeite',
    ).not.toHaveBeenCalled();
  });

  it('não envia quando ninguém decidiu ainda', async () => {
    /*
      Ausente não é "sim".

      É a mesma regra de `consent.ts`, e ela precisa valer também aqui: quem nunca viu o banner —
      porque comprou antes de ele existir, ou porque o cookie expirou — não autorizou nada.
    */
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const { enviarCompra } = await import('@/lib/meta-capi');
    const r = await enviarCompra({ ...contextoValido(), consent: 'nao_decidido' });

    expect(r.enviado).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('envia quando houve aceite', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, text: async () => '{}' });
    vi.stubGlobal('fetch', fetchSpy);

    const { enviarCompra } = await import('@/lib/meta-capi');
    const r = await enviarCompra(contextoValido());

    expect(r).toEqual({ enviado: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe('o que vai no corpo do evento', () => {
  it('leva o id do pedido como event_id, para deduplicar', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, text: async () => '{}' });
    vi.stubGlobal('fetch', fetchSpy);

    const { enviarCompra } = await import('@/lib/meta-capi');
    await enviarCompra(contextoValido());

    const corpo = JSON.parse(fetchSpy.mock.calls[0]![1].body);
    expect(corpo.data[0].event_id).toBe('11111111-1111-1111-1111-111111111111');
    expect(corpo.data[0].event_name).toBe('Purchase');
    expect(corpo.data[0].custom_data).toEqual({ value: 29.99, currency: 'BRL' });
  });

  /**
   * O que NÃO vai é decisão, e um teste é o único jeito de ela sobreviver a uma refatoração.
   *
   * IP, user-agent e e-mail com hash melhorariam a correspondência e todos são aceitos pelo Meta.
   * `schema/campaigns.ts` diz que esta medição não guarda impressão digital — e a API de Conversões
   * não pode virar a exceção que reabre isso pela porta dos fundos.
   */
  it('não manda impressão digital: sem IP, sem user-agent, sem e-mail', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, text: async () => '{}' });
    vi.stubGlobal('fetch', fetchSpy);

    const { enviarCompra } = await import('@/lib/meta-capi');
    await enviarCompra(contextoValido());

    const user = JSON.parse(fetchSpy.mock.calls[0]![1].body).data[0].user_data;
    for (const proibido of ['client_ip_address', 'client_user_agent', 'em', 'ph', 'external_id']) {
      expect(user[proibido], `${proibido} vazou para o corpo do evento`).toBeUndefined();
    }
    expect(Object.keys(user).sort()).toEqual(['fbc']);
  });

  it('sem identificador nenhum, não envia', async () => {
    /*
      A API aceitaria o evento e o descartaria do outro lado, por não ter a quem atribuir. Um
      sucesso aparente é pior que uma recusa: ele não aparece em lugar nenhum como problema.
    */
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const { enviarCompra } = await import('@/lib/meta-capi');
    const r = await enviarCompra({ ...contextoValido(), fbc: null, fbp: null });

    expect(r).toEqual({ enviado: false, motivo: 'sem_identificador' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('valor zero ou ilegível não vira evento', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const { enviarCompra } = await import('@/lib/meta-capi');
    for (const valor of [0, -1, Number.NaN]) {
      const r = await enviarCompra({ ...contextoValido(), valorEmReais: valor });
      expect(r.enviado, `valor ${valor} produziu evento`).toBe(false);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('quando o Meta falha', () => {
  it('erro de rede não derruba o webhook', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND graph.facebook.com')),
    );

    const { enviarCompra } = await import('@/lib/meta-capi');
    await expect(enviarCompra(contextoValido())).resolves.toEqual({
      enviado: false,
      motivo: 'erro_de_rede',
    });
  });

  it('recusa do Meta vira motivo legível, não exceção', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => 'token expirado' }),
    );

    const { enviarCompra } = await import('@/lib/meta-capi');
    const r = await enviarCompra(contextoValido());
    expect(r).toEqual({ enviado: false, motivo: 'http_400' });
  });
});

describe('sem configuração', () => {
  it('não tenta enviar quando falta a chave', async () => {
    delete process.env.META_CAPI_ACCESS_TOKEN;
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const { enviarCompra, capiConfigurada } = await import('@/lib/meta-capi');
    expect(capiConfigurada()).toBe(false);
    expect((await enviarCompra(contextoValido())).enviado).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

/**
 * ═══ A TRAVA CONTRA CONTAR A MESMA VENDA DUAS VEZES ══════════════════════════════════════════
 *
 * Duas fontes podem mandar a mesma compra: este envio e o pixel do navegador. Ligadas ao mesmo
 * tempo, dobram o retorno que o Meta calcula — e ninguém investiga um número que veio bom.
 *
 * A defesa é estrutural e mais forte que a deduplicação do Meta: as duas nunca estão ligadas juntas.
 */
describe('uma fonte de compra por vez', () => {
  it('a página de resultado não renderiza o pixel quando o servidor envia', () => {
    const fonte = readFileSync('src/app/resultado/[sessionId]/page.tsx', 'utf8');
    expect(fonte.includes('capiConfigurada()')).toBe(true);
    expect(
      fonte.includes('{!compraSaiDoServidor && ('),
      'o pixel do navegador voltou a disparar junto com o envio do servidor',
    ).toBe(true);
  });

  /**
   * ═══ UM REMETENTE, MESMO COM DOIS CAMINHOS DE CONCESSÃO ════════════════════════════════════
   *
   * O envio morava dentro do webhook até 19/09/2026, quando nasceu um segundo caminho que concede
   * compra: a recuperação manual em `/admin/vendas`, para o dia em que o gateway confirma e a
   * notificação não chega.
   *
   * Dois caminhos de concessão poderiam virar dois remetentes, e a duplicidade que este arquivo
   * inteiro existe para impedir voltaria pela porta de trás — não pelo pixel, mas por duas cópias
   * do mesmo `enviarCompra`. A saída foi extrair `concluir-compra.ts`: os dois caminhos concedem, e
   * **um só** manda.
   *
   * O teste continua exigindo exatamente um arquivo; o que mudou foi qual.
   */
  it('a compra sai de um lugar só, mesmo com webhook e recuperação manual', async () => {
    const { globSync } = await import('node:fs');
    const arquivos = globSync('src/**/*.{ts,tsx}');

    const remetentes = arquivos.filter((f) => {
      const conteudo = readFileSync(f, 'utf8');
      return conteudo.includes('enviarCompra(') && !f.endsWith('meta-capi.ts');
    });

    expect(remetentes, 'a compra passou a ser enviada de mais de um lugar').toEqual([
      'src/payments/concluir-compra.ts',
    ]);
  });

  /**
   * ═══ OS DOIS CAMINHOS DE COMPRA TERMINAM NA MESMA FUNÇÃO ═══════════════════════════════════
   *
   * Conceder compra acontece em dois lugares desde 19/09/2026: a notificação do gateway e a
   * recuperação manual. Os dois precisam fazer AS DUAS coisas que vêm depois — mandar a conversão
   * e mandar o recibo — e a única garantia de que fazem é chamarem a mesma função.
   *
   * O defeito que isto impede é silencioso: um caminho que mandasse o recibo por conta própria
   * entregaria o relatório ao cliente e deixaria a conversão para trás. Ninguém veria erro; a
   * diferença apareceria semanas depois, num CAC que não fecha.
   *
   * ─── POR QUE O CUPOM NÃO ENTRA NESTA REGRA ────────────────────────────────────────────────
   *
   * `planos/[sessionId]/actions.ts` também manda `reportReadyEmail`, e está certo: é o resgate de
   * CUPOM, que concede acesso sem pagamento e sem venda. Não há conversão para mandar ao Meta — e
   * mandar seria reportar uma compra que não existiu.
   */
  it('webhook e recuperação terminam em concluirCompra, e não mandam recibo por conta própria', () => {
    for (const arquivo of [
      'src/app/api/webhooks/payment/route.ts',
      'src/app/admin/vendas/acoes.ts',
    ]) {
      const fonte = readFileSync(arquivo, 'utf8');
      expect(fonte, `${arquivo} deixou de concluir a compra pelo caminho comum`).toContain(
        'concluirCompra(',
      );
      expect(fonte, `${arquivo} voltou a mandar o recibo sozinho`).not.toContain(
        'reportReadyEmail(',
      );
    }
  });
});
