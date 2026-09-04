import { redirect } from 'next/navigation';
import { AdminNav } from '../nav';
import { isAuthenticated } from '../auth';
import { LANCAMENTO, vendasDesde } from '@/database/repositories/commerce-repo';
import { registrarAcessoAVendas } from '@/database/repositories/support-repo';
import { withAutoBootstrap } from '@/database/setup';
import { Wordmark } from '@/components/marketing/wordmark';
import { brl } from '@/payments/catalogo';
import { dataCurta, dataLonga, hora } from '@/lib/datas';

export const dynamic = 'force-dynamic';

/**
 * `/admin/vendas` — gestão.
 *
 * ═══ POR QUE ESTA TELA É SEPARADA DE `/admin/analises` ═══════════════════════════════════════
 *
 * `analises` recusa listar de propósito, e continua recusando. O comentário de lá explica: busca
 * exata é ferramenta de atendimento, lista é janela para folhear os dados de todos os clientes, e
 * a diferença entre as duas é uma linha de código.
 *
 * A tentação era acrescentar a lista lá — é o mesmo dado, na mesma seção do painel. Seria o jeito
 * mais rápido e apagaria a regra: no dia seguinte ninguém lembraria por que a busca é exata, com
 * uma lista completa logo acima dela. Duas telas mantêm as duas perguntas separadas, e cada uma
 * com a sua regra escrita.
 *
 * ═══ O QUE ELA MOSTRA, E O QUE FICA DE FORA ══════════════════════════════════════════════════
 *
 * Data, e-mail, produto, valor, cupom e um LINK para o relatório. O relatório não vem embutido: uma
 * lista que já traz o conteúdo é uma lista que se lê inteira sem querer, e ler o relatório de um
 * cliente precisa ser um ato — um clique que a pessoa decide dar.
 *
 * Fica de fora todo pedido anterior ao lançamento, e a contagem do que ficou aparece no rodapé.
 * Ver `vendasDesde` para o porquê do corte.
 */
export default async function VendasPage() {
  if (!(await isAuthenticated())) redirect('/admin');

  const vendas = await withAutoBootstrap(async () => {
    const v = await vendasDesde(LANCAMENTO);
    /*
      O acesso é registrado como qualquer consulta de atendimento.

      Não é desconfiança do dono: é que a senha do admin pode um dia estar com mais alguém, e um
      painel que abre a lista de clientes sem deixar rastro não tem como responder "quem viu isso,
      e quando". O registro aparece na própria tela de atendimento, onde ele é lido.
    */
    await registrarAcessoAVendas(v.itens.length);
    return v;
  });

  const total = vendas.itens.reduce((soma, v) => soma + v.amountCents, 0);

  return (
    <main className="min-h-screen bg-paper">
      <header className="border-b border-line bg-court px-6 py-5 text-paper">
        <div className="mx-auto max-w-5xl">
          <Wordmark size="sm" tone="dark" withTagline={false} />
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10">
        <AdminNav current="vendas" />

        <h1 className="font-display text-2xl font-semibold">Vendas</h1>
        <p className="mt-2 max-w-prose text-sm text-graphite">
          Pagamentos confirmados desde o lançamento, em {dataLonga(vendas.desde)} às{' '}
          {hora(vendas.desde)}. Acesso por cupom não aparece aqui — não é venda, e tem contador
          próprio em Códigos de acesso.
        </p>

        <div className="mt-6 flex flex-wrap gap-8 border-y border-line py-4">
          <div>
            <div className="font-display text-3xl font-semibold tabular-nums">
              {vendas.itens.length}
            </div>
            <div className="text-xs uppercase tracking-wide text-graphite">
              {vendas.itens.length === 1 ? 'pedido pago' : 'pedidos pagos'}
            </div>
          </div>
          <div>
            <div className="font-display text-3xl font-semibold tabular-nums">{brl(total)}</div>
            <div className="text-xs uppercase tracking-wide text-graphite">receita no período</div>
          </div>
        </div>

        {vendas.itens.length === 0 ? (
          <p className="mt-8 text-sm text-graphite">
            Nenhuma venda desde o lançamento ainda.
          </p>
        ) : (
          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-graphite">
                  <th className="py-2 pr-4 font-medium">Quando</th>
                  <th className="py-2 pr-4 font-medium">E-mail</th>
                  <th className="py-2 pr-4 font-medium">Produto</th>
                  <th className="py-2 pr-4 text-right font-medium">Valor</th>
                  <th className="py-2 pr-4 font-medium">Cupom</th>
                  <th className="py-2 font-medium">Relatório</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {vendas.itens.map((v) => (
                  <tr key={v.orderId}>
                    <td className="py-3 pr-4 tabular-nums text-graphite">{dataCurta(v.paidAt)}</td>
                    <td className="py-3 pr-4">
                      {/*
                        Sem e-mail é o caso das compras feitas antes de o checkout exigi-lo. Dizer
                        "—" esconderia a diferença entre "não informou" e "coluna vazia por defeito
                        nosso"; a frase curta é honesta e cabe na célula.
                      */}
                      {v.email ?? <span className="text-graphite">sem cadastro</span>}
                    </td>
                    <td className="py-3 pr-4 text-graphite">{v.sku}</td>
                    <td className="py-3 pr-4 text-right tabular-nums">{brl(v.amountCents)}</td>
                    <td className="py-3 pr-4 text-graphite">{v.couponCode ?? ''}</td>
                    <td className="py-3">
                      {v.publicId ? (
                        <a
                          href={`/resultado/${v.publicId}`}
                          className="text-signal underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          abrir
                        </a>
                      ) : (
                        <span className="text-graphite">sem análise</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/*
          O rodapé é condicional pelo mesmo motivo do aviso em `/admin/analises`: como texto fixo
          ele afirmaria algo que pode deixar de ser verdade, e ninguém voltaria aqui para apagá-lo.
        */}
        {vendas.anterioresAoCorte > 0 && (
          <p className="mt-8 max-w-prose text-xs leading-relaxed text-graphite">
            <strong>
              {vendas.anterioresAoCorte}{' '}
              {vendas.anterioresAoCorte === 1 ? 'pedido pago não aparece' : 'pedidos pagos não aparecem'}{' '}
              nesta lista
            </strong>{' '}
            por serem anteriores ao lançamento — são as compras de teste feitas por você. Elas
            continuam no banco e continuam válidas; só não entram na contagem de vendas, para a
            receita aqui ser a receita de clientes.
          </p>
        )}
      </div>
    </main>
  );
}
