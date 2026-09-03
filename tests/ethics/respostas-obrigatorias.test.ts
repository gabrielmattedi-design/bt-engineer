/**
 * IDADE, ALTURA E PESO SÃO OBRIGATÓRIOS — E DO LADO DO SERVIDOR TAMBÉM.
 *
 * ═══ O PEDIDO E A RAZÃO DELE ═════════════════════════════════════════════════════════════════
 *
 * Do dono, depois de ler a varredura de mil perfis:
 *
 *   "sobre o problema de não declarar o peso, deveria ser de preenchimento obrigatório, peso,
 *    altura, idade, esses pontos que são chave."
 *
 * Ele estava certo sobre o que essas três respostas sustentam. Sem `weight_kg` não existe reta de
 * porte, e sem porte `frameWeightCeiling` devolve `null` — a única proteção DURA sobre a massa do
 * quadro simplesmente não roda. A varredura achou o caso extremo: menino de 10 anos, 1,32 m, peso
 * em branco, recebendo quadro adulto de 300 g. Sem idade não há fator de capacidade; sem altura o
 * porte fica cego.
 *
 * ═══ POR QUE A TELA NÃO BASTAVA ══════════════════════════════════════════════════════════════
 *
 * Na tela as três já eram obrigatórias — não têm `optional: true`, e o botão de avançar não passa.
 * Mas `analyzeAnswers` é um Server Action: um POST direto não encosta em botão nenhum. É o mesmo
 * princípio que o checkout já tinha escrito em comentário e não aplicava aqui — "esconder é decisão
 * de tela, e tela é o que menos protege".
 *
 * ═══ E POR QUE A REGRA É A MESMA FUNÇÃO, NÃO UMA CÓPIA ═══════════════════════════════════════
 *
 * A guarda do servidor usa `isAnswered` sobre `visibleSteps`, exatamente como o formulário. Uma
 * segunda lista de campos obrigatórios mantida à mão divergiria da primeira na próxima pergunta que
 * alguém acrescentasse — e divergiria em silêncio, porque as duas só se encontram em produção.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STEPS, isAnswered, unansweredIn, visibleSteps } from '@/components/quiz/steps';
import { emptyAnswers, type QuestionnaireAnswers } from '@/recommendation/profile/answers';
import { PERSONAS } from '@/data/personas';
import { gerar } from '../helpers/varredura';

const ROOT = join(__dirname, '..', '..');
const semComentarios = (c: string): string =>
  c.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const acoes = semComentarios(
  readFileSync(join(ROOT, 'src', 'app', 'questionario', 'actions.ts'), 'utf8'),
);

const CHAVE = ['age', 'height_cm', 'weight_kg'] as const;

/**
 * Uma pessoa que respondeu TUDO — base para apagar um campo por vez.
 *
 * Vem do sorteador da varredura de propósito: ele já confere cada perfil contra as opções e as
 * obrigatórias do próprio questionário, então "completo" aqui significa a mesma coisa que significa
 * lá. As personas não servem de base — várias nasceram antes de perguntas que hoje existem, e uma
 * base incompleta faria estes testes passarem pelo motivo errado.
 */
function completa(): QuestionnaireAnswers {
  return { ...emptyAnswers(), ...gerar(1)[0]!.answers };
}

describe('as três respostas-chave', () => {
  it('nenhuma delas é opcional no questionário', () => {
    for (const key of CHAVE) {
      const q = STEPS.flatMap((s) => s.questions).find((x) => x.key === key);
      expect(q, `${key} sumiu do questionário`).toBeDefined();
      expect(q!.optional ?? false, `${key} virou opcional`).toBe(false);
    }
  });

  /**
   * O teste que de fato prende o comportamento: apagar cada uma delas tem de deixar a etapa
   * incompleta. Se um dia `isAnswered` passar a aceitar `null` para número, isto quebra.
   */
  it('apagar qualquer uma delas deixa o questionário incompleto', () => {
    for (const key of CHAVE) {
      const answers = { ...completa(), [key]: null } as QuestionnaireAnswers;
      const faltando = visibleSteps(answers).flatMap((s) => unansweredIn(s, answers));
      expect(faltando.map((q) => q.key), `${key} em branco passou como respondido`).toContain(key);
    }
  });

  it('respondidas, o perfil completo passa inteiro', () => {
    const answers = completa();
    const faltando = visibleSteps(answers).flatMap((s) => unansweredIn(s, answers));
    expect(faltando.map((q) => q.title), 'perfil completo foi recusado').toEqual([]);
  });

  /** E as 22 personas — que alimentam relatórios de exemplo — declaram as três. */
  it('toda persona declara idade, altura e peso', () => {
    for (const p of PERSONAS) {
      for (const key of CHAVE) {
        expect(p.answers[key], `${p.id} (${p.name}) não declara ${key}`).not.toBeNull();
      }
    }
  });
});

describe('a guarda do Server Action', () => {
  it('confere as obrigatórias antes de qualquer outra coisa', () => {
    expect(acoes, 'a guarda de obrigatórias sumiu do Server Action').toContain(
      'respostasFaltando',
    );
    const posGuarda = acoes.indexOf('respostasFaltando(answers)');
    const posMotor = acoes.indexOf('buildPlayerProfile(');
    expect(posGuarda, 'não achei a chamada da guarda').toBeGreaterThan(-1);
    expect(posMotor, 'não achei a montagem do perfil').toBeGreaterThan(-1);
    expect(posGuarda, 'a guarda passou a rodar depois do motor').toBeLessThan(posMotor);
  });

  /**
   * A guarda tem de derivar da MESMA fonte que a tela. Uma lista literal de campos aqui dentro
   * seria a divergência silenciosa que este arquivo existe para impedir.
   */
  it('a regra vem do questionário, não de uma lista à parte', () => {
    expect(acoes, 'a guarda parou de usar as funções do questionário').toMatch(
      /visibleSteps\(answers\)[\s\S]{0,80}unansweredIn/,
    );
  });
});

/**
 * ═══ A PERGUNTA DE FREQUÊNCIA GUARDA NÚMERO ══════════════════════════════════════════════════
 *
 * `frequency_per_week` está declarada `number | null`, o motor faz conta com ela, e as personas
 * guardam números — mas a pergunta é de escolha única, e escolha única guardava a STRING do botão.
 * Um `as` no formulário calava o compilador, e `('3' - 0) / 4` dava a conta certa pelo motivo
 * errado. O tipo declarado era mentira para todo usuário real.
 *
 * A mentira só apareceu quando a varredura de mil perfis — que gera números, como as personas —
 * passou a ser conferida contra a guarda nova: 1000 de 1000 seriam recusados por essa pergunta,
 * porque `isAnswered` exigia string.
 */
describe('frequência semanal', () => {
  const pergunta = STEPS.flatMap((s) => s.questions).find((q) => q.key === 'frequency_per_week')!;

  it('está marcada como numérica', () => {
    expect(pergunta.kind).toBe('single');
    expect(
      pergunta.kind === 'single' && pergunta.numeric,
      'a marca `numeric` sumiu — o formulário volta a guardar string num campo `number`',
    ).toBe(true);
  });

  it('todas as opções dela são números', () => {
    const valores = pergunta.kind === 'single' ? pergunta.choices.map((c) => c.value) : [];
    for (const v of valores) {
      expect(Number.isFinite(Number(v)), `"${v}" não é número`).toBe(true);
    }
  });

  /** O número conta como respondido — é o que as personas e a varredura guardam. */
  it('número conta como resposta', () => {
    const answers = { ...completa(), frequency_per_week: 3 } as QuestionnaireAnswers;
    expect(isAnswered(pergunta, answers)).toBe(true);
  });

  /**
   * E a string também, porque um rascunho começado antes desta mudança guarda a string. Exigir só
   * o número apagaria a resposta de alguém no meio do questionário.
   */
  it('a string antiga continua contando como resposta', () => {
    const answers = { ...completa(), frequency_per_week: '3' } as unknown as QuestionnaireAnswers;
    expect(isAnswered(pergunta, answers)).toBe(true);
  });

  it('em branco não conta', () => {
    const answers = { ...completa(), frequency_per_week: null } as QuestionnaireAnswers;
    expect(isAnswered(pergunta, answers)).toBe(false);
  });
});
