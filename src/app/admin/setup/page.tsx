import { redirect } from 'next/navigation';
import { AdminNav } from '../nav';
import { isAuthenticated } from '../auth';
import { setupStatus } from '@/database/setup';
import { catalogStats } from '@/data/load';
import { SetupPanel } from './panel';
import { PaymentStatus } from './payment-status';
import { Wordmark } from '@/components/marketing/wordmark';

export const dynamic = 'force-dynamic';

/**
 * `/admin/setup` — preparar o banco sem terminal.
 *
 * Existe porque o dono deste produto não é desenvolvedor. Um passo de infraestrutura que só pode
 * ser executado por linha de comando é, na prática, um passo que não acontece.
 */
export default async function SetupPage() {
  if (!(await isAuthenticated())) redirect('/admin');

  const status = await setupStatus();
  const catalog = catalogStats();

  return (
    <main className="min-h-screen bg-paper">
      <header className="border-b border-line bg-court px-6 py-5 text-paper">
        <div className="mx-auto max-w-3xl">
          <Wordmark size="sm" tone="dark" withTagline={false} />
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-10">
        <AdminNav current="setup" />

        <h1 className="font-display text-2xl font-semibold">Preparar o sistema</h1>
        <p className="mt-2 max-w-prose text-sm text-graphite">
          Três etapas. Você só precisa fazer isso uma vez.
        </p>

        <SetupPanel
          status={status}
          catalogTotal={catalog.rackets}
          catalogVerified={catalog.racketsVerified}
        />

        <PaymentStatus />
      </div>
    </main>
  );
}
