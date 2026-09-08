/**
 * O evento de compra do pixel — as travas contra contar a mesma venda duas vezes.
 *
 * ═══ POR QUE ISTO IMPORTA MAIS QUE PARECE ════════════════════════════════════════════════════
 *
 * A campanha vai otimizar POR ESTE EVENTO, e a decisão de escalar sai do retorno que o Meta calcula
 * com ele. Contar a mesma compra duas vezes dobra o retorno aparente — e ninguém investiga um
 * número que veio bom.
 *
 * O modo de falha é mundano: o comprador recarrega a página do relatório, ou reabre uma semana
 * depois o link que guardou. As duas coisas acontecem o tempo todo.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const FONTE = 'src/components/marketing/purchase-pixel.tsx';

describe('as travas do evento de compra', () => {
  it('exige o sinal de que a compra acabou de acontecer', () => {
    const fonte = readFileSync(FONTE, 'utf8');
    expect(
      fonte.includes("searchParams.get('compra')"),
      'sem checar o parâmetro, reabrir o relatório contaria uma venda nova',
    ).toBe(true);
  });

  it('guarda uma marca para o recarregamento não contar de novo', () => {
    const fonte = readFileSync(FONTE, 'utf8');
    expect(fonte.includes('localStorage')).toBe(true);
    expect(
      fonte.includes('setItem'),
      'ler sem gravar não é trava nenhuma — o F5 seguinte contaria outra vez',
    ).toBe(true);
  });

  /**
   * O parâmetro `?compra=1` só pode nascer no redirecionamento pós-pagamento.
   *
   * Se qualquer outro lugar do sistema passasse a produzi-lo, a trava principal cairia sem que
   * nenhum teste de comportamento percebesse.
   */
  it('só a página de retorno produz o sinal de compra', async () => {
    const { globSync } = await import('node:fs');
    const arquivos = globSync('src/**/*.{ts,tsx}');

    const produtores = arquivos.filter((f) => {
      const conteudo = readFileSync(f, 'utf8');
      return conteudo.includes('compra=1') && !f.includes('purchase-pixel');
    });

    expect(produtores, 'o sinal de compra passou a ser produzido em mais de um lugar').toEqual([
      'src/app/retorno/[sessionId]/page.tsx',
    ]);
  });
});

/**
 * ═══ O VALOR: NUNCA UMA MÉDIA, NUNCA ZERO ════════════════════════════════════════════════════
 *
 * O Meta calcula retorno sobre o número que recebe. Um valor inventado — a média, ou zero — produz
 * um retorno que o dinheiro não sustenta, e a decisão de escalar sairia dele.
 *
 * A regra é: sem valor legível, o evento não vai. Um evento a menos deixa o número menor; um evento
 * com valor errado deixa o número errado, que é pior porque não parece.
 */
describe('o valor da compra', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('soma todos os pedidos pagos da mesma análise', async () => {
    /*
      Upsells existem: quem compra o relatório e depois o setup fez dois pedidos pagos para a mesma
      análise. O valor da conversão é o total, não o do primeiro pedido — senão o Meta subestima
      exatamente os compradores mais valiosos.
    */
    const fonte = readFileSync('src/database/repositories/commerce-repo.ts', 'utf8');
    const funcao = fonte.slice(fonte.indexOf('export async function valorPagoEmReais'));
    expect(funcao.includes('reduce'), 'o valor deveria somar os pedidos, não pegar o primeiro').toBe(
      true,
    );
    expect(funcao.includes("eq(orders.status, 'paid')"), 'só pedido pago pode contar').toBe(true);
  });

  it('não dispara quando o valor é nulo ou zero', () => {
    const fonte = readFileSync(FONTE, 'utf8');
    expect(
      fonte.includes('valorEmReais === null || valorEmReais <= 0'),
      'sem esta guarda, uma compra sem valor legível viraria um evento de R$ 0 ou NaN',
    ).toBe(true);
  });
});
