import { redirect } from 'next/navigation';
import { janelaDoPeriodo } from '@/lib/periodo';
import { isAuthenticated } from '../auth';
import { AdminNav } from '../nav';
import {
  contarJornadasDeCupomNoFunil,
  contarRelatoriosSemPagamento,
  funnelReport,
  funnelStartedAt,
  quizDropoff,
} from '@/database/repositories/funnel-repo';
import { dataCurta } from '@/lib/datas';
import { campaignReport } from '@/database/repositories/campaign-repo';
import { envioDeCompras } from '@/database/repositories/meta-repo';
import { contarCompradoresDistintos, contarVendas } from '@/database/repositories/commerce-repo';
import { explicarMotivo } from '@/lib/motivo-do-envio';
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
  searchParams: Promise<{ periodo?: string }>;
}) {
  if (!(await isAuthenticated())) redirect('/admin');

  const { periodo } = await searchParams;
  const janela = janelaDoPeriodo(periodo);

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
      ]),
  );

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
        {(periodo === 'hoje' || periodo === 'ontem') && (
          <p className="mt-3 max-w-prose text-xs text-graphite">
            Dia fechado no horário de Brasília — o mesmo corte que o Gerenciador de Anúncios usa.
            Dá para dividir o gasto do dia por estas vendas e ter o CAC.
          </p>
        )}

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
                  <p className="mt-2 text-graphite">
                    <strong className="text-ink">Os números fecham.</strong> Cada pessoa conta uma
                    vez no funil, e {vendas - compradores}{' '}
                    {vendas - compradores === 1 ? 'pedido é' : 'pedidos são'} segunda compra de
                    alguém que já estava na conta. Para o CAC, use{' '}
                    <strong className="text-ink">{vendas}</strong>.
                  </p>
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

            <div className="mt-4 overflow-x-auto rounded border border-line bg-white">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-graphite">
                    <th className="px-4 py-3 font-semibold">Origem</th>
                    <th className="px-4 py-3 font-semibold">Campanha</th>
                    <th className="px-4 py-3 font-semibold">Criativo</th>
                    <th className="px-4 py-3 text-right font-semibold">Chegaram</th>
                    <th className="px-4 py-3 text-right font-semibold">Terminaram</th>
                    <th className="px-4 py-3 text-right font-semibold">Pagaram</th>
                    <th className="px-4 py-3 text-right font-semibold">Conversão</th>
                  </tr>
                </thead>
                <tbody>
                  {origens.map((o) => (
                    <tr
                      key={`${o.source}|${o.campaign ?? ''}|${o.content ?? ''}`}
                      className="border-b border-line/60 last:border-0"
                    >
                      <td className="px-4 py-3 font-medium">{o.source}</td>
                      <td className="px-4 py-3 text-graphite">{o.campaign ?? '—'}</td>
                      <td className="px-4 py-3 text-graphite">{o.content ?? '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{o.visitors}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-graphite">
                        {o.finished}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{o.paid}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {o.conversion.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/*
              A ressalva que impede a decisão errada mais comum.

              Uma origem com 3 visitantes e 1 pagante marca 33% e parece a melhor da tabela. Não é
              resultado, é acaso de amostra pequena — e desligar a campanha de 300 visitantes para
              investir naquela seria a pior decisão que este painel poderia induzir.
            */}
            <p className="mt-3 max-w-prose text-xs text-graphite">
              Ordenado por volume, e não por conversão: abaixo de umas 50 pessoas o percentual
              oscila demais para decidir. As colunas do meio dizem ONDE a origem falha — quem não
              termina o questionário veio pelo anúncio errado; quem termina e não paga é público
              certo com oferta errada.
            </p>
          </section>
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
