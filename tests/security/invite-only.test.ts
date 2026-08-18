/**
 * Modo convite — o checkout fecha por inteiro, e fecha mais forte que a configuração que ele corrige.
 *
 * ═══ O PROBLEMA ══════════════════════════════════════════════════════════════════════════════
 *
 * O checkout simulado libera o relatório sem cobrar. Isso é útil enquanto só o dono percorre o
 * funil e vira um problema no minuto em que o link sai da mão dele: quem recebe repassa, e o
 * produto pago vira gratuito para quem tiver a URL.
 *
 * ═══ O QUE ESTE TESTE TRANCA ═════════════════════════════════════════════════════════════════
 *
 * A PRECEDÊNCIA, que é a parte fácil de quebrar sem perceber. `ALLOW_FAKE_PAYMENTS=true` e o
 * interruptor de demonstração continuam existindo e continuam ligando o simulado; o modo convite
 * precisa vencer os dois. Se algum dia a ordem se inverter, o dono liga o convite, acredita que
 * fechou, e continua distribuindo acesso grátis por uma chave esquecida em outro lugar — sem
 * nenhum sintoma visível.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

const ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ENV };
  vi.resetModules();
  vi.unstubAllEnvs();
});

/** Importa o módulo já com o ambiente montado — ele lê `process.env` na chamada. */
async function loadMode(env: Record<string, string | undefined>, inviteInDb: boolean) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) vi.stubEnv(key, '');
    else vi.stubEnv(key, value);
  }

  vi.doMock('@/database/repositories/settings-repo', () => ({
    inviteOnlyEnabledInDatabase: async () => inviteInDb,
    simulatedPaymentsEnabledInDatabase: async () => false,
  }));

  return import('@/payments/mode');
}

describe('acesso só por convite', () => {
  it('fecha o checkout mesmo com ALLOW_FAKE_PAYMENTS=true', async () => {
    const mode = await loadMode(
      { NODE_ENV: 'production', ALLOW_FAKE_PAYMENTS: 'true', INVITE_ONLY: 'true' },
      false,
    );

    // O simulado continua "permitido" — o convite é que vence depois.
    expect(await mode.simulatedPaymentsAllowed()).toBe(true);
    expect(await mode.checkoutOpen()).toBe(false);
  });

  it('fecha o checkout quando ligado só pelo painel', async () => {
    const mode = await loadMode(
      { NODE_ENV: 'production', ALLOW_FAKE_PAYMENTS: 'true', INVITE_ONLY: '' },
      true,
    );

    expect(await mode.inviteOnlyAccess()).toBe(true);
    expect(await mode.checkoutOpen()).toBe(false);
  });

  /**
   * O convite não pode fechar um gateway REAL sem querer: fora do modo, quem contratou provedor de
   * verdade precisa continuar vendendo.
   */
  it('com gateway real e sem convite, o checkout segue aberto', async () => {
    const mode = await loadMode(
      { NODE_ENV: 'production', PAYMENT_PROVIDER: 'stripe', INVITE_ONLY: '' },
      false,
    );

    expect(await mode.checkoutOpen()).toBe(true);
  });

  /** E com o convite ligado, nem o gateway real abre — é uma decisão de produto, não de provedor. */
  it('o convite fecha o checkout inclusive com gateway real', async () => {
    const mode = await loadMode(
      { NODE_ENV: 'production', PAYMENT_PROVIDER: 'stripe', INVITE_ONLY: 'true' },
      false,
    );

    expect(await mode.checkoutOpen()).toBe(false);
  });

  it('sem convite e sem provedor utilizável em produção, o checkout fica fechado', async () => {
    const mode = await loadMode(
      { NODE_ENV: 'production', ALLOW_FAKE_PAYMENTS: '', INVITE_ONLY: '' },
      false,
    );

    expect(await mode.checkoutOpen()).toBe(false);
  });

  it('a recusa exibida ao visitante não fala de configuração', async () => {
    const mode = await loadMode({ INVITE_ONLY: 'true' }, false);

    // Quem lê é o convidado, não o administrador: nada de env var, painel ou provedor.
    for (const termo of ['ALLOW_FAKE', 'admin', 'PAYMENT_PROVIDER', 'gateway']) {
      expect(mode.INVITE_ONLY_MESSAGE).not.toContain(termo);
    }
    expect(mode.INVITE_ONLY_MESSAGE).toContain('convite');
  });
});
