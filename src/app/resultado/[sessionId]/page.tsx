import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { markPageFunnel } from '@/app/funnel-mark';
import { BrandSignature } from '@/components/marketing/wordmark';
import { SiteHeader } from '@/components/marketing/site-header';
import { Podium } from '@/components/result/podium';
import { AttributeReadout } from '@/components/result/attribute-readout';
import { CompatibilityRadar } from '@/components/result/radar';
import { ShareCard } from '@/components/result/share-card';
import { ShareCardDownload } from '@/components/result/share-card-download';
import { BaixarPdf } from '@/components/result/baixar-pdf';
import { brl } from '@/payments/catalogo';
import { precosPublicados } from '@/payments/precos';
import { getReport } from '@/app/questionario/actions';
import { selectSetupRacket } from './actions';
import { grantedEntitlements } from '@/database/repositories/session-repo';

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
 * Relatório — §35, §36, §64.
 *
 * ─── DE ONDE VÊM OS ENTITLEMENTS ────────────────────────────────────────────────────────────
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

  /*
    Marcado só quando o relatório EXISTE e foi entregue.

    Antes dos redirecionamentos acima, este ponto contaria também quem chegou sem entitlement e
    foi mandado de volta aos planos — inflando o fim do funil justamente com quem não converteu.
  */
  await markPageFunnel('report');

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

  const precos = await precosPublicados();

  return (
    <main className="min-h-screen pb-20">
      {/* Cabeçalho com a marca em destaque (§64) — fixo e clicável de volta ao início. */}
      <SiteHeader tone="dark" />

      <div className="mx-auto max-w-3xl space-y-16 px-6 py-12">
        {/*
          ── ANÁLISE DE UMA VERSÃO ANTERIOR DO MOTOR ────────────────────

          A recomendação é calculada UMA vez, quando o questionário é enviado, e fica gravada.
          Reabrir o link não recalcula nada, e isso é deliberado: um relatório pago não pode mudar
          de conclusão sozinho entre duas leituras.

          Mas a página é montada a cada leitura, então depois de uma mudança de motor um relatório
          antigo fica híbrido — números congelados, apresentação nova. Dizer isso é mais honesto do
          que deixar o leitor comparar dois relatórios e concluir que o produto é instável.
        */}
        {report.analysis_outdated && (
          <div className="rounded border border-warn/40 bg-warn/5 p-5">
            <p className="text-sm leading-relaxed">{report.analysis_outdated.message}</p>
            <Link
              href="/questionario"
              className="mt-3 inline-block text-sm font-semibold underline underline-offset-4"
            >
              Refazer o questionário
            </Link>
          </div>
        )}

        {/* ── MIGRAÇÃO JUVENIL ───────────────────────────────────────
            Antes do match, e não depois.

            Este aviso muda como TODO o resto da página deve ser lido — inclusive o número grande
            de compatibilidade. Colocado no fim, ele chegaria depois de a pessoa já ter concluído
            o que ia concluir, que é o mesmo que não estar lá.
        */}
        {report.junior_transition && (
          <div className="rounded border border-court/40 bg-court/5 p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-court">
              Antes de tudo: uma ressalva importante
            </p>
            <p className="mt-3 max-w-prose text-sm leading-relaxed">{report.junior_transition}</p>
          </div>
        )}

        {/* ── MATCH ──────────────────────────────────────────────── */}
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

            {/* ── PESO NA BALANÇA × ESFORÇO NA MÃO ─────────────────────
                Colada no card da raquete, porque é lá que o número de gramas aparece.

                A objeção que esta nota responde — "por que estão me mandando uma raquete mais
                pesada?" — nasce no instante em que a pessoa lê a especificação. Respondê-la três
                seções abaixo é responder depois de a conclusão já estar formada.
            */}
            {report.weight_reading && (
              <p className="mt-4 max-w-prose rounded border-l-2 border-court bg-white px-4 py-3
                            text-sm leading-relaxed">
                {report.weight_reading}
              </p>
            )}

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

        {/* ── POR QUE COMBINA (§35) ───────────────────────────────── */}
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

        {/* ── O QUE VOCÊ DEVE PERCEBER (§35) ───────────────────────── */}
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
          ── CARD COMPARTILHÁVEL ──────────────────────────────────

          Fica logo depois do resultado e antes da leitura técnica: é o momento em que a pessoa
          acabou de descobrir a raquete e tem vontade de contar. Enterrado no fim do relatório, o
          card seria visto por quem já leu tudo — que é justamente quem menos precisa de um resumo.
        */}
        {winner && report.radar.length > 0 && (
          <section>
            <h2 className="font-display text-2xl font-bold">Seu card</h2>
            <p className="mt-2 max-w-prose text-sm text-graphite">
              Baixe e compartilhe. O card traz seu perfil, a raquete indicada
              {report.setup ? ', a corda e a tensão' : ''}.
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

        {/*
          ═══ AS TROCAS VÊM ANTES DO GRÁFICO ══════════════════════════════════

          Estava depois, e a ordem produzia a leitura errada. Reclamação do usuário, com o card na
          mão: ele pediu POTÊNCIA como prioridade 1, o vértice de potência aparece bem abaixo do
          pedido, e a conclusão foi "parece não ter respeitado meu desejo".

          A explicação para isso já existia e é boa — diz que a raquete mais potente do catálogo é
          um frame de 280 g e 108 pol², desenhado para iniciante, e que no caso dele o lugar certo
          de buscar potência é a corda e a tensão. Só que ela chegava DEPOIS do gráfico que provoca
          a pergunta, e quem fecha a página no vão não chega no motivo.

          Um vão sem explicação ao lado não é transparência, é uma acusação sem defesa.
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

        {/* ── RADAR: quatro leituras nos mesmos eixos ─────────────────── */}
        {report.radar.length > 0 && (
          <section>
            <h2 className="font-display text-2xl font-bold">Seu jogo e a raquete, lado a lado</h2>
            {/*
              ═══ O PESO É O ESPAÇO, E A FRASE NÃO CITA O VÉRTICE ═══════════════════════

              Uma versão anterior dizia "a largura de cada fatia é o peso que aquele eixo teve na
              decisão". Observação do usuário, e ela está certa: cada indicador é um VÉRTICE, e um
              vértice tem duas arestas, uma de cada lado, compartilhadas com os vizinhos — não havia
              resposta para "qual aresta é a minha".

              A versão seguinte falava em "abertura" e situava o vértice no meio dela. Correta, e
              ainda assim cara: obrigava o leitor a montar a geometria na cabeça antes de olhar o
              desenho. O que ele precisa saber cabe em uma frase sobre ESPAÇO, que é o que o olho já
              enxerga sem instrução. A geometria exata continua documentada em `radar-geometry.ts`.
            */}
            <p className="mt-2 max-w-prose text-sm text-graphite">
              Cada eixo vai de 0 a 100, e <strong>o quanto ele ocupa em volta do centro é o peso que
              ele teve na decisão</strong>. Quanto mais espaço o eixo ocupa, mais aquele critério
              contou.
            </p>
            {/*
              A LINHA LARANJA É DITA PELO QUE SE QUER DELA, NÃO PELO QUE FALTA.

              Duas versões anteriores descreviam o VÃO — "onde o verde fica abaixo dela houve uma
              troca", depois "ela entrega menos do que o seu perfil pedia". As duas ensinavam o
              leitor a caçar o buraco, e o buraco é a exceção: na maioria dos eixos o verde encosta
              na laranja. Dito pela proximidade, o gráfico passa a ser lido pela regra em vez de
              pela exceção, sem esconder nada — a distância continua visível para quem olhar.

              A palavra "troca" saiu junto, e por um motivo próprio: ela aparecia três vezes na
              mesma página em sentidos ligeiramente diferentes, e a seção que a explica se chama
              "As trocas desta escolha". Nomear o vão com o jargão antes de explicar o jargão é
              pedir para o leitor aceitar o termo de graça.
            */}
            <p className="mt-3 max-w-prose text-sm text-graphite">
              A linha laranja é o seu alvo: <strong>o melhor que poderia existir para você</strong>.
              O objetivo é que a raquete recomendada fique o mais próximo possível desta linha.
              Quanto mais próximo dela, mais ela entregou naquele critério.
            </p>

            <div className="mt-6 rounded border border-line bg-white p-6">
              <CompatibilityRadar axes={report.radar} />
            </div>
            {/*
              O peso vive AQUI, e só aqui.

              Ele já esteve impresso em cada vértice do radar, e ali produzia a leitura errada:
              "Spin 3%" ao lado de "Seu swing 17%" faz parecer que o spin foi ignorado. Os três
              eixos de bola são FATIAS de um único critério — o que você pediu —, repartidas na
              ordem de prioridade declarada; swing é um critério inteiro. Fatia contra bolo não é
              comparação.

              Somados por bloco, os números são da mesma natureza e podem ser lidos um contra o
              outro. É a única forma em que o peso informa em vez de confundir.
            */}
            {(() => {
              const pedido = report.radar
                .filter((a) => a.group === 'bola')
                .reduce((sum, a) => sum + a.weight, 0);
              const encaixe = report.radar
                .filter((a) => a.group === 'voce')
                .reduce((sum, a) => sum + a.weight, 0);

              /*
                ═══ OS DOIS NÚMEROS SÃO A REPARTIÇÃO DO GRÁFICO, NÃO DA DECISÃO INTEIRA ═════

                Os pesos crus dos oito eixos somam ~90%, não 100. O que falta é `transition_fit` —
                o quanto a mudança seria brusca em relação à raquete que a pessoa já usa —, que não
                tem eixo no radar de propósito: os oito respondem "o que a raquete faz" e "o quanto
                ela serve a você", e a transição não é nem uma coisa nem outra, ela mede a
                DISTÂNCIA entre dois equipamentos. O lugar dela é a tabela de comparação.

                A versão anterior mostrava os três números (22 / 68 / 10) e explicava o terceiro.
                Foi pior, e o usuário disse por quê: um percentual chamado "distância entre a sua
                atual e a recomendada" ao lado de um match de 92% convida a leitura de que a
                distância entre as duas raquetes é de 10%, que é outra grandeza inteiramente.

                Então os dois blocos são renormalizados ENTRE SI e fecham 100. A frase diz "entre
                os oito eixos do gráfico" e não "da decisão", porque é isso que o número é: a
                repartição do que está desenhado. Chamá-lo de fração da decisão seria trocar um
                texto confuso por um texto errado, e o critério que não aparece continua explicado
                onde ele mora, na comparação com a raquete atual.

                O segundo sai por SUBTRAÇÃO para que a soma feche 100 mesmo com arredondamento.
              */
              const base = pedido + encaixe;
              const pedidoPct = base > 0 ? Math.round((pedido / base) * 100) : 50;
              const encaixePct = 100 - pedidoPct;

              return (
                <p className="mt-4 text-sm leading-relaxed text-graphite">
                  Somando por bloco, entre os oito eixos do gráfico:{' '}
                  <strong>o que você pediu</strong> (potência, controle e spin) responde por{' '}
                  <strong>{pedidoPct}%</strong> e <strong>o encaixe com você</strong> (conforto,
                  peso, nível, swing e estilo) por <strong>{encaixePct}%</strong>. Os três primeiros
                  são fatias de um mesmo critério, repartidas na ordem de prioridade que você
                  declarou.
                </p>
              );
            })()}
          </section>
        )}

        {/*
          ── AS TROCAS DA ESCOLHA (§35) ───────────────────────────────

          Antes esta seção se chamava "Pontos de atenção" e listava as penalizações do motor. O
          efeito, logo abaixo do nome do produto recém-comprado, era o de uma confissão: "você
          pediu mais estabilidade, mas este frame vai na direção contrária". Verdadeiro, e lido
          como falha do sistema.

          O fato continua dito com todas as letras — o que muda é que ele vem com o raciocínio ao
          lado, e o raciocínio é verificável: a alternativa citada existe no ranking e o que ela
          custaria sai do mesmo breakdown que sustenta o resto do relatório. Esconder a troca seria
          o §35 ao contrário; mostrá-la sem o motivo é o que estava errado.
        */}

        {/* ── TRANSIÇÃO (§22) ────────────────────────────────────── */}
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
          ── UPGRADE DE SETUP ──────────────────────────────────────

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
                bola gira; a tensão ajusta o resto. Você escolhe para qual raquete quer o cálculo —
                e pode trocar depois.
              </p>
              {/*
                O QUE ESTE PREÇO ABRE, DITO ANTES DE PAGAR.

                `setup_upgrade` também concede `rank2_access` e `rank3_access` (ver
                `PRODUCT_ENTITLEMENTS`). Isso estava no código e não estava na oferta: a pessoa
                pagava e descobria depois. Uma vantagem que só aparece após o pagamento não vende
                nada e ainda parece pegadinha quando o cliente compara os preços sozinho.
              */}
              <ul className="mt-4 space-y-1.5 text-sm">
                <li className="flex gap-2">
                  <span aria-hidden className="text-court">✓</span>
                  <span>Corda, espessura e tensão inicial, com a faixa de ajuste</span>
                </li>
                <li className="flex gap-2">
                  <span aria-hidden className="text-court">✓</span>
                  <span>
                    <strong>A 2ª e a 3ª colocadas</strong>, com marca, modelo e leitura técnica
                  </span>
                </li>
                <li className="flex gap-2">
                  <span aria-hidden className="text-court">✓</span>
                  <span>A comparação lado a lado entre as três</span>
                </li>
              </ul>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href={`/planos/${sessionId}?produto=setup_upgrade`}
                  className="flex min-h-[56px] items-center justify-center gap-3 rounded bg-court
                             px-6 font-semibold text-white transition-opacity hover:opacity-90"
                >
                  <span className="display-number text-lg">{brl(precos.setup_upgrade)}</span>
                  <span>Completar meu setup</span>
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* ── SETUP COMPLETO (§36) ────────────────────────────────── */}
        {report.setup && (
          <section>
            <h2 className="font-display text-2xl font-bold">Seu setup completo</h2>

            {/*
              PARA QUAL raquete o setup vale.

              Com o pódio desbloqueado, corda e tensão flutuando ao lado de três nomes seriam
              ambíguas — e a escolha da corda depende do frame: padrão, cabeça e rigidez mudam a
              tensão recomendada. Dizer a raquete é obrigatório; poder trocar é o que o upgrade de
              setup comprou.
            */}
            <p className="mt-2 max-w-prose text-sm text-graphite">
              Calculado para a{' '}
              <strong className="text-ink">{setupTarget?.product_name ?? 'sua raquete'}</strong>.
              Corda e tensão dependem do frame — trocar de raquete muda a recomendação.
            </p>

            {/*
              Fora do PDF: o quadro inteiro, e não só os botões.

              A impressão esconde `form` e `button`, mas a MOLDURA e o título ficavam — no papel
              saía uma caixa vazia com "Calcular o setup para outra do pódio" em cima e nada
              embaixo. É o mesmo defeito que o seletor de raquete já tinha, num lugar novo: quem
              esconde só o controle esquece que a legenda dele existe por causa do controle.
            */}
            {setupChoices.length > 1 && (
              <div className="te-sem-impressao mt-4 rounded border border-line bg-white p-5">
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

        {/* ── VEREDICTO SOBRE A RAQUETE ATUAL ────────────────────────────────
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

            {/* ── E O QUE FAZER COM ELA HOJE ───────────────────────────────
                Dentro do mesmo quadro, e não numa seção à parte.

                A pergunta que este bloco responde nasce da frase acima — "a sua ficou em 12º" leva
                direto a "e daí, o que eu faço com ela?". Separar as duas em seções distintas
                obrigaria a pessoa a atravessar o pódio inteiro entre a pergunta e a resposta.
            */}
            {report.current_racket_setup && (
              <div className="mt-6 border-t border-court/20 pt-6">
                <p className="text-xs uppercase tracking-[0.2em] text-graphite">
                  Sem trocar de raquete
                </p>
                <h3 className="mt-2 font-display text-xl font-bold">
                  O melhor setup para a sua {report.current_racket_setup.racket_name}
                </h3>
                <p className="mt-2 max-w-prose text-sm leading-relaxed text-graphite">
                  Rodamos o mesmo cálculo de corda e tensão sobre o quadro que você já tem. É o que
                  aproxima a sua raquete do ideal por uma fração do custo de trocá-la.
                </p>

                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  <div className="rounded border border-line bg-white p-5">
                    <div className="text-[10px] uppercase tracking-widest text-graphite">Corda</div>
                    <div className="mt-2 font-display text-lg font-semibold leading-tight">
                      {report.current_racket_setup.string_brand}{' '}
                      {report.current_racket_setup.string_model}
                    </div>
                    <div className="mt-1 text-xs text-graphite">
                      {report.current_racket_setup.string_type}
                    </div>
                  </div>

                  <div className="rounded border border-line bg-white p-5">
                    <div className="text-[10px] uppercase tracking-widest text-graphite">
                      Espessura
                    </div>
                    <div className="display-number mt-2 text-2xl">
                      {report.current_racket_setup.gauge_mm.toFixed(2)}
                    </div>
                    <div className="mt-1 text-xs text-graphite">mm</div>
                  </div>

                  <div className="rounded border border-line bg-white p-5">
                    <div className="text-[10px] uppercase tracking-widest text-graphite">Tensão</div>
                    <div className="display-number mt-2 text-2xl">
                      {report.current_racket_setup.tension_lbs} lbs
                    </div>
                    <div className="mt-1 text-xs text-graphite">
                      {report.current_racket_setup.tension_kg.toFixed(1).replace('.', ',')} kg ·
                      faixa {report.current_racket_setup.tension_range_lbs[0]}–
                      {report.current_racket_setup.tension_range_lbs[1]} lbs
                    </div>
                  </div>
                </div>

                {report.current_racket_setup.availability_warning && (
                  <p className="mt-4 rounded border-l-2 border-warn bg-white px-4 py-3 text-sm">
                    {report.current_racket_setup.availability_warning}
                  </p>
                )}

                <Explainer
                  title="O que muda em relação ao que você usa hoje"
                  lines={report.current_racket_setup.change_from_current}
                />
                <Explainer
                  title="Por que essa corda para a sua raquete"
                  lines={report.current_racket_setup.why_string}
                />
                <Explainer
                  title="Por que essa tensão"
                  lines={report.current_racket_setup.why_tension}
                />

                {/*
                  O limite fecha o bloco, e não abre.

                  Ele precisa ser lido DEPOIS dos números — quem lê a ressalva antes de saber o que
                  está sendo proposto descarta a proposta. E precisa estar aqui: uma lista só de
                  ganhos transformaria uma análise em argumento de venda (§58).
                */}
                <p className="mt-8 max-w-prose rounded border-l-2 border-court bg-white px-4 py-3
                              text-sm leading-relaxed">
                  {report.current_racket_setup.ceiling_note}
                </p>
              </div>
            )}
          </section>
        )}

        {/* ── PÓDIO (§28) ─────────────────────────────────────────── */}
        <Podium
          entries={report.podium}
          tie={report.podium_tie ?? null}
          separation={report.separation ?? null}
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
                        {/*
                          O preço acompanha a POSIÇÃO, e não uma SKU escolhida à mão.

                          Este bloco se repete para a 2ª e para a 3ª, e o valor estava escrito
                          direto no JSX — as duas mostravam o mesmo número porque hoje elas custam
                          o mesmo. No dia em que deixarem de custar, uma das duas passaria a
                          anunciar o preço da outra, e o cliente só descobriria no checkout.
                        */}
                        <span className="display-number text-lg">
                          {brl(entry.rank === 2 ? precos.unlock_rank_2 : precos.unlock_rank_3)}
                        </span>
                        <span>Desbloquear</span>
                      </Link>
                    </div>
                  ))}
              </div>
            ) : null
          }
        />

        {/* ── COMPARATIVO TOP 3 (§31) ───────────────────────────────── */}
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

        {/*
          O download fica no FIM, e não junto do card compartilhável no início.

          São gestos diferentes: o card é impulso — a pessoa acabou de descobrir a raquete e quer
          contar. Salvar o relatório inteiro é o gesto de quem terminou de ler e quer guardar, ou
          levar ao encordoador. Oferecer no começo interromperia a leitura para propor arquivar algo
          que ainda não foi lido.
        */}
        <div className="te-sem-impressao border-t border-line pt-8">
          <h2 className="font-display text-lg font-semibold">Guardar este relatório</h2>
          <p className="mt-2 max-w-prose text-sm text-graphite">
            Sai em página única, sem cortes entre folhas — do jeito que você lê aqui. Útil para levar
            ao encordoador.
          </p>
          <div className="mt-4">
            <BaixarPdf />
          </div>
        </div>

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
/**
 * Converte `**assim**` em negrito — e escapa tudo o mais antes.
 *
 * ═══ POR QUE O ESCAPE, SE HOJE A ENTRADA É SEGURA ════════════════════════════════════════════
 *
 * O retorno vai para `dangerouslySetInnerHTML`, que é a única porta do React por onde HTML cru
 * entra sem passar pela proteção automática contra injeção.
 *
 * Auditado em ago/2026: as linhas que chegam aqui vêm de `explainExpectations`, que interpola
 * apenas rótulos de eixo definidos como constantes no próprio código. Nada digitado por ninguém
 * chega até aqui. Não é explorável hoje.
 *
 * O escape entra porque "hoje" é a palavra frágil dessa frase. O questionário guarda texto livre —
 * o nome do jogador e a descrição da raquete atual — e basta alguém decidir que a expectativa fica
 * melhor citando um dos dois para que o relatório passe a executar o que a pessoa digitou, no
 * navegador de quem abrir o link. Uma linha de escape fecha a classe inteira, para sempre, e não
 * custa nada.
 *
 * A ordem importa: escapar DEPOIS de converter transformaria o `<strong>` recém-criado em texto.
 */
function boldify(text: string): string {
  const seguro = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  return seguro.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}
