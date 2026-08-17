/**
 * Desempate entre opções tecnicamente equivalentes.
 *
 * ═══ O PROBLEMA ══════════════════════════════════════════════════════════════════════════════
 *
 * Os atributos de uma raquete saem de seis especificações publicadas. Produtos diferentes com
 * especificações iguais recebem, necessariamente, o MESMO vetor — e isso não é um defeito do
 * modelo, é o limite honesto do que dados publicados permitem afirmar. Uma Yonex VCORE 98 e uma
 * HEAD Extreme Tour, ambas 305 g / 98 pol² / 22-23-21 mm / 16×19, são indistinguíveis para
 * qualquer análise que só disponha dessas medidas.
 *
 * O empate, então, é a resposta CORRETA. O erro estava no que se fazia com ele:
 *
 *     scored.sort((a, b) => b.fit - a.fit || a.variant.id.localeCompare(b.variant.id));
 *
 * Empate resolvido por ORDEM ALFABÉTICA. Como o desempate não depende do jogador, a mesma opção
 * ganhava para todo mundo e a gêmea não aparecia para ninguém. Medido sobre 2916 perfis: apenas
 * 22 das 46 raquetes e 5 das 17 cordas chegavam a ser primeiras alguma vez, e sete raquetes
 * ficavam a 0.00 ponto da vencedora sem nunca vencer. Pure Aero, Pure Drive, EZONE 100 — que estão
 * entre as mais vendidas do mundo — não eram indicadas a ninguém, jamais.
 *
 * ═══ A CORREÇÃO ══════════════════════════════════════════════════════════════════════════════
 *
 * O desempate continua 100% determinístico — um relatório pago precisa dar o mesmo resultado toda
 * vez que for aberto —, mas passa a depender também do PERFIL. Entre opções empatadas, jogadores
 * diferentes recebem opções diferentes, e o catálogo inteiro volta a circular.
 *
 * Isto não é sorteio disfarçado de análise. A análise já terminou: ela concluiu, com os dados que
 * existem, que estas opções são equivalentes para este jogador. Quando duas coisas são de fato
 * equivalentes, escolher pelo alfabeto não é mais rigoroso do que escolher por qualquer outro
 * critério — é apenas enviesado, e sempre na mesma direção.
 *
 * O que NÃO se faz é esconder o empate: quem recebe uma opção empatada recebe também a lista das
 * equivalentes, para decidir por preço, disponibilidade ou gosto — critérios que o motor não tem e
 * não deve fingir ter.
 */

/**
 * Assinatura numérica estável do jogador.
 *
 * Precisa ser estável (o mesmo perfil sempre gera a mesma assinatura, para o relatório ser
 * reproduzível) e variada (perfis diferentes geram assinaturas diferentes, para o desempate
 * circular). Números arredondados bastam: a assinatura não é medida de nada, é semente.
 */
export function profileSignature(values: readonly number[]): string {
  return values.map((v) => Math.round(v)).join('|');
}

/**
 * FNV-1a de 32 bits — determinístico, sem dependência, bem distribuído para strings curtas.
 *
 * Não é criptográfico e não precisa ser: o requisito é espalhar de forma reproduzível, não
 * resistir a ataque.
 */
export function stableHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Chave de desempate de um candidato para um perfil. Estável, e diferente a cada perfil. */
export function tieBreakKey(candidateId: string, signature: string): number {
  return stableHash(`${candidateId}#${signature}`);
}

/**
 * Comparador: pontuação primeiro, desempate por chave estável depois.
 *
 * ═══ POR QUE A COMPARAÇÃO É EXATA, E NÃO ARREDONDADA ═════════════════════════════════════════
 *
 * A versão anterior comparava `Math.round(score)` — "na mesma precisão que o usuário lê na tela",
 * para que o número exibido nunca contradissesse a ordem. A intenção era boa e o efeito, ruim:
 * dentro de um mesmo ponto inteiro a ordem passava a ser inteiramente do hash. Medido num perfil
 * real (voleador intermediário, prioridades potência → controle → spin):
 *
 *     1º  84.18  Pure Aero      2º  84.14  EZONE 100
 *     3º  84.18  Pure Drive     4º  84.23  VCORE 100   ← o MAIOR score, em quarto
 *
 * O primeiro colocado não era o de maior pontuação, e a 4ª opção — que ganhava de todas — ficava
 * de fora do pódio. Num relatório pago isso é indefensável: a pessoa não pode receber como "a
 * escolha" algo que o próprio motor pontuou abaixo de uma alternativa que ele descartou.
 *
 * O arredondamento também produzia uma faixa de empate ARBITRÁRIA: 84.49 e 83.51 quase um ponto
 * separados eram "empate", enquanto 84.51 e 84.49 — dois centésimos — caíam em pontos inteiros
 * diferentes e eram tratados como diferença real. A largura do empate dependia de onde a fronteira
 * caísse, não da confiança do modelo.
 *
 * ═══ O QUE PRESERVA A COBERTURA ══════════════════════════════════════════════════════════════
 *
 * O hash continua existindo e continua fazendo exatamente o que foi criado para fazer. O problema
 * original (22 de 46 raquetes nunca indicadas) vinha de gêmeas de ESPECIFICAÇÃO — produtos com o
 * mesmo vetor de atributos e, portanto, o mesmo score até o último decimal, desempatados pelo
 * alfabeto. Esse caso é o `=== 0` aqui embaixo, e nele o hash age igual a antes.
 *
 * A diferença é que uma vantagem REAL de 0.05 ponto volta a valer. Ela é pequena — e é por isso
 * que o pódio marca o empate técnico e mostra ao lado o que separa as opções empatadas: a resposta
 * para "a diferença é minúscula" é DIZER que é minúscula, não desordenar o ranking.
 */
export function compareByScoreThenTieBreak(
  a: { score: number; id: string },
  b: { score: number; id: string },
  signature: string,
): number {
  if (b.score !== a.score) return b.score - a.score;
  return tieBreakKey(a.id, signature) - tieBreakKey(b.id, signature);
}
