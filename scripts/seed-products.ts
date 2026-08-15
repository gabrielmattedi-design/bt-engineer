/**
 * Seed dos produtos — docs/MONETIZATION.md §1.
 *
 * Os preços vivem no banco (§34) e são editáveis sem deploy. Este script apenas cria as linhas
 * iniciais; rodá-lo de novo NÃO sobrescreve preços já ajustados, para que uma reexecução acidental
 * não desfaça uma mudança comercial.
 */

import { db } from '../src/database/client';
import { products } from '../src/database/schema';

const SEED = [
  {
    sku: 'racket_report',
    name: 'Descubra sua raquete ideal',
    description:
      'A raquete com maior compatibilidade com o seu perfil, com a explicação técnica de por que ' +
      'ela foi escolhida e o que você deve sentir em quadra.',
    priceCents: 1999,
    grantsEntitlements: ['racket_report_access'],
  },
  {
    sku: 'full_setup',
    name: 'Descubra seu setup completo',
    description:
      'Raquete + corda + espessura + tensão inicial, com a faixa de ajuste e o motivo de cada ' +
      'escolha.',
    priceCents: 4999,
    grantsEntitlements: ['racket_report_access', 'full_setup_access'],
  },
  {
    sku: 'top3_unlock',
    name: 'Desbloquear Top 3',
    description: 'As outras duas melhores opções, com a comparação técnica completa entre as três.',
    priceCents: 999,
    grantsEntitlements: ['top3_access'],
  },
];

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL não configurada.');
    process.exit(1);
  }

  for (const product of SEED) {
    await db()
      .insert(products)
      .values({ ...product, currency: 'BRL', active: true })
      .onConflictDoNothing({ target: products.sku });
  }

  const rows = await db().select().from(products);
  console.log('Produtos no catálogo:');
  for (const r of rows) {
    console.log(`  ${r.sku.padEnd(16)} R$ ${(r.priceCents / 100).toFixed(2).replace('.', ',')}`);
  }
  process.exit(0);
}

void main();
