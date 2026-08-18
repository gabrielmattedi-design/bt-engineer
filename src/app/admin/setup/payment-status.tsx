import {
  inviteOnlyEnabledInDatabase,
  simulatedPaymentsEnabledInDatabase,
} from '@/database/repositories/settings-repo';
import {
  inSimulatedPaymentMode,
  inviteOnlyAccess,
  inviteOnlyByEnv,
  simulatedPaymentsAllowed,
  simulatedPaymentsAllowedByEnv,
} from '@/payments/mode';
import { setInviteOnly, setSimulatedPayments } from './actions';

/**
 * Diagnóstico e interruptor do modo de pagamento.
 *
 * ─── POR QUE ISTO PRECISOU EXISTIR ───────────────────────────────────────────────────────────
 *
 * O funil de pagamento parou por causa de uma variável de ambiente ausente, e não havia como o
 * dono do site descobrir isso: o painel da hospedagem mostra o que foi DIGITADO, e o que quebra o
 * produto é o que o processo em execução realmente recebeu. Entre os dois existem três armadilhas
 * silenciosas, e todas já derrubaram este deploy:
 *
 *   • a variável foi salva mas o deploy não foi refeito — só entra no build seguinte;
 *   • foi marcada em Preview ou Development, e não em Production;
 *   • foi salva como "TRUE", "1" ou com espaço no fim, e a comparação é com a string exata "true".
 *
 * Nos três casos o painel da hospedagem mostra a variável lá, e o site continua recusando.
 *
 * Daí as duas metades desta tela: em cima, o que o servidor está de fato enxergando; embaixo, um
 * botão que liga o modo sem depender de encontrar a tela certa em painel de terceiro.
 *
 * ─── POR QUE O VALOR DA VARIÁVEL NÃO É EXIBIDO ───────────────────────────────────────────────
 *
 * Mostramos se ela CHEGOU e se foi ACEITA, nunca o conteúdo. Esta página fica atrás de senha, mas
 * o hábito de imprimir variáveis de ambiente numa tela é como vazamento de credencial começa — e
 * no dia em que alguém colocar um segredo de gateway aqui do lado, o hábito já estará formado.
 */
export async function PaymentStatus() {
  const provider = process.env.PAYMENT_PROVIDER ?? 'fake';
  const raw = process.env.ALLOW_FAKE_PAYMENTS;
  const nodeEnv = process.env.NODE_ENV;

  const byEnv = simulatedPaymentsAllowedByEnv();
  const byPanel = await simulatedPaymentsEnabledInDatabase();
  const allowed = await simulatedPaymentsAllowed();
  const demoMode = await inSimulatedPaymentMode();
  const inviteOnly = await inviteOnlyAccess();
  const inviteByPanel = await inviteOnlyEnabledInDatabase();

  /** Diferencia "não chegou" de "chegou com valor que não liga nada" — erros de causa distinta. */
  const flag: 'ausente' | 'aceita' | 'valor inválido' =
    raw === undefined ? 'ausente' : raw === 'true' ? 'aceita' : 'valor inválido';

  /**
   * Fora de produção nada disso decide coisa alguma — o simulado já roda.
   *
   * Marcar a linha de vermelho ali criaria um alarme falso permanente na máquina de quem
   * desenvolve, e alarme que sempre toca é alarme que ninguém lê.
   */
  const inProduction = nodeEnv === 'production';
  const realProvider = provider !== 'fake';

  const rows: readonly { label: string; value: string; ok: boolean | null }[] = [
    { label: 'Ambiente do servidor', value: nodeEnv ?? 'não definido', ok: null },
    { label: 'Provedor configurado', value: provider, ok: null },
    {
      label: 'ALLOW_FAKE_PAYMENTS',
      value: !inProduction
        ? 'não se aplica fora de produção'
        : flag === 'ausente'
          ? 'não chegou ao servidor'
          : flag === 'aceita'
            ? 'recebida e aceita'
            : 'recebida, mas o valor não é exatamente "true"',
      ok: inProduction ? flag === 'aceita' : null,
    },
    {
      label: 'Interruptor do painel',
      value: byPanel ? 'ligado aqui nesta tela' : 'desligado',
      ok: inProduction ? byPanel : null,
    },
    {
      label: 'Checkout liberado',
      value: allowed ? 'sim' : 'não — o botão de pagamento vai recusar',
      ok: allowed,
    },
  ];

  return (
    <section className="mt-10 rounded border border-line bg-white p-6">
      <h2 className="font-display text-lg font-semibold">Pagamento</h2>
      <p className="mt-1 text-sm text-graphite">
        O que este servidor está enxergando neste momento.
      </p>

      <dl className="mt-5 space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <dt className="w-52 shrink-0 text-xs uppercase tracking-wider text-graphite">
              {row.label}
            </dt>
            <dd
              className={
                row.ok === null ? 'text-sm' : row.ok ? 'text-sm text-court' : 'text-sm text-warn'
              }
            >
              {row.ok === null ? '' : row.ok ? '✓ ' : '✕ '}
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      {realProvider ? (
        <p className="mt-6 rounded border border-line bg-paper p-4 text-sm text-graphite">
          Este site está configurado com um gateway real ({provider}). O modo demonstração não se
          aplica — e não há interruptor que o traga de volta.
        </p>
      ) : (
        <div className="mt-6 border-t border-line pt-6">
          <h3 className="font-medium">Modo demonstração</h3>
          <p className="mt-2 max-w-prose text-sm text-graphite">
            Liga o funil de pagamento de ponta a ponta <strong>sem cobrar nada</strong>. Serve para
            você percorrer o site inteiro antes de contratar um gateway. Enquanto estiver ligado,
            todas as páginas exibem um aviso ao visitante — e ele não é fechável.
          </p>

          {/*
            Formulário nativo, sem `onClick` + `useTransition`.
            Já custou caro neste projeto: os botões de migração desta mesma página não POSTavam
            nada e a tela parecia funcionar. `<form action={serverAction}>` não tem esse modo de
            falhar, e ainda funciona com JavaScript desligado.
          */}
          <form action={setSimulatedPayments} className="mt-4">
            <input type="hidden" name="enabled" value={byPanel ? 'false' : 'true'} />
            <button
              type="submit"
              className={
                byPanel
                  ? 'flex min-h-[56px] items-center justify-center rounded border-2 border-ink px-6 font-semibold transition-colors hover:bg-ink hover:text-paper'
                  : 'flex min-h-[56px] items-center justify-center rounded bg-clay px-6 font-semibold text-white transition-opacity hover:opacity-90'
              }
            >
              {byPanel ? 'Desligar modo demonstração' : 'Ligar modo demonstração'}
            </button>
          </form>

          {byEnv && inProduction && (
            <p className="mt-3 text-xs text-graphite">
              A variável ALLOW_FAKE_PAYMENTS já libera o modo por conta própria. Desligar o
              interruptor aqui não terá efeito enquanto ela existir.
            </p>
          )}
        </div>
      )}

      {demoMode && !inviteOnly && (
        <p className="mt-6 rounded border border-court/30 bg-court/5 p-4 text-sm">
          O site está em <strong>modo demonstração</strong>: o funil funciona de ponta a ponta e
          nada é cobrado. Desligue ao conectar um gateway real.
        </p>
      )}

      {/*
        O convite fica DEPOIS do modo demonstração e por cima dele — que é a ordem de precedência
        real. Colocado antes, pareceria mais uma opção entre iguais; aqui ele encerra a seção
        dizendo que anula o que está acima, inclusive a variável de ambiente.
      */}
      <div className="mt-6 border-t border-line pt-6">
        <h3 className="font-medium">Acesso só por convite</h3>
        <p className="mt-2 max-w-prose text-sm text-graphite">
          Fecha o checkout por completo. Nenhum pedido é criado, o checkout simulado deixa de
          existir e o relatório só é liberado por <strong>código de convite</strong>. É o modo para
          mandar o link a convidados sem que o repasse transforme o produto em gratuito.
        </p>

        <form action={setInviteOnly} className="mt-4">
          <input type="hidden" name="enabled" value={inviteByPanel ? 'false' : 'true'} />
          <button
            type="submit"
            className={
              inviteByPanel
                ? 'flex min-h-[56px] items-center justify-center rounded border-2 border-ink px-6 font-semibold transition-colors hover:bg-ink hover:text-paper'
                : 'flex min-h-[56px] items-center justify-center rounded bg-court px-6 font-semibold text-paper transition-opacity hover:opacity-90'
            }
          >
            {inviteByPanel ? 'Reabrir o checkout' : 'Ligar acesso só por convite'}
          </button>
        </form>

        {inviteOnlyByEnv() && (
          <p className="mt-3 text-xs text-graphite">
            A variável INVITE_ONLY já mantém o modo ligado por conta própria. Desligar aqui não terá
            efeito enquanto ela existir.
          </p>
        )}

        {inviteOnly && (
          <p className="mt-4 rounded border border-court/30 bg-court/5 p-4 text-sm">
            O checkout está <strong>fechado</strong>. Ao ligar, os códigos <code>MAITE</code>{' '}
            (ilimitado) e <code>DJOKOINSS</code> (20 usos) foram criados se ainda não existiam —
            veja e recarregue em <code>/admin/codigos</code>.
          </p>
        )}
      </div>
    </section>
  );
}
