/**
 * O funil de pagamento nunca devolve "Application error" ao usuário.
 *
 * Um Server Action que lança produz, no navegador, "a server-side exception has occurred" mais um
 * número de digest — e nada mais. Foi assim que uma recusa CORRETA e bem explicada do provedor
 * simulado ("configure ALLOW_FAKE_PAYMENTS…") chegou ao dono do site como "Digest: 1191712468".
 *
 * O prejuízo é duplo: o visitante acha que o site quebrou, e quem poderia consertar não recebe a
 * instrução que já estava escrita. Estes testes trancam o contrário — toda falha vira frase útil,
 * e nenhuma vaza detalhe técnico de infraestrutura.
 */

import { describe, expect, it } from 'vitest';
import { describeCheckoutFailure } from '@/payments/checkout-errors';
import { SIMULATED_PAYMENTS_BLOCKED } from '@/payments/mode';

describe('mensagens de falha do checkout', () => {
  it('a recusa do provedor simulado vira instrução acionável', () => {
    const msg = describeCheckoutFailure(new Error(SIMULATED_PAYMENTS_BLOCKED));
    expect(msg).toContain('ALLOW_FAKE_PAYMENTS');
    expect(msg).toContain('deploy');
  });

  it('adapter não implementado é repassado com o motivo', () => {
    const msg = describeCheckoutFailure(
      new Error('O adapter "mercadopago" ainda não foi implementado.'),
    );
    expect(msg).toContain('mercadopago');
  });

  it('banco ausente é dito em português, sem jargão de driver', () => {
    const msg = describeCheckoutFailure(new Error('DATABASE_URL é obrigatória em produção.'));
    expect(msg).toContain('banco de dados');
  });

  it('qualquer erro produz frase, nunca vazio', () => {
    for (const input of [new Error('boom'), 'string solta', null, undefined, 42]) {
      const msg = describeCheckoutFailure(input);
      expect(msg.length, String(input)).toBeGreaterThan(20);
    }
  });

  /**
   * O erro cru pode carregar a string de conexão inteira — usuário, senha e host do Postgres.
   * Repassá-la ao navegador seria vazar credencial numa tela pública.
   */
  it('NÃO vaza credencial nem host interno do erro genérico', () => {
    const leaky = new Error(
      'connect ECONNREFUSED postgresql://admin:s3nh4@db.interno.local:5432/tennis',
    );
    const msg = describeCheckoutFailure(leaky);
    expect(msg).not.toContain('s3nh4');
    expect(msg).not.toContain('db.interno.local');
    expect(msg).not.toContain('postgresql://');
  });

  it('o genérico diz onde procurar em vez de só constatar a falha', () => {
    const msg = describeCheckoutFailure(new Error('erro desconhecido'));
    expect(msg).toContain('log do servidor');
  });
});
