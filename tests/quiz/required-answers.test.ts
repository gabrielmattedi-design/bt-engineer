/**
 * Nenhuma etapa avança com pergunta obrigatória em branco.
 *
 * ─── O QUE ESTAVA ERRADO ─────────────────────────────────────────────────────────────────────
 *
 * Dava para atravessar o questionário inteiro clicando só em "Continuar". O motor recebia um
 * perfil vazio, calculava normalmente e devolvia um relatório de aparência idêntica ao de quem
 * respondeu tudo — apoiado em nada.
 *
 * Isso corrompia a própria medida de incerteza do produto. `unknown_answer_ratio` e a confiança do
 * relatório existem para distinguir quem respondeu "não sei" de quem respondeu com convicção; se a
 * pessoa pode pular, "não sei" deixa de ser informação e vira ausência de dado, indistinguível de
 * qualquer outra coisa.
 *
 * ─── E O QUE CONTINUA PODENDO FICAR EM BRANCO ────────────────────────────────────────────────
 *
 * Poucas perguntas em que NÃO responder é uma resposta legítima: não faltar nada na raquete atual
 * é exatamente o perfil do jogador satisfeito, e forçar uma escolha ali inventaria um objetivo que
 * a pessoa não tem. O teste fixa quais são — a lista não pode crescer por conveniência.
 */

import { describe, expect, it } from 'vitest';
import { emptyAnswers, type QuestionnaireAnswers } from '@/recommendation/profile/answers';

/** `vazio()` é uma FÁBRICA (o formulário a usa como inicializador preguiçoso do useState). */
const vazio = (): QuestionnaireAnswers => emptyAnswers();
import { isAnswered, unansweredIn, visibleSteps } from '@/components/quiz/steps';

/**
 * A lista existe para ser conferida, não para crescer.
 *
 * Cada entrada aqui é uma pergunta em que NÃO responder é uma resposta legítima e distinta —
 * quase sempre porque a informação depende de algo que a pessoa pode não ter (a própria tensão,
 * o modelo exato da raquete) ou porque a ausência já é o conteúdo (nada a melhorar).
 */
const OPCIONAIS_PERMITIDAS = [
  'missing_attributes',
  'current_racket_id',
  'current_racket_likes',
  'current_racket_dislikes',
  'current_tension_lbs',
  'current_tension_feeling',
  // Nome: dado de apresentação, não de análise. Não entra em cálculo nenhum.
  'player_name',
  'free_text',
  /**
   * Orçamento da corda: não responder é resposta legítima, e o motor sabe o que fazer com ela.
   *
   * Muita gente simplesmente não pensou em quanto quer gastar antes de ver a recomendação, e
   * obrigar uma escolha ali produziria um número inventado num eixo que pesa 0.12. Sem resposta, a
   * necessidade de economia é INFERIDA de dois fatos já coletados e aritméticos: quem arrebenta
   * corda toda semana paga a corda quarenta vezes por ano, e quem está começando raramente investe
   * no topo da faixa. É estimativa declarada, não silêncio tratado como zero.
   */
  'string_budget',
  /** Sexo: dado sensível, e o motor funciona sem ele. Obrigar seria cobrar o que não é necessário. */
  'sex',
];

describe('perguntas obrigatórias', () => {
  const steps = visibleSteps(vazio());

  it('o questionário tem etapas', () => {
    expect(steps.length).toBeGreaterThan(3);
  });

  it('as perguntas obrigatórias de cada etapa começam todas em branco', () => {
    for (const step of steps) {
      const required = step.questions.filter((q) => !q.optional);
      expect(unansweredIn(step, vazio()).length, step.id).toBe(required.length);
    }
  });

  it('só as perguntas previstas são opcionais', () => {
    const optionals = steps
      .flatMap((s) => s.questions)
      .filter((q) => q.optional)
      .map((q) => String(q.key))
      .sort();

    expect(optionals).toEqual([...OPCIONAIS_PERMITIDAS].sort());
  });

  /**
   * O slider exibe a posição do meio antes de qualquer interação. Se a validação olhasse a tela em
   * vez do estado, toda pergunta numérica passaria por respondida sem ninguém ter tocado nela —
   * e o perfil receberia a mediana da faixa como se fosse a idade da pessoa.
   */
  it('número só conta como respondido quando existe valor no estado', () => {
    const idade = steps.flatMap((s) => s.questions).find((q) => q.key === 'age');
    expect(idade, 'pergunta de idade não encontrada').toBeDefined();

    expect(isAnswered(idade!, vazio())).toBe(false);
    expect(isAnswered(idade!, { ...vazio(), age: 30 })).toBe(true);
  });

  it('escolha múltipla exige ao menos um item', () => {
    const multi = steps
      .flatMap((s) => s.questions)
      .find((q) => q.kind === 'multi' && !q.optional);
    expect(multi).toBeDefined();

    expect(isAnswered(multi!, vazio())).toBe(false);
    const answered = { ...vazio(), [multi!.key]: ['x'] } as QuestionnaireAnswers;
    expect(isAnswered(multi!, answered)).toBe(true);
  });

  /**
   * A raquete atual é opcional, mas quando respondida tem DOIS caminhos válidos — e o texto livre
   * existe exatamente para quem tem uma raquete fora do catálogo.
   */
  it('a raquete atual aceita tanto a busca quanto a descrição livre', () => {
    const racket = steps.flatMap((s) => s.questions).find((q) => q.kind === 'racket');
    expect(racket).toBeDefined();

    expect(
      isAnswered(racket!, { ...vazio(), current_racket_id: 'babolat-pure-drive-gen-11-2025' }),
    ).toBe(true);
    expect(
      isAnswered(racket!, { ...vazio(), current_racket_free_text: 'Head Speed branca 2019' }),
    ).toBe(true);
  });

  it('a lista de opcionais cobre exatamente o que foi decidido', () => {
    const optionals = steps
      .flatMap((s) => s.questions)
      .filter((q) => q.optional)
      .map((q) => String(q.key));
    for (const key of optionals) expect(OPCIONAIS_PERMITIDAS).toContain(key);
  });

  it('quem não tem raquete própria não é obrigado a informar uma', () => {
    // A etapa inteira de equipamento desaparece — a pergunta nunca chega a ser cobrada.
    const semRaquete = { ...vazio(), no_current_racket: true };
    const ids = visibleSteps(semRaquete).map((s) => s.id);
    expect(ids).not.toContain('equipamento');
  });
});
