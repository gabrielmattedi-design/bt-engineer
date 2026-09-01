/**
 * O catálogo de venda: o que existe, o que custa e o que cada compra abre.
 *
 * ═══ POR QUE ELE SAIU DE `database/setup.ts` ═════════════════════════════════════════════════
 *
 * Ele morava junto do código de banco, e isso obrigava qualquer tela que quisesse mostrar um preço
 * a importar o cliente Postgres inteiro — por um número. O resultado prático foi pior: as telas não
 * importaram nada, escreveram "R$ 19,99" na mão, e o produto passou a ter DOIS preços, um no banco
 * (o cobrado) e outro no JSX (o exibido). O §34 proíbe preço no código exatamente por isso.
 *
 * Aqui não há dependência de banco, então a tela pode ler o preço da mesma lista que o alimenta.
 *
 * ═══ QUEM MANDA NO PREÇO ═════════════════════════════════════════════════════════════════════
 *
 * Esta lista. O banco é uma PROJEÇÃO dela: `seedProducts()` reconcilia a tabela `products` com o
 * que está escrito aqui, e é isso que `/admin/setup` executa. Antes o seed era `onConflictDoNothing`
 * e a tabela nunca mudava — trocar o preço no código não trocava nada em produção, e o site passava
 * a anunciar um valor e cobrar outro.
 *
 * O pedido continua guardando o preço COPIADO no instante da compra (ver `createOrder`), então
 * mexer aqui não reescreve o histórico de quem já pagou.
 */

export const PRODUCT_SEED = [
  {
    sku: 'racket_report',
    name: 'Descubra sua raquete ideal',
    description:
      'A raquete com maior compatibilidade com o seu perfil, com a explicação técnica de por que ' +
      'ela foi escolhida e o que você deve sentir em quadra.',
    priceCents: 2999,
    grantsEntitlements: ['racket_report_access'],
  },
  {
    sku: 'full_setup',
    name: 'Descubra seu setup completo',
    description:
      'Raquete + corda + espessura + tensão inicial, com a faixa de ajuste e o motivo de cada ' +
      'escolha. Inclui a 2ª e a 3ª colocadas, com marca, modelo e leitura técnica.',
    priceCents: 4999,
    grantsEntitlements: [
      'racket_report_access',
      'full_setup_access',
      'rank2_access',
      'rank3_access',
    ],
  },
  {
    sku: 'unlock_rank_2',
    name: 'Desbloquear a 2ª colocada',
    description:
      'A segunda raquete com maior compatibilidade, com marca, modelo e a leitura técnica completa.',
    priceCents: 999,
    grantsEntitlements: ['rank2_access'],
  },
  {
    sku: 'unlock_rank_3',
    name: 'Desbloquear a 3ª colocada',
    description:
      'A terceira raquete com maior compatibilidade, com marca, modelo e a leitura técnica completa.',
    priceCents: 999,
    grantsEntitlements: ['rank3_access'],
  },
  {
    sku: 'setup_upgrade',
    name: 'Completar com corda e tensão',
    description:
      'Corda, espessura e tensão inicial para a raquete que você escolher entre as do pódio, ' +
      'com a faixa de ajuste e o motivo de cada escolha. Inclui a 2ª e a 3ª colocadas.',
    priceCents: 2999,
    grantsEntitlements: ['full_setup_access', 'rank2_access', 'rank3_access'],
  },
] as const;

export type Sku = (typeof PRODUCT_SEED)[number]['sku'];

const PORINDICE: ReadonlyMap<string, (typeof PRODUCT_SEED)[number]> = new Map(
  PRODUCT_SEED.map((p) => [p.sku, p]),
);

/** Centavos → "R$ 29,99". Um lugar só decide vírgula e separador. */
export function brl(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
}

/**
 * O preço de uma SKU, já formatado, para escrever na tela.
 *
 * O tipo `Sku` é o que dá a garantia: uma SKU que não existe não compila, então uma tela não pode
 * anunciar um produto aposentado. Por isso ele não devolve `null` nem lança — não há caso de erro
 * possível em tempo de execução.
 */
export function preco(sku: Sku): string {
  return brl(PORINDICE.get(sku)!.priceCents);
}
