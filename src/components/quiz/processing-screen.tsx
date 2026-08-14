'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * Experiência de processamento — §63.
 *
 * "Criar uma animação curta com mensagens REAIS relacionadas ao processamento.
 * Evitar loading fake excessivamente longo."
 *
 * As mensagens descrevem etapas que de fato acontecem no motor. A duração mínima existe apenas
 * para que sejam legíveis (2,8 s no total); se o cálculo demorar mais que isso, a tela espera o
 * cálculo — nunca o contrário. Não há barra falsa nem progresso simulado além do término real.
 */
const STEPS: readonly string[] = [
  'Analisando seu perfil técnico…',
  'Interpretando seu estilo de jogo…',
  'Comparando especificações de frames…',
  'Avaliando potência, controle e spin…',
  'Analisando comportamento das cordas…',
  'Calculando tensão inicial…',
  'Calculando compatibilidade…',
];

const STEP_MS = 400;

export function ProcessingScreen({
  ready,
  onDone,
}: {
  /** true quando o servidor já devolveu o resultado. */
  ready: boolean;
  onDone: () => void;
}) {
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    if (visible >= STEPS.length) return;
    const timer = setTimeout(() => setVisible((v) => v + 1), STEP_MS);
    return () => clearTimeout(timer);
  }, [visible]);

  // Avança somente quando AMBOS terminam: as mensagens e o cálculo real.
  const finished = visible >= STEPS.length && ready;

  useEffect(() => {
    if (!finished) return;
    const timer = setTimeout(onDone, 600);
    return () => clearTimeout(timer);
  }, [finished, onDone]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-6 text-paper">
      <div className="w-full max-w-md">
        <div className="wordmark wordmark-on-dark text-sm opacity-60">Tennis Engineer</div>

        <ul className="mt-10 space-y-3" aria-live="polite">
          {STEPS.map((label, i) => {
            const done = i < visible;
            return (
              <li
                key={label}
                className={cn(
                  'flex items-center gap-3 text-sm transition-opacity duration-300',
                  done ? 'opacity-100' : 'opacity-25',
                )}
              >
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px]',
                    done ? 'border-ball text-ball' : 'border-paper/30 text-transparent',
                  )}
                  aria-hidden
                >
                  ✓
                </span>
                {label}
              </li>
            );
          })}
        </ul>

        <p
          className={cn(
            'mt-10 font-display text-xl font-semibold transition-opacity duration-500',
            finished ? 'opacity-100' : 'opacity-0',
          )}
        >
          Seu Tennis Engineer está pronto.
        </p>
      </div>
    </main>
  );
}
