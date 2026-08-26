'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { Wordmark } from '@/components/marketing/wordmark';
import { RacketPicker, type RacketOption } from './racket-picker';
import { emptyAnswers, type QuestionnaireAnswers } from '@/recommendation/profile/answers';
import { unansweredIn, visibleSteps, type Question } from './steps';

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

  /**
   * A cobrança só aparece DEPOIS da primeira tentativa de avançar.
   *
   * Marcar de vermelho o que a pessoa ainda nem teve chance de responder transforma a tela de
   * abertura de cada etapa numa lista de erros — ela é repreendida por não ter feito algo que
   * acabou de receber. O estado começa limpo, a validação entra quando ela diz "Continuar", e sai
   * assim que a pergunta é respondida.
   */
  const [showErrors, setShowErrors] = useState(false);
  const missing = unansweredIn(step, answers);
  const missingKeys = new Set(missing.map((q) => String(q.key)));

  useEffect(() => {
    setShowErrors(false);
  }, [stepIndex]);

  function advance(): void {
    if (missing.length > 0) {
      setShowErrors(true);
      // Leva à primeira pendência: numa etapa longa ela pode estar fora da tela.
      document
        .getElementById(`q-${String(missing[0]!.key)}`)
        ?.scrollIntoView({ block: 'center', behavior: 'auto' });
      return;
    }
    if (isLast) onComplete(answers);
    else setStepIndex((i) => i + 1);
  }

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
        {/*
          ── A ÚNICA SAÍDA DO QUESTIONÁRIO ──────────────────────────────────────────────────────

          Levantamento de telas sem saída: esta era a única do site sem NENHUM caminho de volta —
          nem marca clicável, nem link. O "Voltar ao início" existia só na tela de erro, que quase
          ninguém vê. Quem abria o questionário e mudava de ideia dependia do botão do navegador.

          É a tela de maior tráfego do funil e a primeira que um visitante de anúncio encontra, o
          que torna a ausência mais cara: sem saída, a alternativa dele é fechar a aba.

          A marca entra em vez de um "voltar" porque resolve duas coisas com um elemento — dá a
          saída E assina a página, que era a outra ausência (§64, a assinatura acompanha a leitura).
          Fica na linha do rótulo da etapa, sem ganhar peso: o foco continua sendo a pergunta.
        */}
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-baseline gap-3">
            <Link
              href="/"
              aria-label="Tennis Engineer — voltar ao início"
              className="rounded transition-opacity hover:opacity-70
                         focus-visible:outline focus-visible:outline-2
                         focus-visible:outline-offset-4 focus-visible:outline-current"
            >
              <Wordmark size="sm" withTagline={false} />
            </Link>
            <span className="text-xs font-semibold uppercase tracking-wider text-court">
              {step.label}
            </span>
          </div>
          <span className="shrink-0 text-xs tabular-nums text-graphite">
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
              missing={showErrors && missingKeys.has(String(question.key))}
              onSet={set}
              onToggleMulti={toggleMulti}
            />
          ))}
        </div>
      </main>

      {/* CTA fixo no rodapé em telas de decisão (docs/DESIGN.md §5). */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 border-t border-line bg-paper/95 backdrop-blur">
        {showErrors && missing.length > 0 && (
          <p
            role="alert"
            id="quiz-missing"
            className="mx-auto max-w-2xl px-6 pt-3 text-sm text-warn"
          >
            {missing.length === 1
              ? 'Falta responder uma pergunta desta etapa.'
              : `Faltam responder ${missing.length} perguntas desta etapa.`}
          </p>
        )}
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
            onClick={advance}
            /*
              O botão continua HABILITADO mesmo com pendências.
              Desabilitar economizaria a validação, mas deixaria a pessoa presa diante de um botão
              morto, sem nada explicando o motivo — em etapas longas a pergunta em falta costuma
              estar fora da tela. Clicar e ser levado até ela ensina; um botão cinza não.
            */
            aria-describedby={showErrors && missing.length > 0 ? 'quiz-missing' : undefined}
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

const MISSING_PROMPT: Record<Question['kind'], string> = {
  single: 'Escolha uma opção para continuar.',
  multi: 'Escolha ao menos uma opção para continuar.',
  number: 'Arraste para responder.',
  racket: 'Busque sua raquete ou descreva a que você usa.',
  text: 'Preencha para continuar.',
  shortText: 'Preencha para continuar.',
};

function QuestionField({
  question,
  answers,
  rackets,
  missing,
  onSet,
  onToggleMulti,
}: {
  question: Question;
  answers: QuestionnaireAnswers;
  readonly rackets: readonly RacketOption[];
  readonly missing: boolean;
  onSet: <K extends keyof QuestionnaireAnswers>(k: K, v: QuestionnaireAnswers[K]) => void;
  onToggleMulti: (k: keyof QuestionnaireAnswers, v: string, max: number) => void;
}) {
  const value = answers[question.key];

  return (
    <fieldset id={`q-${String(question.key)}`} className="scroll-mt-24">
      <legend className="font-display text-xl font-semibold leading-snug sm:text-2xl">
        {question.title}
      </legend>
      {question.help && <p className="mt-2 text-sm text-graphite">{question.help}</p>}
      {/*
        A cobrança fala a língua do CONTROLE, não a do formulário.
        "Escolha uma opção" sobre um slider está errado — nele não se escolhe, se arrasta —, e o
        pedido de raquete não é uma escolha entre alternativas visíveis, é uma busca.
      */}
      {missing && (
        <p className="mt-2 flex items-center gap-2 text-sm font-medium text-warn">
          <span
            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-warn"
            aria-hidden
          />
          {MISSING_PROMPT[question.kind]}
        </p>
      )}

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

        {question.kind === 'shortText' && (
          <input
            type="text"
            value={typeof value === 'string' ? value : ''}
            maxLength={question.maxLength}
            placeholder={question.placeholder}
            autoComplete="given-name"
            onChange={(e) =>
              onSet(question.key, e.target.value as QuestionnaireAnswers[typeof question.key])
            }
            className="min-h-[56px] w-full rounded border-2 border-line bg-white px-4 text-[15px]
                       placeholder:text-graphite/50 focus:border-court focus:outline-none"
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

/**
 * Campo numérico — barra e caixa de digitação sobre o MESMO valor.
 *
 * ═══ POR QUE OS DOIS, E NÃO SÓ A BARRA ═══════════════════════════════════════════════════════
 *
 * Arrastar é bom para descobrir a faixa e péssimo para acertar um número que a pessoa já sabe. Ela
 * sabe a idade, sabe a altura e sabe o peso — e obrigá-la a caçar "82" com o dedo, num controle
 * cuja resolução depende da largura da tela, transforma três respostas triviais em três tentativas.
 * No celular é pior: o alvo tem alguns pixels e o polegar cobre o número enquanto arrasta.
 *
 * Os dois controles não são alternativas empilhadas: são a mesma resposta. O número grande no topo
 * deixa de ser rótulo e passa a ser o campo, então digitar move a barra e arrastar reescreve o
 * número, sem etapa de confirmação entre um e outro.
 *
 * ═══ POR QUE O TEXTO DIGITADO TEM ESTADO PRÓPRIO ═════════════════════════════════════════════
 *
 * Porque limitar à faixa a cada tecla torna o campo impossível de usar. Com mínimo de 10, quem
 * digita "18" tecla primeiro "1" — que vira 10 na hora, e o "8" seguinte produz "108". O rascunho
 * guarda exatamente o que foi digitado enquanto o foco está no campo; o valor do perfil só é
 * atualizado quando o que está escrito já é um número válido dentro da faixa.
 *
 * Ao sair do campo o rascunho é resolvido: número fora da faixa é trazido para a borda mais
 * próxima, e campo vazio devolve a pergunta ao estado de NÃO RESPONDIDA — que é diferente de
 * responder zero, e é a distinção que a confiança do relatório mede.
 */
function NumberField({
  question,
  value,
  onSet,
}: {
  question: Extract<Question, { kind: 'number' }>;
  value: number | null;
  onSet: (v: number | null) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === null ? '' : String(value));

  const commit = (raw: string) => {
    setDraft(raw);
    if (raw.trim() === '') return;

    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    // Só entra no perfil o que já está dentro da faixa — o resto espera o blur.
    if (parsed >= question.min && parsed <= question.max) onSet(parsed);
  };

  const settle = () => {
    const raw = (draft ?? '').trim();
    setDraft(null);

    if (draft === null) return;
    if (raw === '') {
      onSet(null);
      return;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    onSet(Math.min(question.max, Math.max(question.min, Math.round(parsed))));
  };

  return (
    <div className="rounded border-2 border-line bg-white p-5">
      <div className="flex items-baseline gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={question.min}
          max={question.max}
          step={question.step ?? 1}
          value={shown}
          placeholder="—"
          aria-label={`${question.title} (${question.unit})`}
          onChange={(e) => commit(e.target.value)}
          onBlur={settle}
          /*
            As setinhas do navegador saem: elas ocupam metade da largura útil num campo em corpo
            grande, mudam de desenho a cada navegador e oferecem o passo de 1 que a barra ao lado
            já dá melhor.
          */
          /*
            Largura fixa e número alinhado à DIREITA.

            Um `<input>` não encolhe para o conteúdo como o `<span>` que ele substituiu, então
            alinhar à esquerda deixava um vão entre o número e a unidade que crescia conforme o
            valor encurtava — "34    anos". À direita, o número sempre termina colado em "anos",
            e a folga fica antes dele, onde ninguém repara. Três caracteres e meio cobrem o maior
            valor do questionário (210 cm) com espaço para o cursor.
          */
          className="display-number w-[3.5ch] border-b-2 border-transparent bg-transparent
                     text-right text-4xl leading-none outline-none transition-colors
                     focus:border-court
                     [appearance:textfield]
                     [&::-webkit-inner-spin-button]:appearance-none
                     [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="text-sm text-graphite">{question.unit}</span>
      </div>
      <input
        type="range"
        min={question.min}
        max={question.max}
        step={question.step ?? 1}
        value={value ?? Math.round((question.min + question.max) / 2)}
        onChange={(e) => {
          setDraft(null);
          onSet(Number(e.target.value));
        }}
        aria-label={question.title}
        className="mt-4 h-2 w-full cursor-pointer appearance-none rounded bg-line accent-court"
      />
      <div className="mt-1 flex justify-between text-xs tabular-nums text-graphite">
        <span>{question.min}</span>
        <span>{question.max}</span>
      </div>
      {value === null && (
        <p className="mt-3 text-xs text-graphite">
          Arraste a barra ou digite o número. O ponto no meio é só a posição inicial, não uma
          resposta.
        </p>
      )}
    </div>
  );
}
