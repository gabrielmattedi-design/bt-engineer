import { inSimulatedPaymentMode, simulatedPaymentsAllowed } from '@/payments/mode';

/**
 * Diagnóstico do modo de pagamento — o que o SERVIDOR está enxergando, agora.
 *
 * ─── POR QUE ISTO PRECISOU EXISTIR ───────────────────────────────────────────────────────────
 *
 * O funil de pagamento parou por causa de uma variável de ambiente ausente, e não havia como o
 * dono do site descobrir isso: o painel da Vercel mostra o que foi DIGITADO, e o que quebra o
 * produto é o que o processo em execução realmente recebeu. Entre os dois existem três armadilhas
 * silenciosas, e todas já derrubaram este deploy:
 *
 *   • a variável foi salva mas o deploy não foi refeito — a Vercel só injeta no build seguinte;
 *   • foi marcada só em Preview ou Development, e não em Production;
 *   • foi salva com "TRUE", "1" ou um espaço no fim, e a comparação é com a string exata "true".
 *
 * Nos três casos o painel da Vercel mostra a variável lá, verdinha, e o site continua recusando.
 * Sem esta tela o diagnóstico vira tentativa e erro contra um deploy de dois minutos.
 *
 * ─── POR QUE O VALOR NÃO É EXIBIDO ───────────────────────────────────────────────────────────
 *
 * Mostramos se a variável CHEGOU e se foi ACEITA, nunca o conteúdo. Esta página fica atrás de
 * senha, mas o hábito de imprimir variáveis de ambiente numa tela é como vazamento de credencial
 * começa — e no dia em que alguém colocar um segredo de gateway aqui do lado, o hábito já estará
 * formado.
 */
export function PaymentStatus() {
  const provider = process.env.PAYMENT_PROVIDER ?? 'fake';
  const raw = process.env.ALLOW_FAKE_PAYMENTS;
  const nodeEnv = process.env.NODE_ENV;
  const allowed = simulatedPaymentsAllowed();
  const demoMode = inSimulatedPaymentMode();

  /** Diferencia "não chegou" de "chegou com valor que não liga nada" — erros de causa distinta. */
  const flag: 'ausente' | 'aceita' | 'valor inválido' =
    raw === undefined ? 'ausente' : raw === 'true' ? 'aceita' : 'valor inválido';

  /**
   * Fora de produção a variável não decide nada — o simulado já roda.
   *
   * Marcá-la de vermelho aqui criaria um alarme falso permanente na máquina de quem desenvolve, e
   * alarme que sempre toca é alarme que ninguém lê. O estado neutro diz a verdade: a linha existe,
   * mas não é ela que manda neste ambiente.
   */
  const inProduction = nodeEnv === 'production';

  const rows: readonly { label: string; value: string; ok: boolean | null }[] = [
    { label: 'Ambiente do servidor', value: nodeEnv ?? 'não definido', ok: null },
    { label: 'Provedor configurado', value: provider, ok: null },
    {
      label: 'ALLOW_FAKE_PAYMENTS',
      value: !inProduction
        ? `${flag === 'ausente' ? 'ausente' : `valor "${raw}"`} — não se aplica fora de produção`
        : flag === 'ausente'
          ? 'não chegou ao servidor'
          : flag === 'aceita'
            ? 'recebida e aceita'
            : 'recebida, mas o valor não é exatamente "true"',
      ok: inProduction ? flag === 'aceita' : null,
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

      {!allowed && (
        <div className="mt-5 rounded border border-warn/40 bg-warn/5 p-4 text-sm">
          <p className="font-medium">Como liberar o modo demonstração</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-graphite">
            <li>Na Vercel, abra o projeto e vá em Settings → Environment Variables.</li>
            <li>
              Nome <code>ALLOW_FAKE_PAYMENTS</code>, valor <code>true</code> — tudo minúsculo, sem
              espaços.
            </li>
            <li>
              Marque <strong>Production</strong>. Marcar só Preview não vale para o site publicado.
            </li>
            <li>
              Salve e vá em Deployments → menu do último deploy → <strong>Redeploy</strong>. Sem
              isso a variável não entra no ar.
            </li>
            <li>Volte a esta página: as duas linhas acima devem ficar verdes.</li>
          </ol>
        </div>
      )}

      {demoMode && (
        <p className="mt-5 rounded border border-court/30 bg-court/5 p-4 text-sm">
          O site está em <strong>modo demonstração</strong>: o funil funciona de ponta a ponta e
          nada é cobrado. Todas as páginas exibem o aviso ao visitante. Remova a variável ao
          conectar um gateway real.
        </p>
      )}
    </section>
  );
}
