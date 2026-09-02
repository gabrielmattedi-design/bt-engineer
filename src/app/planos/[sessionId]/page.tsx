import { markPageFunnel } from '@/app/funnel-mark';
import { notFound } from 'next/navigation';
import { activeProducts } from '@/database/repositories/commerce-repo';
import { loadRecommendation } from '@/database/repositories/session-repo';
import { seedProducts, withAutoBootstrap } from '@/database/setup';
import { BrandSignature } from '@/components/marketing/wordmark';
import { SiteHeader } from '@/components/marketing/site-header';
import { CheckoutButton } from './checkout-button';
import { CouponForm } from './coupon-form';
import { checkoutOpen, INVITE_ONLY_MESSAGE } from '@/payments/mode';
import { brl } from '@/payments/catalogo';
import { comDesconto, descontoDaAnalise } from '@/database/repositories/coupon-repo';

export const dynamic = 'force-dynamic';

/**
 * Fora do índice dos buscadores.
 *
 * Esta URL é o conteúdo de UMA pessoa, e o acesso a ela é o próprio endereço — quem tem o link
 * tem a página. Indexada, ela deixaria de ser privada sem que ninguém percebesse.
 *
 * Segunda camada: `robots.ts` já pede o mesmo para a rota inteira. As duas existem porque falham
 * de formas diferentes — o arquivo cobre antes da visita, esta tag cobre a página mesmo quando o
 * robô chegou nela por outro caminho.
 */
export const metadata = {
  robots: { index: false, follow: false },
};


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

  await markPageFunnel('plans');

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

  /*
    O desconto é relido AQUI, e não guardado de nenhuma visita anterior.

    Ele pode ter deixado de valer desde a última vez — cupom desativado no painel, ou último uso
    gasto por outra pessoa. Relendo, o preço volta ao cheio na hora e a pessoa vê isso antes de
    pagar, em vez de descobrir no gateway.
  */
  const desconto = await withAutoBootstrap(() => descontoDaAnalise(sessionId));

  const inviteOnly = !(await checkoutOpen());

  /*
    O preço continua vindo do BANCO nesta tela, e não do catálogo do código.

    É a tela que antecede o checkout: o número aqui precisa ser o mesmo que `createOrder` vai copiar
    para o pedido. Ler do catálogo faria a página anunciar o preço novo enquanto a loja ainda cobra o
    antigo, no exato lugar onde essa diferença custa mais caro. Quem reconcilia os dois é
    `seedProducts`, e `/admin/setup` mostra quando eles estão fora de sincronia.
  */

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader tone="court" withTagline={false} />

      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">
          Sua análise está pronta
        </h1>
        <p className="mt-3 max-w-prose text-graphite">
          Avaliamos {stored.result.candidates_evaluated} raquetes contra o seu perfil.
          {inviteOnly ? ' Veja abaixo o que cada plano abre.' : ' Escolha o que você quer ver.'}
        </p>

        {/*
          Fase de convidados: o campo de código vem PRIMEIRO e os planos viram informação.

          Enterrado depois de dois cartões com preço e botão desabilitado, o campo parecia a saída de
          emergência de um site quebrado. Ele é a porta da frente enquanto durar o teste, e a única
          coisa que o convidado precisa fazer aqui.
        */}
        {inviteOnly && (
          <div className="mt-8 rounded border-2 border-court bg-white p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-court">
              Acesso por convite
            </p>
            <p className="mt-3 max-w-prose text-sm text-graphite">{INVITE_ONLY_MESSAGE}</p>
            <CouponForm sessionId={sessionId} />
          </div>
        )}

        <div className="mt-8 space-y-4">
          {visible.map((product) => (
            <div key={product.sku} className="rounded border border-line bg-white p-6">
              <h2 className="font-display text-lg font-semibold">{product.name}</h2>
              {product.description && (
                <p className="mt-2 max-w-prose text-sm text-graphite">{product.description}</p>
              )}
              {/*
                ═══ O PREÇO CHEIO CONTINUA VISÍVEL, RISCADO ═══════════════════════════════════

                O §58 proíbe preço "de/por" — e proíbe o FICTÍCIO: inventar um valor anterior que
                nunca foi cobrado para fabricar a sensação de desconto. Aqui o valor riscado é o que
                a loja cobra de todo mundo neste instante, e o cupom é real.

                Escondê-lo seria pior para o cliente: sem a referência, "R$ 20,99" não informa que
                houve desconto nenhum, e a pessoa que digitou um cupom fica sem saber se ele pegou.
              */}
              {desconto ? (
                <p className="mt-4 flex flex-wrap items-baseline gap-3">
                  <span className="display-number text-3xl text-court">
                    {brl(comDesconto(product.priceCents, desconto.percent))}
                  </span>
                  <span className="text-lg text-graphite line-through">
                    {brl(product.priceCents)}
                  </span>
                  <span className="rounded bg-court/10 px-2 py-0.5 text-xs font-semibold text-court">
                    {desconto.code} · −{desconto.percent}%
                  </span>
                </p>
              ) : (
                <p className="display-number mt-4 text-3xl">{brl(product.priceCents)}</p>
              )}
              {inviteOnly ? (
                /*
                  O preço continua visível de propósito.

                  Some-lo transformaria a tela num cardápio sem valores, e o convidado é justamente
                  quem precisa reagir ao preço — é metade do que se está testando. O que sai é o
                  botão, porque ele é o que concede acesso sem cobrar.
                */
                <p className="mt-3 text-sm text-graphite">
                  Compra indisponível durante a fase de testes.
                </p>
              ) : (
                <CheckoutButton sessionId={sessionId} sku={product.sku} />
              )}
            </div>
          ))}
        </div>

        {visible.length === 0 && (
          <p className="mt-8 rounded border border-warn/40 bg-warn/5 p-4 text-sm text-warn">
            Nenhum produto disponível no momento. Abra <code>/admin/setup</code> e clique em
            &ldquo;Criar produtos&rdquo;.
          </p>
        )}

        {!inviteOnly && <CouponForm sessionId={sessionId} />}

        <p className="mt-10 max-w-prose text-xs text-graphite">
          Pagamento único, sem assinatura e sem renovação automática. Os índices Tennis Engineer são
          métricas internas da nossa análise, não especificações do fabricante.
        </p>

        <BrandSignature className="mt-10" />
      </div>
    </main>
  );
}
