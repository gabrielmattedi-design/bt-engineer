import Link from 'next/link';
import { markPageFunnel } from '@/app/funnel-mark';
import { notFound } from 'next/navigation';
import { SiteHeader } from '@/components/marketing/site-header';
import { getTeaser } from '@/app/questionario/actions';
import { preco } from '@/payments/catalogo';

/**
 * Fora do índice dos buscadores.
 *
 * Esta URL é o conteúdo de UMA pessoa, e o acesso a ela é o próprio endereço — quem tem o link
 * tem a página. Indexada, ela deixaria de ser privada sem que ninguém percebesse.
 *
 * Segunda camada: `robots.ts` já pede o mesmo para a rota inteira. As duas existem porque falham
 * de formas diferentes — o arquivo cobre antes da visita, esta tag cobre a página mesmo quando o
 * robô chegou nela por outro caminho.
 */
export const metadata = {
  robots: { index: false, follow: false },
};


/**
 * "Análise concluída" + planos — §27, §25, §26, §57.
 *
 * Prova que houve processamento real ANTES do pagamento, sem revelar o produto: os números são
 * contagens reais da sessão, lidas do resultado persistido. O nome da raquete não chega ao cliente.
 *
 * Sem cronômetro, sem escassez, sem preço "de/por" (§58).
 */
/**
 * O conteúdo dos planos vive em dados, não em JSX repetido.
 *
 * A mesma lista aparece de duas formas — cartão no desktop, comparativo no celular — e duplicá-la
 * em duas marcações garantia que uma das duas ficasse para trás na primeira alteração de escopo.
 * Aqui só existe uma fonte, e ela é o que o produto promete entregar.
 */
const RACKET_PLAN = [
  'Sua raquete recomendada, com marca, modelo e geração',
  'Fit Score e índices de potência, controle, spin e conforto',
  'Por que ela combina com você, e os pontos de atenção',
  'Comparação com sua raquete atual',
] as const;

const SETUP_PLAN = [
  'Tudo do plano anterior',
  /*
    Esta linha faltava, e a ausência dela era o defeito comercial mais caro desta tela.

    `full_setup` concede `rank2_access` e `rank3_access` desde sempre. A lista não dizia, então o
    comparativo mostrava o plano completo como "o de raquete + corda e tensão" — duas das quatro
    entregas ficavam invisíveis exatamente no momento em que a pessoa escolhe entre os dois planos.
    Ela só descobria depois de pagar, que é quando a informação não vale mais nada.
  */
  'A 2ª e a 3ª colocadas, com marca, modelo e leitura técnica',
  'Corda e espessura recomendadas, com disponibilidade no Brasil',
  'Tensão inicial em libras e quilos, com faixa sugerida',
  'Por que essa raquete, essa corda e essa tensão funcionam juntas',
  'Como ajustar no próximo encordoamento',
  'Análise de conforto',
] as const;

/** Uma linha por entrega. `racket` diz se o plano de raquete a inclui — o completo inclui tudo. */
const COMPARISON: readonly { item: string; racket: boolean }[] = [
  ...RACKET_PLAN.map((item) => ({ item, racket: true })),
  ...SETUP_PLAN.filter((item) => item !== 'Tudo do plano anterior').map((item) => ({
    item,
    racket: false,
  })),
];

export default async function AnalisePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const teaser = await getTeaser(sessionId);
  if (!teaser) notFound();

  // Depois do `notFound`: um id inexistente não é uma visita à prévia.
  await markPageFunnel('analysis');

  /**
   * Estado honesto: nenhuma raquete sobreviveu aos FILTROS DUROS.
   *
   * Acontece quando o catálogo está em modo estrito e ainda não foi verificado (a trava de
   * release fazendo seu trabalho — docs/DATA_SOURCING.md §3). Nesse caso NÃO oferecemos um
   * relatório para venda. Vender uma análise que não temos como sustentar seria exatamente o que
   * o §62 proíbe.
   *
   * ⚠️ Esta tela NÃO deve aparecer por score baixo. Já apareceu: enquanto `selectPodium` aplicava
   * `MIN_PODIUM_FIT` também ao primeiro colocado, um perfil legítimo cujo melhor fit era 74
   * chegava aqui depois de o motor avaliar 46 raquetes — e o rodapé exibia "46 raquetes
   * elegíveis" logo abaixo de "não podemos recomendar", que é a própria contradição. Hoje o pódio
   * só é vazio quando `full_ranking` é vazio, e aí o texto abaixo é literalmente verdadeiro.
   * Trancado por tests/ethics/always-recommendable.test.ts.
   */
  if (teaser.matches_found === 0) {
    return (
      <main className="min-h-screen">
        <SiteHeader />
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
      <SiteHeader />

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
          {/*
            A contagem acima é a afirmação central desta página, e ela vem logo antes do preço.
            Deixar o visitante conferir a lista ANTES de pagar é o que separa um número apurado de
            um número de propaganda (§57).
          */}
          <Link href="/catalogo" className="mt-4 inline-block text-sm text-clay underline">
            Ver a lista completa que avaliamos
          </Link>
        </div>

        {/* Planos (§25, §26). */}
        <h2 className="mt-12 font-display text-xl font-semibold">Escolha sua análise</h2>

        {/*
          ═══ LADO A LADO, NÃO EMPILHADOS ═══════════════════════════════════════════════════

          Empilhados, o mais barato ficava inteiro na primeira tela e o completo começava abaixo da
          dobra. Quem não rolasse escolhia entre um plano e nada — e "não rolou" não é uma escolha
          informada entre dois produtos, é a ausência de um deles.

          A comparação é o ponto desta tela: os dois preços e as duas listas precisam ser vistos no
          mesmo olhar. `items-start` mantém os cards com alturas próprias — esticar o mais curto
          para acompanhar o mais longo criaria um vazio que sugere item faltando.
        */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 sm:items-start">
          <article className="flex flex-col rounded border border-line bg-white p-4 sm:p-6">
            {/*
              O selo existe nos DOIS cards, e em cinza no mais simples.

              Sem ele, a coluna da direita tinha uma linha a mais e as duas nasciam desalinhadas:
              o título de um começava na altura do selo do outro, e a comparação — que é a função
              desta tela — passava a exigir do olho um ajuste que não deveria existir.

              A cor é o que mantém a hierarquia: `court` marca a opção destacada, `graphite` apenas
              nomeia. Igualar também a cor faria os dois parecerem o mesmo produto.
            */}
            <div className="text-[10px] font-semibold uppercase tracking-wider text-graphite sm:text-xs">
              Análise de raquete
            </div>
            <h3 className="mt-2 font-display text-base font-semibold sm:text-lg">
              Descubra sua raquete ideal
            </h3>
            <p className="display-number mt-1 text-2xl sm:text-3xl">{preco('racket_report')}</p>

            {/* A lista completa vive no comparativo abaixo no celular; aqui ela é só do desktop. */}
            <ul className="mt-4 hidden space-y-1.5 text-sm text-graphite sm:block">
              {RACKET_PLAN.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="mt-4 hidden text-xs text-graphite sm:block">
              Não inclui corda, espessura nem tensão.
            </p>

            {/*
              O respiro fica FORA do botão.

              Ele estava como `pt-4` dentro do próprio botão, e padding só em cima desloca o texto
              para baixo do centro — o rótulo ficava visivelmente descolado da caixa. Num wrapper,
              o espaço continua existindo e o botão volta a centralizar nos dois eixos.
            */}
            <div className="mt-auto pt-4 sm:pt-5">
              <Link
                href={`/planos/${sessionId}?produto=racket_report`}
                className="flex min-h-[56px] items-center justify-center rounded border-2
                           border-ink px-2 text-center text-sm font-semibold transition-colors
                           hover:bg-ink hover:text-paper sm:text-base"
              >
                Ver minha raquete
              </Link>
            </div>
          </article>

          <article className="flex flex-col rounded border-2 border-court bg-white p-4 sm:p-6">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-court sm:text-xs">
              Análise completa
            </div>
            <h3 className="mt-2 font-display text-base font-semibold sm:text-lg">
              Descubra seu setup completo
            </h3>
            <p className="display-number mt-1 text-2xl sm:text-3xl">{preco('full_setup')}</p>

            <ul className="mt-4 hidden space-y-1.5 text-sm text-graphite sm:block">
              {SETUP_PLAN.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <div className="mt-auto pt-4 sm:pt-5">
              <Link
                href={`/planos/${sessionId}?produto=full_setup`}
                className="flex min-h-[56px] items-center justify-center rounded bg-clay px-2
                           text-center text-sm font-semibold text-white transition-opacity
                           hover:opacity-90 sm:text-base"
              >
                Ver meu setup completo
              </Link>
            </div>
          </article>
        </div>

        {/*
          ═══ NO CELULAR, O DETALHE VIRA COMPARATIVO ════════════════════════════════════════

          Lado a lado em 390 px cabem os dois PREÇOS, não as duas listas: cada coluna fica com uns
          165 px, e uma frase como "Corda e espessura recomendadas, com disponibilidade no Brasil"
          quebra em cinco linhas. Empilhar de novo resolveria a leitura e devolveria o problema que
          o lado a lado veio consertar — o mais barato sozinho na primeira tela.

          A saída é separar as duas perguntas. Em cima, lado a lado, fica a que precisa ser vista
          de uma vez: quanto custa cada um. Aqui embaixo fica o que cada um entrega, em linha única
          por item, com uma marca por plano. Nada é escondido: o mesmo conteúdo das listas do
          desktop, numa forma que 390 px comportam.

          A coluna de marcas é `tabular-nums` e de largura fixa para os traços e os vistos ficarem
          alinhados verticalmente — desalinhados, eles pareceriam ruído em vez de tabela.
        */}
        <div className="mt-6 sm:hidden">
          {/*
            As colunas são nomeadas pelo PLANO, não pelo preço.

            "19,99" e "49,99" já estão nos cards logo acima, e repeti-los aqui obrigava a subir os
            olhos para lembrar qual preço era qual produto. O nome resolve sozinho — e sobrevive a
            uma mudança de preço, que o rótulo numérico não sobreviveria.
          */}
          <div className="flex items-baseline justify-end gap-3 text-[10px] font-semibold uppercase tracking-wider text-graphite">
            <span className="w-16 text-center">Raquete</span>
            <span className="w-16 text-center">Completa</span>
          </div>
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {COMPARISON.map(({ item, racket }) => (
              <li key={item} className="flex items-start gap-3 py-2.5">
                <span className="flex-1 text-sm leading-snug text-graphite">{item}</span>
                <span
                  className={`w-16 shrink-0 text-center text-sm ${racket ? 'text-court' : 'text-line'}`}
                  aria-label={
                    racket ? 'incluído na análise de raquete' : 'não incluído na análise de raquete'
                  }
                >
                  {racket ? '✓' : '—'}
                </span>
                <span
                  className="w-16 shrink-0 text-center text-sm text-court"
                  aria-label="incluído na análise completa"
                >
                  ✓
                </span>
              </li>
            ))}
          </ul>
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
