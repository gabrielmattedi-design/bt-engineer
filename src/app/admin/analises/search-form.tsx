'use client';

import { useActionState } from 'react';
import { searchAnalyses, type SearchResult } from './actions';
import type { SupportMatch } from '@/database/repositories/support-repo';

const KIND_LABEL: Readonly<Record<string, string>> = {
  analise: 'ID de análise',
  pedido: 'ID de pedido',
  pagamento: 'ID de pagamento',
  email: 'e-mail',
};

const SKU_LABEL: Readonly<Record<string, string>> = {
  racket_report: 'Análise de raquete',
  unlock_rank_2: '2ª colocada',
  unlock_rank_3: '3ª colocada',
  setup_upgrade: 'Completar o setup',
  full_setup: 'Análise completa',
};

const ENTITLEMENT_LABEL: Readonly<Record<string, string>> = {
  racket_report_access: 'raquete',
  full_setup_access: 'corda e tensão',
  rank2_access: '2ª colocada',
  rank3_access: '3ª colocada',
  top3_access: 'pódio completo',
};

/** O nível de confiança vem do motor em inglês; o painel é em português como o resto do produto. */
const CONFIDENCE_LABEL: Readonly<Record<string, string>> = {
  high: 'alta',
  medium: 'média',
  low: 'baixa',
};

const STATUS_TONE: Readonly<Record<string, string>> = {
  paid: 'text-court',
  pending: 'text-graphite',
  failed: 'text-warn',
  refunded: 'text-warn',
  cancelled: 'text-warn',
};

function money(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function when(date: Date): string {
  return new Date(date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function SearchForm() {
  const [state, action, pending] = useActionState<SearchResult | undefined, FormData>(
    searchAnalyses,
    undefined,
  );

  return (
    <>
      <form action={action} className="mt-6 rounded border border-line bg-white p-6">
        <label htmlFor="q" className="text-sm font-medium">
          E-mail, ID da análise ou ID do pagamento
        </label>
        <p className="mt-1 text-[13px] text-graphite">
          A busca é <strong>exata</strong>: cole o valor inteiro. Não há busca por parte do e-mail
          nem listagem de análises.
        </p>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            id="q"
            name="q"
            required
            autoComplete="off"
            spellCheck={false}
            placeholder="joao@exemplo.com  ·  02684ec8-74ed-…  ·  pi_3Abc…"
            className="min-h-[52px] flex-1 rounded border border-line px-3 focus-visible:border-court"
          />
          <button
            type="submit"
            disabled={pending}
            className="flex min-h-[52px] items-center justify-center rounded bg-court px-6
                       font-semibold text-paper transition-opacity hover:opacity-90
                       disabled:opacity-50"
          >
            {pending ? 'Buscando…' : 'Buscar'}
          </button>
        </div>
      </form>

      {state && 'error' in state && (
        <p className="mt-4 rounded border border-warn/40 bg-warn/5 p-3 text-sm text-warn">
          {state.error}
        </p>
      )}

      {state && 'matches' in state && <Results result={state} />}
    </>
  );
}

function Results({ result }: { result: Extract<SearchResult, { matches: unknown }> }) {
  const kind = KIND_LABEL[result.kind] ?? result.kind;

  if (result.matches.length === 0) {
    return (
      <div className="mt-4 rounded border border-line bg-white p-5 text-sm">
        <p className="font-medium">Nada encontrado para esse {kind}.</p>
        {/*
          Os dois "não encontrei" pedem respostas opostas, e confundi-los faz o operador procurar um
          dado que ainda não existe em lugar nenhum.
        */}
        {result.emailNotCollectedYet ? (
          <p className="mt-2 leading-relaxed text-graphite">
            E não vai encontrar: <strong>o checkout ainda não pede e-mail</strong>, então nenhuma
            compra tem endereço associado. Até que o cadastro exista, procure pelo{' '}
            <strong>ID do pagamento</strong> (no painel do gateway) ou pelo{' '}
            <strong>ID da análise</strong> (na URL do relatório).
          </p>
        ) : (
          <p className="mt-2 leading-relaxed text-graphite">
            Confira se o valor está completo e sem espaços. Se a pessoa tiver o link do relatório, o
            ID da análise está no fim da URL.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4">
      <p className="text-sm text-graphite">
        {result.matches.length === 1
          ? `1 análise encontrada por ${kind}.`
          : `${result.matches.length} análises encontradas por ${kind}.`}
      </p>
      <ul className="mt-3 space-y-4">
        {result.matches.map((m) => (
          <MatchCard key={m.publicId} match={m} />
        ))}
      </ul>
    </div>
  );
}

function MatchCard({ match }: { match: SupportMatch }) {
  const paid = match.orders.filter((o) => o.status === 'paid');

  return (
    <li className="rounded border border-line bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <code className="text-sm font-semibold tracking-tight">{match.publicId}</code>
        <span className="text-xs text-graphite">{when(match.createdAt)}</span>
      </div>

      <p className="mt-1 text-sm text-graphite">
        {match.email ? (
          <>
            E-mail gravado: <strong className="text-ink">{match.email}</strong>
          </>
        ) : (
          'Sem e-mail associado.'
        )}
      </p>

      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-graphite">
        <div>
          <dt className="inline">Motor </dt>
          <dd className="inline tabular-nums text-ink">{match.engineVersion}</dd>
        </div>
        <div>
          <dt className="inline">Catálogo </dt>
          <dd className="inline tabular-nums text-ink">{match.datasetVersion}</dd>
        </div>
        <div>
          <dt className="inline">Confiança </dt>
          <dd className="inline text-ink">
            {CONFIDENCE_LABEL[match.confidenceLevel] ?? match.confidenceLevel}
          </dd>
        </div>
      </dl>

      {/*
        Pedidos com o ID do gateway à vista: é a chave que fecha o círculo. Quem chegou aqui pelo
        e-mail sai com o ID do pagamento para conferir no extrato, e vice-versa.
      */}
      <h3 className="mt-5 text-xs font-semibold uppercase tracking-wider text-graphite">
        Pedidos ({match.orders.length})
      </h3>
      {match.orders.length === 0 ? (
        <p className="mt-1 text-sm text-graphite">Nenhum pedido — análise gratuita ou por código.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line border-y border-line">
          {match.orders.map((o) => (
            <li key={o.id} className="flex flex-wrap items-baseline justify-between gap-x-4 py-2">
              <span className="text-sm">
                {SKU_LABEL[o.sku] ?? o.sku}{' '}
                <span className="tabular-nums text-graphite">{money(o.amountCents)}</span>
              </span>
              <span className={`text-xs font-medium ${STATUS_TONE[o.status] ?? 'text-graphite'}`}>
                {o.status}
                {o.paidAt && ` · ${when(o.paidAt)}`}
              </span>
              {o.providerPaymentId && (
                <code className="w-full text-[11px] text-graphite">
                  {o.provider}: {o.providerPaymentId}
                </code>
              )}
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-4 text-xs font-semibold uppercase tracking-wider text-graphite">
        Acesso liberado
      </h3>
      {match.entitlements.length === 0 ? (
        <p className="mt-1 text-sm text-graphite">
          Nada liberado{paid.length > 0 && ' — há pagamento confirmado sem acesso concedido'}.
        </p>
      ) : (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {match.entitlements.map((e) => (
            <span
              key={e}
              className="rounded border border-line px-2 py-1 text-[11px] font-medium text-graphite"
            >
              {ENTITLEMENT_LABEL[e] ?? e}
            </span>
          ))}
        </div>
      )}

      {/*
        O link vai para o RELATÓRIO, servido pelas mesmas regras de entitlement de sempre: se a
        pessoa só pagou a raquete, você também vê só a raquete. O painel não tem passe livre, e é
        melhor assim — ver exatamente o que ela vê é o que permite responder "por que não aparece
        a corda?" sem adivinhar.
      */}
      <a
        href={`/resultado/${match.publicId}`}
        className="mt-5 inline-block text-sm text-clay underline"
      >
        Abrir o relatório como esta pessoa o vê
      </a>
    </li>
  );
}
