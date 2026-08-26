/**
 * Seed dos produtos — docs/MONETIZATION.md §1.
 *
 * Os preços vivem no banco (§34) e são editáveis sem deploy. Este script apenas cria as linhas
 * iniciais; rodá-lo de novo NÃO sobrescreve preços já ajustados, para que uma reexecução acidental
 * não desfaça uma mudança comercial.
 *
 * ═══ POR QUE ELE NÃO TEM MAIS A PRÓPRIA LISTA ════════════════════════════════════════════════
 *
 * Ele tinha, e ela apodreceu. Enquanto `src/database/setup.ts` — o caminho que o painel do admin
 * usa — passou a cinco produtos, esta cópia ficou em três, e as três que sobreviveram divergiam:
 *
 *     aqui          full_setup concedia racket_report + full_setup
 *     no painel     full_setup concede  racket_report + full_setup + rank2 + rank3
 *     aqui          existia top3_unlock, que o painel já tinha aposentado
 *     aqui          NÃO existiam setup_upgrade, unlock_rank_2 nem unlock_rank_3
 *
 * Um banco semeado por este script ficava sem os três produtos que a página de resultado oferece —
 * o botão "Completar meu setup" apontava para uma SKU inexistente. E qual das duas listas valia
 * dependia de quem tinha semeado, o que é a definição de estado indefinido num sistema que cobra
 * dinheiro.
 *
 * Agora existe uma lista só. Este arquivo é o executor; `PRODUCT_SEED` é a verdade.
 */

import { db } from '../src/database/client';
import { products } from '../src/database/schema';
import { PRODUCT_SEED } from '../src/database/setup';

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL não configurada.');
    process.exit(1);
  }

  for (const product of PRODUCT_SEED) {
    await db()
      .insert(products)
      .values({ ...product, grantsEntitlements: [...product.grantsEntitlements], currency: 'BRL', active: true })
      .onConflictDoNothing({ target: products.sku });
  }

  const rows = await db().select().from(products);
  console.log('Produtos no catálogo:');
  for (const r of rows) {
    console.log(
      `  ${r.sku.padEnd(16)} R$ ${(r.priceCents / 100).toFixed(2).replace('.', ',')}` +
        `  → ${(r.grantsEntitlements ?? []).join(', ')}`,
    );
  }
  process.exit(0);
}

void main();
