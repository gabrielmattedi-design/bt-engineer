import { db, isDatabaseConfigured } from '@/database/client';
import { products } from '@/database/schema';
import { PRODUCT_SEED, precoInicial, type Sku } from './catalogo';

/**
 * De onde TODA tela tira o preço que exibe.
 *
 * ═══ POR QUE UMA FUNÇÃO SÓ, E NÃO UMA CONSTANTE POR PÁGINA ═══════════════════════════════════
 *
 * O preço aparece em quatro lugares — home, comparativo de `/analise`, upsells do relatório e
 * `/planos` — e é `/planos` que antecede o checkout: o valor que ela mostra é o que `createOrder`
 * copia para o pedido e o gateway cobra.
 *
 * Enquanto as três primeiras liam do código e só a quarta lia do banco, existia um estado em que o
 * site anunciava um valor e a loja cobrava outro. Não era teórico: bastava o preço mudar no código
 * sem alguém aplicar no banco. Lendo todas da MESMA fonte, esse estado deixa de ser possível — não
 * por disciplina, por construção.
 *
 * ═══ O RECUO PARA O CATÁLOGO ═════════════════════════════════════════════════════════════════
 *
 * Sem banco (desenvolvimento) ou com o banco fora do ar, devolve os valores iniciais do catálogo.
 *
 * A alternativa seria a home quebrar. Entre uma home fora do ar e uma home mostrando o preço com
 * que os produtos foram criados, a segunda é melhor — e o risco de ela estar errada é baixo,
 * porque o recuo só vale enquanto o banco não responde, e sem banco não há venda para divergir:
 * `/planos` e `createOrder` precisam da mesma tabela para existir.
 */
export type TabelaDePrecos = Readonly<Record<Sku, number>>;

function doCatalogo(): TabelaDePrecos {
  return Object.fromEntries(
    PRODUCT_SEED.map((p) => [p.sku, p.priceCents]),
  ) as unknown as TabelaDePrecos;
}

export async function precosPublicados(): Promise<TabelaDePrecos> {
  if (!isDatabaseConfigured()) return doCatalogo();

  try {
    const rows = await db()
      .select({ sku: products.sku, priceCents: products.priceCents })
      .from(products);

    const noBanco = new Map(rows.map((r) => [r.sku, r.priceCents]));

    /*
      SKU ausente no banco cai no valor inicial, uma a uma.

      Não é o mesmo que recuar a tabela inteira: um produto novo, cuja linha ainda não foi criada,
      não pode apagar da tela o preço correto dos outros quatro.
    */
    return Object.fromEntries(
      PRODUCT_SEED.map((p) => [p.sku, noBanco.get(p.sku) ?? precoInicial(p.sku)]),
    ) as unknown as TabelaDePrecos;
  } catch {
    return doCatalogo();
  }
}
