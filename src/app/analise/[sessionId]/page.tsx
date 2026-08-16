import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Wordmark } from '@/components/marketing/wordmark';
import { getTeaser } from '@/app/questionario/actions';

/**
 * "Análise concluída" + planos — §27, §25, §26, §57.
 *
 * Prova que houve processamento real ANTES do pagamento, sem revelar o produto: os números são
 * contagens reais da sessão, lidas do resultado persistido. O nome da raquete não chega ao cliente.
 *
 * Sem cronômetro, sem escassez, sem preço "de/por" (§58).
 */
export default async function AnalisePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const teaser = await getTeaser(sessionId);
  if (!teaser) notFound();

  /**
   * Estado honesto: nenhuma raquete sobreviveu aos filtros.
   *
   * Acontece quando o catálogo está em modo estrito e ainda não foi verificado (a trava de
   * release fazendo seu trabalho — docs/DATA_SOURCING.md §3). Nesse caso NÃO oferecemos um
   * relatório para venda. Vender uma análise que não temos como sustentar seria exatamente o que
   * o §62 proíbe.
   */
  if (teaser.matches_found === 0) {
    return (
      <main className="min-h-screen">
        <header className="border-b border-line px-6 py-5">
          <Wordmark size="sm" />
        </header>
        <section className="mx-auto max-w-2xl px-6 py-16">
          <h1 className="font-display text-3xl font-bold">
            Ainda não podemos recomendar com segurança
          </h1>
          <p className="mt-5 max-w-prose text-[15px]">
            Analisamos seu perfil normalmente, mas nenhuma raquete do nosso catálogo passou nos
            critérios de verificação de dados necessários para uma recomendação paga. Isso é uma
            limitação nossa, não do seu perfil.
          </p>
          <p className="mt-4 max-w-prose text-[15px] text-graphite">
            Preferimos não vender uma análise que não temos como sustentar tecnicamente. Assim que
            a curadoria do catálogo estiver concluída, sua análise poderá ser gerada.
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex min-h-[56px] items-center justify-center rounded border-2
                       border-ink px-8 font-semibold transition-colors hover:bg-ink hover:text-paper"
          >
            Voltar ao início
          </Link>
          <p className="mt-8 text-xs text-graphite">
            Motor {teaser.engine_version} · catálogo {teaser.dataset_version} ·{' '}
            {teaser.candidates_evaluated} raquetes elegíveis
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-line px-6 py-5">
        <Wordmark size="sm" />
      </header>

      <section className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Análise concluída</h1>

        <ul className="mt-8 space-y-2">
          {teaser.analysis_steps.map((step) => (
            <li key={step} className="flex items-center gap-3 text-[15px]">
              <span className="text-court" aria-hidden>✓</span>
              {step}
            </li>
          ))}
        </ul>

        {/* Números REAIS da sessão (§57). */}
        <div className="mt-10 rounded border border-line bg-white p-6">
          <p className="text-[15px]">
            Avaliamos{' '}
            <strong className="tabular-nums">{teaser.candidates_evaluated} raquetes</strong> e{' '}
            <strong className="tabular-nums">
              {teaser.string_variants_evaluated} variantes de corda
            </strong>{' '}
            disponíveis no Brasil.
          </p>
          <p className="mt-3 text-[15px]">
            Encontramos{' '}
            <strong className="tabular-nums">{teaser.matches_found} raquetes</strong> com alta
            compatibilidade com o seu jogo.
          </p>
          <p className="mt-3 text-sm text-graphite">
            Confiança da análise: <strong className="text-ink">{teaser.confidence_level}</strong>
          </p>
        </div>

        {/* Planos (§25, §26). */}
        <h2 className="mt-12 font-display text-xl font-semibold">Escolha seu relatório</h2>

        <div className="mt-5 space-y-4">
          <article className="rounded border border-line bg-white p-6">
            <h3 className="font-display text-lg font-semibold">Descubra sua raquete ideal</h3>
            <p className="display-number mt-1 text-3xl">R$ 19,99</p>
            <ul className="mt-4 space-y-1.5 text-sm text-graphite">
              <li>Sua raquete recomendada, com marca, modelo e geração</li>
              <li>Fit Score e índices de potência, controle, spin e conforto</li>
              <li>Por que ela combina com você, e os pontos de atenção</li>
              <li>Comparação com sua raquete atual</li>
            </ul>
            <p className="mt-4 text-xs text-graphite">Não inclui corda, espessura nem tensão.</p>
            <Link
              href={`/planos/${sessionId}?produto=racket_report`}
              className="mt-5 flex min-h-[56px] items-center justify-center rounded border-2
                         border-ink font-semibold transition-colors hover:bg-ink hover:text-paper"
            >
              Ver minha raquete
            </Link>
          </article>

          <article className="rounded border-2 border-court bg-white p-6">
            <div className="text-xs font-semibold uppercase tracking-wider text-court">
              Análise completa
            </div>
            <h3 className="mt-2 font-display text-lg font-semibold">
              Descubra seu setup completo
            </h3>
            <p className="display-number mt-1 text-3xl">R$ 49,99</p>
            <ul className="mt-4 space-y-1.5 text-sm text-graphite">
              <li>Tudo do plano anterior</li>
              <li>Corda e espessura recomendadas, com disponibilidade no Brasil</li>
              <li>Tensão inicial em libras e quilos, com faixa sugerida</li>
              <li>Por que essa raquete, essa corda e essa tensão funcionam juntas</li>
              <li>Como ajustar no próximo encordoamento</li>
              <li>Análise de conforto</li>
            </ul>
            <Link
              href={`/planos/${sessionId}?produto=full_setup`}
              className="mt-5 flex min-h-[56px] items-center justify-center rounded bg-court
                         font-semibold text-white transition-opacity hover:opacity-90"
            >
              Ver meu setup completo
            </Link>
          </article>
        </div>

        <p className="mt-8 text-xs text-graphite">
          Pagamento via PIX ou cartão. Reembolso integral em até 7 dias.
        </p>
        <p className="mt-2 text-xs text-graphite">
          Motor {teaser.engine_version} · catálogo {teaser.dataset_version}
        </p>
      </section>
    </main>
  );
}
