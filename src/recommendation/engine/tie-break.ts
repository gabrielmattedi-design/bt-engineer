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
 * A pontuação é comparada ARREDONDADA, na mesma precisão que o usuário lê na tela. Sem isso, uma
 * diferença de 0.06 ponto — que a tela mostra como dois números iguais — continuaria decidindo
 * quem aparece e quem não aparece, com um rigor que o modelo não tem (R-04).
 */
export function compareByScoreThenTieBreak(
  a: { score: number; id: string },
  b: { score: number; id: string },
  signature: string,
): number {
  const rounded = Math.round(b.score) - Math.round(a.score);
  if (rounded !== 0) return rounded;
  return tieBreakKey(a.id, signature) - tieBreakKey(b.id, signature);
}
