import { redirect } from 'next/navigation';
import { isAuthenticated } from '../auth';
import { AdminNav } from '../nav';
import { withAutoBootstrap } from '@/database/setup';
import { faturamentoPorDia, gastosPorDia } from '@/database/repositories/financeiro-repo';
import { montarFinanceiro } from '@/lib/financeiro';
import { emReais } from '@/lib/lucro';
import { GastoForm } from './gasto-form';

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
export default async function FinanceiroPage() {
  if (!(await isAuthenticated())) redirect('/admin');

  const [faturamento, gastos] = await withAutoBootstrap(() =>
    Promise.all([faturamentoPorDia(INICIO), gastosPorDia()]),
  );

  const resumo = montarFinanceiro(faturamento, gastos);

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
              </p>
            )}

            <div className="mt-8 overflow-x-auto rounded border border-line bg-white">
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
