import { redirect } from 'next/navigation';
import { isAuthenticated } from '../auth';
import { anyEmailStored, recentLookups } from '@/database/repositories/support-repo';
import { withAutoBootstrap } from '@/database/setup';
import { Wordmark } from '@/components/marketing/wordmark';
import { SearchForm } from './search-form';

export const dynamic = 'force-dynamic';

/**
 * `/admin/analises` — atendimento.
 *
 * ─── PARA QUE ELA EXISTE ─────────────────────────────────────────────────────────────────────
 *
 * Alguém paga, perde o link (e-mail errado, cookie limpo, celular trocado) e escreve pedindo
 * ajuda. O relatório está inteiro no banco; o que faltava era um caminho até ele que não passasse
 * por abrir o Postgres de produção na mão.
 *
 * ─── O QUE ELA DELIBERADAMENTE NÃO FAZ ───────────────────────────────────────────────────────
 *
 * Não lista análises. Não busca por parte do e-mail. Não tem "as 50 mais recentes". Cada uma
 * dessas conveniências transformaria uma ferramenta de atendimento numa janela para folhear os
 * dados de todos os clientes — e a diferença entre as duas coisas é uma linha de código, então ela
 * precisa ser uma decisão consciente e escrita, não um acidente de implementação.
 *
 * Também não reenvia e-mail nem corrige endereço: essas ações dependem de um cadastro que ainda
 * não existe. Quando existir, elas entram aqui.
 */
export default async function AnalisesPage() {
  if (!(await isAuthenticated())) redirect('/admin');

  const [lookups, emailsExist] = await withAutoBootstrap(async () =>
    Promise.all([recentLookups(), anyEmailStored()]),
  );

  return (
    <main className="min-h-screen bg-paper">
      <header className="border-b border-line bg-court px-6 py-5 text-paper">
        <div className="mx-auto max-w-3xl">
          <Wordmark size="sm" tone="dark" withTagline={false} />
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-10">
        <nav className="mb-6 flex flex-wrap gap-4 text-sm">
          <a href="/admin/verificacao" className="text-graphite underline">
            Curadoria
          </a>
          <a href="/admin/setup" className="text-graphite underline">
            Preparar o sistema
          </a>
          <a href="/admin/codigos" className="text-graphite underline">
            Códigos de acesso
          </a>
          <span className="font-semibold">Atendimento</span>
        </nav>

        <h1 className="font-display text-2xl font-semibold">Atendimento</h1>
        <p className="mt-2 max-w-prose text-sm text-graphite">
          Encontre a análise de quem perdeu o acesso. Toda consulta aqui abre o relatório de outra
          pessoa — por isso a busca é exata, nunca parcial, e cada consulta fica registrada abaixo.
        </p>

        <SearchForm />

        <section className="mt-12">
          <h2 className="font-display text-lg font-semibold">Consultas recentes</h2>
          <p className="mt-1 max-w-prose text-sm text-graphite">
            O registro guarda o <strong>tipo</strong> da busca e o resultado — nunca o termo
            digitado, que seria uma segunda cópia do dado pessoal justamente no log feito para
            protegê-lo.
          </p>

          {lookups.length === 0 ? (
            <p className="mt-3 text-sm text-graphite">Nenhuma consulta ainda.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {lookups.map((l, i) => (
                <li
                  key={`${l.createdAt.toISOString()}-${i}`}
                  className="flex items-baseline justify-between gap-4 py-2 text-sm"
                >
                  <span>
                    busca por <strong>{l.queryKind}</strong> ·{' '}
                    <span className="text-graphite">
                      {l.matchedCount === 0
                        ? 'sem resultado'
                        : l.matchedCount === 1
                          ? '1 análise'
                          : `${l.matchedCount} análises`}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-graphite">
                    {l.createdAt.toLocaleString('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/*
          O aviso é CONDICIONAL, e isso não é detalhe.

          Como texto fixo ele seria verdade hoje e mentira no dia em que o checkout começasse a
          gravar e-mail — e ninguém se lembraria de vir aqui apagá-lo. Um painel que afirma algo
          falso sobre o próprio sistema é pior que um painel que não afirma nada.
        */}
        {!emailsExist && (
          <p className="mt-10 max-w-prose text-xs leading-relaxed text-graphite">
            <strong>A busca por e-mail ainda não encontra nada</strong>, porque o checkout não pede
            e-mail — a coluna existe e a consulta é real, esperando o cadastro. Até lá, o caminho de
            recuperação é o ID do pagamento, que aparece no painel do gateway junto do valor e do
            horário.
          </p>
        )}
      </div>
    </main>
  );
}
