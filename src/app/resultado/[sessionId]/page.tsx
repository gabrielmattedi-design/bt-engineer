import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Wordmark } from '@/components/marketing/wordmark';
import { Podium } from '@/components/result/podium';
import { getReport } from '@/app/questionario/actions';
import { PRODUCT_ENTITLEMENTS, type Entitlement } from '@/payments/entitlements';

/**
 * Relatório — §35, §36, §64.
 *
 * ⚠️ Os entitlements são derivados do query param APENAS nesta demonstração. Em produção eles vêm
 * da tabela `entitlements`, concedidos exclusivamente por webhook de pagamento confirmado (§33) —
 * ver docs/MONETIZATION.md §4-5. A fronteira já está no lugar certo: a página não decide o que
 * mostrar, ela recebe de `getReport()` um payload já construído por entitlement.
 */
export default async function ResultadoPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ plano?: string; top3?: string }>;
}) {
  const { sessionId } = await params;
  const { plano, top3 } = await searchParams;

  const granted: Entitlement[] = [...(PRODUCT_ENTITLEMENTS[plano ?? 'racket_report'] ?? [])];
  if (top3 === '1') granted.push('top3_access');

  // `getReport` lança se o pódio estiver vazio (nenhuma raquete atingiu o mínimo). Isso é o
  // comportamento correto do motor; aqui traduzimos para uma resposta honesta em vez de um erro.
  let report;
  try {
    report = await getReport(sessionId, granted);
  } catch {
    redirect(`/analise/${sessionId}`);
  }
  if (!report) notFound();

  const first = report.podium[0];
  const winner = first && !first.locked ? first : null;

  return (
    <main className="min-h-screen pb-20">
      {/* Cabeçalho com a marca em destaque (§64). */}
      <header className="border-b border-line bg-ink px-6 py-8 text-paper">
        <div className="mx-auto max-w-3xl">
          <Wordmark size="md" />
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-16 px-6 py-12">
        {/* ── MATCH ────────────────────────────────────────────────────────── */}
        {winner && (
          <section>
            <p className="text-graphite">Encontramos seu match.</p>

            <div className="mt-6 rounded border-2 border-ink bg-white p-8">
              <div className="display-number text-7xl leading-none sm:text-8xl">
                {winner.fit_score}%
              </div>
              <div className="mt-1 text-xs uppercase tracking-[0.2em] text-graphite">match</div>

              <div className="mt-8 text-sm uppercase tracking-wider text-graphite">
                {winner.brand}
              </div>
              <h1 className="mt-1 font-display text-3xl font-bold leading-tight sm:text-4xl">
                {winner.product_name}
              </h1>

              <div className="mt-6 flex flex-wrap gap-2">
                {winner.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded border border-line px-2.5 py-1 text-[11px] font-semibold
                               uppercase tracking-wider"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <p className="mt-4 text-sm text-graphite">{report.headline}</p>

            {/* Compatibilidade e confiança são dimensões SEPARADAS (§24). */}
            <div className="mt-6 rounded border border-line bg-white p-5">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold">Confiança da análise</span>
                <span className="font-display text-lg font-bold">{report.confidence.level}</span>
              </div>
              <ul className="mt-3 space-y-2">
                {report.confidence.reasons.map((reason) => (
                  <li key={reason.message} className="text-xs text-graphite">
                    {reason.message}
                    {reason.remedy && (
                      <span className="mt-0.5 block text-graphite/70">↳ {reason.remedy}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* ── POR QUE COMBINA (§35) ────────────────────────────────────────── */}
        {winner && (
          <section>
            <h2 className="font-display text-2xl font-bold">Por que combina com você?</h2>
            <div className="mt-4 max-w-prose space-y-3 text-[15px]">
              {winner.why.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </section>
        )}

        {/* ── O QUE VOCÊ DEVE PERCEBER (§35) ───────────────────────────────── */}
        {winner && winner.expectations.length > 0 && (
          <section>
            <h2 className="font-display text-2xl font-bold">O que você deve perceber</h2>
            <ul className="mt-4 max-w-prose space-y-2 text-[15px]">
              {winner.expectations.map((line) => (
                <li key={line} dangerouslySetInnerHTML={{ __html: boldify(line) }} />
              ))}
            </ul>
          </section>
        )}

        {/* ── PONTOS DE ATENÇÃO (§35) — mesmo destaque dos ganhos ──────────── */}
        {winner && winner.attention.length > 0 && (
          <section>
            <h2 className="font-display text-2xl font-bold">Pontos de atenção</h2>
            <ul className="mt-4 max-w-prose space-y-2 border-l-2 border-warn pl-4 text-[15px]">
              {winner.attention.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        )}

        {/* ── TRANSIÇÃO (§22) ──────────────────────────────────────────────── */}
        <section>
          <h2 className="font-display text-2xl font-bold">Comparação com sua raquete atual</h2>
          {report.transition.available ? (
            <>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-graphite">
                      <th className="py-2 pr-4 font-medium">Característica</th>
                      <th className="py-2 pr-4 font-medium">Atual</th>
                      <th className="py-2 pr-4 font-medium">Recomendada</th>
                      <th className="py-2 font-medium">O que muda</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.transition.comparisons.map((c) => (
                      <tr key={c.label} className="border-b border-line/60 align-top">
                        <td className="py-2.5 pr-4 font-medium">{c.label}</td>
                        <td className="py-2.5 pr-4 tabular-nums text-graphite">
                          {c.current ?? '—'}
                        </td>
                        <td className="py-2.5 pr-4 tabular-nums">
                          {c.recommended ?? '—'}
                          {c.delta !== null && c.direction !== 'same' && (
                            <span className="ml-1 text-xs text-graphite">
                              {c.delta > 0 ? '↑' : '↓'} {Math.abs(c.delta)}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 text-xs text-graphite">{c.interpretation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 max-w-prose space-y-2 text-[15px]">
                {report.transition.expectations.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </>
          ) : (
            <div className="mt-4 max-w-prose space-y-2 text-[15px] text-graphite">
              {report.transition.attention_points.map((line) => (
                <p key={line}>{line}</p>
              ))}
              {report.transition.attention_points.length === 0 && (
                <p>Você não informou uma raquete atual, então não há comparação a fazer.</p>
              )}
            </div>
          )}
        </section>

        {/* ── SETUP COMPLETO (§36) ─────────────────────────────────────────── */}
        {report.setup && (
          <section>
            <h2 className="font-display text-2xl font-bold">Seu setup completo</h2>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div className="rounded border border-line bg-white p-5">
                <div className="text-[10px] uppercase tracking-widest text-graphite">Corda</div>
                <div className="mt-2 font-display text-lg font-semibold leading-tight">
                  {report.setup.string_brand} {report.setup.string_model}
                </div>
                <div className="mt-1 text-xs text-graphite">{report.setup.string_type}</div>
              </div>

              <div className="rounded border border-line bg-white p-5">
                <div className="text-[10px] uppercase tracking-widest text-graphite">Espessura</div>
                <div className="display-number mt-2 text-2xl">
                  {report.setup.gauge_mm.toFixed(2)}
                </div>
                <div className="mt-1 text-xs text-graphite">mm</div>
              </div>

              <div className="rounded border-2 border-court bg-white p-5">
                <div className="text-[10px] uppercase tracking-widest text-court">Tensão</div>
                <div className="display-number mt-2 text-2xl">{report.setup.tension_lbs} lbs</div>
                <div className="mt-1 text-xs text-graphite">
                  {report.setup.tension_kg.toFixed(1).replace('.', ',')} kg · faixa{' '}
                  {report.setup.tension_range_lbs[0]}–{report.setup.tension_range_lbs[1]} lbs
                </div>
              </div>
            </div>

            {report.setup.availability_warning && (
              <p className="mt-4 rounded border-l-2 border-warn bg-white px-4 py-3 text-sm">
                {report.setup.availability_warning}
              </p>
            )}

            <Explainer title="Por que essa corda?" lines={report.setup.why_string} />
            <Explainer title="Por que essa tensão?" lines={report.setup.why_tension} />
            <Explainer title="Por que essa combinação funciona?" lines={[report.setup.why_combination]} />
            <Explainer title="Análise de conforto" lines={report.setup.comfort} />
          </section>
        )}

        {/* ── PÓDIO (§28) ──────────────────────────────────────────────────── */}
        <Podium
          entries={report.podium}
          onUnlock={
            report.top3_offer_available ? (
              <div className="mt-8 rounded border-2 border-ink bg-white p-6">
                <h3 className="font-display text-lg font-semibold">
                  Desbloquear as outras duas melhores opções
                </h3>
                <p className="mt-2 max-w-prose text-sm text-graphite">
                  As três foram calculadas pelo mesmo algoritmo e as três são boas opções reais.
                  Desbloqueando, você vê os nomes, os trade-offs e a comparação completa entre elas.
                </p>
                <p className="display-number mt-4 text-2xl">R$ 9,99</p>
                <Link
                  href={`/resultado/${sessionId}?plano=${plano ?? 'racket_report'}&top3=1`}
                  className="mt-4 flex min-h-[56px] items-center justify-center rounded bg-ink
                             font-semibold text-paper transition-opacity hover:opacity-90"
                >
                  Desbloquear Top 3
                </Link>
              </div>
            ) : null
          }
        />

        {/* ── COMPARATIVO TOP 3 (§31) ──────────────────────────────────────── */}
        {report.comparison && report.comparison.length > 1 && (
          <section>
            <h2 className="font-display text-2xl font-bold">Comparação entre as três</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-graphite">
                    <th className="py-2 pr-4 font-medium">Característica</th>
                    {report.comparison.map((entry) => (
                      <th key={entry.rank} className="py-2 pr-4 font-medium">
                        {entry.rank}º
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-line/60">
                    <td className="py-2.5 pr-4 font-medium">Modelo</td>
                    {report.comparison.map((entry) => (
                      <td key={entry.rank} className="py-2.5 pr-4">
                        {entry.product_name}
                      </td>
                    ))}
                  </tr>
                  {['cabeca_sq_in', 'peso_g', 'balanco_mm', 'swingweight', 'rigidez_ra', 'padrao'].map(
                    (spec) => (
                      <tr key={spec} className="border-b border-line/60">
                        <td className="py-2.5 pr-4 font-medium">{SPEC_LABELS[spec] ?? spec}</td>
                        {report.comparison!.map((entry) => (
                          <td key={entry.rank} className="py-2.5 pr-4 tabular-nums text-graphite">
                            {entry.specs[spec] ?? '—'}
                          </td>
                        ))}
                      </tr>
                    ),
                  )}
                  {Object.keys(report.comparison[0]!.indices).map((index) => (
                    <tr key={index} className="border-b border-line/60">
                      <td className="py-2.5 pr-4 font-medium capitalize">{index}</td>
                      {report.comparison!.map((entry) => (
                        <td key={entry.rank} className="py-2.5 pr-4 tabular-nums">
                          {entry.indices[index]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <footer className="court-line pt-8 text-xs text-graphite">
          <p>{report.indices_disclaimer}</p>
          <p className="mt-2">
            Motor {report.engine_version} · catálogo {report.dataset_version}
          </p>
        </footer>
      </div>
    </main>
  );
}

const SPEC_LABELS: Record<string, string> = {
  cabeca_sq_in: 'Cabeça (sq in)',
  peso_g: 'Peso (g)',
  balanco_mm: 'Balanço (mm)',
  swingweight: 'Swingweight',
  rigidez_ra: 'Rigidez (RA)',
  padrao: 'Padrão de cordas',
};

function Explainer({ title, lines }: { title: string; lines: readonly string[] }) {
  if (lines.length === 0) return null;
  return (
    <div className="mt-8">
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <div className="mt-2 max-w-prose space-y-2 text-[15px]">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </div>
  );
}

/** Converte **negrito** dos textos determinísticos. Entrada é nossa, não do usuário. */
function boldify(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}
