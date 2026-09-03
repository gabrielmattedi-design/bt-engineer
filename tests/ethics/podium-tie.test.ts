/**
 * Empate no pódio — três cards com o mesmo número não podem sair sem explicação.
 *
 * ─── O QUE ESTAVA ERRADO ─────────────────────────────────────────────────────────────────────
 *
 * Um relatório real trouxe as três primeiras marcando 88%, com um rótulo de "empate técnico" que
 * dizia que não havia diferença sem dizer o que havia no lugar dela. A pergunta que sobra para quem
 * pagou é direta: se as três são 88, por que esta é a primeira?
 *
 * ─── O QUE ESTE TESTE TRANCA ─────────────────────────────────────────────────────────────────
 *
 * Duas coisas, e as duas são de honestidade, não de estética:
 *
 * 1. Quando existe empate no topo, ele é ANUNCIADO com a distância medida — a pessoa lê que a
 *    margem é de centésimos, em vez de deduzir que o motor não decidiu.
 * 2. Cada opção empatada e desbloqueada traz o que a separa das outras. Quando não há nada acima do
 *    ruído, o texto diz que são equivalentes e devolve a escolha para preço e disponibilidade — o
 *    que NÃO pode acontecer é o card ficar mudo, e não pode aparecer uma casa decimal inventando
 *    uma resolução que seis especificações publicadas não têm.
 */

import { describe, expect, it } from 'vitest';

import { buildPlayerProfile } from '@/recommendation/profile/build-profile';
import { recommend } from '@/recommendation';
import { serializeRecommendation } from '@/payments/entitlements';
import { buildDistinction, buildSeparation, buildTieGroup } from '@/payments/podium-tie';
import { TECHNICAL_TIE_THRESHOLD } from '@/domain/reference-ranges';
import { PERSONAS } from '@/data/personas';
import { TEST_DATASET_VERSION, TEST_MODE, testRackets, testStrings } from '../helpers/catalog';

const ALL_ACCESS = ['racket_report_access', 'rank2_access', 'rank3_access', 'full_setup_access'] as const;

const runs = PERSONAS.map((persona) => {
  const profile = buildPlayerProfile(persona.answers);
  const result = recommend({
    profile,
    rackets: testRackets(),
    strings: testStrings(),
    datasetVersion: TEST_DATASET_VERSION,
    mode: TEST_MODE,
    includeSetup: true,
  });
  return {
    persona,
    result,
    report: serializeRecommendation(result, profile, [...ALL_ACCESS]),
  };
});

describe('empate no pódio', () => {
  it('a varredura encontra pelo menos um empate — senão o teste não prova nada', () => {
    expect(runs.filter((r) => r.report.podium_tie !== null).length).toBeGreaterThan(0);
  });

  /**
   * Empate é igualdade no número EXIBIDO, não proximidade no score cru.
   *
   * A regra anterior usava a faixa de 2 pontos e produzia o pior desfecho possível: com 82, 81 e 80
   * na tela, o relatório dizia "entre as empatadas" ao lado de três números visivelmente
   * diferentes — contradizendo o dado que ele mesmo exibia.
   */
  it('só anuncia empate quando os números exibidos são iguais', () => {
    for (const { persona, result, report } of runs) {
      const first = result.podium[0]!;
      const second = result.podium[1];
      const tied =
        second !== undefined && Math.round(first.fit_score) === Math.round(second.fit_score);

      expect(report.podium_tie !== null, persona.id).toBe(tied);
    }
  });

  it('nenhum anúncio de empate aparece com percentuais diferentes na tela', () => {
    for (const { persona, report } of runs) {
      const tie = report.podium_tie;
      if (!tie) continue;

      const shown = tie.ranks.map((r) => report.podium.find((e) => e.rank === r)!.fit_score);
      expect(new Set(shown).size, `${persona.id}: ${shown.join('/')}`).toBe(1);
    }
  });

  it('o grupo anunciado só contém posições realmente dentro da faixa', () => {
    for (const { persona, result, report } of runs) {
      const tie = report.podium_tie;
      if (!tie) continue;

      expect(tie.ranks[0], persona.id).toBe(1);
      expect(tie.spread, persona.id).toBeLessThan(TECHNICAL_TIE_THRESHOLD);

      const first = result.podium[0]!;
      for (const rank of tie.ranks) {
        const entry = result.podium.find((e) => e.rank === rank)!;
        expect(
          Math.abs(first.fit_score - entry.fit_score),
          `${persona.id}: rank ${rank} fora da faixa`,
        ).toBeLessThan(TECHNICAL_TIE_THRESHOLD);
      }
    }
  });

  /**
   * O card não pode ficar mudo. É o ponto inteiro da mudança: sem uma frase ali, o empate volta a
   * parecer indecisão do motor.
   */
  it('toda posição empatada e desbloqueada explica o que a separa das outras', () => {
    for (const { persona, report } of runs) {
      const tie = report.podium_tie;
      if (!tie) continue;

      for (const rank of tie.ranks) {
        const entry = report.podium.find((e) => e.rank === rank);
        if (!entry || entry.locked) continue;

        expect(entry.distinction, `${persona.id}: rank ${rank} sem distinção`).not.toBeNull();
        expect(
          entry.distinction!.headline.length,
          `${persona.id}: rank ${rank} com frase vazia`,
        ).toBeGreaterThan(20);
      }
    }
  });

  /**
   * A frase de comparação existe para todo o pódio — a pergunta "o que esta faz de diferente das
   * outras duas?" é a de quem está escolhendo, com números iguais ou não. O que ela NÃO pode fazer
   * é afirmar empate onde os números desmentem.
   */
  it('posição fora de empate é comparada, mas nunca chamada de empatada', () => {
    for (const { persona, result } of runs) {
      const ranks = new Set(buildTieGroup(result.podium)?.ranks ?? []);

      for (const entry of result.podium) {
        if (ranks.has(entry.rank)) continue;
        const d = buildDistinction(entry, result.podium);
        if (!d) continue;
        expect(d.headline, `${persona.id}: rank ${entry.rank}`).not.toMatch(/empatad/i);
      }
    }
  });

  /**
   * A casa decimal continua fora da tela.
   *
   * O caminho fácil para "diferenciar visualmente" seria imprimir 88.3 contra 88.1. O score sai de
   * seis medidas publicadas, nenhuma delas com tolerância de fabricação declarada — a variação
   * entre duas unidades da mesma raquete supera essas décimas. O número exibido continua inteiro, e
   * a diferenciação vem do motivo escrito ao lado.
   */
  it('o fit exibido continua sendo um inteiro', () => {
    for (const { persona, report } of runs) {
      for (const entry of report.podium) {
        expect(Number.isInteger(entry.fit_score), `${persona.id}: rank ${entry.rank}`).toBe(true);
      }
    }
  });

  /**
   * Gêmeas de especificação existem no catálogo e a resposta certa para elas é dizer que são
   * gêmeas. Quando o texto afirma isso, o vetor de atributos precisa de fato coincidir.
   */
  it('quando declara gêmea, as duas têm o mesmo vetor de atributos', () => {
    for (const { persona, result, report } of runs) {
      const tie = report.podium_tie;
      if (!tie) continue;

      for (const rank of tie.ranks) {
        const entry = report.podium.find((e) => e.rank === rank);
        if (!entry || entry.locked || !entry.distinction?.identical_twin) continue;

        const ranked = result.podium.find((e) => e.rank === rank)!;
        const twin = result.podium.find(
          (e) =>
            e.rank !== rank &&
            tie.ranks.includes(e.rank) &&
            e.racket.attributes.power_score === ranked.racket.attributes.power_score &&
            e.racket.attributes.control_score === ranked.racket.attributes.control_score &&
            e.racket.attributes.spin_score === ranked.racket.attributes.spin_score &&
            e.racket.attributes.comfort_score === ranked.racket.attributes.comfort_score &&
            e.racket.attributes.stability_score === ranked.racket.attributes.stability_score &&
            e.racket.attributes.maneuverability_score ===
              ranked.racket.attributes.maneuverability_score,
        );

        expect(twin, `${persona.id}: rank ${rank} declara gêmea inexistente`).toBeDefined();
      }
    }
  });
});

/**
 * ═══ AS TRÊS FRASES PRECISAM DIZER TRÊS COISAS ═══════════════════════════════════════════════
 *
 * Reclamação do teste de usuário, olhando um pódio de 89/89/89:
 *
 *     "o texto tá muito parecido, início igual e até justificativas parecidas"
 *
 * Medido nas 22 personas ANTES da correção, ele estava sendo generoso:
 *
 *     45% dos pódios tinham dois cards abrindo pelo mesmo eixo
 *     77% tinham os três começando com as mesmas 18 letras
 *     e em p02 dois cards saíam com a frase LITERALMENTE IDÊNTICA
 *
 * A causa era aritmética. Cada card escolhia seu maior delta sozinho, e o delta é medido contra a
 * média das OUTRAS: se duas raquetes são confortáveis e a terceira não é, as duas confortáveis têm
 * conforto como maior delta e escrevem a mesma frase. Verdadeiro nas duas, e inútil — a pergunta do
 * card é "o que ESTA faz de diferente das outras duas".
 *
 * A correção resolve os três cards JUNTOS, com um eixo distinto para cada um. Estes testes trancam
 * o resultado, não a implementação: o que não pode voltar é o pódio explicar duas raquetes com a
 * mesma frase.
 */
describe('as frases do pódio se distinguem entre si', () => {
  const podiums = runs.map(({ persona, result }) => ({
    persona,
    headlines: result.podium
      .map((entry) => buildDistinction(entry, result.podium)?.headline)
      .filter((h): h is string => h !== undefined),
  }));

  it('duas posições do mesmo pódio nunca recebem a mesma frase', () => {
    for (const { persona, headlines } of podiums) {
      /*
        A frase de gêmeas é a exceção legítima: quando duas raquetes têm o mesmo vetor de atributos,
        cada uma aponta a OUTRA pelo nome, então os textos citam produtos diferentes e não colidem.
        Se um dia colidirem, é porque uma delas apontou para si mesma — e o teste precisa falhar.
      */
      expect(
        new Set(headlines).size,
        `${persona.id}: frases repetidas\n  ${headlines.join('\n  ')}`,
      ).toBe(headlines.length);
    }
  });

  /**
   * A abertura é o que o olho compara primeiro, com os três cards lado a lado. Duas aberturas iguais
   * fazem os cards parecerem o mesmo texto mesmo quando o fim difere.
   */
  it('duas posições do mesmo pódio nunca abrem com as mesmas palavras', () => {
    for (const { persona, headlines } of podiums) {
      const aberturas = headlines.map((h) => h.split('.')[0]!.trim());
      expect(
        new Set(aberturas).size,
        `${persona.id}: aberturas repetidas\n  ${aberturas.join('\n  ')}`,
      ).toBe(aberturas.length);
    }
  });

  /**
   * O prefixo antigo — "Entre as empatadas," / "Comparada às outras do pódio," — custava até 29
   * caracteres idênticos nos três cards antes de qualquer conteúdo, num espaço de ~200px. Saiu
   * porque a faixa de empate acima já diz isso, e porque os cards estão lado a lado.
   */
  it('nenhuma frase gasta a abertura com preâmbulo repetido', () => {
    for (const { persona, headlines } of podiums) {
      for (const h of headlines) {
        expect(h, `${persona.id}`).not.toMatch(/^(Entre as empatadas|Comparada às outras)/);
      }
    }
  });

  /**
   * Superlativo é uma afirmação mais forte que comparativo, e só cabe quando a opção é de fato o
   * extremo do grupo. Três cards não podem ser cada um "o mais confortável" — se a frase diz "é a
   * mais X", nenhuma outra do escopo pode ter X maior.
   */
  it('quando um card se declara o extremo, ele é mesmo o extremo', () => {
    const CARDINAL: Readonly<Record<number, string>> = { 2: 'duas', 3: 'três' };

    for (const { persona, result } of runs) {
      // O escopo da comparação é o pódio à vista — o mesmo conjunto que o leitor compara.
      const scope = result.podium.slice(0, 3);

      for (const entry of scope) {
        const headline = buildDistinction(entry, result.podium)?.headline;
        if (!headline?.startsWith('Das ')) continue;

        const declarado = /^Das (duas|três)/.exec(headline)?.[1];
        expect(declarado, `${persona.id}: rank ${entry.rank} — "${headline}"`).toBe(
          CARDINAL[scope.length],
        );

        /*
          E o superlativo precisa ser verdade: nenhuma outra do escopo pode ter valor maior no eixo
          citado. Como a frase não nomeia o eixo em código, a checagem é indireta — o extremo
          declarado tem de existir em ALGUM componente. Sem isso, "é a mais confortável" poderia
          sair em dois cards ao mesmo tempo.
        */
        const others = scope.filter((e) => e.rank !== entry.rank);
        const éExtremoEmAlgo = entry.breakdown.components.some((c) =>
          others.every(
            (o) => c.raw > (o.breakdown.components.find((x) => x.key === c.key)?.raw ?? Infinity),
          ),
        );
        expect(éExtremoEmAlgo, `${persona.id}: rank ${entry.rank} — "${headline}"`).toBe(true);
      }
    }
  });

  /** A frase precisa caber num card de ~200px sem virar parágrafo. */
  it('nenhuma frase de diferenciação passa de 130 caracteres', () => {
    for (const { persona, headlines } of podiums) {
      for (const h of headlines) {
        // A frase de gêmeas cita o nome do produto e é naturalmente mais longa.
        if (h.startsWith('Tecnicamente idêntica')) continue;
        expect(h.length, `${persona.id}: ${h.length} caracteres — "${h}"`).toBeLessThanOrEqual(130);
      }
    }
  });
});

/**
 * A frase de separação não pode contradizer os próprios números que exibe.
 *
 * ═══ O DEFEITO QUE ISTO TRANCA ═══════════════════════════════════════════════════════════════
 *
 * O veredicto `indiferente` dizia "— quase um quarto do catálogo" com a fração escrita à mão,
 * enquanto ele dispara a partir de 20% e não tem teto. Numa amostra real saiu "5 das 9 raquetes
 * avaliadas ficaram empatadas — quase um quarto do catálogo": 55% descrito como um quarto, com os
 * dois números na mesma frase para qualquer leitor conferir.
 *
 * Um relatório pago se sustenta em ser conferível. Errar a conta que o próprio texto exibe custa
 * mais do que a informação vale — e é o tipo de erro que nenhuma revisão de redação pega, porque a
 * frase só fica falsa em parte dos perfis.
 */
describe('a separação diz a verdade sobre os próprios números', () => {
  it('a fração citada bate com as raquetes empatadas', () => {
    let verificados = 0;

    for (const { persona, result } of runs) {
      const sep = buildSeparation(result.full_ranking, result.full_ranking.length);
      if (!sep) continue;
      verificados += 1;

      const percentual = sep.message.match(/— (\d+)% do catálogo/);
      if (!percentual) continue;

      const real = Math.round((sep.tied_with_first / sep.evaluated) * 100);
      expect(Number(percentual[1]), `${persona.id}: texto diz ${percentual[1]}%, dado é ${real}%`)
        .toBe(real);
    }

    expect(verificados, 'nenhuma persona produziu separação').toBeGreaterThan(0);
  });

  /**
   * `brands_tied` existe para dizer ao leitor que o empate atravessa marcas — a resposta honesta à
   * concentração medida na varredura de 20.000 perfis (Wilson Blade em 21,9% das recomendações).
   * Se o número não for o número, a frase vira propaganda.
   */
  it('a contagem de marcas empatadas é a contagem real', () => {
    for (const { persona, result } of runs) {
      const sep = buildSeparation(result.full_ranking, result.full_ranking.length);
      if (!sep) continue;

      const primeiro = result.full_ranking[0]!;
      const empatadas = result.full_ranking.filter(
        (r) => primeiro.fit_score - r.fit_score < TECHNICAL_TIE_THRESHOLD,
      );
      const marcas = new Set(empatadas.map((r) => r.racket.variant.brand)).size;

      expect(sep.brands_tied, `${persona.id}`).toBe(marcas);
      expect(sep.tied_with_first, `${persona.id}`).toBe(empatadas.length);

      // Uma marca só nunca vira frase: soaria como recomendação de marca.
      if (sep.brands_tied <= 1) {
        expect(sep.message, `${persona.id}: citou marcas com apenas uma`).not.toContain('marcas diferentes');
      }
    }
  });
});
