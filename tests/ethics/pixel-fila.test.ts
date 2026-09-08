/**
 * A fila de eventos do pixel — e as duas coisas opostas que ela não pode fazer.
 *
 * ═══ POR QUE ESTE ARQUIVO EXISTE ═════════════════════════════════════════════════════════════
 *
 * Em 08/09/2026, com o site rodando, a fila do `fbq` ao abrir `/questionario` continha `init` e
 * `PageView` e NÃO continha o `Lead` — o evento pelo qual a campanha inteira otimiza. A causa era a
 * ordem dos efeitos no React: os efeitos dos filhos rodam antes dos do pai, o banner (que injeta o
 * pixel) mora no layout, e o questionário chamava `Lead` antes de `fbq` existir. O evento era
 * descartado em silêncio.
 *
 * A correção — uma fila que segura o evento até o script entrar — resolve isso e cria um risco
 * novo, oposto e pior: **guardar evento de quem recusou e mandar depois.** Os dois casos estão
 * cobertos aqui, e o segundo é o que não pode falhar nunca.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CONSENT_COOKIE } from '@/lib/consent';

/** `document.cookie` e `window.fbq` controlados à mão — é o que decide os dois caminhos. */
function prepararDom(cookie: string) {
  vi.stubGlobal('document', { cookie });
  vi.stubGlobal('window', {} as Window);
}

function ligarFbq(): { chamadas: unknown[][] } {
  const chamadas: unknown[][] = [];
  (globalThis as unknown as { window: Window & { fbq?: unknown } }).window.fbq = (
    ...args: unknown[]
  ) => {
    chamadas.push(args);
  };
  return { chamadas };
}

/* O módulo guarda a fila em estado de módulo, então cada teste precisa de uma instância limpa. */
async function carregarModulo() {
  vi.resetModules();
  return import('@/lib/meta-pixel');
}

describe('a fila do pixel', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('segura o evento que chega antes do pixel, e despacha quando ele entra', async () => {
    prepararDom(`${CONSENT_COOKIE}=aceito`);
    const { metaInicioDeQuestionario, metaDescarregarFila } = await carregarModulo();

    /* O caso real: o questionário monta antes de o banner injetar o script. */
    metaInicioDeQuestionario();

    const { chamadas } = ligarFbq();
    expect(chamadas, 'nada pode ser enviado antes de o pixel existir').toHaveLength(0);

    metaDescarregarFila();

    expect(chamadas, 'o Lead se perdeu — é o defeito de 08/09/2026 de volta').toHaveLength(1);
    expect(chamadas[0]?.[1]).toBe('Lead');
  });

  /**
   * ═══ O RISCO QUE A PRÓPRIA CORREÇÃO CRIOU ══════════════════════════════════════════════════
   *
   * Uma fila que espera é, por definição, um lugar onde eventos ficam guardados. Se ela guardar o
   * que aconteceu ANTES do consentimento e despachar quando a pessoa aceita, o produto passa a
   * aplicar o "sim" retroativamente — que não é consentimento, é registro disfarçado de permissão.
   *
   * Por isso `metaEvento` lê o cookie a cada chamada, em vez de inferir consentimento da existência
   * do `fbq`. Este teste é o que impede alguém de "simplificar" isso de volta.
   */
  it('NUNCA guarda evento de quem não consentiu, mesmo que aceite depois', async () => {
    for (const cookieInicial of ['', `${CONSENT_COOKIE}=recusado`]) {
      vi.unstubAllGlobals();
      prepararDom(cookieInicial);
      const { metaInicioDeQuestionario, metaDescarregarFila } = await carregarModulo();

      metaInicioDeQuestionario();
      metaInicioDeQuestionario();

      /* A pessoa muda de ideia e aceita — o pixel entra agora. */
      (globalThis as unknown as { document: { cookie: string } }).document.cookie =
        `${CONSENT_COOKIE}=aceito`;
      const { chamadas } = ligarFbq();
      metaDescarregarFila();

      expect(
        chamadas,
        `com o cookie "${cookieInicial || '(ausente)'}", os eventos anteriores ao aceite não podem ser enviados`,
      ).toHaveLength(0);
    }
  });

  it('sem consentimento não envia, mesmo com o pixel já carregado', async () => {
    prepararDom(`${CONSENT_COOKIE}=recusado`);
    const { metaInicioDeQuestionario } = await carregarModulo();
    const { chamadas } = ligarFbq();

    metaInicioDeQuestionario();

    expect(chamadas).toHaveLength(0);
  });

  /**
   * A fila só cresce na janela entre o aceite e o script entrar. Sem teto, um script bloqueado por
   * extensão numa navegação longa a faria crescer para sempre — vazamento de memória silencioso,
   * do tipo que ninguém liga a um pixel.
   */
  it('tem teto, e não cresce sem limite quando o pixel nunca entra', async () => {
    prepararDom(`${CONSENT_COOKIE}=aceito`);
    const { metaInicioDeQuestionario, metaDescarregarFila } = await carregarModulo();

    for (let i = 0; i < 500; i++) metaInicioDeQuestionario();

    const { chamadas } = ligarFbq();
    metaDescarregarFila();

    expect(chamadas.length, 'a fila cresceu sem limite').toBeLessThanOrEqual(20);
    expect(chamadas.length, 'a fila deveria ter guardado até o teto').toBeGreaterThan(0);
  });
});
