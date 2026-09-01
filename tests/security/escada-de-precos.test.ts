/**
 * O que o editor de preços aceita, e o que ele recusa.
 *
 * ═══ POR QUE UM CAMPO DE PREÇO PRECISA DE TRAVA ══════════════════════════════════════════════
 *
 * `/admin/setup` passou a ter cinco caixas de texto que mudam o que a loja cobra, na hora, sem
 * publicar nada. É a única forma sensata de o dono ajustar preço — e é também a forma mais fácil já
 * criada neste sistema de escrever, sem querer, o estado que ele inteiro foi construído para
 * evitar: alguém pagando MAIS e recebendo MENOS.
 *
 * Não é hipótese. Já aconteceu aqui, com o upgrade que não abria a 2ª e a 3ª — quem decidia em duas
 * etapas pagava 20% a mais para receber menos, e só descobria depois de pagar. A correção está
 * documentada em `PRODUCT_ENTITLEMENTS`; um dígito a mais numa caixa de texto a desfaz.
 *
 * ═══ O QUE AS REGRAS NÃO FAZEM ═══════════════════════════════════════════════════════════════
 *
 * Não opinam sobre quanto cobrar. Não exigem margem, desconto de pacote nem proporção entre planos.
 * Uma trava que dá palpite comercial vira uma trava que o dono contorna — e aí ela não protege
 * nada. Todas verificam a mesma coisa: quem paga mais recebe pelo menos tanto quanto quem paga
 * menos.
 */

import { describe, expect, it } from 'vitest';

import {
  conferirEscada,
  PRECO_MAX_CENTS,
  PRECO_MIN_CENTS,
  PRODUCT_SEED,
  type Sku,
} from '@/payments/catalogo';

/** A tabela de hoje, montada do catálogo — nenhum número repetido à mão. */
function tabelaAtual(): Record<Sku, number> {
  return Object.fromEntries(PRODUCT_SEED.map((p) => [p.sku, p.priceCents])) as Record<Sku, number>;
}

describe('a escada em vigor', () => {
  it('passa na própria validação', () => {
    /*
      Se um dia os preços do catálogo forem recusados pelo editor, o produto está vendendo uma
      combinação que ele mesmo considera incoerente — e ninguém perceberia sem este teste, porque o
      seed inicial não passa pela validação.
    */
    expect(conferirEscada(tabelaAtual())).toBeNull();
  });
});

describe('o que a validação recusa', () => {
  it('o pacote mais barato que a raquete avulsa', () => {
    const t = { ...tabelaAtual(), racket_report: 4999, full_setup: 3999 };
    expect(conferirEscada(t)).toMatch(/setup completo não pode custar menos/i);
  });

  /**
   * Decidir em duas etapas PODE custar mais — é o preço do parcelamento da decisão, e o produto
   * cobra R$ 9,99 por isso hoje. O que não pode é custar menos: aí quem comprou o pacote de uma vez
   * pagou a mais pelo mesmo conteúdo.
   */
  it('as duas etapas somando menos que o pacote', () => {
    const t = { ...tabelaAtual(), racket_report: 1500, setup_upgrade: 1500, full_setup: 4999 };
    expect(conferirEscada(t)).toMatch(/mais barato que o setup completo/i);
  });

  /**
   * O caminho fatiado nunca fica mais barato que o pacote — e nenhuma regra precisa dizer isso.
   *
   * Este teste nasceu tentando REPROVAR essa condição, e não conseguiu: toda tabela construída para
   * violá-la esbarrava antes na regra das duas etapas. A explicação é aritmética — se
   * raquete + upgrade já é ≥ pacote, somar as duas posições avulsas (mínimo de um real cada) só
   * afasta mais.
   *
   * A validação correspondente foi REMOVIDA por isso: código que não tem como disparar é pior que
   * código ausente, porque alguém confia nele. Fica aqui a prova de que a propriedade sobrevive
   * sem ele.
   */
  it('o caminho fatiado nunca empata com o pacote numa tabela aceita', () => {
    const candidatas: Record<Sku, number>[] = [
      { racket_report: 1000, unlock_rank_2: 100, unlock_rank_3: 100, setup_upgrade: 1999, full_setup: 2999 },
      { racket_report: 2999, unlock_rank_2: 100, unlock_rank_3: 100, setup_upgrade: 2999, full_setup: 5998 },
      { racket_report: 100, unlock_rank_2: 100, unlock_rank_3: 100, setup_upgrade: 100, full_setup: 200 },
    ];

    for (const t of candidatas) {
      expect(conferirEscada(t), JSON.stringify(t)).toBeNull();
      const fatiado = t.racket_report + t.unlock_rank_2 + t.unlock_rank_3 + t.setup_upgrade;
      expect(fatiado, JSON.stringify(t)).toBeGreaterThan(t.full_setup);
    }
  });

  it.each([
    ['zero', 0],
    ['negativo', -100],
    ['centavo solto', 50],
    ['acima do teto', PRECO_MAX_CENTS + 1],
    ['fração de centavo', 2999.5],
  ])('preço %s', (_nome, valor) => {
    /*
      Zero é o mais perigoso da lista e o mais fácil de digitar: um produto de graça concede acesso
      pago sem cobrar nada, que é o §32 ao contrário — e nada na tela denunciaria, porque o checkout
      funcionaria normalmente.
    */
    const t = { ...tabelaAtual(), racket_report: valor };
    expect(conferirEscada(t)).toContain('racket_report');
  });

  it('o piso aceita exatamente o mínimo', () => {
    const t = { ...tabelaAtual(), unlock_rank_2: PRECO_MIN_CENTS };
    expect(conferirEscada(t)).toBeNull();
  });
});

describe('o que a validação aceita', () => {
  it('uma tabela bem mais cara, mantendo a coerência', () => {
    const t = {
      racket_report: 4999,
      unlock_rank_2: 1999,
      unlock_rank_3: 1999,
      setup_upgrade: 4999,
      full_setup: 8999,
    };
    expect(conferirEscada(t)).toBeNull();
  });

  it('uma tabela bem mais barata, mantendo a coerência', () => {
    const t = {
      racket_report: 999,
      unlock_rank_2: 499,
      unlock_rank_3: 499,
      setup_upgrade: 999,
      full_setup: 1499,
    };
    expect(conferirEscada(t)).toBeNull();
  });

  /** Nenhuma regra opina sobre margem: pacote com desconto de um centavo é decisão do dono. */
  it('um desconto de pacote mínimo', () => {
    const t = { ...tabelaAtual(), racket_report: 2999, setup_upgrade: 2999, full_setup: 5998 };
    expect(conferirEscada(t)).toBeNull();
  });
});
