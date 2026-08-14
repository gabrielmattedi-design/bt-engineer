'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { QuizForm } from '@/components/quiz/quiz-form';
import { ProcessingScreen } from '@/components/quiz/processing-screen';
import { analyzeAnswers } from './actions';
import type { QuestionnaireAnswers } from '@/recommendation/profile/answers';

export default function QuestionarioPage() {
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  async function handleComplete(answers: QuestionnaireAnswers) {
    setProcessing(true);
    const { sessionId: id } = await analyzeAnswers(answers);
    setSessionId(id);
  }

  if (processing) {
    return (
      <ProcessingScreen
        ready={sessionId !== null}
        onDone={() => router.push(`/analise/${sessionId}`)}
      />
    );
  }

  return <QuizForm onComplete={handleComplete} />;
}
