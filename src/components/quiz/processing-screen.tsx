'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * Experiência de processamento — §63.
 *
 * "Criar uma animação curta com mensagens REAIS relacionadas ao processamento.
 * Evitar loading fake excessivamente longo."
 *
 * As mensagens descrevem etapas que de fato acontecem no motor. Se o cálculo demorar mais que a
 * animação, a tela espera o CÁLCULO — nunca o contrário. Não há barra falsa nem progresso simulado
 * além do término real.
 *
 * ─── SOBRE O RITMO ───────────────────────────────────────────────────────────────────────────
 *
 * Cada linha entra a cada 1,5 s, o que dá cerca de 10 s de animação para as sete. É uma decisão
 * deliberada e vale registrar a tensão que ela cria com o §63 ("evitar loading fake excessivamente
 * longo"): a 400 ms as sete linhas apareciam praticamente juntas, e um cálculo que se anuncia em
 * três décimos não é lido como cálculo — é lido como tela de transição. O tempo aqui existe para
 * que cada etapa seja LIDA, uma por vez.
 *
 * Se um dia isso pesar, o ajuste certo é ter menos etapas, não etapas mais rápidas: sete linhas
 * ilegíveis informam menos que quatro linhas lidas.
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

const STEP_MS = 1500;

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

        {/*
          Só as etapas JÁ CUMPRIDAS são renderizadas.

          Antes as sete existiam desde o primeiro quadro, apagadas a 25%, e iam acendendo. Lidas
          assim, a lista inteira já estava lá — a animação era de iluminação, não de progresso, e o
          olho recebia o fim junto com o começo. Agora cada linha ENTRA, e a lista cresce enquanto o
          motor trabalha.
        */}
        <ul className="mt-10 space-y-3" aria-live="polite">
          {STEPS.slice(0, visible).map((label) => (
            <li key={label} className="te-step flex items-center gap-3 text-sm">
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full
                           border border-ball text-[11px] text-ball"
                aria-hidden
              >
                ✓
              </span>
              {label}
            </li>
          ))}
        </ul>

        {/*
          O check final é VERDE e PREENCHIDO — os das etapas são amarelos e vazados.

          As sete etapas são passos de um processo; esta linha é a conclusão dele. Repetir o mesmo
          selo faria a última parecer a oitava etapa. `court-mid` é o verde que o brand book indica
          para sucesso, e é o único claro o bastante para se sustentar sobre `ink`.
        */}
        <p
          className={cn(
            'mt-10 flex items-center gap-3 font-display text-xl font-semibold transition-opacity duration-500',
            finished ? 'opacity-100' : 'opacity-0',
          )}
        >
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full
                       bg-court-mid text-sm text-paper"
            aria-hidden
          >
            ✓
          </span>
          Seu Tennis Engineer está pronto.
        </p>
      </div>
    </main>
  );
}
