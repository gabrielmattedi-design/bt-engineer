import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { BrandSignature, Wordmark } from '@/components/marketing/wordmark';
import { Podium } from '@/components/result/podium';
import { AttributeReadout } from '@/components/result/attribute-readout';
import { CompatibilityRadar } from '@/components/result/radar';
import { ShareCard } from '@/components/result/share-card';
import { ShareCardDownload } from '@/components/result/share-card-download';
import { getReport } from '@/app/questionario/actions';
import { selectSetupRacket } from './actions';
import { grantedEntitlements } from '@/database/repositories/session-repo';

/**
 * Relatório — §35, §36, §64.
 *
 * ─── DE ONDE VÊM OS ENTITLEMENTS ─────────────────────────────────────────────────────────────
 *
 * Da tabela `entitlements`, e SÓ dela. Até este commit eles eram derivados do query param
 * (`?plano=full_setup`), o que significava que qualquer pessoa lia o relatório completo editando a
 * URL — uma violação direta do §32 ("a API não deve entregar dados premium para usuário sem
 * entitlement").
 *
 * A tabela é escrita exclusivamente pelo webhook de pagamento confirmado (§33). Não existe outro
 * caminho de concessão em nenhum lugar do sistema.
 *
 * A fronteira já estava no lugar certo: a página não decide o que mostrar, ela recebe de
 * `getReport()` um payload CONSTRUÍDO por entitlement — dados não comprados nunca chegam a existir
 * na resposta.
 */
export default async function ResultadoPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const granted = await grantedEntitlements(sessionId);

  // Sem nenhum entitlement não há relatório a servir. Mandamos de volta para a página de análise,
  // que apresenta os planos honestamente — nunca para uma versão "quase completa" do relatório.
  if (granted.length === 0) redirect(`/analise/${sessionId}`);

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

  /**
   * Raquetes do pódio elegíveis a receber o setup: só as DESBLOQUEADAS.
   *
   * Oferecer o setup de uma posição ainda bloqueada revelaria por tabela qual é o produto — a
   * corda e a tensão descrevem o frame com precisão suficiente para identificá-lo.
   */
  const setupChoices = report.podium.filter((entry) => !entry.locked);

  const setupTarget =
    setupChoices.find((entry) => entry.variant_id === report.setup_for_variant_id) ??
    setupChoices[0] ??
    null;

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

            {/* Leitura técnica: quanto este frame entrega em cada aspecto, em largura cheia. */}
            {winner && (
              <AttributeReadout
                indices={winner.indices}
                className="mt-8 rounded border border-line bg-white p-6"
              />
            )}

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

        {/*
          ── CARD COMPARTILHÁVEL ────────────────────────────────────────────

          Fica logo depois do resultado e antes da leitura técnica: é o momento em que a pessoa
          acabou de descobrir a raquete e tem vontade de contar. Enterrado no fim do relatório, o
          card seria visto por quem já leu tudo — que é justamente quem menos precisa de um resumo.
        */}
        {winner && report.radar.length > 0 && (
          <section>
            <h2 className="font-display text-2xl font-bold">Seu card</h2>
            <p className="mt-2 max-w-prose text-sm text-graphite">
              Baixe e compartilhe. O card traz seu perfil, a raquete indicada
              {report.setup ? ', a corda e a tensão' : ''} — e nada que você não queira mostrar.
            </p>

            <div className="mt-6 overflow-hidden rounded border border-line">
              <ShareCard
                id="te-share-card"
                data={{
                  playerName: report.identity.playerName,
                  phrase: report.identity.phrase,
                  level: report.identity.level,
                  matchScore: winner.fit_score,
                  racketBrand: winner.brand,
                  racketName: winner.product_name,
                  radar: report.radar,
                  setup: report.setup
                    ? {
                        stringBrand: report.setup.string_brand,
                        stringModel: report.setup.string_model,
                        gaugeMm: report.setup.gauge_mm,
                        tensionLbs: report.setup.tension_lbs,
                      }
                    : null,
                }}
              />
            </div>

            <div className="mt-5">
              <ShareCardDownload svgId="te-share-card" fileName="tennis-engineer" />
            </div>
          </section>
        )}

        {/* ── RADAR: quatro leituras nos mesmos eixos ──────────────────────── */}
        {report.radar.length > 0 && (
          <section>
            <h2 className="font-display text-2xl font-bold">Seu jogo e a raquete, lado a lado</h2>
            <p className="mt-2 max-w-prose text-sm text-graphite">
              Cada eixo vai de 0 a 100 em ADEQUAÇÃO ao seu jogo, e traz ao lado quanto ele pesou na escolha. A linha laranja é o TETO: o melhor que existe para você em cada aspecto entre as raquetes que ainda são opção real. Onde o verde encosta nela, aquele ponto está no máximo possível; onde fica abaixo, houve uma troca — e o tamanho do vão é o tamanho da troca.</p>
            <div className="mt-6 rounded border border-line bg-white p-6">
              <CompatibilityRadar axes={report.radar} />
            </div>
          </section>
        )}

        {/*
          ── AS TROCAS DA ESCOLHA (§35) ─────────────────────────────────────

          Antes esta seção se chamava "Pontos de atenção" e listava as penalizações do motor. O
          efeito, logo abaixo do nome do produto recém-comprado, era o de uma confissão: "você
          pediu mais estabilidade, mas este frame vai na direção contrária". Verdadeiro, e lido
          como falha do sistema.

          O fato continua dito com todas as letras — o que muda é que ele vem com o raciocínio ao
          lado, e o raciocínio é verificável: a alternativa citada existe no ranking e o que ela
          custaria sai do mesmo breakdown que sustenta o resto do relatório. Esconder a troca seria
          o §35 ao contrário; mostrá-la sem o motivo é o que estava errado.
        */}
        {winner && winner.attention.length > 0 && (
          <section>
            <h2 className="font-display text-2xl font-bold">As trocas desta escolha</h2>
            <p className="mt-2 max-w-prose text-sm text-graphite">
              Nenhuma raquete é a melhor em tudo — melhorar um eixo custa outro. Estas foram as
              trocas feitas para chegar ao melhor conjunto para o seu jogo.
            </p>
            <ul className="mt-5 max-w-prose space-y-5 border-l-2 border-court pl-5 text-[15px]">
              {winner.attention.map((item) => (
                <li key={item.headline}>
                  <p className="font-medium">{item.headline}</p>
                  {item.rationale && (
                    <p className="mt-1.5 text-sm text-graphite">{item.rationale}</p>
                  )}
                </li>
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

        {/*
          ── UPGRADE DE SETUP ───────────────────────────────────────────────

          Aparece só para quem tem a raquete e ainda não tem corda e tensão. A escolha de PARA QUAL
          das desbloqueadas fica dentro da própria seção de setup, depois da compra — oferecer a
          escolha antes exigiria explicar uma decisão que ainda não é possível tomar.
        */}
        {!report.setup && winner && (
          <section>
            <div className="rounded border-2 border-court bg-white p-6">
              <div className="text-xs font-semibold uppercase tracking-wider text-court">
                Completar a análise
              </div>
              <h2 className="mt-2 font-display text-xl font-semibold">
                Corda, espessura e tensão
              </h2>
              <p className="mt-2 max-w-prose text-sm text-graphite">
                A raquete é metade do setup. A corda define o que você sente no impacto e quanto a
                bola gira; a tensão ajusta o resto. Você escolhe para qual das raquetes já
                desbloqueadas quer o cálculo — e pode trocar depois.
              </p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href={`/planos/${sessionId}?produto=setup_upgrade`}
                  className="flex min-h-[56px] items-center justify-center gap-3 rounded bg-court
                             px-6 font-semibold text-white transition-opacity hover:opacity-90"
                >
                  <span className="display-number text-lg">R$ 39,99</span>
                  <span>Completar meu setup</span>
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* ── SETUP COMPLETO (§36) ─────────────────────────────────────────── */}
        {report.setup && (
          <section>
            <h2 className="font-display text-2xl font-bold">Seu setup completo</h2>

            {/*
              PARA QUAL raquete o setup vale.

              Com o pódio desbloqueado, corda e tensão flutuando ao lado de três nomes seriam
              ambíguas — e a escolha da corda depende do frame: padrão, cabeça e rigidez mudam a
              tensão recomendada. Dizer a raquete é obrigatório; poder trocar é o que o upgrade de
              R$ 39,99 comprou.
            */}
            <p className="mt-2 max-w-prose text-sm text-graphite">
              Calculado para a{' '}
              <strong className="text-ink">{setupTarget?.product_name ?? 'sua raquete'}</strong>.
              Corda e tensão dependem do frame — trocar de raquete muda a recomendação.
            </p>

            {setupChoices.length > 1 && (
              <div className="mt-4 rounded border border-line bg-white p-5">
                <p className="text-sm font-medium">Calcular o setup para outra do pódio</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {setupChoices.map((entry) => {
                    const active = entry.variant_id === setupTarget?.variant_id;
                    return (
                      <form key={entry.variant_id} action={selectSetupRacket}>
                        <input type="hidden" name="session_id" value={sessionId} />
                        <input type="hidden" name="variant_id" value={entry.variant_id} />
                        <button
                          type="submit"
                          disabled={active}
                          className={
                            active
                              ? 'min-h-[48px] rounded border-2 border-court bg-court/5 px-4 text-sm font-semibold'
                              : 'min-h-[48px] rounded border-2 border-line px-4 text-sm transition-colors hover:border-court'
                          }
                        >
                          {entry.rank}ª · {entry.product_name}
                        </button>
                      </form>
                    );
                  })}
                </div>
              </div>
            )}

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

        {/* ── VEREDICTO SOBRE A RAQUETE ATUAL ──────────────────────────────────
            Vem ANTES do pódio de propósito.

            O pódio é uma lista de coisas para comprar. Quando a raquete que a pessoa já tem está
            tecnicamente empatada com a primeira colocada, mostrar a lista primeiro e a ressalva
            depois inverte a ordem da honestidade: ela decide olhando o produto e só então descobre
            que não precisava. A informação que muda a decisão tem que chegar primeiro.
        */}
        {report.current_racket_standing && (
          <section
            className={`rounded-2xl border p-6 sm:p-8 ${
              report.current_racket_standing.verdict === 'keep'
                ? 'border-court/30 bg-court/5'
                : 'border-black/10 bg-white'
            }`}
          >
            <p className="text-xs uppercase tracking-[0.2em] text-graphite">
              {report.current_racket_standing.verdict === 'keep'
                ? 'Antes de trocar de raquete'
                : 'Sua raquete atual nesta análise'}
            </p>
            <p className="mt-3 text-lg font-semibold text-court">
              {report.current_racket_standing.product_name} — {report.current_racket_standing.rank}º
              lugar, {report.current_racket_standing.fit_score}% de compatibilidade
            </p>
            <p className="mt-2 text-sm leading-relaxed text-graphite">
              {report.current_racket_standing.message}
            </p>
          </section>
        )}

        {/* ── PÓDIO (§28) ──────────────────────────────────────────────────── */}
        <Podium
          entries={report.podium}
          /*
            Uma oferta POR POSIÇÃO bloqueada, não uma oferta para o conjunto.

            O preço é o mesmo para cada uma, e quem só tem curiosidade sobre a 2ª não precisa
            pagar pela 3ª. Cada card já mostra o próprio fit e, quando a diferença para a 1ª é
            grande, o aviso de qualidade — então a decisão de desbloquear é tomada com o número na
            frente, não no escuro.
          */
          onUnlock={
            report.top3_offer_available ? (
              <div className="mt-8 space-y-3">
                {report.podium
                  .filter((entry) => entry.locked)
                  .map((entry) => (
                    <div
                      key={entry.rank}
                      className="flex flex-col gap-3 rounded border-2 border-ink bg-white p-5
                                 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <h3 className="font-display font-semibold">
                          Desbloquear a {entry.rank}ª colocada
                        </h3>
                        <p className="mt-1 text-sm text-graphite">
                          Marca, modelo, leitura técnica e por que ela ficou nesta posição.
                        </p>
                      </div>
                      <Link
                        href={`/planos/${sessionId}?produto=unlock_rank_${entry.rank}`}
                        className="flex min-h-[56px] shrink-0 items-center justify-center gap-3
                                   rounded bg-ink px-6 font-semibold text-paper
                                   transition-opacity hover:opacity-90"
                      >
                        <span className="display-number text-lg">R$ 9,99</span>
                        <span>Desbloquear</span>
                      </Link>
                    </div>
                  ))}
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
                  {['cabeca_sq_in', 'peso_g', 'balanco_mm', 'perfil_quadro_mm', 'comprimento_in', 'padrao'].map(
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
          <BrandSignature className="mb-4" />
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
  perfil_quadro_mm: 'Perfil do quadro (mm)',
  comprimento_in: 'Comprimento (in)',
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
