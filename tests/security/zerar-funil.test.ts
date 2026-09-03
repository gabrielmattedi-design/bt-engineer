/**
 * ZERAR MEDIÇÃO NÃO PODE APAGAR VENDA.
 *
 * ═══ O PEDIDO ════════════════════════════════════════════════════════════════════════════════
 *
 * Do dono, na véspera do lançamento: "consegue zerar agora o funil, para eu ter real ideia do
 * público quando lançar?"
 *
 * A razão é boa. Todo marco gravado até ali era ele mesmo testando — dezenas de questionários,
 * pagamentos aprovados e recusados, telas abertas e reabertas. Um funil que soma o dono ao público
 * não mede o público, e engana para o lado otimista: quem testa completa o fluxo inteiro muito
 * mais do que um visitante real.
 *
 * ═══ O RISCO QUE ESTE ARQUIVO EXISTE PARA TRANCAR ════════════════════════════════════════════
 *
 * "Zerar" é uma palavra perigosa perto de um banco que guarda pedidos pagos. A limpeza tem de
 * atingir as duas tabelas de MEDIÇÃO e nenhuma outra — `orders`, `recommendation_sessions`,
 * `entitlements`, `users` e `coupons` são registro de operação, e algumas delas são o que sustenta
 * o acesso de quem já pagou. Apagar uma linha dessas para limpar um gráfico seria destruir a
 * entrega de um cliente.
 *
 * O defeito seria silencioso do pior jeito: depois de zerar, o painel mostra zeros — exatamente o
 * esperado de quem acabou de zerar de propósito. Ninguém desconfia. O cliente que perdeu o acesso
 * descobre sozinho, dias depois.
 *
 * Os testes leem o código-fonte em vez de rodar contra um banco porque é o alcance da limpeza que
 * precisa ficar preso, e ele está escrito na função: as tabelas que ela cita.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const ler = (...p: string[]): string => readFileSync(join(ROOT, ...p), 'utf8');

const repo = ler('src', 'database', 'repositories', 'funnel-repo.ts');
const acoes = ler('src', 'app', 'admin', 'actions.ts');
const formulario = ler('src', 'app', 'admin', 'funil', 'reset-form.tsx');

/** O corpo de `resetFunnel`, isolado — é o alcance dele que importa, não o arquivo inteiro. */
const corpoDoReset = /export async function resetFunnel\([\s\S]*?\n}/.exec(repo)?.[0] ?? '';

describe('o alcance da limpeza', () => {
  it('existe uma função de reset', () => {
    expect(corpoDoReset, 'não achei `resetFunnel` no repositório do funil').not.toBe('');
  });

  it('apaga as duas tabelas de medição', () => {
    expect(corpoDoReset, 'os marcos do funil deixaram de ser apagados').toContain('funnelMarkers');
    expect(corpoDoReset, 'as origens de tráfego deixaram de ser apagadas').toContain(
      'visitorCampaigns',
    );
  });

  /**
   * A regra que de fato protege o cliente. Qualquer tabela de operação citada dentro desta função
   * é, por definição, um `delete` que não deveria existir — não há outro motivo para nomeá-la ali.
   */
  it('não encosta em nenhuma tabela de operação', () => {
    const PROIBIDAS = [
      'orders',
      'payments',
      'entitlements',
      'recommendationSessions',
      'anonymousSessions',
      'users',
      'coupons',
      'products',
    ];
    for (const tabela of PROIBIDAS) {
      expect(
        corpoDoReset,
        `resetFunnel cita "${tabela}" — zerar métrica não pode apagar venda nem acesso`,
      ).not.toContain(tabela);
    }
  });

  /** Um `delete` sem `where` já é amplo demais; um SQL cru aqui escaparia da revisão acima. */
  it('não usa SQL cru para apagar', () => {
    expect(corpoDoReset, 'SQL cru dentro do reset escapa da conferência de alcance').not.toMatch(
      /sql`|TRUNCATE|DROP/i,
    );
  });
});

describe('as travas antes de apagar', () => {
  /**
   * Uma Server Action é um endpoint HTTP e pode ser chamada direto, sem passar por renderização
   * nenhuma. Numa ação destrutiva, conferir só na página é a aparência de uma proteção.
   */
  it('a ação revalida a autenticação por conta própria', () => {
    const acao = /export async function resetarFunil\([\s\S]*?\n}/.exec(acoes)?.[0] ?? '';
    expect(acao, 'não achei a ação').not.toBe('');
    expect(acao, 'a ação destrutiva parou de conferir a sessão').toContain('isAuthenticated');

    const posAuth = acao.indexOf('isAuthenticated');
    const posReset = acao.indexOf('resetFunnel');
    expect(posReset, 'não achei a chamada da limpeza').toBeGreaterThan(-1);
    expect(posAuth, 'a autenticação passou a ser conferida depois de apagar').toBeLessThan(posReset);
  });

  /**
   * A confirmação digitada é revalidada no SERVIDOR. A do formulário é conveniência — quem chama a
   * ação direto não passa por formulário nenhum.
   */
  it('a palavra de confirmação é exigida no servidor, antes de apagar', () => {
    const acao = /export async function resetarFunil\([\s\S]*?\n}/.exec(acoes)?.[0] ?? '';
    expect(acao, 'a confirmação digitada deixou de ser exigida').toContain('CONFIRMACAO_ZERAR');

    const posConfirma = acao.indexOf('CONFIRMACAO_ZERAR');
    const posReset = acao.indexOf('resetFunnel');
    expect(posConfirma, 'a confirmação passou a ser conferida depois de apagar').toBeLessThan(
      posReset,
    );
  });

  it('confirmação errada não apaga nada, e diz isso', () => {
    expect(acoes).toMatch(/Nada foi apagado/);
  });
});

describe('o que a tela promete', () => {
  /**
   * A tela precisa dizer as duas coisas que decidem o clique: que não tem volta, e que a venda
   * não é tocada. Sem a primeira, alguém zera sem pesar; sem a segunda, ninguém ousa zerar.
   */
  it('avisa que não tem volta', () => {
    expect(formulario).toMatch(/Não tem volta/i);
  });

  it('diz o que NÃO é apagado', () => {
    expect(formulario, 'a tela não tranquiliza sobre pedidos e acessos').toMatch(
      /Pedidos, análises, acessos e cupons não são tocados/,
    );
  });

  /** Recolhido atrás de um link: o único controle destrutivo do painel não fica à mão. */
  it('fica recolhido até ser pedido', () => {
    expect(formulario).toContain('useState');
    expect(formulario).toMatch(/setOpen\(true\)/);
  });
});
