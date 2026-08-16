import { notFound } from 'next/navigation';
import { activeProducts } from '@/database/repositories/commerce-repo';
import { loadRecommendation } from '@/database/repositories/session-repo';
import { seedProducts, withAutoBootstrap } from '@/database/setup';
import { BrandSignature, Wordmark } from '@/components/marketing/wordmark';
import { CheckoutButton } from './checkout-button';

export const dynamic = 'force-dynamic';

/**
 * Escolha de plano — §26, §57, §58.
 *
 * Regras aplicadas aqui, todas do §58: sem cronômetro, sem "última chance", sem desconto fictício,
 * sem falsa escassez. O preço vem do banco (§34) — nenhum valor em reais existe no código desta
 * página, então não há como o exibido divergir do cobrado.
 */
export default async function PlanosPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ produto?: string }>;
}) {
  const { sessionId } = await params;
  const { produto } = await searchParams;

  const stored = await loadRecommendation(sessionId);
  if (!stored) notFound();

  /**
   * Semeia os produtos sob demanda se a tabela existir vazia.
   *
   * `withAutoBootstrap` só reage a "tabela não existe". Um banco cuja estrutura foi criada mas
   * nunca semeada passa por ele sem erro e chega aqui com zero produtos — e a tela então pedia
   * para o dono "rodar npm run db:seed-products", um comando de terminal, para um produto cujo
   * dono é declaradamente não-técnico. Semear é idempotente (`onConflictDoNothing` na SKU), então
   * fazê-lo aqui não tem custo nem risco.
   */
  const all = await withAutoBootstrap(async () => {
    const products = await activeProducts();
    if (products.length > 0) return products;
    await seedProducts();
    return activeProducts();
  });
  // O upsell do Top 3 vem do relatório e mostra só aquele item; a entrada normal mostra os planos
  // principais. Em nenhum dos casos inventamos uma opção que não existe no catálogo.
  const visible = produto ? all.filter((p) => p.sku === produto) : all.filter((p) => p.sku !== 'top3_unlock');

  const brl = (cents: number): string =>
    `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;

  return (
    <main className="min-h-screen bg-paper">
      <header className="border-b border-line bg-court px-6 py-6 text-paper">
        <div className="mx-auto max-w-3xl">
          <Wordmark size="sm" tone="dark" withTagline={false} />
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">
          Sua análise está pronta
        </h1>
        <p className="mt-3 max-w-prose text-graphite">
          Avaliamos {stored.result.candidates_evaluated} raquetes contra o seu perfil. Escolha o que
          você quer ver.
        </p>

        <div className="mt-8 space-y-4">
          {visible.map((product) => (
            <div key={product.sku} className="rounded border border-line bg-white p-6">
              <h2 className="font-display text-lg font-semibold">{product.name}</h2>
              {product.description && (
                <p className="mt-2 max-w-prose text-sm text-graphite">{product.description}</p>
              )}
              <p className="display-number mt-4 text-3xl">{brl(product.priceCents)}</p>
              <CheckoutButton sessionId={sessionId} sku={product.sku} />
            </div>
          ))}
        </div>

        {visible.length === 0 && (
          <p className="mt-8 rounded border border-warn/40 bg-warn/5 p-4 text-sm text-warn">
            Nenhum produto disponível no momento. Abra <code>/admin/setup</code> e clique em
            &ldquo;Criar produtos&rdquo;.
          </p>
        )}

        <p className="mt-10 max-w-prose text-xs text-graphite">
          Pagamento único, sem assinatura e sem renovação automática. Os índices Tennis Engineer são
          métricas internas da nossa análise, não especificações do fabricante.
        </p>

        <BrandSignature className="mt-10" />
      </div>
    </main>
  );
}
