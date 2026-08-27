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

/**
 * As falhas do Mercado Pago não podem cair no genérico.
 *
 * O genérico manda conferir `DATABASE_URL` e `PAYMENT_PROVIDER`. Em toda falha do gateway essas
 * duas variáveis estão CERTAS — a frase manda procurar onde o problema não está, e quem for atrás
 * vai conferir duas configurações corretas com o funil de pagamento parado.
 */
describe('falhas do Mercado Pago', () => {
  const generico = /DATABASE_URL/;

  it('rede inacessível não vira "confira suas variáveis"', () => {
    const msg = describeCheckoutFailure(
      new Error('Mercado Pago inacessível a partir do servidor.', { cause: new Error('fetch failed') }),
    );
    expect(msg).not.toMatch(generico);
    expect(msg).toMatch(/fora do ar|bloqueada/);
  });

  it('credencial recusada aponta a conta, não a configuração do site', () => {
    const msg = describeCheckoutFailure(
      new Error('O Mercado Pago recusou a criação do checkout (HTTP 401). {"message":"invalid_token"}'),
    );
    expect(msg).not.toMatch(generico);
    expect(msg).toMatch(/Access Token/);
    // A pista que resolve o caso mais comum: os tokens de teste e de produção são idênticos de olhar.
    expect(msg).toMatch(/mesma aparência/);
  });

  it('403 recebe o mesmo diagnóstico de 401', () => {
    const um = describeCheckoutFailure(new Error('O Mercado Pago recusou (HTTP 401).'));
    const outro = describeCheckoutFailure(new Error('O Mercado Pago recusou (HTTP 403).'));
    expect(outro).toBe(um);
  });

  it('variável ausente diz QUAL falta e que o deploy precisa ser refeito', () => {
    const msg = describeCheckoutFailure(new Error('MERCADOPAGO_ACCESS_TOKEN não configurado. …'));
    expect(msg).toContain('MERCADOPAGO_ACCESS_TOKEN');
    expect(msg).toContain('deploy');
    expect(msg).not.toContain('MERCADOPAGO_WEBHOOK_SECRET');
  });

  it('a recusa genérica do gateway não devolve o corpo da resposta ao navegador', () => {
    /*
      O corpo de erro do Mercado Pago traz `cause`, `caller_id` e mensagens em inglês. Nada disso
      ajuda quem está lendo a tela, e o `caller_id` identifica a conta que vende — informação que
      não tem por que aparecer no navegador de um visitante.
    */
    const msg = describeCheckoutFailure(
      new Error(
        'O Mercado Pago recusou a criação do checkout (HTTP 400). ' +
          '{"caller_id":3646483422,"message":"invalid_items"}',
      ),
    );
    expect(msg).not.toContain('3646483422');
    expect(msg).not.toContain('invalid_items');
    expect(msg).toMatch(/log do servidor/);
  });
});
