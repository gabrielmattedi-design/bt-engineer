import { redirect } from 'next/navigation';
import { AdminNav } from '../nav';
import { isAuthenticated } from '../auth';
import { listCoupons } from '@/database/repositories/coupon-repo';
import { withAutoBootstrap } from '@/database/setup';
import { Wordmark } from '@/components/marketing/wordmark';
import { toggleCode } from './actions';
import { ACCESS_PRESETS } from './presets';
import { CreateCodeForm } from './create-form';
import { RechargeForm } from './recharge-form';

export const dynamic = 'force-dynamic';

/**
 * `/admin/codigos` — códigos de acesso.
 *
 * Libera o relatório sem cobrança para quem tem o código, mantendo o site normal para quem não
 * tem. É o que permite mandar o link a um colega sem transformar o produto em gratuito para todos,
 * e sem a faixa de "modo demonstração" anunciando que nada é cobrado.
 */
export default async function CodigosPage() {
  if (!(await isAuthenticated())) redirect('/admin');

  const coupons = await withAutoBootstrap(() => listCoupons());

  return (
    <main className="min-h-screen bg-paper">
      <header className="border-b border-line bg-court px-6 py-5 text-paper">
        <div className="mx-auto max-w-3xl">
          <Wordmark size="sm" tone="dark" withTagline={false} />
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-10">
        <AdminNav current="codigos" />

        <h1 className="font-display text-2xl font-semibold">Códigos de acesso</h1>
        <p className="mt-2 max-w-prose text-sm text-graphite">
          Quem digita um código válido na tela de planos recebe o relatório sem passar pelo
          pagamento. Quem não tem código vê o site normalmente, com os preços — o campo de código
          fica recolhido atrás de um link discreto.
        </p>

        <CreateCodeForm presets={ACCESS_PRESETS} />

        <h2 className="mt-12 font-display text-lg font-semibold">Códigos existentes</h2>

        {coupons.length === 0 ? (
          <p className="mt-3 text-sm text-graphite">Nenhum código criado ainda.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {coupons.map((c) => {
              const remaining = c.maxUses === null ? null : Math.max(0, c.maxUses - c.usedCount);
              const exhausted = remaining === 0;

              return (
                <li key={c.code} className="rounded border border-line bg-white p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <code className="font-display text-lg font-bold tracking-wider">{c.code}</code>
                    <span
                      className={
                        !c.active || exhausted
                          ? 'text-xs font-medium uppercase tracking-wider text-warn'
                          : 'text-xs font-medium uppercase tracking-wider text-court'
                      }
                    >
                      {!c.active ? 'desativado' : exhausted ? 'esgotado' : 'ativo'}
                    </span>
                  </div>

                  {/*
                    O TIPO do código, dito na listagem.

                    Os dois se parecem aqui — mesma linha, mesmo contador, mesmo botão de desativar —
                    e fazem coisas opostas: um libera o relatório de graça, o outro só abate uma
                    porcentagem. Sem esta linha, a única forma de saber qual é qual seria lembrar do
                    que foi digitado no dia em que o código nasceu.
                  */}
                  <p className="mt-2 text-sm font-medium">
                    {c.discountPercent === null
                      ? 'Libera o acesso'
                      : `Desconto de ${c.discountPercent}% no checkout`}
                  </p>

                  <p className="mt-1 text-sm tabular-nums text-graphite">
                    {c.maxUses === null
                      ? `${c.usedCount} usos · sem limite total`
                      : `${c.usedCount} de ${c.maxUses} usos · restam ${remaining}`}
                  </p>

                  {/*
                    O contador das últimas 24 h — o número que denuncia vazamento em curso.

                    O total acumulado não serve para isso: um código com 300 usos em seis meses e um
                    com 300 usos em duas horas mostram o mesmo número, e só o segundo é problema.
                    O destaque acende no teto porque é exatamente quando vale olhar.
                  */}
                  {c.dailyLimit !== null && (
                    <p
                      className={`mt-1 text-sm tabular-nums ${
                        c.usedToday >= c.dailyLimit ? 'font-semibold text-warn' : 'text-graphite'
                      }`}
                    >
                      {c.usedToday} de {c.dailyLimit} nas últimas 24 h
                      {c.usedToday >= c.dailyLimit && ' · teto do dia atingido'}
                    </p>
                  )}

                  {c.note && <p className="mt-1 text-sm text-graphite">{c.note}</p>}

                  {/* Só o código limitado recebe recarga — em ilimitado ela não significa nada. */}
                  {c.maxUses !== null && <RechargeForm code={c.code} />}

                  {/* Formulário nativo: nada de onClick que possa não postar. */}
                  <form action={toggleCode} className="mt-3">
                    <input type="hidden" name="code" value={c.code} />
                    <input type="hidden" name="active" value={c.active ? 'false' : 'true'} />
                    <button type="submit" className="text-sm text-clay underline">
                      {c.active ? 'Desativar' : 'Reativar'}
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-10 max-w-prose text-xs text-graphite">
          Desativar não apaga o histórico: quem já resgatou continua com o acesso. Editar um código
          existente mantém o contador de usos — o limite novo vale sobre o total, não sobre o que
          resta.
        </p>
      </div>
    </main>
  );
}
