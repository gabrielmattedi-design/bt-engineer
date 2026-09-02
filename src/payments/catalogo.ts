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
 * ═══ QUEM MANDA NO PREÇO: O BANCO ════════════════════════════════════════════════════════════
 *
 * O `priceCents` daqui é o valor INICIAL — o que a linha recebe quando é criada, e nada além disso.
 * A partir daí quem manda é a tabela `products`, editável em `/admin/setup`, e é de lá que TODA
 * tela lê (ver `payments/precos.ts`). É o §34 como sempre esteve escrito.
 *
 * A inversão é recente e vale registrar por quê. Por um dia o código foi a fonte e o banco a
 * projeção, com `seedProducts` reconciliando os dois. Aquilo consertava o problema imediato — o
 * preço em produção estava congelado no valor do primeiro dia — mas trocava por dois piores:
 *
 *   • mudar um preço passava a exigir um deploy, num produto de dono não-técnico;
 *   • `withAutoBootstrap` chama `seedProducts` sozinho quando falta uma coluna, então qualquer
 *     migração futura reverteria silenciosamente todo preço ajustado à mão.
 *
 * `active` também é do banco pelo mesmo motivo: aposentar um produto é decisão operacional.
 * NOME, DESCRIÇÃO e ENTITLEMENTS continuam sendo do código — eles descrevem o que o motor entrega,
 * e mudá-los sem mudar o produto seria vender outra coisa.
 *
 * O pedido guarda o preço COPIADO no instante da compra (ver `createOrder`), então mexer no preço
 * nunca reescreve o histórico de quem já pagou.
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
      'escolha. Inclui a 2ª e a 3ª colocadas, com marca, modelo e leitura técnica, e o setup ' +
      'ideal para a raquete que você já tem — sem trocar de quadro.',
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
      'Corda, espessura e tensão inicial para a raquete que você escolher entre as do pódio — e ' +
      'também para a que você já tem —, com a faixa de ajuste e o motivo de cada escolha. ' +
      'Inclui a 2ª e a 3ª colocadas.',
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

/** O valor com que a linha nasce, quando ela ainda não existe no banco. */
export function precoInicial(sku: Sku): number {
  return PORINDICE.get(sku)!.priceCents;
}

/**
 * Teto do desconto de cupom, em pontos percentuais.
 *
 * ═══ POR QUE 90, E POR QUE ELE MORA AQUI ═════════════════════════════════════════════════════
 *
 * O gateway recusa cobrança abaixo de um valor mínimo. Com 90%, o produto mais barato do catálogo
 * (R$ 9,99) cai para R$ 1,00 e passa. Um teto maior criaria um cupom que o painel aceita e o
 * checkout recusa — com o cliente na frente da tela, que é a pior hora de descobrir.
 *
 * Fica neste módulo, e não junto do resgate, porque o FORMULÁRIO do painel precisa dele para
 * escrever "de 1 a 90" ao lado do campo. Aquele arquivo fala com o Postgres, e um componente de
 * cliente que o importasse arrastaria o driver do banco para dentro do navegador.
 */
export const DESCONTO_MAX_PERCENT = 90;

/**
 * Aplica um desconto percentual a um preço, em centavos.
 *
 * `Math.round` e não truncamento: R$ 29,99 com 15% dá 2549,15 centavos, e truncar entregaria um
 * centavo a mais de desconto em quase toda combinação — barato, e ainda assim dinheiro decidido por
 * acidente de arredondamento em vez de por regra.
 *
 * O piso de um real repete o que `DESCONTO_MAX_PERCENT` já garante. Ele existe porque essa garantia
 * depende do preço mais barato do catálogo, e o catálogo é editável no painel: no dia em que
 * existir um produto de R$ 1,00, é esta linha que impede um checkout de R$ 0,10.
 */
export function comDesconto(precoCents: number, percent: number): number {
  return Math.max(PRECO_MIN_CENTS, Math.round(precoCents * (1 - percent / 100)));
}

/** Piso e teto do que o painel aceita digitar. Ver `conferirEscada`. */
export const PRECO_MIN_CENTS = 100;
export const PRECO_MAX_CENTS = 99_999;

/**
 * A escada faz sentido? Devolve a primeira incoerência, em português, ou `null`.
 *
 * ═══ POR QUE O EDITOR VALIDA, EM VEZ DE SÓ SALVAR ════════════════════════════════════════════
 *
 * Um campo de preço solto permite escrever, sem esforço e sem aviso, o estado que este produto
 * inteiro foi construído para evitar: alguém pagando MAIS e recebendo MENOS. Não é hipótese — já
 * aconteceu aqui uma vez, com o upgrade que não abria a 2ª e a 3ª, e a correção está documentada em
 * `PRODUCT_ENTITLEMENTS`. Um digito a mais numa caixa de texto recria aquilo em dois segundos.
 *
 * As regras abaixo não são de negócio, são de COERÊNCIA: nenhuma delas opina sobre quanto cobrar,
 * todas verificam que quem paga mais recebe pelo menos tanto quanto quem paga menos. Qualquer
 * tabela de preços que as respeite é aceita.
 *
 * O que fica DELIBERADAMENTE de fora: margem, desconto mínimo do pacote, proporção entre planos.
 * São decisões do dono, e um sistema que as trava vira um sistema que ele contorna.
 */
export function conferirEscada(precos: Readonly<Record<Sku, number>>): string | null {
  for (const [sku, cents] of Object.entries(precos) as [Sku, number][]) {
    if (!Number.isInteger(cents) || cents < PRECO_MIN_CENTS || cents > PRECO_MAX_CENTS) {
      return `${sku}: o preço precisa ficar entre ${brl(PRECO_MIN_CENTS)} e ${brl(PRECO_MAX_CENTS)}.`;
    }
  }

  /*
    O pacote contém tudo o que a raquete avulsa contém, e mais. Mais barato que ela, ele
    transformaria a compra da avulsa num prejuízo puro para quem a escolheu.
  */
  if (precos.full_setup < precos.racket_report) {
    return (
      'O setup completo não pode custar menos que a raquete avulsa — ele entrega tudo o que ela ' +
      'entrega, e mais. Quem comprasse a avulsa teria pago mais por menos.'
    );
  }

  /*
    Decidir em duas etapas pode custar mais que decidir de uma vez; é o preço do parcelamento da
    decisão. O que não pode é custar MENOS, porque aí o pacote deixa de ter razão de existir e quem
    o comprou pagou a mais sem receber nada em troca.
  */
  if (precos.racket_report + precos.setup_upgrade < precos.full_setup) {
    return (
      'Comprar a raquete e depois o upgrade ficaria mais barato que o setup completo. ' +
      'Quem comprou o pacote de uma vez teria pago a mais pelo mesmo conteúdo.'
    );
  }

  /*
    ─── E A REGRA QUE NÃO PRECISA SER ESCRITA ─────────────────────────────────────────────────

    "O caminho mais fatiado de todos (raquete + 2ª + 3ª + upgrade) precisa custar mais que o
    pacote" parece a terceira regra necessária, e chegou a ser escrita aqui. Ela é INALCANÇÁVEL:
    a regra acima já garante que raquete + upgrade ≥ pacote, e as duas posições avulsas custam no
    mínimo `PRECO_MIN_CENTS` cada — a soma maior nunca fica abaixo da menor.

    Foi um teste tentando reprovar essa condição que mostrou isso: toda tabela construída para
    violá-la esbarrava antes na regra anterior. Validação que não tem como disparar é pior que
    validação ausente, porque alguém confia nela. A propriedade continua conferida onde ela de fato
    vale — sobre o catálogo em vigor, em tests/security/product-tiers.test.ts.
  */
  return null;
}
