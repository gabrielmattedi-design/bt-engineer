import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NO_CONCERN } from '@/recommendation/strings/select-string';

/**
 * ═══ O LAUDO NÃO PODE SE CONTRADIZER NA MESMA PÁGINA ═════════════════════════════════════════
 *
 * ⚠️ DEFEITO REAL, MEDIDO NUM LAUDO ENTREGUE (20/09/2026)
 *
 * Um cliente declarou desconforto em cotovelo e ombro. O motor acertou tudo: descartou frames
 * rígidos antes da pontuação, excluiu poliéster duro e recomendou TRIPA NATURAL — amigabilidade ao
 * braço 100 de 100, a corda mais macia do catálogo. O próprio PDF dizia, com todas as letras:
 *
 *   "Pelo histórico de desconforto que você informou, tratamos o conforto como restrição, não
 *    como preferência: frames rígidos foram descartados antes mesmo da pontuação."
 *
 * E o MESMO PDF mandou ele comprar poliéster três vezes:
 *
 *   "O lugar certo de buscar spin no seu caso é o setup: um poliéster de perfil áspero..."
 *   "...um poliéster em tensão um pouco mais alta encurta a bola e fecha o alvo."
 *
 * A causa: `SETUP_LEVER` era uma constante. Não sabia nada do jogador nem do que o motor de cordas
 * tinha decidido. O conselho genérico estava tecnicamente correto e era o conselho errado para
 * aquela pessoa.
 *
 * O custo não é de redação. Um documento que se contradiz perde a autoridade INTEIRA: quem lê não
 * sabe mais em qual das duas frases acreditar, e conclui que ninguém conferiu nada. Foi o que esse
 * cliente concluiu, e ele tinha razão.
 *
 * ─── POR QUE O TESTE LÊ O CÓDIGO ───────────────────────────────────────────────────────────
 *
 * A alternativa seria montar um perfil inteiro e rodar o motor, que é caro e frágil por motivos que
 * não têm a ver com o que está sendo protegido. O que precisa ser verdade é estrutural: a tabela
 * de conselhos não pode voltar a ser constante, e a de braço sensível não pode mencionar poliéster.
 */
const FONTE = readFileSync('src/payments/trade-offs.ts', 'utf8');

describe('o conselho de setup respeita o braço de quem lê', () => {
  it('existe uma tabela separada para braço sensível', () => {
    expect(FONTE).toContain('SETUP_LEVER_BRACO_SENSIVEL');
  });

  /**
   * A regra central: nenhuma das frases destinadas a quem tem braço sensível pode prescrever
   * poliéster. É literalmente o material que o motor acabou de excluir por causa dele.
   */
  it('nenhuma frase de braço sensível prescreve poliéster', () => {
    const bloco = /SETUP_LEVER_BRACO_SENSIVEL[\s\S]*?\n\};/.exec(FONTE)?.[0] ?? '';
    expect(bloco, 'a tabela de braço sensível sumiu ou mudou de forma').not.toBe('');

    /*
      Citar "sem a rigidez do poliéster" é legítimo e desejável — explica POR QUE o conselho é
      outro. O que não pode é mandar comprar. A diferença está na preposição, então o teste procura
      as formas de prescrição, e não a palavra.
    */
    for (const prescricao of [/um poli[ée]ster/i, /poli[ée]ster de perfil/i, /escolha um poli/i]) {
      expect(bloco, `a tabela de braço sensível voltou a prescrever poliéster: ${prescricao}`).not.toMatch(
        prescricao,
      );
    }
  });

  /**
   * O texto e o motor têm que usar o MESMO limiar. Uma cópia do número aqui divergiria da de lá no
   * dia em que um dos dois mudasse — e a divergência seria de novo invisível, dentro de um PDF.
   */
  it('o limiar vem importado do motor de cordas, não copiado', () => {
    expect(FONTE).toContain("from '@/recommendation/strings/select-string'");
    expect(FONTE).toContain('NO_CONCERN');
    expect(FONTE, 'o limiar foi copiado como literal em vez de importado').not.toMatch(
      /armSensitivity\s*>\s*\d+/,
    );
    // E o valor importado é o que se espera — se mudar lá, este teste conta a história.
    expect(NO_CONCERN).toBe(25);
  });

  /** A escolha do conselho passa pelo perfil. Constante de novo é o defeito voltando. */
  it('o conselho é escolhido em função do perfil, e não fixo', () => {
    expect(FONTE).toMatch(/setupLever\(\s*need,/);
    expect(FONTE).toMatch(/profile\.arm_sensitivity_score/);
  });
});

/**
 * ═══ A CAUSA RAIZ, E POR QUE A PRIMEIRA CORREÇÃO NÃO BASTOU ══════════════════════════════════
 *
 * A correção de braço sensível fechou três das quatro frases erradas do laudo de 20/09/2026. A
 * quarta passou:
 *
 *   "O lugar certo de buscar conforto no seu caso é o setup: UM MULTIFILAMENTO em tensão mais
 *    baixa amortece bem mais que qualquer troca de frame."
 *
 * Dita a um jogador que recebeu TRIPA NATURAL — que amortece mais que multifilamento. Tecnicamente
 * correta em abstrato, e um rebaixamento naquele documento.
 *
 * Ela escapou porque o problema nunca foi o braço: era este módulo escrever conselho de corda sem
 * saber se o laudo já tinha dado um. Enquanto a decisão do motor de cordas não chegasse aqui,
 * qualquer tabela de materiais ia contradizer alguma recomendação, mais cedo ou mais tarde.
 *
 * A correção é estrutural: com a corda em mãos, o conselho para de nomear material e passa a falar
 * de bitola e tensão — verdadeiro em qualquer corda, e incapaz de contradizer coisa nenhuma.
 */
describe('o conselho não contradiz a corda que o próprio laudo indicou', () => {
  it('o contexto carrega a corda recomendada', () => {
    expect(FONTE).toContain('recommendedString');
  });

  it('existe uma tabela de conselhos para quando já há corda escolhida', () => {
    expect(FONTE).toContain('SETUP_LEVER_COM_CORDA');
  });

  /**
   * A regra que impede o defeito de voltar em qualquer forma: as frases usadas quando já existe
   * corda escolhida não podem nomear MATERIAL NENHUM. Poliéster, multifilamento e tripa são todos
   * proibidos ali — não por serem perigosos, mas porque nomear qualquer um deles é arriscar
   * contradizer o que o laudo escolheu.
   */
  it('nenhuma frase com corda escolhida nomeia material', () => {
    const bloco = /SETUP_LEVER_COM_CORDA[\s\S]*?\n\};/.exec(FONTE)?.[0] ?? '';
    expect(bloco, 'a tabela sumiu ou mudou de forma').not.toBe('');

    for (const material of [/poli[ée]ster/i, /multifilamento/i, /tripa/i, /sint[ée]tic/i]) {
      expect(bloco, `a tabela voltou a nomear material: ${material}`).not.toMatch(material);
    }
  });

  /** E ela tem prioridade: existindo corda, é ela que manda, antes de qualquer ramo de braço. */
  it('a corda escolhida tem prioridade sobre as tabelas de material', () => {
    const fn = /function setupLever\([\s\S]*?\n\}/.exec(FONTE)?.[0] ?? '';
    const posCorda = fn.indexOf('SETUP_LEVER_COM_CORDA');
    const posBraco = fn.indexOf('SETUP_LEVER_BRACO_SENSIVEL');
    expect(posCorda).toBeGreaterThanOrEqual(0);
    expect(posBraco).toBeGreaterThanOrEqual(0);
    expect(posCorda, 'o ramo de material passou na frente do da corda escolhida').toBeLessThan(
      posBraco,
    );
  });
});
