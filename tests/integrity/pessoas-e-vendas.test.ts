/**
 * Pessoas ≠ vendas, e o painel precisa dizer qual é qual.
 *
 * ═══ A DIVERGÊNCIA QUE ORIGINOU ISTO (12/09/2026) ════════════════════════════════════════════
 *
 * O dono leu "Pagou: 5" no `/admin/funil` com filtro "Hoje" e contou **7** na lista de
 * `/admin/vendas`. O extrato do Mercado Pago confirmou 7 pagamentos, e o dono conferiu os e-mails
 * da lista: **uma pessoa fez 3 compras no mesmo dia.** 7 pedidos, 5 pessoas. **Os dois números
 * estavam certos** — o funil conta gente, a lista conta pedido.
 *
 * ─── O CAMINHO ATÉ AÍ, QUE VALE MAIS QUE A CONCLUSÃO ─────────────────────────────────────────
 *
 * A conclusão estava certa e o método não. Respondi duas vezes sem dado, e errei as duas.
 *
 * Primeiro dei a explicação como fato — deduzida da restrição única em (visitante, marco) — e a
 * escrevi na tela, no documento e num commit **sem verificar nada**. Ela acabou se confirmando, o
 * que é sorte, não acerto: eu não tinha como saber.
 *
 * Depois o dono citou **5 e-mails do Mercado Pago** e eu recuei demais — tratei a divergência como
 * insolúvel e pus a lista sob suspeita. Eram os e-mails que estavam incompletos: 2 não chegaram.
 *
 * A lição não é sobre qual número era certo. É que **dois números discordando não se resolvem por
 * dedução**, e que recuar para "não dá para saber" é tão inútil quanto chutar. O que resolve é
 * instrumentar a diferença — que é o que este arquivo trava.
 *
 * ─── O QUE FALTAVA, E QUE ESTES TESTES TRAVAM ────────────────────────────────────────────────
 *
 * Um TERCEIRO número. Com "pedidos" e "pessoas no funil" apenas, *o funil está errado* e *o funil
 * mede outra coisa* são indistinguíveis. Contar as pessoas distintas por trás dos pedidos decide
 * na hora, e a tela passa a dar o veredito em vez de deixá-lo para a próxima dedução.
 *
 * Travam também o log em `markFunnelBySessionId`: o `return` mudo quando a sessão anônima não é
 * encontrada é o suspeito de marco perdido, e sem rastro a investigação não começa.
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
      COMMERCE_REPO.indexOf('export async function contarCompradoresDistintos'),
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
      COMMERCE_REPO.indexOf('export async function contarCompradoresDistintos'),
    );
    expect(corpo).toContain('recorte(orders.paidAt');
  });

  /** Cupom não é venda — a lista já respeitava isto, e a contagem precisa respeitar igual. */
  it('só conta pedido com status `paid`', () => {
    const corpo = COMMERCE_REPO.slice(
      COMMERCE_REPO.indexOf('export async function contarVendas'),
      COMMERCE_REPO.indexOf('export async function contarCompradoresDistintos'),
    );
    expect(corpo).toMatch(/eq\(orders\.status,\s*'paid'\)/);
  });
});

describe('o terceiro número, que é o que desempata', () => {
  /**
   * Com só "pedidos" e "pessoas no funil", *o funil está errado* e *o funil mede outra coisa* são
   * indistinguíveis — e foi exatamente aí que eu respondi por dedução e errei o motivo.
   *
   * Contar as pessoas distintas por trás dos pedidos decide: se bate com o funil, ele está certo
   * e a diferença é segunda compra; se não bate, faltou marco e é defeito.
   */
  it('conta compradores distintos pela MESMA chave que o marco usa', () => {
    expect(COMMERCE_REPO).toContain('export async function contarCompradoresDistintos');
    /*
      `coalesce(recommendationSessions.sessionId, orders.sessionId)`, na mesma ordem de
      `donoDaAnalise ?? sessionId` em `processPaymentEvent`. Contar por `orders.session_id` puro
      daria um número maior e INVENTARIA uma divergência que não existe — a pessoa pode ter
      comprado de outro aparelho.
    */
    expect(COMMERCE_REPO).toMatch(
      /count\(distinct coalesce\(\$\{recommendationSessions\.sessionId\}, \$\{orders\.sessionId\}\)\)/,
    );
  });

  it('a marcação por sessão deixa rastro quando descarta', () => {
    /*
      O `return` mudo quando a sessão não é encontrada era um dos dois suspeitos da divergência de
      12/09: pedido pago, marco descartado, nada em lugar nenhum. Sem log, a investigação não tem
      por onde começar.
    */
    const repo = ler('src/database/repositories/funnel-repo.ts');
    expect(repo).toMatch(/console\.error\([^)]*sessão anônima/s);
  });
});

describe('a tela mostra os números com o nome do que medem', () => {
  it('o painel do funil pede as duas contagens', () => {
    expect(PAGINA_DO_FUNIL).toContain('contarVendas');
    expect(PAGINA_DO_FUNIL).toContain('contarCompradoresDistintos');
  });

  /** A tela precisa dar o veredito, e não deixar a comparação para quem lê. */
  it('diz explicitamente quando o funil perdeu marco', () => {
    expect(PAGINA_DO_FUNIL).toMatch(/O funil perdeu \{compradores - pagaram\}/);
    expect(PAGINA_DO_FUNIL).toMatch(/Os números fecham/);
  });

  /**
   * Não basta mostrar os dois: sem dizer que um é gente e o outro é pedido, duas linhas com
   * números diferentes lado a lado leem como defeito — que foi exatamente a pergunta que originou
   * tudo isto.
   */
  it('a tela distingue pedidos de pessoas em texto', () => {
    expect(PAGINA_DO_FUNIL).toContain('pedidos pagos');
    expect(PAGINA_DO_FUNIL).toContain('pessoas por trás');
    expect(PAGINA_DO_FUNIL).toContain('no funil');
  });
});

describe('o documento distingue os dois divisores', () => {
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
    expect(DOC_DA_CAMPANHA).toMatch(/Resolvido em 12\/09\/2026/);
    expect(DOC_DA_CAMPANHA).toMatch(/O ERRO DE MÉTODO/);
    /*
      CAC é custo de aquisição de CLIENTE — o divisor é gente, não pedido. Confundir os dois não é
      preciosismo: quando alguém compra três vezes, a receita por cliente adquirido sobe, e com ela
      o teto do que se pode pagar para trazer o próximo. Dividir tudo por pedidos esconde isso.
    */
    expect(DOC_DA_CAMPANHA).toMatch(/receita por\n> cliente adquirido fica acima do ticket médio/);
  });
});
