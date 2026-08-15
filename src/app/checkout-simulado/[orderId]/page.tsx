import { notFound } from 'next/navigation';
import { SimulateButton } from './simulate-button';

export const dynamic = 'force-dynamic';

/**
 * Checkout simulado — só existe fora de produção.
 *
 * Imita a tela hospedada de um gateway: o usuário confirma, o gateway processa e a confirmação
 * chega ao produto POR WEBHOOK, nunca por esta página. É o que garante que o caminho testado em
 * desenvolvimento seja o mesmo caminho de produção.
 */
export default async function CheckoutSimuladoPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ retorno?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();

  const { orderId } = await params;
  const { retorno } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-6">
      <div className="w-full max-w-md rounded-lg bg-paper p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-warn">
          Ambiente de desenvolvimento
        </p>
        <h1 className="mt-3 font-display text-xl font-semibold">Checkout simulado</h1>
        <p className="mt-3 text-sm text-graphite">
          Esta tela substitui o checkout do gateway. Ao confirmar, um evento assinado é enviado ao
          webhook — exatamente o mesmo caminho de um pagamento real. Nenhum acesso é liberado por
          esta página.
        </p>
        <p className="mt-4 break-all rounded border border-line bg-white p-3 font-mono text-xs">
          pedido {orderId}
        </p>

        <SimulateButton orderId={orderId} returnUrl={retorno ?? '/'} />
      </div>
    </main>
  );
}
