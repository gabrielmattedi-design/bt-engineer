import { redirect } from 'next/navigation';
import { isAuthenticated } from '../auth';
import { AdminNav } from '../nav';
import { withAutoBootstrap } from '@/database/setup';
import { faturamentoPorDia, gastosPorDia } from '@/database/repositories/financeiro-repo';
import {
  ehIndicador,
  INDICADORES,
  mediaPorDiaDaSemana,
  montarFinanceiro,
  montarGrafico,
  rotulosDoGrafico,
  type Indicador,
} from '@/lib/financeiro';
import { emReais } from '@/lib/lucro';
import { GastoForm } from './gasto-form';

const ROTULO: Record<Indicador, string> = {
  faturamento: 'Faturamento',
  gasto: 'Gasto',
  lucro: 'Lucro',
};

/* A cor carrega significado: entra, sai, sobra. Amarelo é reservado para o prejuízo. */
const COR: Record<Indicador, string> = {
  faturamento: 'bg-court',
  gasto: 'bg-clay',
  lucro: 'bg-ink',
};

export const dynamic = 'force-dynamic';

/** Desde quando a tela olha. 01/09/2026 é o mês em que a operação começou a ter movimento. */
const INICIO = new Date('2026-09-01T00:00:00-03:00');

/**
 * Gestão financeira — faturamento de todas as origens contra o gasto de anúncio, dia a dia.
 *
 * ═══ POR QUE ESTA TELA É SEPARADA DO FUNIL ═══════════════════════════════════════════════════
 *
 * Pedida pelo dono em 17/09/2026, e ele definiu a fronteira melhor do que eu:
 *
 * > *"Nessa eu não quero olhar CAC, eu não quero olhar gasto [por origem]. É basicamente para fazer
 * > uma gestão financeira do meu negócio."*
 *
 * São duas perguntas que exigem contas incompatíveis:
 *
 *   **O Meta está funcionando?** → receita do fluxo Meta ÷ gasto do Meta. Venda que veio de
 *   indicação em grupo não pode entrar, senão infla o ROAS do canal pago com resultado de outro
 *   canal — e a decisão de orçamento sai errada para cima. Essa vive em `/admin/funil` e na série
 *   de `docs/OPERACAO_DA_CAMPANHA.md` §4.
 *
 *   **Quanto o negócio ganhou?** → faturamento INTEIRO menos custo INTEIRO. Aqui a origem não
 *   importa: dinheiro que entrou é dinheiro que entrou, e o único custo variável hoje é o anúncio.
 *
 * Uma tela que tentasse servir as duas produziria um número que não responde nenhuma.
 *
 * ═══ A FONTE É `orders`, E O DONO ESTAVA CERTO SOBRE ISSO ════════════════════════════════════
 *
 * > *"o funil às vezes apresenta menos vendas do que no painel vendas. E o vendas, eu checando com
 * > o Mercado Pago, é o correto."*
 *
 * Está. `funnel_markers` tem restrição única em (visitante, marco) — um visitante tem um marco
 * `paid` na vida —, então segunda compra, upsell e recompra não aparecem lá. É de propósito, para a
 * taxa de conversão significar algo. Mas torna o funil a fonte errada para dinheiro.
 */
export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string }>;
}) {
  if (!(await isAuthenticated())) redirect('/admin');

  const { ver } = await searchParams;
  const indicador: Indicador = ehIndicador(ver) ? ver : 'faturamento';

  const [faturamento, gastos] = await withAutoBootstrap(() =>
    Promise.all([faturamentoPorDia(INICIO), gastosPorDia()]),
  );

  /*
    `hoje` em Brasília, e não em UTC.

    É ele que faz a série chegar até o dia de hoje mesmo sem venda nenhuma — um dia zerado é
    informação. Em UTC, depois das 21h o servidor já acharia que é amanhã e a tabela ganharia a
    linha de um dia que ainda não começou. Mesma armadilha do `max` do seletor de data do funil.
  */
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

  const resumo = montarFinanceiro(faturamento, gastos, hoje);

  /* `montarGrafico` ordena sozinho: a tabela fica do mais recente, o gráfico do mais antigo. */
  const grafico = montarGrafico(resumo.dias, indicador);
  /* Quais dias ganham rótulo — ver `rotulosDoGrafico`, e o defeito de leitura que ela conserta. */
  const visiveis = rotulosDoGrafico(grafico.barras.length);
  const porDiaDaSemana = mediaPorDiaDaSemana(resumo.dias);

  const diaBonito = (iso: string) => {
    const [ano, mes, dia] = iso.split('-');
    return `${dia}/${mes}${ano === '2026' ? '' : `/${ano}`}`;
  };

  return (
    <>
      <AdminNav current="financeiro" />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold">Financeiro</h1>
        <p className="mt-2 max-w-prose text-sm text-graphite">
          Faturamento de <strong className="text-ink">todas as origens</strong> contra o gasto de
          anúncio, dia por dia. A fonte é a lista de pedidos pagos — a mesma que bate com o extrato
          do Mercado Pago, e não o funil.
        </p>

        {/*
          O aviso da fronteira fica NA TELA, e não só no comentário do arquivo.

          A tentação de usar este lucro para decidir orçamento de anúncio vai existir sempre, porque
          o número é maior e mais bonito que o do fluxo Meta. Ele é maior porque soma venda que o
          anúncio não trouxe.
        */}
        <p className="mt-3 max-w-prose rounded border border-line bg-white p-3 text-xs text-graphite">
          <strong className="text-ink">Esta tela não decide orçamento de anúncio.</strong> O lucro
          aqui soma vendas que o anúncio não trouxe — indicação, link da bio, boca a boca. Para saber
          se o Meta está valendo a pena, a conta é outra e está no Funil, escolhendo o dia e olhando
          a linha da origem.
        </p>

        {resumo.dias.length === 0 ? (
          <p className="mt-8 rounded border border-line bg-white p-5 text-sm text-graphite">
            Nenhum pedido pago desde {diaBonito('2026-09-01')}. Quando a primeira venda entrar, ela
            aparece aqui.
          </p>
        ) : (
          <>
            <dl className="mt-8 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {[
                { rotulo: 'Faturamento', valor: resumo.faturamentoCentavos },
                { rotulo: 'Gasto com anúncio', valor: resumo.gastoCentavos },
                { rotulo: 'Lucro', valor: resumo.lucroCentavos },
              ].map((c) => (
                <div key={c.rotulo} className="rounded border border-line bg-white p-4">
                  <dt className="text-xs text-graphite">{c.rotulo}</dt>
                  <dd
                    className={`mt-1 font-display text-xl font-semibold tabular-nums ${
                      c.valor < 0 ? 'text-clay' : 'text-ink'
                    }`}
                  >
                    R$ {emReais(c.valor)}
                  </dd>
                </div>
              ))}
              <div className="rounded border border-line bg-white p-4">
                <dt className="text-xs text-graphite">Compras</dt>
                <dd className="mt-1 font-display text-xl font-semibold tabular-nums text-ink">
                  {resumo.pedidos}
                </dd>
              </div>
              <div className="rounded border border-line bg-white p-4">
                <dt className="text-xs text-graphite">Ticket médio</dt>
                <dd className="mt-1 font-display text-xl font-semibold tabular-nums text-ink">
                  {resumo.ticketMedioCentavos === null
                    ? '—'
                    : `R$ ${emReais(resumo.ticketMedioCentavos)}`}
                </dd>
              </div>
            </dl>

            {/*
              O ticket médio do topo é ponderado, e a nota diz isso.

              Quem lê uma coluna de ticket por dia espera que o total seja a média daquela coluna, e
              não é — é faturamento total ÷ compras totais. A diferença aparece justamente quando um
              dia magro de produto barato entra no meio de domingos cheios: a média das médias
              afundaria o número dando a esse dia o mesmo peso.
            */}
            <p className="mt-3 max-w-prose text-xs text-graphite">
              O ticket médio do topo é <strong className="text-ink">ponderado</strong>: faturamento
              total ÷ compras totais. Não é a média da coluna ao lado, que daria o mesmo peso a um
              dia de 20 compras e a um de 1.
            </p>

            {resumo.diasSemGasto > 0 && (
              <p className="mt-3 max-w-prose text-xs text-clay">
                {resumo.diasSemGasto === 1
                  ? 'Um dia está sem gasto informado e ficou FORA do total de lucro'
                  : `${resumo.diasSemGasto} dias estão sem gasto informado e ficaram FORA do total de lucro`}{' '}
                — o lucro acima é dos dias completos, para não sair inflado. Preencha na tabela.
                Dias anteriores ao primeiro anúncio não entram nessa conta.
              </p>
            )}

            {/*
              ═══ OS DOIS GRÁFICOS ═══════════════════════════════════════════════════════════

              Desenhados com CSS, sem biblioteca. Um gráfico de barras é uma divisão e uma altura —
              não vale uma dependência nova, e a `lib/financeiro.ts` já testa a matemática que
              importa: escala a partir do zero, valor ausente que não vira barra zerada, e espaço
              abaixo do zero quando existe prejuízo.
            */}
            <section className="mt-10">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-lg font-semibold">Dia a dia</h2>
                <nav className="flex gap-1 text-sm" aria-label="Indicador">
                  {INDICADORES.map((i) => (
                    <a
                      key={i}
                      href={`/admin/financeiro?ver=${i}`}
                      aria-current={i === indicador ? 'page' : undefined}
                      className={`rounded border px-3 py-1 ${
                        i === indicador
                          ? 'border-ink bg-ink text-paper'
                          : 'border-line text-graphite hover:border-ink'
                      }`}
                    >
                      {ROTULO[i]}
                    </a>
                  ))}
                </nav>
              </div>

              {grafico.media !== null && (
                <p className="mt-1 text-sm text-graphite">
                  Média de <strong className="text-ink">R$ {emReais(Math.round(grafico.media))}</strong>{' '}
                  por dia, sobre {grafico.amostra} {grafico.amostra === 1 ? 'dia' : 'dias'} — é a
                  linha pontilhada.
                </p>
              )}

              <div className="mt-4 rounded border border-line bg-white p-4">
                <div className="relative h-48">
                  {/* A linha do zero só aparece quando existe barra abaixo dela. */}
                  {grafico.zeroEmPorcento > 0 && (
                    <div
                      className="absolute inset-x-0 border-t border-line"
                      style={{ bottom: `${grafico.zeroEmPorcento}%` }}
                    />
                  )}

                  {grafico.mediaEmPorcento !== null && (
                    <div
                      className="absolute inset-x-0 border-t border-dashed border-graphite"
                      style={{ bottom: `${grafico.mediaEmPorcento}%` }}
                      aria-hidden
                    />
                  )}

                  <ol className="absolute inset-0 flex items-end gap-1">
                    {grafico.barras.map((b) => (
                      <li key={b.rotulo} className="relative h-full flex-1">
                        {b.valor === null ? (
                          /* Ausente é visualmente diferente de zero: tracejado, sem preenchimento. */
                          <span
                            className="absolute inset-x-0 bottom-0 top-0 rounded-sm border border-dashed border-line"
                            title={`${b.rotulo} — sem gasto informado`}
                          />
                        ) : (
                          <span
                            className={`absolute inset-x-0 rounded-sm ${
                              b.negativo ? 'bg-ball' : COR[indicador]
                            }`}
                            style={{
                              bottom: `${b.base}%`,
                              height: `${Math.max(b.altura, 0.6)}%`,
                            }}
                            title={`${b.rotulo} — R$ ${emReais(b.valor)}`}
                          />
                        )}
                      </li>
                    ))}
                  </ol>
                </div>

                {/*
                  ⚠️ `min-w-0` NÃO É DETALHE — É O QUE IMPEDE O GRÁFICO DE MENTIR.

                  Item de flex tem `min-width: auto` por padrão, e isso o proíbe de encolher abaixo
                  do próprio conteúdo. O item de BARRA é vazio, então vai a zero; o de rótulo tem
                  dois dígitos dentro e não vai. Com vinte e um dias num celular, a fileira de
                  rótulos fica mais larga que a de barras, transborda, e cada rótulo escorrega para
                  a direita do seu bar — com o erro ACUMULANDO até o fim da série.

                  Em 23/09 isso fez o dono ler que "o gráfico só conta até o dia 20", com as barras
                  do 21 e do 22 desenhadas na tela o tempo todo.

                  `rotulosDoGrafico` cuida da outra metade: os itens continuam todos aqui — é o que
                  mantém o alinhamento —, e só alguns recebem texto.
                */}
                <ol className="mt-2 flex gap-1 text-center text-[10px] tabular-nums text-graphite">
                  {grafico.barras.map((b, i) => (
                    <li key={b.rotulo} className="min-w-0 flex-1 overflow-hidden">
                      {visiveis[i] ? b.rotulo.slice(8) : ''}
                    </li>
                  ))}
                </ol>
              </div>

              {indicador === 'lucro' && resumo.diasSemGasto > 0 && (
                <p className="mt-2 text-xs text-graphite">
                  As barras tracejadas são dias sem gasto informado — lucro desconhecido, que é
                  diferente de lucro zero. Elas também ficam fora da média.
                </p>
              )}
            </section>

            {porDiaDaSemana.length > 0 && (
              <section className="mt-10">
                <h2 className="font-display text-lg font-semibold">
                  Faturamento médio por dia da semana
                </h2>
                <p className="mt-1 max-w-prose text-sm text-graphite">
                  Do que mais fatura para o que menos. O número entre parênteses é quantos dias
                  daquele tipo existem na série.
                </p>

                <div className="mt-4 rounded border border-line bg-white p-4">
                  <ol className="space-y-2">
                    {porDiaDaSemana.map((l) => (
                      <li key={l.indice} className="flex items-center gap-3 text-sm">
                        <span className="w-20 shrink-0 text-graphite">{l.nome}</span>
                        <span className="relative h-6 flex-1 overflow-hidden rounded-sm bg-paper">
                          <span
                            className="absolute inset-y-0 left-0 rounded-sm bg-court"
                            style={{ width: `${Math.max(l.altura, 1)}%` }}
                          />
                        </span>
                        <span className="w-28 shrink-0 text-right tabular-nums text-ink">
                          R$ {emReais(l.mediaCentavos)}
                        </span>
                        <span
                          className={`w-10 shrink-0 text-right text-xs tabular-nums ${
                            l.dias === 1 ? 'text-clay' : 'text-graphite'
                          }`}
                        >
                          ({l.dias})
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/*
                  O aviso de amostra pequena é obrigatório aqui.

                  "Quinta é o melhor dia" apoiado numa única quinta é ruído com cara de descoberta —
                  e leva alguém a concentrar orçamento no dia errado. Com nove dias de série, quase
                  todo dia da semana tem uma ou duas amostras.
                */}
                {porDiaDaSemana.some((l) => l.dias < 3) && (
                  <p className="mt-2 max-w-prose text-xs text-clay">
                    Dias da semana com poucas amostras — em vermelho os que têm uma só. Com uma ou
                    duas ocorrências isto ainda é ruído, não padrão: não vale mudar orçamento por
                    causa desta ordem antes de umas quatro semanas de série.
                  </p>
                )}
              </section>
            )}

            <div className="mt-10 overflow-x-auto rounded border border-line bg-white">
              <table className="w-full text-sm">
                <thead className="border-b border-line text-xs text-graphite">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Dia</th>
                    <th className="px-4 py-3 text-right font-semibold">Compras</th>
                    <th className="px-4 py-3 text-right font-semibold">Faturamento</th>
                    <th className="px-4 py-3 text-right font-semibold">Ticket médio</th>
                    <th className="px-4 py-3 text-right font-semibold">Gasto (R$)</th>
                    <th className="px-4 py-3 text-right font-semibold">Lucro</th>
                  </tr>
                </thead>
                <tbody>
                  {resumo.dias.map((d) => {
                    const melhorFat = resumo.melhorFaturamento?.dia === d.dia;
                    const melhorLuc = resumo.melhorLucro?.dia === d.dia;
                    return (
                      <tr key={d.dia} className="border-b border-line last:border-0">
                        <td className="px-4 py-2 text-ink">{diaBonito(d.dia)}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-graphite">
                          {d.pedidos}
                        </td>
                        <td
                          className={`px-4 py-2 text-right tabular-nums ${
                            melhorFat ? 'font-semibold text-ink' : 'text-ink'
                          }`}
                        >
                          {emReais(d.faturamentoCentavos)}
                          {melhorFat && <span className="ml-1 text-xs text-clay">máx</span>}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-graphite">
                          {d.ticketMedioCentavos === null ? '—' : emReais(d.ticketMedioCentavos)}
                        </td>
                        <td className="px-4 py-2">
                          <GastoForm
                            dia={d.dia}
                            valorAtual={d.gastoCentavos === null ? '' : emReais(d.gastoCentavos)}
                          />
                        </td>
                        <td
                          className={`px-4 py-2 text-right tabular-nums ${
                            d.lucroCentavos === null
                              ? 'text-graphite'
                              : d.lucroCentavos < 0
                                ? 'font-semibold text-clay'
                                : melhorLuc
                                  ? 'font-semibold text-ink'
                                  : 'text-ink'
                          }`}
                        >
                          {d.lucroCentavos === null ? '—' : emReais(d.lucroCentavos)}
                          {melhorLuc && <span className="ml-1 text-xs text-clay">máx</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="mt-3 max-w-prose text-xs text-graphite">
              O gasto é digitado porque o projeto não conversa com a API de marketing do Meta — ele
              existe só no Gerenciador de Anúncios. Digitado uma vez, fica salvo. Campo em branco
              apaga o dia; <strong className="text-ink">zero</strong> é diferente de branco e
              significa &quot;campanha pausada&quot;.
            </p>

            {(resumo.melhorFaturamento !== null || resumo.piorLucro !== null) && (
              <div className="mt-6 max-w-prose rounded border border-line bg-white p-4 text-sm text-graphite">
                {resumo.melhorFaturamento !== null && (
                  <p>
                    Maior faturamento:{' '}
                    <strong className="text-ink">
                      {diaBonito(resumo.melhorFaturamento.dia)} — R${' '}
                      {emReais(resumo.melhorFaturamento.faturamentoCentavos)}
                    </strong>
                  </p>
                )}
                {resumo.melhorLucro !== null && (
                  <p className="mt-1">
                    Maior lucro:{' '}
                    <strong className="text-ink">
                      {diaBonito(resumo.melhorLucro.dia)} — R${' '}
                      {emReais(resumo.melhorLucro.lucroCentavos ?? 0)}
                    </strong>
                  </p>
                )}
                {resumo.piorLucro !== null && resumo.piorLucro.dia !== resumo.melhorLucro?.dia && (
                  <p className="mt-1">
                    Pior lucro:{' '}
                    <strong className="text-ink">
                      {diaBonito(resumo.piorLucro.dia)} — R${' '}
                      {emReais(resumo.piorLucro.lucroCentavos ?? 0)}
                    </strong>
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
