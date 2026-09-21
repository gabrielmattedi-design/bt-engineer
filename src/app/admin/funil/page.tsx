import { redirect } from 'next/navigation';
import { ehDiaDeCalendario, janelaDoPeriodo } from '@/lib/periodo';
import { isAuthenticated } from '../auth';
import { AdminNav } from '../nav';
import {
  contarJornadasDeCupomNoFunil,
  contarRelatoriosSemPagamento,
  coorteDeChegada,
  funnelReport,
  funnelStartedAt,
  quizDropoff,
} from '@/database/repositories/funnel-repo';
import { dataCurta } from '@/lib/datas';
import { semMarcacao, semMarcacaoNaCoorte, totalDasOrigens } from '@/lib/origens';
import { brl } from '@/payments/catalogo';
import { campaignReport } from '@/database/repositories/campaign-repo';
import { envioDeCompras } from '@/database/repositories/meta-repo';
import {
  contarCompradoresDistintos,
  contarVendas,
  somarReceita,
} from '@/database/repositories/commerce-repo';
import { explicarMotivo } from '@/lib/motivo-do-envio';
import {
  calcularLucro,
  emReais,
  lerDinheiroEmCentavos,
  lerTaxaPercentual,
} from '@/lib/lucro';
import { withAutoBootstrap } from '@/database/setup';
import { ResetFunnelForm } from './reset-form';
import { ReconciliarFunilForm } from './reconciliar-form';

export const dynamic = 'force-dynamic';

/**
 * Funil — §16.
 *
 * ═══ AS DUAS PERGUNTAS QUE ESTA TELA RESPONDE ════════════════════════════════════════════════
 *
 * "Quanto do topo chega ao fim" e "onde eles somem". A primeira é a que interessa ao caixa; a
 * segunda é a única que dá para consertar.
 *
 * ═══ POR QUE NÃO HÁ GRÁFICO ══════════════════════════════════════════════════════════════════
 *
 * Um funil tem sete linhas. Uma tabela com sete linhas é lida de uma vez; um gráfico das mesmas
 * sete exige decodificar a escala antes de ler o número, e o número é o que importa. A barra atrás
 * de cada linha existe só para dar a proporção em relance — ela não substitui o valor, acompanha.
 */
export default async function FunilPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; gasto?: string; taxa?: string }>;
}) {
  if (!(await isAuthenticated())) redirect('/admin');

  const { periodo, gasto, taxa } = await searchParams;
  const janela = janelaDoPeriodo(periodo);

  /*
    Gasto e taxa vêm pela URL, e NÃO do banco.

    O gasto do anúncio só existe no Gerenciador do Meta — o nosso banco não tem como sabê-lo, e
    inventar uma tabela para o dono digitar todo dia seria trocar uma digitação por outra mais
    burocrática. Pela URL, o número vale para a leitura daquele dia e o link fica compartilhável.

    A taxa também é entrada, e de propósito: ver `lib/lucro.ts` — a razão de 0,9447 que circula na
    documentação vem de dois números arredondados de conversa, e a taxa real muda com o meio de
    pagamento. Sem taxa informada, a tela diz "antes das taxas" em vez de chutar.
  */
  const gastoCentavos = lerDinheiroEmCentavos(gasto);
  const taxaPercentual = lerTaxaPercentual(taxa);

  /* Um dia de calendário — por botão ou pelo seletor — é o único recorte que fecha CAC. */
  const diaFechado = ehDiaDeCalendario(periodo);
  const ehData = diaFechado && periodo !== 'hoje' && periodo !== 'ontem';
  /* `max` do seletor: hoje em Brasília, e não em UTC, senão depois das 21h ele libera amanhã. */
  const hojeEmBrasilia = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
  }).format(new Date());

  /*
    `withAutoBootstrap` aqui pelo mesmo motivo de todo o resto do sistema — e a ausência dele foi um
    defeito real: a tela do funil quebrava com "Application error" porque a tabela `funnel_markers`
    é nova e ainda não existia no banco de produção.

    O erro era duplamente ruim. Primeiro porque a tela morria inteira, sem dizer o que fazer.
    Segundo porque a gravação dos marcos NUNCA lança de propósito (medição não pode derrubar o
    produto) — então nada avisava que a tabela faltava, e a única forma de descobrir era abrir a
    tela e ver o erro. Bootstrap sob demanda cria a estrutura e a tela passa a funcionar sozinha, no
    primeiro acesso.
  */
  const [
    funil,
    etapas,
    origens,
    medindoDesde,
    relatoriosSemPagamento,
    convidadosNoFunil,
    envios,
    vendas,
    compradores,
    receitaCentavos,
    coorte,
  ] = await withAutoBootstrap(
    () =>
      Promise.all([
        funnelReport(janela),
        quizDropoff(janela),
        campaignReport(janela),
        funnelStartedAt(),
        /*
          A contagem NÃO é filtrada pela janela de período.

          O resíduo é do banco inteiro: um marco órfão de agosto continua distorcendo a leitura de
          "Tudo", e some da tela em "7 dias" só porque a janela o esconde. Um aviso que aparece e
          desaparece conforme o filtro ensinaria que o problema vai e volta, quando ele está parado
          no mesmo lugar.
        */
        contarRelatoriosSemPagamento(),
        contarJornadasDeCupomNoFunil(),
        envioDeCompras(janela),
        contarVendas(janela),
        contarCompradoresDistintos(janela),
        /*
          Receita de TODAS as origens, e é o ponto do bloco de lucro.

          A tabela "De onde vieram" soma receita por origem, e era a única receita que esta tela
          sabia. O gasto sai de um canal só, mas a receita entra por vários — em 15/09 o fluxo Meta
          fez R$ 429,91 e o total foi R$ 529,89. Calcular lucro do dia com a receita de uma origem
          jogaria 19% do resultado fora, para baixo.
        */
        somarReceita(janela),
        /*
          Todo mundo que chegou na janela — marcado ou não —, para a tabela de chegadas poder
          fechar do mesmo jeito que a do dinheiro. Ver `coorteDeChegada`: o relógio dela é o da
          CHEGADA, e não o do marco, senão o resto misturaria dois relógios.
        */
        coorteDeChegada(janela),
      ]),
  );

  /* A soma das origens, para a linha de total da tabela. Ver `lib/origens.ts`. */
  const totais = totalDasOrigens(origens);

  /*
    O que sobrou do faturamento sem origem conhecida — a linha que faz a tabela fechar com Vendas.
    Sem ela a tabela mostra 9 num dia de 11 e não diz onde foram os outros 2. Ver `lib/origens.ts`.
  */
  const resto = semMarcacao(vendas, receitaCentavos, totais);

  /* O mesmo resto, para a tabela de chegadas. Fonte diferente de propósito — ver `lib/origens.ts`. */
  const restoDaCoorte = semMarcacaoNaCoorte(coorte, totais);

  const lucro = gastoCentavos === null
    ? null
    : calcularLucro({ receitaCentavos, gastoCentavos, taxaPercentual, clientes: compradores });

  /*
    Alguma etapa recebeu MAIS gente que a anterior?

    Acontece de verdade e por motivos legítimos — quem entra por convite pula o pagamento, quem
    reabre um link antigo conta no fim sem ter contado no começo, e, sobretudo, quem passou pelo
    funil antes de a medição existir carrega só a metade final do percurso.

    O número acima de 100% é a informação, e escondê-lo seria pior. O que faltava era a explicação
    ao lado dele: sem ela, quem lê conclui que o cálculo está errado e para de confiar na tela
    inteira — inclusive nas linhas que estão certas.
  */
  const temEtapaMaiorQueAnterior = funil.some((l, i) => i > 0 && l.ofPrevious > 100);

  const topo = funil[0]?.visitors ?? 0;
  const pagaram = funil.find((f) => f.marker === 'paid')?.visitors ?? 0;

  return (
    <main className="min-h-screen bg-paper">
      <AdminNav current="funil" />

      <div className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="font-display text-2xl font-bold">Funil</h1>
        <p className="mt-2 max-w-prose text-sm text-graphite">
          Quantas pessoas alcançaram cada ponto. Cada visitante conta uma vez por ponto — recarregar
          a página não infla o número.
        </p>

        <nav className="mt-6 flex flex-wrap gap-2 text-sm" aria-label="Período">
          {[
            ['hoje', 'Hoje'],
            ['ontem', 'Ontem'],
            ['7', '7 dias'],
            ['30', '30 dias'],
            ['90', '90 dias'],
            ['tudo', 'Tudo'],
          ].map(([valor, rotulo]) => {
            const ativo = (periodo ?? '30') === valor;
            return (
              <a
                key={valor}
                href={`/admin/funil?periodo=${valor}`}
                className={`rounded border px-3 py-1.5 ${
                  ativo ? 'border-ink bg-ink text-paper' : 'border-line hover:border-ink'
                }`}
              >
                {rotulo}
              </a>
            );
          })}

          {/*
            ═══ O CALENDÁRIO, E POR QUE ELE NÃO É LUXO ═══════════════════════════════════════

            Os botões cobriam hoje, ontem, e pulavam para 7 dias. Anteontem ficava inalcançável —
            a janela de 7 dias soma tudo e não separa nada.

            Isso travava exatamente o trabalho que o painel existe para permitir: montar a série de
            CAC dia a dia contra o gasto do Meta, que o dono tem por dia no aplicativo. Metade da
            série não tinha como ser lida.

            `<form method="get">` com `<input type="date">`: sem JavaScript nosso, e no celular abre
            o seletor nativo do sistema. `max` impede escolher um dia que ainda não aconteceu.
          */}
          <form method="get" className="flex items-center gap-2">
            <input
              type="date"
              name="periodo"
              defaultValue={ehData ? periodo : ''}
              max={hojeEmBrasilia}
              aria-label="Escolher um dia"
              className={`rounded border px-3 py-1.5 ${
                ehData ? 'border-ink bg-ink text-paper' : 'border-line'
              }`}
            />
            <button
              type="submit"
              className="rounded border border-line px-3 py-1.5 hover:border-ink"
            >
              Ver o dia
            </button>
          </form>
        </nav>

        {/*
          ═══ POR QUE "HOJE" E "ONTEM" SÃO DIFERENTES DOS OUTROS ═══════════════════════════════

          Eles são dias de CALENDÁRIO no fuso de Brasília — os mesmos dias que o Gerenciador de
          Anúncios usa para reportar gasto. É isso que torna possível dividir um pelo outro.

          "7 dias", "30" e "90" continuam ROLANTES: as últimas N×24 horas a partir de agora. Serve
          para tendência e NÃO serve para fechar CAC — dividir o gasto de um dia de calendário pelas
          vendas de uma janela rolante é dividir duas coisas que não se sobrepõem, e o resultado sai
          plausível, que é o que o torna perigoso.
        */}
        {diaFechado && (
          <p className="mt-3 max-w-prose text-xs text-graphite">
            Dia fechado no horário de Brasília — o mesmo corte que o Gerenciador de Anúncios usa.
            Dá para dividir o gasto do dia por estas vendas e ter o CAC.
          </p>
        )}

        {/*
          ═══ O FECHAMENTO — A ÚNICA CAIXA QUE PRECISA SER LIDA TODO DIA ═════════════════════════

          ⚠️ ESTA SEÇÃO EXISTE PORQUE O PAINEL FICOU ILEGÍVEL (21/09/2026)

          A tela tinha seis caixas — funil, lucro, etapas do questionário, origens, envios ao Meta,
          e o que o funil não vê. Cada uma correta, cada uma documentada, e **quatro relógios
          diferentes entre elas**: chegada, checkout, pagamento e clique no anúncio.

          O dono passou uma tarde tentando fazer quatro números baterem que nunca foram feitos para
          bater, e escreveu: *"tá muito confuso, muita informação que só está servindo para
          complicar"*.

          O erro não foi dele. Um painel que exige saber qual relógio cada caixa usa **antes** de
          ler qualquer número não é um painel, é um manual. E o pior efeito não é a confusão: é
          fazer o dono desconfiar de número certo — a partir de um certo ponto ele para de usar a
          tela inteira, inclusive as partes que decidem dinheiro.

          ─── A REGRA QUE ESTA CAIXA SEGUE ──────────────────────────────────────────────────────

          **Um relógio só: o do PAGAMENTO.** O mesmo de `/admin/vendas` e o mesmo do extrato do
          Mercado Pago. Tudo que usa outro relógio foi para trás de "ver detalhes", onde é
          diagnóstico e não leitura diária.

          Fica fora do `topo === 0` de propósito: venda existe sem marco de funil (recuperação
          manual, cupom, marco perdido), e a caixa do dinheiro não pode sumir porque a MEDIÇÃO
          ficou vazia.
        */}
        <section className="mt-8">
          <div className="rounded border border-line bg-white p-5">
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
              <p className="text-2xl font-bold tabular-nums text-ink">
                {vendas} {vendas === 1 ? 'venda' : 'vendas'}
              </p>
              <p className="text-2xl font-bold tabular-nums text-ink">{brl(receitaCentavos)}</p>
              {lucro?.roas != null && (
                <p className="text-lg font-semibold tabular-nums text-court">
                  ROAS {lucro.roas.toFixed(2)}×
                </p>
              )}
            </div>

            <p className="mt-2 text-sm text-graphite">
              Contado pelo dia em que o <strong className="text-ink">pagamento entrou</strong> — o
              mesmo corte de <strong className="text-ink">Vendas</strong> e do extrato do Mercado
              Pago. É o seu faturamento do período.
            </p>

            {/*
              O gasto vem pela URL e não do banco — ver o comentário original em `lerDinheiroEmCentavos`:
              ele só existe no Gerenciador de Anúncios, e uma tabela para digitar todo dia trocaria
              uma digitação por outra mais burocrática.
            */}
            <form
              method="get"
              className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-4"
            >
              {periodo !== undefined && <input type="hidden" name="periodo" value={periodo} />}
              <label className="flex flex-col gap-1 text-xs text-graphite">
                Gasto no anúncio (R$)
                <input
                  type="text"
                  inputMode="decimal"
                  name="gasto"
                  defaultValue={gasto ?? ''}
                  placeholder="126,17"
                  className="w-36 rounded border border-line px-3 py-1.5 text-sm text-ink"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-graphite">
                Taxa do gateway (%) — opcional
                <input
                  type="text"
                  inputMode="decimal"
                  name="taxa"
                  defaultValue={taxa ?? ''}
                  placeholder="5,53"
                  className="w-44 rounded border border-line px-3 py-1.5 text-sm text-ink"
                />
              </label>
              <button
                type="submit"
                className="rounded border border-line px-3 py-1.5 text-sm hover:border-ink"
              >
                Calcular
              </button>
            </form>

            {gasto !== undefined && gasto.trim() !== '' && gastoCentavos === null && (
              <p className="mt-3 max-w-prose text-sm text-clay">
                Não consegui ler <strong>{gasto}</strong> como valor. Use 126,17 ou 126.17 — e
                atenção: <strong>1.234</strong> é lido como mil duzentos e trinta e quatro, não como
                um real e vinte e três.
              </p>
            )}

            {lucro !== null && (
              <div className="mt-4 max-w-prose border-t border-line pt-4 text-sm">
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 tabular-nums">
                  <dt className="text-graphite">Receita (todas as origens)</dt>
                  <dd className="text-right text-ink">R$ {emReais(lucro.receitaCentavos)}</dd>

                  <dt className="text-graphite">Gasto no anúncio</dt>
                  <dd className="text-right text-ink">− R$ {emReais(lucro.gastoCentavos)}</dd>

                  {lucro.taxaCentavos !== null && (
                    <>
                      <dt className="text-graphite">Taxa do gateway ({taxaPercentual}%)</dt>
                      <dd className="text-right text-ink">− R$ {emReais(lucro.taxaCentavos)}</dd>
                    </>
                  )}

                  <dt className="border-t border-line pt-2 font-semibold text-ink">
                    Lucro {lucro.antesDasTaxas && 'antes das taxas'}
                  </dt>
                  <dd
                    className={`border-t border-line pt-2 text-right font-semibold ${
                      lucro.lucroCentavos < 0 ? 'text-clay' : 'text-ink'
                    }`}
                  >
                    R$ {emReais(lucro.lucroCentavos)}
                  </dd>
                </dl>

                <p className="mt-3 border-t border-line pt-3 text-graphite">
                  {lucro.cacCentavos === null ? (
                    <>Sem cliente no período — não existe CAC.</>
                  ) : (
                    <>
                      <strong className="text-ink">CAC R$ {emReais(lucro.cacCentavos)}</strong> por
                      cliente ({compradores})
                    </>
                  )}
                </p>

                {lucro.antesDasTaxas && (
                  <p className="mt-2 text-xs text-graphite">
                    Sem taxa informada, este lucro é <strong>bruto</strong>. A taxa não tem valor
                    padrão de propósito: ela muda com o meio de pagamento, e um número fixo aqui
                    seria falso em todo dia que não fosse a média.
                  </p>
                )}

                {!diaFechado && (
                  <p className="mt-2 text-xs text-clay">
                    Este período é uma janela <strong>rolante</strong>. O gasto digitado precisa ser
                    o do mesmo intervalo, senão o CAC sai plausível e errado — que é pior que sair
                    absurdo.
                  </p>
                )}
              </div>
            )}
          </div>
        </section>

        {/*
          Desempenho por origem — §15.

          O funil acima dá a média. Com dois anúncios no ar, uma média de 5% pode ser 9% e 1%, e a
          decisão certa — desligar um, dobrar no outro — fica escondida atrás dela. Esta tabela é a
          única que responde onde colocar dinheiro.
        */}
        {origens.length > 0 && (
          <section className="mt-12">
            <h2 className="font-display text-lg font-semibold">De onde vieram</h2>
            <p className="mt-1 max-w-prose text-sm text-graphite">
              Só quem chegou por um link com <code>utm_source</code>. Quem veio direto ou por busca
              não aparece aqui — a origem só existe se você a escreveu no link.
            </p>

            {/*
              ═══ TRÊS COLUNAS, E A LINHA QUE FAZ A CONTA FECHAR ═════════════════════════════

              A tabela tinha DEZ colunas e dois relógios: "Chegaram", "Terminaram", "Pagaram" e
              "Conversão" contam por data de CHEGADA; "Clientes", "Pedidos" e "Receita" contam por
              data de PAGAMENTO. As duas metades estavam certas e nunca podiam bater entre si.

              ⚠️ E o pior não eram as colunas — era o que a tabela OMITIA. Num dia de 11 vendas ela
              mostrava 9 pedidos e não dizia onde foram os outros 2. O subtítulo avisava que só
              aparece quem chegou com `utm_source`; não adianta, porque o número some e a conclusão
              natural é que o sistema perdeu venda.

              Agora a tabela tem UM relógio — o do pagamento, o mesmo do fechamento e de Vendas —,
              três colunas, e a linha "sem marcação". Com ela a coluna SOMA o faturamento: nada
              some em silêncio, e a pergunta "por que não bate" deixa de existir.

              As colunas de chegada não foram apagadas: foram para o `<details>` abaixo, onde
              respondem "onde a origem falha", que é pergunta de uma vez por mês.
            */}
            <div className="mt-4 overflow-x-auto rounded border border-line bg-white">
              <table className="w-full min-w-[26rem] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-graphite">
                    <th className="px-4 py-3 font-semibold">Origem</th>
                    <th className="px-4 py-3 text-right font-semibold">Vendas</th>
                    <th className="px-4 py-3 text-right font-semibold">Receita</th>
                  </tr>
                </thead>
                <tbody>
                  {origens.map((o) => (
                    <tr
                      key={`${o.source}|${o.campaign ?? ''}|${o.content ?? ''}`}
                      className="border-b border-line/60 last:border-0"
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium text-ink">{o.source}</span>
                        {/*
                          Campanha e criativo viram uma linha secundária em vez de duas colunas.
                          Com um anúncio no ar as duas colunas eram "—" o tempo todo e custavam
                          um terço da largura da tabela no celular.
                        */}
                        {(o.campaign ?? o.content) && (
                          <span className="block text-xs text-graphite">
                            {[o.campaign, o.content].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {o.pedidos}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {brl(o.receitaCentavos)}
                      </td>
                    </tr>
                  ))}

                  {/*
                    ⚠️ A LINHA QUE NÃO PODE SUMIR MESMO VALENDO ZERO NAS VENDAS.

                    Ela é o resto: faturamento total menos o que foi atribuído. É o que transforma
                    esta tabela de "uma amostra do dia" em "o dia inteiro".

                    Aparece sempre que houver pedido ou receita não atribuída — inclusive quando só
                    a receita sobra, o que acontece quando um pedido é atribuído a uma origem mas
                    outro valor do mesmo período não é.
                  */}
                  {(resto.pedidos > 0 || resto.receitaCentavos > 0) && (
                    <tr className="border-b border-line/60 last:border-0 bg-paper/60">
                      <td className="px-4 py-3">
                        <span className="font-medium text-graphite">sem marcação</span>
                        <span className="block text-xs text-graphite">
                          digitou o endereço, veio de busca, ou o link não tinha{' '}
                          <code>utm_source</code>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-graphite">
                        {resto.pedidos}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-graphite">
                        {brl(resto.receitaCentavos)}
                      </td>
                    </tr>
                  )}
                </tbody>

                <tfoot>
                  <tr className="border-t-2 border-line bg-paper font-semibold">
                    <td className="px-4 py-3">Total</td>
                    <td className="px-4 py-3 text-right tabular-nums">{vendas}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{brl(receitaCentavos)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <p className="mt-3 max-w-prose text-xs text-graphite">
              O total é o mesmo de <strong className="text-ink">Vendas</strong> e o mesmo do
              fechamento lá em cima. Se as três telas discordarem, é defeito — me chame.
            </p>

            {/*
              ⚠️ Soma das origens MAIOR que o total: dupla atribuição, não resto.

              `dinheiroPorOrigem` agrupa por (origem, campanha, criativo) e conta `distinct` dentro
              de cada grupo. Quem chegou pelo anúncio na segunda e pela bio na terça tem duas linhas
              de campanha, e o pedido dela é contado nas duas.

              Zerar isso em silêncio esconderia um defeito real atrás de uma linha plausível.
            */}
            {resto.excede && (
              <p className="mt-3 max-w-prose rounded border border-warn/40 bg-warn/5 p-3 text-sm text-warn">
                <strong>As origens somam mais que o total.</strong> Alguém chegou por mais de um
                link no período e o pedido está sendo contado em mais de uma origem. O total acima
                está certo; as linhas individuais estão infladas. Confira em{' '}
                <strong>Vendas</strong>, que é o registro do dinheiro.
              </p>
            )}

            {/*
              ═══ AS COLUNAS DE CHEGADA, ONDE ELAS NÃO ATRAPALHAM ═══════════════════════════════

              Não são inúteis — são a única coisa que diz ONDE uma origem falha, e a §15 foi escrita
              por causa disso. O que elas não podem é estar na frente do dono todo dia ao lado das
              colunas de dinheiro, porque usam outro relógio e a comparação lado a lado é o que
              produziu a confusão de 21/09.

              Fechado por padrão: quem abre já está fazendo a pergunta que elas respondem.
            */}
            <details className="mt-4 rounded border border-line bg-white">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-ink">
                Onde cada origem falha (chegadas e conversão)
              </summary>

              <div className="border-t border-line px-4 py-4">
                <p className="max-w-prose text-xs text-graphite">
                  ⚠️ Estas colunas contam por <strong className="text-ink">data de chegada</strong>,
                  não de pagamento. Quem chegou ontem e pagou hoje aparece na tabela de cima e não
                  aqui — <strong className="text-ink">elas não batem com as de cima de propósito</strong>.
                </p>

                <p className="mt-2 max-w-prose text-xs text-graphite">
                  Elas dizem <strong className="text-ink">onde</strong> a origem falha: quem não
                  termina o questionário veio pelo anúncio errado; quem termina e não paga é público
                  certo com oferta errada. Uma origem com 3 visitantes e 1 pagante marca 33% e não é
                  resultado — é acaso de amostra pequena.
                </p>

                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[30rem] text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-graphite">
                        <th className="px-3 py-2 font-semibold">Origem</th>
                        <th className="px-3 py-2 text-right font-semibold">Chegaram</th>
                        <th className="px-3 py-2 text-right font-semibold">Terminaram</th>
                        <th className="px-3 py-2 text-right font-semibold">Pagaram</th>
                        <th className="px-3 py-2 text-right font-semibold">Conversão</th>
                      </tr>
                    </thead>
                    <tbody>
                      {origens.map((o) => (
                        <tr
                          key={`d|${o.source}|${o.campaign ?? ''}|${o.content ?? ''}`}
                          className="border-b border-line/60 last:border-0"
                        >
                          <td className="px-3 py-2">
                            {o.source}
                            {(o.campaign ?? o.content) && (
                              <span className="block text-xs text-graphite">
                                {[o.campaign, o.content].filter(Boolean).join(' · ')}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{o.visitors}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-graphite">
                            {o.finished}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{o.paid}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {o.conversion.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                      {/*
                        A mesma linha da tabela do dinheiro, pelo mesmo motivo — e vinda de OUTRA
                        fonte. Aqui o total é a coorte de chegada (`coorteDeChegada`), não `orders`.

                        ⚠️ A subtração tentadora, "Pagou do funil menos a soma das origens", está
                        errada: o funil recorta por data do MARCO e esta tabela por data de
                        CHEGADA. Ver `lib/origens.ts` e `funnel-repo.ts`.
                      */}
                      {(restoDaCoorte.visitors > 0 || restoDaCoorte.paid > 0) && (
                        <tr className="border-b border-line/60 last:border-0 bg-paper/60">
                          <td className="px-3 py-2">
                            <span className="text-graphite">sem marcação</span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-graphite">
                            {restoDaCoorte.visitors}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-graphite">
                            {restoDaCoorte.finished}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-graphite">
                            {restoDaCoorte.paid}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-graphite">
                            {restoDaCoorte.conversion.toFixed(1)}%
                          </td>
                        </tr>
                      )}
                    </tbody>

                    {/*
                      O total é a COORTE inteira — não a soma das origens marcadas, que era o que
                      estava aqui e fazia o rodapé chamado "Total" mostrar menos que o total.

                      A conversão dele continua sendo `pagaram ÷ chegaram` do AGREGADO, e não a
                      média das porcentagens: em 18/09 a média simples dava 24,9% e a verdadeira
                      23,4%. Ver `lib/origens.ts`.
                    */}
                    <tfoot>
                      <tr className="border-t-2 border-line bg-paper font-semibold">
                        <td className="px-3 py-2">Total</td>
                        <td className="px-3 py-2 text-right tabular-nums">{coorte.visitors}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-graphite">
                          {coorte.finished}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{coorte.paid}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {coorte.visitors === 0
                            ? '0.0'
                            : ((coorte.paid / coorte.visitors) * 100).toFixed(1)}
                          %
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/*
                  ⚠️ Coorte menor que a soma das origens — e é um caso REAL, não defensivo.

                  `funnel_markers` tem única em (visitante, marco): `quiz:start` é gravado uma vez
                  na vida do visitante. `visitor_campaigns` não tem essa trava — cada chegada por
                  link marcado cria linha nova. Então o cliente antigo que clica no anúncio hoje
                  entra nas origens de hoje e não nesta coorte, porque o `quiz:start` dele é velho.

                  Zerar isso em silêncio ensinaria a ler um "0" como "não houve", quando o que
                  houve foi visitante recorrente — que é informação de negócio, não defeito.
                */}
                {restoDaCoorte.excede && (
                  <p className="mt-3 max-w-prose rounded border border-line bg-paper p-3 text-xs text-graphite">
                    <strong className="text-ink">As origens somam mais que a coorte.</strong> É o
                    esperado quando alguém que JÁ tinha aberto o questionário antes volta por um
                    link marcado: ele conta como chegada da origem e não como chegada nova, porque
                    o marco de abertura é único por visitante. Quanto maior esta diferença, mais
                    gente voltando — e isso é público recorrente, não erro.
                  </p>
                )}
              </div>
            </details>

            {/*
              A ressalva que impede a decisão errada mais comum.

              Uma origem com 3 visitantes e 1 pagante marca 33% e parece a melhor da tabela. Não é
              resultado, é acaso de amostra pequena — e desligar a campanha de 300 visitantes para
              investir naquela seria a pior decisão que este painel poderia induzir.
            */}
            {/*
              A ressalva de amostra pequena mudou de lugar junto com a coluna que a provocava.

              Ela existe porque uma origem com 3 visitantes e 1 pagante marca 33% e parece a melhor
              da tabela — e desligar a campanha de 300 visitantes por causa dela seria a pior
              decisão que este painel poderia induzir. Como a conversão agora só aparece dentro do
              `<details>`, o aviso vive ali, colado no número que ele protege.
            */}
            <p className="mt-3 max-w-prose text-xs text-graphite">
              Ordenado por volume. Para decidir onde pôr dinheiro, compare{' '}
              <strong className="text-ink">Receita</strong> contra o gasto de cada canal — e
              desconfie de origem com poucas vendas: abaixo de umas 50 pessoas o percentual oscila
              demais para decidir.
            </p>
          </section>
        )}

        {/*
          ═══ O QUE SAIU DA FRENTE, E POR QUÊ ═══════════════════════════════════════════════════

          ⚠️ 21/09/2026. O painel tinha seis caixas abertas ao mesmo tempo, com QUATRO relógios
          diferentes entre elas — chegada, checkout, pagamento e clique no anúncio. Cada caixa
          certa, cada uma documentada, e nenhuma capaz de bater com a vizinha.

          O dono gastou uma tarde tentando conciliar quatro números que nunca foram feitos para
          fechar entre si, e concluiu: *"tá muito confuso, muita informação que só está servindo
          para complicar"*.

          O custo real disso não é a confusão de um dia. É que, depois de tropeçar algumas vezes,
          quem lê para de confiar na tela inteira — inclusive nas duas caixas que decidem dinheiro.

          ─── O CRITÉRIO DO QUE FICOU FORA ──────────────────────────────────────────────────────

          Nada foi apagado. O que saiu da frente é o que responde pergunta de DIAGNÓSTICO — "onde
          as pessoas desistem", "a API de Conversões está viva", "quantos marcos o funil perdeu".
          São perguntas de quando algo está errado, não de todo dia.

          O que ficou na frente é o que responde "como foi o período": quanto vendeu, quanto
          entrou, de onde veio. Um relógio só, o do pagamento.

          `<details>` e não uma aba: sem JavaScript nosso, o navegador guarda o estado, e o
          conteúdo continua no HTML — dá para buscar na página com Ctrl+F mesmo fechado.
        */}
        <details className="mt-12 rounded border border-line bg-white">
          <summary className="cursor-pointer px-5 py-4 font-display text-lg font-semibold text-ink">
            Ver detalhes da medição
          </summary>
          <div className="border-t border-line px-5 pb-5">
        {topo === 0 ? (
          /*
            Estado vazio que diz o que fazer.

            "Nenhum dado" num painel novo é ambíguo entre "ninguém veio" e "a medição não está
            funcionando", e as duas exigem ações opostas. Dizer que a tabela começa a encher no
            primeiro questionário resolve a dúvida sem exigir que o dono investigue nada.
          */
          <p className="mt-8 rounded border border-line bg-white p-6 text-sm text-graphite">
            Ainda não há marcos registrados neste período. A tabela começa a encher assim que
            alguém abrir o questionário — inclusive você, testando.
          </p>
        ) : (
          <>
            <div className="mt-8 rounded border border-line bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-graphite">
                    <th className="px-4 py-3 font-semibold">Etapa</th>
                    <th className="px-4 py-3 text-right font-semibold">Pessoas</th>
                    <th className="px-4 py-3 text-right font-semibold">Do topo</th>
                    <th className="px-4 py-3 text-right font-semibold">Da anterior</th>
                  </tr>
                </thead>
                <tbody>
                  {funil.map((linha, i) => {
                    /*
                      Perda relevante em destaque.

                      O limiar é 60% de retenção: abaixo disso, mais de dois em cada cinco somem
                      naquele ponto específico. Marcar tudo abaixo de 100% pintaria a tabela
                      inteira e não diria nada — todo funil perde em toda etapa.
                    */
                    const sangra = i > 0 && linha.ofPrevious < 60;
                    return (
                      <tr key={linha.marker} className="border-b border-line/60 last:border-0">
                        <td className="relative px-4 py-3">
                          <span
                            aria-hidden
                            className="absolute inset-y-0 left-0 bg-court/10"
                            style={{ width: `${Math.max(1, linha.ofStart)}%` }}
                          />
                          <span className="relative">{linha.label}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">
                          {linha.visitors}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-graphite">
                          {linha.ofStart.toFixed(1)}%
                        </td>
                        <td
                          className={`px-4 py-3 text-right tabular-nums ${
                            sangra ? 'font-semibold text-warn' : 'text-graphite'
                          }`}
                        >
                          {i === 0 ? '—' : `${linha.ofPrevious.toFixed(1)}%`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {temEtapaMaiorQueAnterior && (
              <p className="mt-4 rounded border border-line bg-white p-4 text-sm text-graphite">
                <strong className="text-ink">Uma etapa aparece acima de 100% da anterior.</strong>{' '}
                Não é erro de cálculo. As causas possíveis, em ordem de probabilidade: alguém passou
                por essa etapa antes de a medição existir e só as seguintes foram gravadas; alguém
                entrou por código de convite e pulou o pagamento; ou alguém reabriu um link antigo e
                contou no fim sem ter contado no começo.
              </p>
            )}

            <p className="mt-4 text-sm text-graphite">
              <strong className="text-ink">
                {topo > 0 ? ((pagaram / topo) * 100).toFixed(1) : '0'}%
              </strong>{' '}
              de quem abre o questionário chega a pagar ({pagaram} de {topo}).
            </p>

            {/*
              ═══ PESSOAS × VENDAS, NA MESMA TELA ══════════════════════════════════════════════

              Em 12/09/2026 o dono leu "Pagou: 5" aqui, contou 7 na lista de vendas e perguntou
              qual estava errada. Nenhuma — e o painel não dizia isso em lugar nenhum.

              `funnel_markers` tem única em (visitante, marco): um visitante só tem UM marco `paid`
              na vida. O funil conta PESSOAS que pagaram pela primeira vez na janela. A lista conta
              PEDIDOS. Quem já era cliente e comprou de novo aparece lá e não aqui.

              Mostrar só um dos dois obriga a escolher entre uma taxa de conversão errada (se
              contasse pedidos) e um número de vendas errado (se contasse só pessoas). Os dois
              lado a lado, com o nome do que cada um mede, é a única forma que fecha.

              E o de vendas é o que vale para CAC. O `COMO_SUBIR_A_CAMPANHA.md` mandava usar o do
              funil, chamando-o de "registro completo" — estava errado, e errado para menos, que é
              o pior lado: CAC inflado manda cortar orçamento de campanha que está indo bem.
            */}
            {/*
              ═══ TRÊS NÚMEROS, PORQUE DOIS NÃO DECIDEM NADA ═══════════════════════════════════

              Em 12/09/2026 o funil mostrou 5 e a lista 7, e o extrato do gateway confirmou 7. Com
              só esses dois números na mão, "o funil está errado" e "o funil mede outra coisa" são
              indistinguíveis — e eu respondi por dedução, sem dado, e errei o motivo.

              O terceiro número desempata. `compradores` conta as PESSOAS distintas por trás dos
              pedidos pagos, pela mesma chave que o marco `paid` usa:

                compradores == pagaram  → o funil está certo. Pedidos a mais são segunda compra
                                          da mesma pessoa, e o marco é único por visitante.
                compradores >  pagaram  → o funil PERDEU marco. Aí é defeito, e o rastro está no
                                          log de `markFunnelBySessionId`.

              A tela diz qual dos dois é, em vez de deixar para a próxima dedução.
            */}
            {vendas !== pagaram && (
              <div className="mt-3 max-w-prose rounded border border-line bg-white p-4 text-sm">
                <p className="text-graphite">
                  <strong className="tabular-nums text-ink">{vendas}</strong> pedidos pagos ·{' '}
                  <strong className="tabular-nums text-ink">{compradores}</strong> pessoas por trás
                  deles · <strong className="tabular-nums text-ink">{pagaram}</strong> no funil
                </p>

                {compradores === pagaram ? (
                  <>
                    <p className="mt-2 text-graphite">
                      <strong className="text-ink">Os números fecham.</strong> Cada pessoa conta
                      uma vez no funil, e {vendas - compradores}{' '}
                      {vendas - compradores === 1 ? 'pedido é' : 'pedidos são'} compra adicional de
                      quem já estava na conta — o upgrade é o caso mais comum.
                    </p>
                    {/*
                      ═══ OS DOIS DIVISORES, PORQUE ELES DECIDEM COISAS DIFERENTES ═════════════

                      Eu tinha escrito aqui "para o CAC, use o número de pedidos". Errado por
                      descuido de nome: CAC é custo de aquisição de CLIENTE, e o denominador é
                      gente, não pedido.

                      A distinção não é preciosismo — ela vira dinheiro. Quando uma pessoa compra
                      duas ou três vezes, a receita por cliente ADQUIRIDO fica acima do ticket
                      médio, e o teto do que se pode pagar para trazer um cliente sobe junto.
                      Dividir por pedidos esconde exatamente isso: dá um custo por venda menor e
                      um teto que parece o mesmo de sempre.
                    */}
                    <p className="mt-2 text-graphite">
                      Para <strong className="text-ink">CAC</strong> — custo por cliente — divida o
                      gasto do período por <strong className="text-ink">{compradores}</strong>. Para
                      custo por venda, por <strong className="text-ink">{vendas}</strong>. E
                      compare o CAC com a receita por cliente do dia, que com{' '}
                      {vendas - compradores} {vendas - compradores === 1 ? 'pedido' : 'pedidos'} a
                      mais está <strong className="text-ink">acima</strong> do ticket médio.
                    </p>
                  </>
                ) : (
                  <p className="mt-2 font-medium text-warn">
                    O funil perdeu {compradores - pagaram}{' '}
                    {compradores - pagaram === 1 ? 'marco' : 'marcos'}. São {compradores} pessoas
                    compradoras e só {pagaram} no funil — não é diferença de contagem, é registro
                    faltando. O motivo está no log do servidor, em{' '}
                    <code>[funil] marco &quot;paid&quot; descartado</code>.
                  </p>
                )}
              </div>
            )}

            {etapas.length > 1 && (
              <section className="mt-10">
                <h2 className="font-display text-lg font-semibold">
                  Onde param dentro do questionário
                </h2>
                <p className="mt-1 max-w-prose text-sm text-graphite">
                  A etapa que mais derruba é a que vale reescrever primeiro.
                </p>

                <div className="mt-4 rounded border border-line bg-white">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-graphite">
                        <th className="px-4 py-3 font-semibold">Etapa</th>
                        <th className="px-4 py-3 text-right font-semibold">Chegaram</th>
                        <th className="px-4 py-3 text-right font-semibold">Pararam aqui</th>
                      </tr>
                    </thead>
                    <tbody>
                      {etapas.map((e) => (
                        <tr key={e.step} className="border-b border-line/60 last:border-0">
                          <td className="px-4 py-3">
                            {e.step === 0 ? 'Abertura' : `Etapa ${e.step + 1}`}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">{e.reached}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-graphite">
                            {e.lostHere > 0 ? e.lostHere : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}

        {/*
          ═══ O QUE O META RECEBEU — E POR QUE ISTO MORA AQUI ══════════════════════════════════

          Esta seção nasceu de um problema que não era técnico: por dois dias, a única resposta que
          eu sabia dar para "a API de Conversões está funcionando?" era "abra o Gerenciador de
          Eventos num computador". O dono opera do celular. A pergunta ficou sem resposta enquanto
          a campanha gastava, e as decisões do período foram tomadas no escuro.

          O dado sempre existiu — no log do servidor, que ninguém lê do celular. Trazê-lo para cá
          não mediu nada de novo; só o pôs onde ele é procurado.

          A tabela some quando não há nenhum contexto no período. Um bloco zerado num dia sem venda
          nenhuma leria como falha, e não é.
        */}
        {(envios.aceitas > 0 || envios.recusadas.length > 0) && (
          <section className="mt-12">
            <h2 className="font-display text-lg font-semibold">O que o Meta recebeu</h2>
            <p className="mt-1 max-w-prose text-sm text-graphite">
              Compras que o nosso servidor conseguiu entregar ao Meta pela API de Conversões.
            </p>

            <div className="mt-4 rounded border border-line bg-white p-5">
              <p className="text-sm">
                <strong className="text-lg tabular-nums text-ink">{envios.aceitas}</strong>{' '}
                <span className="text-graphite">
                  {envios.aceitas === 1 ? 'compra aceita pelo Meta' : 'compras aceitas pelo Meta'}
                </span>
              </p>

              {envios.recusadas.length > 0 && (
                <ul className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
                  {envios.recusadas.map((r) => {
                    const { texto, esperado } = explicarMotivo(r.motivo);
                    return (
                      <li key={r.motivo} className="flex gap-3">
                        <span className="shrink-0 font-semibold tabular-nums">{r.quantidade}</span>
                        <span className={esperado ? 'text-graphite' : 'font-medium text-warn'}>
                          {texto}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}

              {envios.semDesfecho > 0 && (
                <p className="mt-4 border-t border-line pt-4 text-xs text-graphite">
                  {envios.semDesfecho} chegaram ao checkout e não pagaram — sem pagamento não há o
                  que enviar.
                </p>
              )}

              {/*
                ═══ O TOTAL, PORQUE ACEITAS SOZINHO NÃO É O NÚMERO DE COMPRAS ══════════════════

                A decisão de enviar ou não acontece no webhook de PAGAMENTO: uma linha em
                "recusadas" é uma compra que aconteceu e que a gente escolheu não mandar. Logo
                `aceitas` é sempre MENOR que o número de compras do dia, e lê-lo como o total é o
                erro natural — foi o que aconteceu em 18/09, quando 11 aceitas + 1 recusada por
                cookie foram comparados com o funil como se fossem 11 compras.

                A soma está aqui porque é ela que dá para conferir contra Vendas, que bate com o
                extrato do Mercado Pago. Sem esta linha, a conferência exige somar a caixa de cima
                com a lista do meio — de novo uma adição de cabeça, de novo em silêncio.
              */}
              {(() => {
                const recusadas = envios.recusadas.reduce((s, r) => s + r.quantidade, 0);
                if (recusadas === 0) return null;
                return (
                  <p className="mt-4 border-t border-line pt-4 text-xs text-graphite">
                    <strong className="text-ink">
                      {envios.aceitas + recusadas} compras no período
                    </strong>{' '}
                    ({envios.aceitas} enviadas + {recusadas} não enviadas). É este total que deve
                    bater com <strong className="text-ink">Vendas</strong>, não o número de cima.
                  </p>
                );
              })()}
            </div>

            {/*
              A ressalva que evita a conclusão errada mais provável desta seção.

              "Aceitas" e o número do Gerenciador de Anúncios medem coisas diferentes, e o primeiro
              é quase sempre maior. Sem esta linha, a diferença leria como defeito da API — e o
              conserto seria mexer em algo que está certo.
            */}
            <p className="mt-3 max-w-prose text-xs text-graphite">
              Este número não é o do Gerenciador de Anúncios. Aqui conta tudo que o Meta{' '}
              <strong className="text-ink">aceitou</strong>; lá conta só o que ele{' '}
              <strong className="text-ink">atribui ao anúncio</strong>, que exige a pessoa ter
              clicado num anúncio dentro da janela dele. Este ser maior é o normal.
            </p>

            {/*
              ═══ O RELÓGIO DO GERENCIADOR DE ANÚNCIOS É OUTRO ════════════════════════════════

              A ressalva acima explica por que o número DELE é menor, e não explica a parte que
              confunde mais: ele conta a compra no dia do CLIQUE, não no dia do pagamento.

              Duas consequências que parecem defeito e não são:

                • uma compra de hoje, de quem clicou ontem, entra na linha de ONTEM lá e na de HOJE
                  aqui — as duas telas certas, discordando;
                • o número de hoje lá AINDA VAI SUBIR, porque quem clicar hoje e comprar amanhã é
                  somado retroativamente ao dia de hoje.

              Sem isto escrito, comparar as duas telas no meio da tarde produz a conclusão de que
              "nada bate" — que foi exatamente o que aconteceu em 18/09, às 17h.
            */}
            <p className="mt-2 max-w-prose text-xs text-graphite">
              <strong className="text-ink">E ele conta por outro dia.</strong> O Gerenciador marca
              a compra no dia do <em>clique</em>, não no do pagamento — então o número dele para
              hoje ainda vai subir nos próximos dias, e comparar as duas telas com o dia aberto
              sempre dá diferença.
            </p>
          </section>
        )}

        {/*
          O que esta tela NÃO mede, dito na própria tela.

          Um painel que parece medir tudo faz o dono concluir coisa errada sobre o que não aparece
          nele. Dizer o limite onde ele é lido custa três linhas e evita a decisão tomada sobre um
          dado que nunca existiu.
        */}
        <div className="mt-12 rounded border border-line bg-white p-5 text-sm text-graphite">
          <p className="font-semibold text-ink">O que este funil não vê</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              Quem visitou a home e não clicou em começar — a contagem começa no questionário, e
              nenhuma página gera registro só por ter sido aberta.
            </li>
            <li>
              Quem trocou de aparelho no meio: são dois visitantes diferentes, porque o vínculo é o
              cookie e não a pessoa.
            </li>
            <li>
              Quem entrou por código de convite não passa por pagamento, então aparece no topo e
              não em &quot;Pagou&quot;.
            </li>
            {medindoDesde && (
              /*
                A data do primeiro marco, dita na tela.

                É o dado que separa "o produto tem um problema" de "a medição ainda não existia".
                Sem ele, o primeiro período sempre lê como defeito — e o mesmo vai acontecer toda
                vez que um marco novo entrar, com as etapas ao redor carregando meses de histórico.
              */
              <li>
                Nada antes de <strong className="text-ink">{dataCurta(medindoDesde)}</strong>, que é
                quando o primeiro marco foi gravado. Quem passou pelo funil antes disso aparece só
                nas etapas que alcançou depois.
              </li>
            )}
          </ul>
        </div>

          </div>
        </details>

        {/*
          Só aparece quando existe incoerência — ver `reconciliar-form.tsx`. A ausência dele é a
          confirmação de que o funil fecha.
        */}
        {(relatoriosSemPagamento > 0 || convidadosNoFunil > 0) && (
          <ReconciliarFunilForm
            relatorios={relatoriosSemPagamento}
            convidados={convidadosNoFunil}
          />
        )}

        {/* O único controle destrutivo do painel. Ver `reset-form.tsx` para as duas travas. */}
        <ResetFunnelForm />
      </div>
    </main>
  );
}
