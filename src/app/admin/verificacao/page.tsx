import { redirect } from 'next/navigation';
import { isAuthenticated } from '../auth';
import { buildVerificationQueue } from '@/data/verification-queue';
import { readVerificationsFromDisk } from '@/data/write-verification';
import { catalogStats } from '@/data/load';
import { VerificationPanel } from './panel';
import { Wordmark } from '@/components/marketing/wordmark';

export const dynamic = 'force-dynamic';

/**
 * `/admin/verificacao` — a fila que destrava a venda (ADMIN_SPEC §4).
 *
 * Enquanto qualquer variante estiver não verificada, `npm run build` em produção falha. Esta tela é,
 * literalmente, o caminho entre o estado atual e um produto vendável.
 */
export default async function VerificacaoPage() {
  if (!(await isAuthenticated())) redirect('/admin');

  const disk = readVerificationsFromDisk();
  const queue = buildVerificationQueue().map((entry) => ({
    ...entry,
    // O estado do disco vence o do bundle: o curador precisa ver a própria gravação.
    saved: disk.get(entry.variant.product_name) ?? null,
  }));

  const stats = catalogStats();
  const done = queue.filter((q) => q.saved?.state === 'verified').length;

  return (
    <main className="min-h-screen bg-paper">
      <header className="border-b border-line bg-court px-6 py-5 text-paper">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Wordmark size="sm" tone="dark" withTagline={false} />
          <div className="text-right text-xs">
            <div className="font-display text-2xl font-bold tabular-nums">
              {done}/{queue.length}
            </div>
            <div className="opacity-70">raquetes verificadas</div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        <nav className="mb-6 flex gap-4 text-sm">
          <span className="font-semibold">Curadoria</span>
          <a href="/admin/setup" className="text-graphite underline">
            Preparar o sistema
          </a>
          <a href="/admin/codigos" className="text-graphite underline">
            Códigos de acesso
          </a>
        </nav>

        <h1 className="font-display text-2xl font-semibold">Fila de verificação</h1>
        <p className="mt-2 max-w-prose text-sm text-graphite">
          Ordenada por <strong>impacto real</strong>: quantas das {22} personas de validação recebem
          esta raquete no Top 3. Verificar de cima para baixo libera os casos concretos primeiro — as
          primeiras horas de trabalho valem muito mais que as últimas.
        </p>

        {!stats.productionReady && (
          <p className="mt-4 rounded border border-warn/40 bg-warn/5 p-3 text-sm text-warn">
            O dataset ainda <strong>não está apto para produção</strong>. Faltam{' '}
            {queue.length - done} raquetes e{' '}
            {stats.stringVariants - stats.stringVariantsVerified} variantes de corda. Enquanto isso,{' '}
            <code>npm run build</code> em produção falha por decisão de projeto.
          </p>
        )}

        <VerificationPanel queue={queue} />
      </div>
    </main>
  );
}
