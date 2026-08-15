'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { QuizForm } from '@/components/quiz/quiz-form';
import { ProcessingScreen } from '@/components/quiz/processing-screen';
import { analyzeAnswers } from './actions';
import type { QuestionnaireAnswers } from '@/recommendation/profile/answers';
import { Logo } from '@/components/marketing/logo';

type State =
  | { phase: 'form' }
  | { phase: 'processing'; sessionId: string | null }
  | { phase: 'error'; message: string };

export default function QuestionarioPage() {
  const router = useRouter();
  const [state, setState] = useState<State>({ phase: 'form' });

  async function handleComplete(answers: QuestionnaireAnswers) {
    setState({ phase: 'processing', sessionId: null });

    try {
      const response = await analyzeAnswers(answers);
      if (response.ok) {
        setState({ phase: 'processing', sessionId: response.sessionId });
      } else {
        setState({ phase: 'error', message: response.message });
      }
    } catch {
      /**
       * Rede caiu, deploy no meio da requisição, timeout da função.
       *
       * O `catch` existe porque a alternativa é a tela de processamento girar para sempre. Uma
       * falha que o usuário CONSEGUE ver é recuperável — ele tenta de novo. Uma falha silenciosa
       * custa o questionário inteiro que ele acabou de responder.
       */
      setState({
        phase: 'error',
        message: 'A conexão falhou durante a análise. Suas respostas não foram perdidas — tente novamente.',
      });
    }
  }

  if (state.phase === 'error') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-court px-6">
        <div className="w-full max-w-md rounded-lg bg-paper p-8">
          <Logo size="sm" withTagline={false} />
          <h1 className="mt-6 font-display text-xl font-semibold">
            Não conseguimos concluir sua análise
          </h1>
          <p className="mt-3 text-sm text-graphite">{state.message}</p>

          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setState({ phase: 'form' })}
              className="min-h-[52px] rounded bg-clay font-semibold text-white"
            >
              Tentar novamente
            </button>
            <Link
              href="/"
              className="flex min-h-[48px] items-center justify-center rounded border border-line text-sm"
            >
              Voltar ao início
            </Link>
          </div>

          {/* Nada foi cobrado, e dizer isso explicitamente evita a dúvida óbvia (§58). */}
          <p className="mt-6 text-xs text-graphite">
            Nenhuma cobrança foi feita — o questionário e a análise são gratuitos.
          </p>
        </div>
      </main>
    );
  }

  if (state.phase === 'processing') {
    return (
      <ProcessingScreen
        ready={state.sessionId !== null}
        onDone={() => router.push(`/analise/${state.sessionId}`)}
      />
    );
  }

  return <QuizForm onComplete={handleComplete} />;
}
