import { redirect } from 'next/navigation';
import { isAdminConfigured, isAuthenticated } from './auth';
import { LoginForm } from './login-form';
import { Wordmark } from '@/components/marketing/wordmark';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  if (await isAuthenticated()) redirect('/admin/verificacao');

  return (
    <main className="flex min-h-screen items-center justify-center bg-court px-6">
      <div className="w-full max-w-sm rounded-lg bg-paper p-8">
        <Wordmark size="sm" withTagline={false} />
        <h1 className="mt-6 font-display text-xl font-semibold">Painel de curadoria</h1>

        {isAdminConfigured() ? (
          <LoginForm />
        ) : (
          <p className="mt-4 rounded border border-warn/40 bg-warn/5 p-3 text-sm text-warn">
            <strong>ADMIN_PASSWORD não configurada.</strong> Defina a variável no seu{' '}
            <code>.env.local</code> com no mínimo 8 caracteres e reinicie o servidor. O painel fica
            indisponível até lá — nunca com uma senha padrão.
          </p>
        )}
      </div>
    </main>
  );
}
