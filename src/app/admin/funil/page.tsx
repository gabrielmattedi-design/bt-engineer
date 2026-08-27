import { redirect } from 'next/navigation';
import { isAuthenticated } from '../auth';
import { AdminNav } from '../nav';
import { funnelReport, quizDropoff } from '@/database/repositories/funnel-repo';
import { withAutoBootstrap } from '@/database/setup';

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
  const dias = periodo === 'tudo' ? null : Number(periodo ?? 30);
  const janela = Number.isFinite(dias) ? (dias as number | null) : 30;

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
  const [funil, etapas] = await withAutoBootstrap(() =>
    Promise.all([funnelReport(janela), quizDropoff(janela)]),
  );

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

        <nav className="mt-6 flex gap-2 text-sm" aria-label="Período">
          {[
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

            <p className="mt-4 text-sm text-graphite">
              <strong className="text-ink">
                {topo > 0 ? ((pagaram / topo) * 100).toFixed(1) : '0'}%
              </strong>{' '}
              de quem abre o questionário chega a pagar ({pagaram} de {topo}).
            </p>

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
          </ul>
        </div>
      </div>
    </main>
  );
}
