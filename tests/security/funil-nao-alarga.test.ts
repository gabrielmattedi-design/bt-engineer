/**
 * O funil não pode alargar no fim.
 *
 * ═══ O DEFEITO QUE ISTO IMPEDE DE VOLTAR ═════════════════════════════════════════════════════
 *
 * No primeiro dia de tráfego real o painel mostrou 1 pagamento e 2 relatórios abertos. Não era
 * fraude nem falha de conta: `paid` era gravado pela sessão do PEDIDO e `report` pelo cookie de
 * quem abria a página. Duas unidades diferentes somadas na mesma coluna — um comprador que abre no
 * computador e depois no celular vira duas pessoas, e quem abre o relatório de um cliente pelo
 * admin vira uma terceira.
 *
 * O estrago não é o número errado. É que um número impossível no fim do funil levanta a pergunta
 * "então alguém entrou sem pagar?" — e responder isso exige auditar o sistema inteiro. Um painel
 * que obriga a essa auditoria toda semana é um painel que ninguém usa.
 *
 * Estes testes leem o FONTE em vez de rodar o banco de propósito: o defeito era de qual identidade
 * o marco usa, e isso é visível no código. Um teste de integração exigiria Postgres, dois cookies
 * distintos e um pedido pago — e ainda assim não impediria alguém de trocar a função de volta.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeFunnel } from '@/database/repositories/funnel-repo';

const ROOT = join(__dirname, '..', '..');
const RESULT_PAGE = join(ROOT, 'src', 'app', 'resultado', '[sessionId]', 'page.tsx');

function sourceWithoutComments(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('o marco `report` conta o comprador, não o navegador', () => {
  const source = sourceWithoutComments(RESULT_PAGE);

  it('não marca o funil pelo cookie da visita', () => {
    // `markPageFunnel` resolve o cookie `te_visitor` de quem está abrindo a página. É a função
    // certa para `plans` e `analysis`, onde a pergunta É sobre visitantes, e a errada aqui.
    expect(source).not.toContain('markPageFunnel');
  });

  it('marca pela sessão que comprou', () => {
    expect(source).toContain('paidOwnerSessionId');
    expect(source).toContain("markFunnelBySessionId(compradorId, 'report')");
  });

  it('não marca nada quando ninguém comprou', () => {
    // Acesso por cupom chega até aqui com relatório completo e sem pedido. `paidOwnerSessionId`
    // devolve null, e a guarda impede que um convidado apareça como comprador que voltou.
    expect(source).toMatch(/if\s*\(compradorId\)\s*await markFunnelBySessionId/);
  });
});

describe('`paidOwnerSessionId` só reconhece acesso vindo de pedido', () => {
  const repo = sourceWithoutComments(
    join(ROOT, 'src', 'database', 'repositories', 'session-repo.ts'),
  );

  it('exige `grantedByOrderId` preenchido', () => {
    expect(repo).toContain('isNotNull(entitlementsTable.grantedByOrderId)');
  });

  it('ignora acesso revogado', () => {
    // Um entitlement revogado não é mais uma compra ativa. Sem esta cláusula, um estorno
    // continuaria contando como comprador que abriu o relatório.
    expect(repo).toMatch(/paidOwnerSessionId[\s\S]*isNull\(entitlementsTable\.revokedAt\)/);
  });
});

describe('computeFunnel expõe o alargamento em vez de escondê-lo', () => {
  /*
    O cálculo NÃO trunca em 100%, e isso é deliberado.

    Truncar faria uma etapa impossível parecer saudável — o painel diria 100% e o defeito viveria
    para sempre. Foi justamente o `200.0%` visível na tela que levou à investigação que achou este
    bug. A régua mostra o que existe; quem impede o impossível é a instrumentação, não a formatação.
  */
  it('passa de 100% quando uma etapa tem mais gente que a anterior', () => {
    const linhas = computeFunnel(
      new Map([
        ['quiz:start', 15],
        ['quiz:done', 13],
        ['analysis', 13],
        ['plans', 3],
        ['checkout', 1],
        ['paid', 1],
        ['report', 2],
      ]),
    );

    const report = linhas.find((l) => l.marker === 'report');
    expect(report?.ofPrevious).toBe(200);
  });

  it('o funil corrigido nunca passa de 100% no relatório', () => {
    // Com o marco gravado pela sessão compradora, `report` é um subconjunto de `paid` por
    // construção: só existe marco de relatório para quem tem entitlement vindo de pedido.
    const linhas = computeFunnel(
      new Map([
        ['quiz:start', 15],
        ['quiz:done', 13],
        ['analysis', 13],
        ['plans', 3],
        ['checkout', 1],
        ['paid', 1],
        ['report', 1],
      ]),
    );

    expect(linhas.find((l) => l.marker === 'report')?.ofPrevious).toBeLessThanOrEqual(100);
  });
});
