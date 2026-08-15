'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { createProducts, prepareDatabase, type SetupResult } from './actions';
import type { SetupStatus } from '@/database/setup';
import { cn } from '@/lib/cn';

/**
 * Cada botão é um `<form action={serverAction}>`, e não um `onClick`.
 *
 * Além de ser o caminho que o Next realmente otimiza, isto sobrevive a JavaScript ainda não
 * hidratado: esta é a primeira tela que o dono do produto abre num servidor recém-criado, e um
 * botão que não responde porque o bundle ainda não carregou seria o pior primeiro contato possível.
 */
function ActionButton({
  action,
  label,
  pendingLabel,
  onResult,
}: {
  action: (prev: unknown) => Promise<SetupResult>;
  label: string;
  pendingLabel: string;
  onResult: (result: SetupResult) => void;
}) {
  const [state, formAction, pending] = useActionState(
    async (prev: unknown) => {
      const result = await action(prev);
      onResult(result);
      return result;
    },
    undefined as SetupResult | undefined,
  );
  void state;

  return (
    <form action={formAction}>
      <button
        type="submit"
        disabled={pending}
        className="min-h-[48px] rounded bg-clay px-6 font-semibold text-white disabled:opacity-50"
      >
        {pending ? pendingLabel : label}
      </button>
    </form>
  );
}

export function SetupPanel({
  status,
  catalogTotal,
  catalogVerified,
}: {
  status: SetupStatus;
  catalogTotal: number;
  catalogVerified: number;
}) {
  const [result, setResult] = useState<SetupResult | null>(null);

  return (
    <div className="mt-8 space-y-4">
      <Step
        n={1}
        title="Conectar o banco de dados"
        done={status.databaseConfigured}
        description={
          status.databaseConfigured
            ? 'Banco conectado.'
            : 'Configure a variável DATABASE_URL no seu provedor de hospedagem e recarregue esta página.'
        }
      />

      <Step
        n={2}
        title="Criar as tabelas"
        done={status.tablesReady}
        blocked={!status.databaseConfigured}
        description={
          status.tablesReady
            ? 'Tabelas prontas.'
            : 'Cria a estrutura onde ficam as análises, os pedidos e os acessos.'
        }
        action={
          !status.tablesReady && status.databaseConfigured ? (
            <ActionButton
              action={prepareDatabase}
              label="Criar tabelas"
              pendingLabel="Criando…"
              onResult={setResult}
            />
          ) : null
        }
      />

      <Step
        n={3}
        title="Criar os produtos e preços"
        done={status.productCount > 0}
        blocked={!status.tablesReady}
        description={
          status.productCount > 0
            ? `${status.productCount} produtos cadastrados. Os preços podem ser alterados depois, sem publicar de novo.`
            : 'Cadastra os três planos com os preços iniciais.'
        }
        action={
          status.tablesReady && status.productCount === 0 ? (
            <ActionButton
              action={createProducts}
              label="Criar produtos"
              pendingLabel="Criando…"
              onResult={setResult}
            />
          ) : null
        }
      />

      {result && 'error' in result && (
        <p className="rounded border border-warn/40 bg-warn/5 p-3 text-sm text-warn">
          {result.error}
        </p>
      )}
      {result && 'ok' in result && (
        <p className="rounded border border-court-mid/40 bg-court-mid/5 p-3 text-sm text-court-mid">
          {result.ok}
        </p>
      )}
      {status.error && (
        <p className="rounded border border-warn/40 bg-warn/5 p-3 text-sm text-warn">
          {status.error}
        </p>
      )}

      {status.tablesReady && status.productCount > 0 && (
        <div className="rounded border-2 border-court bg-white p-6">
          <h2 className="font-display text-lg font-semibold">Sistema pronto para uso</h2>
          <p className="mt-2 text-sm text-graphite">
            Falta a curadoria do catálogo: <strong>{catalogVerified} de {catalogTotal}</strong>{' '}
            raquetes conferidas. Enquanto não estiver completa, o site funciona normalmente em modo
            de testes, mas não deve cobrar de ninguém.
          </p>
          <Link
            href="/admin/verificacao"
            className="mt-4 inline-flex min-h-[48px] items-center rounded bg-court px-6 font-semibold text-paper"
          >
            Ir para a curadoria
          </Link>
        </div>
      )}
    </div>
  );
}

function Step({
  n,
  title,
  description,
  done,
  blocked,
  action,
}: {
  n: number;
  title: string;
  description: string;
  done: boolean;
  blocked?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded border bg-white p-5',
        done ? 'border-court-mid' : blocked ? 'border-line opacity-50' : 'border-line',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
            done ? 'bg-court-mid text-white' : 'border border-line text-graphite',
          )}
          aria-hidden
        >
          {done ? '✓' : n}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-graphite">{description}</p>
          {action && <div className="mt-4">{action}</div>}
        </div>
      </div>
    </div>
  );
}
