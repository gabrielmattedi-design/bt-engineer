import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * ═══ APAGAR E DIMINUIR CUPOM — DUAS AÇÕES QUE FALTAVAM, COM UMA TRAVA CADA ═══════════════════
 *
 * O dono pediu em 22/09: *"além de desativar, tivesse a opção de apagar aquele cupom específico.
 * Bem como opção de ajustar o número atual de cupons disponíveis, porque tem opção para recarregar,
 * mas não para diminuir"*.
 *
 * As duas são legítimas e faltavam mesmo. O que estes testes travam é o que cada uma NÃO pode
 * fazer — porque nos dois casos o jeito óbvio de implementar destrói informação em silêncio.
 */
const REPO = readFileSync('src/database/repositories/coupon-repo.ts', 'utf8');
const ACOES = readFileSync('src/app/admin/codigos/actions.ts', 'utf8');
const FORMULARIO = readFileSync('src/app/admin/codigos/ajustar-form.tsx', 'utf8');

const bloco = (fonte: string, nome: string): string =>
  new RegExp(`export async function ${nome}\\([\\s\\S]*?\\n\\}\\n`).exec(fonte)?.[0] ?? '';

describe('apagar cupom não pode apagar história', () => {
  const FUNCAO = bloco(REPO, 'removerCupom');

  it('a função existe', () => {
    expect(FUNCAO, 'removerCupom sumiu ou mudou de forma').not.toBe('');
  });

  /**
   * ⚠️ A TRAVA CENTRAL.
   *
   * `coupon_redemptions.code` e `orders.coupon_code` são texto solto, sem chave estrangeira. Apagar
   * um cupom usado não apaga nada disso — deixa resgates e pedidos apontando para um código que não
   * existe mais.
   *
   * O custo é concreto: some a explicação de um pedido de R$ 39,99 no meio de uma lista de
   * R$ 49,99, e a pergunta que `coupon_redemptions` existe para responder ("quem entrou pelo
   * DJOKOINSS?") fica sem resposta com o rastro intacto e órfão.
   */
  it('recusa apagar cupom que já foi usado', () => {
    expect(FUNCAO, 'a recusa por histórico caiu').toContain('tem_historico');
    expect(FUNCAO, 'o DELETE deixou de ser condicionado ao zero').toMatch(
      /if \(usos > 0\) return \{ kind: 'tem_historico'[\s\S]*?delete\(accessCoupons\)/,
    );
  });

  /**
   * A checagem é DUPLA — contador e tabela de resgates — porque os dois podem divergir se alguém
   * mexer no `used_count` à mão. Quem manda é o que tem histórico, e por isso o `Math.max`.
   */
  it('confere o contador E a tabela de resgates', () => {
    expect(FUNCAO).toContain('couponRedemptions');
    expect(FUNCAO, 'a checagem deixou de considerar as duas fontes').toMatch(
      /Math\.max\(linha\.usedCount,\s*Number\(resgates/,
    );
  });

  /**
   * A confirmação viaja no FORMULÁRIO, e não num `confirm()` do navegador.
   *
   * A ação de servidor precisa receber a intenção junto do pedido: sem isso, um F5 depois de apagar
   * reenviaria o POST e apagaria outro código sem ninguém ter confirmado de novo.
   */
  it('a exclusão exige confirmação vinda no próprio pedido', () => {
    expect(bloco(ACOES, 'excluirCodigo')).toMatch(/formData\.get\('confirmar'\)[\s\S]{0,60}'sim'/);
    expect(FORMULARIO).toMatch(/name="confirmar"/);
  });

  /** A recusa precisa dizer o que fazer, senão o dono fica tentando o mesmo botão. */
  it('a recusa aponta para Desativar', () => {
    expect(bloco(ACOES, 'excluirCodigo')).toContain('Desativar');
  });
});

describe('diminuir usos não pode mentir sobre o passado', () => {
  const FUNCAO = bloco(REPO, 'definirUsosRestantes');

  it('a função existe', () => {
    expect(FUNCAO, 'definirUsosRestantes sumiu ou mudou de forma').not.toBe('');
  });

  /**
   * ⚠️ O teto é `usados + restantes`, e é isso que impede o estado incoerente.
   *
   * Editar o TETO diretamente permitiria pôr um número abaixo do já consumido — um cupom que diz
   * "8 de 5 usos". Por esta construção, `usados ≤ teto` vale sempre, e o contador nunca precisa ser
   * mexido para a conta fechar.
   */
  it('o teto nunca fica abaixo do já consumido', () => {
    expect(FUNCAO, 'o teto deixou de ser calculado a partir dos usos').toMatch(
      /maxUses: sql`\$\{accessCoupons\.usedCount\} \+ \$\{restantes\}`/,
    );
  });

  /** Zero restantes é pedido legítimo — esgota sem apagar. Recusá-lo tiraria metade do recurso. */
  it('aceita zero', () => {
    expect(FUNCAO).toMatch(/restantes < 0/);
    expect(FUNCAO, 'zero deixou de ser aceito').not.toMatch(/restantes < 1|restantes <= 0/);
  });

  /**
   * ⚠️ `active` NÃO é tocado — ao contrário de `addCouponUses`, que reativa de propósito.
   *
   * Diminuir um código desativado e vê-lo voltar à vida seria o oposto exato do que se pediu, e o
   * jeito mais fácil de isso acontecer é alguém copiar o `set` da recarga.
   */
  it('não reativa o cupom ao diminuir', () => {
    expect(FUNCAO, 'diminuir voltou a reativar o cupom').not.toMatch(/active:\s*true/);
  });

  /**
   * O contador de usos é intocável: ele é o espelho de `coupon_redemptions`. Zerá-lo faria as duas
   * fontes discordarem sobre o mesmo fato — é a razão pela qual a recarga soma ao teto em vez de
   * zerar o contador, e vale igual aqui.
   */
  it('não mexe no contador de usos', () => {
    expect(FUNCAO, 'o contador de usos passou a ser reescrito').not.toMatch(/usedCount:\s*\d/);
  });
});
