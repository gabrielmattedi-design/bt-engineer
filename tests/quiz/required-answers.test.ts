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

const OPCIONAIS_PERMITIDAS = [
  'missing_attributes',
  'current_racket_likes',
  'current_racket_dislikes',
  'free_text',
];

describe('perguntas obrigatórias', () => {
  const steps = visibleSteps(vazio());

  it('o questionário tem etapas', () => {
    expect(steps.length).toBeGreaterThan(3);
  });

  it('toda etapa tem pelo menos uma pergunta obrigatória em branco no início', () => {
    for (const step of steps) {
      const required = step.questions.filter((q) => !q.optional);
      expect(required.length, `etapa "${step.id}" não exige nada`).toBeGreaterThan(0);
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
   * A raquete atual tem dois caminhos válidos, e o texto livre existe exatamente para quem tem uma
   * raquete fora do catálogo. Aceitar só a busca excluiria essa pessoa da etapa.
   */
  it('a raquete atual aceita tanto a busca quanto a descrição livre', () => {
    const racket = steps.flatMap((s) => s.questions).find((q) => q.kind === 'racket');
    expect(racket).toBeDefined();

    expect(isAnswered(racket!, vazio())).toBe(false);
    expect(
      isAnswered(racket!, { ...vazio(), current_racket_id: 'babolat-pure-drive-gen-11-2025' }),
    ).toBe(true);
    expect(
      isAnswered(racket!, { ...vazio(), current_racket_free_text: 'Head Speed branca 2019' }),
    ).toBe(true);
    // Texto só com espaços não é resposta.
    expect(isAnswered(racket!, { ...vazio(), current_racket_free_text: '   ' })).toBe(false);
  });

  it('quem não tem raquete própria não é obrigado a informar uma', () => {
    // A etapa inteira de equipamento desaparece — a pergunta nunca chega a ser cobrada.
    const semRaquete = { ...vazio(), no_current_racket: true };
    const ids = visibleSteps(semRaquete).map((s) => s.id);
    expect(ids).not.toContain('equipamento');
  });
});
