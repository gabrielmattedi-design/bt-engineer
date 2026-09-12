/**
 * Pessoas ≠ vendas, e o painel precisa dizer qual é qual.
 *
 * ═══ A DIVERGÊNCIA QUE ORIGINOU ISTO, E QUE CONTINUA ABERTA (12/09/2026) ═════════════════════
 *
 * O dono leu "Pagou: 5" no `/admin/funil` com filtro "Hoje" e contou **7** na lista de
 * `/admin/vendas` no mesmo dia. **Não se sabe qual está certo.**
 *
 * ─── A HIPÓTESE QUE EU DEI COMO CERTA, E QUE NÃO SE SUSTENTOU ────────────────────────────────
 *
 * `funnel_markers` tem restrição única em (visitante, marco): um visitante só tem UM marco `paid`
 * na vida. Daí o funil não contar cliente que volta — logo o número real seria 7, e o funil
 * subestimaria. Escrevi isso num commit e num documento **sem ter verificado dado nenhum**.
 *
 * O dono derrubou com duas coisas: chegaram **5 e-mails do Mercado Pago**, um por pagamento
 * recebido — um terceiro independente também dizendo 5 — e o produto é de compra única, então
 * dois clientes recomprando no mesmo dia é improvável.
 *
 * E o código não fecha com nenhum dos lados: o único caminho para um pedido virar `paid` é um
 * evento do gateway, e com `PAYMENT_PROVIDER` real o adapter simulado nem é construído. Em tese,
 * 7 pedidos pagos exigiriam 7 eventos e 7 e-mails.
 *
 * ─── O QUE ESTES TESTES TRAVAM, ENTÃO ────────────────────────────────────────────────────────
 *
 * Não a explicação — ela não existe ainda. Travam o MECANISMO que torna os dois números
 * legitimamente diferentes (a restrição única), o fato de a contagem de vendas contar pedidos e
 * não pessoas, e que a tela diga qual é qual em vez de mostrar dois números sem nome.
 *
 * E travam que o documento **não volte a afirmar** qual dos dois usar para CAC enquanto a
 * divergência estiver aberta. Foi assim que o erro nasceu: hipótese virando instrução escrita.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const raiz = join(__dirname, '..', '..');
const ler = (caminho: string) => readFileSync(join(raiz, caminho), 'utf8');

const SCHEMA_FUNIL = ler('src/database/schema/funnel.ts');
const COMMERCE_REPO = ler('src/database/repositories/commerce-repo.ts');
const PAGINA_DO_FUNIL = ler('src/app/admin/funil/page.tsx');
const DOC_DA_CAMPANHA = ler('docs/COMO_SUBIR_A_CAMPANHA.md');

describe('a restrição que cria a diferença continua existindo', () => {
  /**
   * Se alguém remover esta única, o funil passa a contar um marco por PAGAMENTO e a taxa de
   * conversão vira mentira — 200% de quem abre o questionário "chega a pagar" no dia em que dois
   * clientes antigos voltam. A restrição é o que faz o número do funil significar alguma coisa.
   */
  it('um visitante tem no máximo um marco `paid`', () => {
    expect(SCHEMA_FUNIL).toMatch(/unique\(\s*'funnel_markers_visitor_marker_key'\s*\)/);
    expect(SCHEMA_FUNIL).toMatch(/\.on\(\s*t\.visitorHash\s*,\s*t\.marker\s*\)/);
  });
});

describe('a contagem de vendas conta PEDIDOS, e não pessoas', () => {
  it('existe e conta linhas de `orders`', () => {
    expect(COMMERCE_REPO).toContain('export async function contarVendas');
    expect(COMMERCE_REPO).toMatch(/count\(\*\)/);
  });

  /**
   * `count(*)` e nunca `count(distinct ...)`.
   *
   * Um `distinct` por usuário aqui reproduziria exatamente o número do funil e apagaria a
   * diferença que esta tela existe para mostrar — o pior desfecho possível, porque os dois
   * números passariam a bater e ninguém investigaria de novo.
   */
  it('não agrupa por pessoa', () => {
    const corpo = COMMERCE_REPO.slice(
      COMMERCE_REPO.indexOf('export async function contarVendas'),
      COMMERCE_REPO.indexOf('export async function vendasDesde'),
    );
    expect(corpo).not.toMatch(/count\(distinct/i);
  });

  /**
   * A janela corta por `paid_at`, o instante do pagamento.
   *
   * Por `created_at` do pedido, um checkout aberto às 23h50 e pago às 00h05 cairia no dia
   * anterior ao do dinheiro — e no dia seguinte ao do marco `paid` do funil, que nasce quando o
   * webhook confirma. As duas linhas da mesma tela discordariam do dia.
   */
  it('recorta pela data do PAGAMENTO', () => {
    const corpo = COMMERCE_REPO.slice(
      COMMERCE_REPO.indexOf('export async function contarVendas'),
      COMMERCE_REPO.indexOf('export async function vendasDesde'),
    );
    expect(corpo).toContain('recorte(orders.paidAt');
  });

  /** Cupom não é venda — a lista já respeitava isto, e a contagem precisa respeitar igual. */
  it('só conta pedido com status `paid`', () => {
    const corpo = COMMERCE_REPO.slice(
      COMMERCE_REPO.indexOf('export async function contarVendas'),
      COMMERCE_REPO.indexOf('export async function vendasDesde'),
    );
    expect(corpo).toMatch(/eq\(orders\.status,\s*'paid'\)/);
  });
});

describe('a tela mostra os dois números com o nome do que medem', () => {
  it('o painel do funil pede a contagem de vendas', () => {
    expect(PAGINA_DO_FUNIL).toContain('contarVendas');
  });

  /**
   * Não basta mostrar os dois: sem dizer que um é gente e o outro é pedido, duas linhas com
   * números diferentes lado a lado leem como defeito — que foi exatamente a pergunta que originou
   * tudo isto.
   */
  it('a tela distingue pessoas de pedidos em texto', () => {
    expect(PAGINA_DO_FUNIL).toMatch(/pessoas<\/strong>/);
    expect(PAGINA_DO_FUNIL).toMatch(/pedidos<\/strong>/);
  });
});

describe('o documento não manda mais calcular CAC pelo número errado', () => {
  /**
   * A frase exata que estava errada. Ela chamava o funil de "o registro completo" de compras, e o
   * registro completo é `orders`.
   */
  it('a instrução antiga sumiu', () => {
    expect(DOC_DA_CAMPANHA).not.toMatch(/use as\s+compras do \*\*`\/admin\/funil`\*\*, que é o registro completo/);
  });

  it('e o erro ficou registrado, em vez de apagado', () => {
    /*
      Corrigir sem deixar rastro faria a próxima pessoa refazer a mesma conta errada e concluir de
      novo que o funil é o registro completo. O motivo do erro vale mais que a correção.
    */
    expect(DOC_DA_CAMPANHA).toMatch(/Em aberto desde 12\/09\/2026/);
    expect(DOC_DA_CAMPANHA).toMatch(/sem ter\n> verificado dado nenhum/);
  });
});
