'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { RacketPicker, type RacketOption } from './racket-picker';
import { emptyAnswers, type QuestionnaireAnswers } from '@/recommendation/profile/answers';
import { visibleSteps, type Question } from './steps';

/**
 * Questionário — §10, §43.
 *
 * Uma etapa por tela, cards grandes, alvos de toque ≥ 56px, progress bar como linha fina,
 * CTA fixo no rodapé com safe-area. Nada de formulário gigante.
 *
 * Este componente só COLETA. Ele não calcula nada: as respostas vão para o servidor, que roda o
 * motor. A fronteira UI ↔ lógica é a regra fundamental da arquitetura (§44).
 */
export function QuizForm({
  onComplete,
  rackets,
}: {
  onComplete: (answers: QuestionnaireAnswers) => void;
  readonly rackets: readonly RacketOption[];
}) {
  const [answers, setAnswers] = useState<QuestionnaireAnswers>(emptyAnswers);
  const [stepIndex, setStepIndex] = useState(0);

  /**
   * Volta ao topo a cada troca de etapa.
   *
   * Sem isso, quem responde uma etapa longa rolando até o fim começa a próxima já no meio da
   * página — às vezes abaixo do enunciado, o que faz as opções parecerem soltas e sem pergunta.
   * O navegador preserva a posição de rolagem porque a URL não muda: é a mesma página trocando de
   * conteúdo.
   *
   * `behavior: 'auto'` e não `'smooth'`: a animação de rolagem competiria com a troca de conteúdo,
   * e quem usa `prefers-reduced-motion` não deveria vê-la de todo.
   */
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [stepIndex]);

  const steps = useMemo(() => visibleSteps(answers), [answers]);
  const step = steps[Math.min(stepIndex, steps.length - 1)]!;
  const isLast = stepIndex >= steps.length - 1;
  const progress = ((stepIndex + 1) / steps.length) * 100;

  const set = <K extends keyof QuestionnaireAnswers>(
    key: K,
    value: QuestionnaireAnswers[K],
  ): void => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const toggleMulti = (key: keyof QuestionnaireAnswers, value: string, max: number): void => {
    const current = (answers[key] as readonly string[]) ?? [];
    // A ordem de seleção é preservada — é ela que codifica a prioridade (§14).
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : current.length >= max
        ? [...current.slice(1), value]
        : [...current, value];
    set(key, next as QuestionnaireAnswers[typeof key]);
  };

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      {/* Progress bar: linha fina no topo (docs/DESIGN.md §4). */}
      <div className="sticky top-0 z-10 bg-paper">
        <div className="h-[3px] w-full bg-line">
          <div
            className="h-full bg-court transition-[width] duration-300"
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={stepIndex + 1}
            aria-valuemin={1}
            aria-valuemax={steps.length}
            aria-label={`Etapa ${stepIndex + 1} de ${steps.length}`}
          />
        </div>
        <div className="mx-auto flex max-w-2xl items-baseline justify-between px-6 py-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-court">
            {step.label}
          </span>
          <span className="text-xs tabular-nums text-graphite">
            {stepIndex + 1} / {steps.length}
          </span>
        </div>
      </div>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 pb-40">
        {step.notice && (
          <p className="mb-8 rounded border-l-2 border-court bg-white px-4 py-3 text-sm text-graphite">
            {step.notice}
          </p>
        )}

        <div className="space-y-12">
          {step.questions.map((question) => (
            <QuestionField
              key={String(question.key)}
              question={question}
              answers={answers}
              rackets={rackets}
              onSet={set}
              onToggleMulti={toggleMulti}
            />
          ))}
        </div>
      </main>

      {/* CTA fixo no rodapé em telas de decisão (docs/DESIGN.md §5). */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 border-t border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl gap-3 px-6 py-4">
          {stepIndex > 0 && (
            <button
              type="button"
              onClick={() => setStepIndex((i) => i - 1)}
              className="min-h-[56px] rounded border border-line px-6 font-medium text-graphite
                         transition-colors hover:border-graphite"
            >
              Voltar
            </button>
          )}
          <button
            type="button"
            onClick={() => (isLast ? onComplete(answers) : setStepIndex((i) => i + 1))}
            className="min-h-[56px] flex-1 rounded bg-ink px-6 font-semibold text-paper
                       transition-opacity hover:opacity-90"
          >
            {isLast ? 'Analisar meu jogo' : 'Continuar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function QuestionField({
  question,
  answers,
  rackets,
  onSet,
  onToggleMulti,
}: {
  question: Question;
  answers: QuestionnaireAnswers;
  readonly rackets: readonly RacketOption[];
  onSet: <K extends keyof QuestionnaireAnswers>(k: K, v: QuestionnaireAnswers[K]) => void;
  onToggleMulti: (k: keyof QuestionnaireAnswers, v: string, max: number) => void;
}) {
  const value = answers[question.key];

  return (
    <fieldset>
      <legend className="font-display text-xl font-semibold leading-snug sm:text-2xl">
        {question.title}
      </legend>
      {question.help && <p className="mt-2 text-sm text-graphite">{question.help}</p>}

      <div className="mt-5 space-y-2">
        {question.kind === 'single' &&
          question.choices.map((choice) => (
            <button
              key={choice.value}
              type="button"
              aria-pressed={value === choice.value}
              onClick={() =>
                onSet(question.key, choice.value as QuestionnaireAnswers[typeof question.key])
              }
              className={cn('choice', value === choice.value && 'choice-selected')}
            >
              <span className="flex-1">
                <span className="font-medium">{choice.label}</span>
                {choice.hint && (
                  <span className="mt-0.5 block text-[13px] text-graphite">{choice.hint}</span>
                )}
              </span>
            </button>
          ))}

        {question.kind === 'multi' &&
          question.choices.map((choice) => {
            const selected = ((value as readonly string[]) ?? []).indexOf(choice.value);
            const isSelected = selected >= 0;
            return (
              <button
                key={choice.value}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onToggleMulti(question.key, choice.value, question.max)}
                className={cn('choice', isSelected && 'choice-selected')}
              >
                {/* Seleção ordenada e numerada — mais confiável que drag-and-drop em mobile. */}
                {question.ranked && (
                  <span
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold tabular-nums',
                      isSelected
                        ? 'border-court bg-court text-white'
                        : 'border-line text-transparent',
                    )}
                    aria-hidden
                  >
                    {isSelected ? selected + 1 : '0'}
                  </span>
                )}
                {/*
                  A explicação aparece nas duas listas — única e múltipla escolha. Ela existia só na
                  de escolha única, então perguntas como "suas bolas costumam…" e "você sente falta
                  de…" ficavam sem definição justamente onde o vocabulário é mais técnico.
                */}
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{choice.label}</span>
                  {choice.hint && (
                    <span className="mt-0.5 block text-[13px] font-normal text-graphite">
                      {choice.hint}
                    </span>
                  )}
                </span>
              </button>
            );
          })}

        {question.kind === 'racket' && (
          <RacketPicker
            options={rackets}
            valueId={typeof value === 'string' ? value : null}
            freeText={answers.current_racket_free_text}
            onSelect={(id) => {
              onSet('current_racket_id', id);
              // Escolher no catálogo apaga a descrição livre: as duas juntas seriam ambíguas.
              if (id) onSet('current_racket_free_text', null);
            }}
            onFreeText={(text) => {
              onSet('current_racket_free_text', text);
              if (text) onSet('current_racket_id', null);
            }}
          />
        )}

        {question.kind === 'number' && (
          <NumberField
            question={question}
            value={typeof value === 'number' ? value : null}
            onSet={(v) => onSet(question.key, v as QuestionnaireAnswers[typeof question.key])}
          />
        )}

        {question.kind === 'text' && (
          <div>
            <textarea
              value={typeof value === 'string' ? value : ''}
              maxLength={question.maxLength}
              rows={6}
              placeholder={question.placeholder}
              onChange={(e) =>
                onSet(question.key, e.target.value as QuestionnaireAnswers[typeof question.key])
              }
              className="w-full rounded border-2 border-line bg-white p-4 text-[15px]
                         placeholder:text-graphite/50 focus:border-court focus:outline-none"
            />
            <p className="mt-1 text-right text-xs tabular-nums text-graphite">
              {(typeof value === 'string' ? value.length : 0)} / {question.maxLength}
            </p>
          </div>
        )}
      </div>
    </fieldset>
  );
}

function NumberField({
  question,
  value,
  onSet,
}: {
  question: Extract<Question, { kind: 'number' }>;
  value: number | null;
  onSet: (v: number | null) => void;
}) {
  return (
    <div className="rounded border-2 border-line bg-white p-5">
      <div className="flex items-baseline gap-2">
        <span className="display-number text-4xl">{value ?? '—'}</span>
        <span className="text-sm text-graphite">{question.unit}</span>
      </div>
      <input
        type="range"
        min={question.min}
        max={question.max}
        step={question.step ?? 1}
        value={value ?? Math.round((question.min + question.max) / 2)}
        onChange={(e) => onSet(Number(e.target.value))}
        aria-label={question.title}
        className="mt-4 h-2 w-full cursor-pointer appearance-none rounded bg-line accent-court"
      />
      <div className="mt-1 flex justify-between text-xs tabular-nums text-graphite">
        <span>{question.min}</span>
        <span>{question.max}</span>
      </div>
      {value === null && (
        <p className="mt-3 text-xs text-graphite">
          Arraste para responder, ou siga adiante para deixar em branco.
        </p>
      )}
    </div>
  );
}
