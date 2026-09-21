import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildCatalogScale } from '@/recommendation/engine/catalog-scale';
import { testRackets } from '../helpers/catalog';

/**
 * ═══ NINGUÉM PERDE A RAQUETE QUE PROCURAVA POR UM PONTO ══════════════════════════════════════
 *
 * ⚠️ CASO REAL (21/09/2026)
 *
 * Um cliente perguntou por que a HEAD Gravity MP — que ele mesmo tinha encontrado pesquisando por
 * conta própria — não apareceu no laudo dele. O motor respondia:
 *
 *   "Você colocou spin em primeiro lugar, e esta raquete entrega menos que a raquete média do
 *    mercado que analisamos nesse aspecto (65 de 100, contra 66)."
 *
 * Medido no catálogo: a média de spin é 65,72 e a Gravity MP está em 65,3. Ela foi ELIMINADA —
 * não penalizada, eliminada antes de pontuar — por **0,4 ponto em 100**.
 *
 * Os índices saem de descritores qualitativos. Na vizinhança da média as raquetes ficam a 0,2–0,5
 * ponto umas das outras, e um corte ali não separa raquete boa de ruim no eixo: separa
 * arredondamento.
 *
 * O arquivo já tinha aprendido metade da lição — existe um comentário explicando por que a
 * comparação passou a ser feita nos números ARREDONDADOS, para não excluir com a frase "60 de 100,
 * contra 60". A margem é a outra metade: um corte que o leitor não consegue AGIR sobre não pode
 * ser explicado por ele, e ninguém troca de raquete por um ponto.
 */
const FONTE = readFileSync('src/recommendation/engine/rank-rackets.ts', 'utf8');

describe('a premissa da 1ª prioridade tem margem', () => {
  it('a margem existe e não é zero', () => {
    expect(FONTE).toContain('MARGEM_ABAIXO_DA_MEDIA');
    const decl = /const MARGEM_ABAIXO_DA_MEDIA = (\d+);/.exec(FONTE);
    expect(decl, 'a constante sumiu ou mudou de forma').not.toBeNull();
    expect(Number(decl?.[1])).toBeGreaterThan(0);
  });

  it('o corte da média aplica a margem', () => {
    const bloco = /const naMedia = scored\.filter\(([\s\S]*?)\);/.exec(FONTE)?.[0] ?? '';
    expect(bloco, 'o filtro da média sumiu ou mudou de forma').not.toBe('');
    expect(bloco, 'o corte voltou a ser exatamente na média, sem margem').toContain(
      'MARGEM_ABAIXO_DA_MEDIA',
    );
  });

  /**
   * A margem precisa ser MAIOR que o espaçamento típico entre raquetes vizinhas — senão ela não
   * protege de nada, porque o corte continua caindo entre duas raquetes indistinguíveis.
   *
   * Isto mede o catálogo de verdade, e não uma suposição: se um dia ele ficar mais esparso ou mais
   * denso, o teste conta.
   */
  it('a margem é maior que o espaçamento entre raquetes vizinhas na média', () => {
    const rackets = testRackets();
    const escala = buildCatalogScale(rackets);

    const posicoes = rackets
      .map((r) => escala.position('spin_score', r.attributes.spin_score))
      .sort((a, b) => a - b);

    const media = posicoes.reduce((s, x) => s + x, 0) / posicoes.length;

    // Distâncias entre vizinhas na faixa de ±5 pontos da média — onde o corte acontece.
    const perto = posicoes.filter((p) => Math.abs(p - media) <= 5);
    const vaos = perto.slice(1).map((p, i) => p - (perto[i] as number));
    const vaoTipico = vaos.length > 0 ? vaos.reduce((s, x) => s + x, 0) / vaos.length : 0;

    const margem = Number(/const MARGEM_ABAIXO_DA_MEDIA = (\d+);/.exec(FONTE)?.[1] ?? 0);

    expect(
      margem,
      `a margem (${margem}) precisa cobrir várias raquetes vizinhas — o vão típico perto da ` +
        `média é ${vaoTipico.toFixed(2)} ponto`,
    ).toBeGreaterThan(vaoTipico * 3);
  });

  /**
   * A frase de exclusão precisa dizer "bem menos", e não "menos".
   *
   * Com a margem, sobreviver exige estar a menos de cinco pontos da média — então "entrega menos
   * que a média" descreve um critério mais rígido do que o aplicado. Foi justamente o descompasso
   * entre o que a frase afirmava e o que o número mostrava ("65 contra 66") que fez um cliente
   * questionar o laudo inteiro.
   */
  it('a frase acompanha o critério que passou a ser aplicado', () => {
    expect(FONTE).toContain('entrega bem ');
  });
});
