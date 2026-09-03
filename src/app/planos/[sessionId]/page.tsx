import Link from 'next/link';
import { markPageFunnel } from '@/app/funnel-mark';
import { notFound } from 'next/navigation';
import { activeProducts } from '@/database/repositories/commerce-repo';
import { grantedEntitlements, loadRecommendation } from '@/database/repositories/session-repo';
import { PRODUCT_ENTITLEMENTS } from '@/payments/entitlements';
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
  searchParams: Promise<{ produto?: string; status?: string; collection_status?: string }>;
}) {
  const { sessionId } = await params;
  const { produto, status, collection_status } = await searchParams;

  /**
   * ═══ QUEM VOLTA DE UM PAGAMENTO RECUSADO CHEGAVA AQUI SEM UMA PALAVRA ══════════════════════
   *
   * A URL de falha do checkout devolve a pessoa a esta página, e o Mercado Pago acrescenta
   * `status=rejected` ao endereço. A página ignorava esse parâmetro: quem teve o cartão recusado
   * via o mesmo card, o mesmo preço e o mesmo botão, como se nada tivesse acontecido.
   *
   * O caso que mostrou o tamanho disso foi uma recusa real, com esta mensagem no painel:
   *
   *   "Protegemos você de um pagamento suspeito. Recomende a seu cliente que pague com o meio de
   *    pagamento e dispositivo que costuma usar para compras on-line."
   *
   * É o antifraude — não é limite, não é cartão inválido, não é erro de digitação. A pessoa que
   * levou essa recusa acredita que o problema é o cartão dela, e tentar de novo com o MESMO cartão
   * é justamente o que costuma ser recusado de novo. Sem uma linha explicando, a venda acaba ali:
   * ela não sabe que o PIX passa por fora dessa análise inteira.
   *
   * O texto não promete que vai dar certo e não culpa o banco de ninguém. Diz o que aconteceu e
   * qual é o caminho com mais chance.
   */
  const pagamentoRecusado =
    status === 'rejected' ||
    status === 'failure' ||
    collection_status === 'rejected';

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
  /**
   * ═══ A LOJA SÓ OFERECE O QUE FAZ SENTIDO PARA QUEM ESTÁ OLHANDO ══════════════════════════════
   *
   * Relato do dono: "essa tela habilita o pagamento de desbloquear a segunda colocada sem ter
   * comprado nada, vai confundir o usuário. As opções de upgrade só devem aparecer na página de
   * resultado, depois de pagar."
   *
   * A lista era `all` menos um SKU fixo, e por isso mostrava os cinco produtos a qualquer visitante:
   * as duas portas de entrada e os três upgrades. "Desbloquear a 2ª colocada" por R$ 8,99 para quem
   * não tem nem a 1ª é pior do que confuso — é vender um pedaço de um relatório que a pessoa não
   * pode abrir. Ela pagaria e continuaria sem ver raquete nenhuma.
   *
   * O filtro agora é por POSSE, e sai de duas perguntas:
   *
   *   1. Este produto ainda entrega alguma coisa? Um SKU cujos entitlements a pessoa já tem some —
   *      é o mesmo princípio do §58 em outra direção: não cobrar de novo pelo que já foi comprado.
   *
   *   2. O pré-requisito está pago? Só `racket_report` e `full_setup` são portas de entrada. Todo o
   *      resto é upgrade e depende de `racket_report_access`, porque é literalmente uma extensão de
   *      um relatório que precisa existir.
   *
   * O `?produto=` continua estreitando a lista a um item, mas AGORA sobre o conjunto já filtrado —
   * antes ele passava por cima de tudo, e `/planos/<id>?produto=unlock_rank_2` abria um checkout de
   * upgrade para quem não tinha comprado nada. Uma tela que esconde o botão não protege nada se o
   * endereço continua funcionando.
   */
  const granted = new Set(await withAutoBootstrap(() => grantedEntitlements(sessionId)));
  const ENTRADAS = new Set(['racket_report', 'full_setup']);

  const temRelatorio = granted.has('racket_report_access');

  const oferecivel = (sku: string): boolean => {
    if (sku === 'top3_unlock') return false;
    const concede = PRODUCT_ENTITLEMENTS[sku] ?? [];
    // Nada a entregar: a pessoa já tem tudo o que este produto abriria.
    if (concede.length > 0 && concede.every((e) => granted.has(e))) return false;
    // Upgrade sem o relatório pago é um produto que a pessoa não consegue usar.
    if (!ENTRADAS.has(sku) && !temRelatorio) return false;
    /*
      ═══ E A PORTA DE ENTRADA FECHA DEPOIS DE ATRAVESSADA ══════════════════════════════════

      Este é o lado caro do mesmo erro, e ele sobreviveu à primeira versão do filtro.

      Quem pagou R$ 29,99 pela raquete ainda via "Descubra seu setup completo" por R$ 44,99 — um
      produto que INCLUI a raquete que ela acabou de comprar. Aceitar essa oferta custaria R$ 74,98
      pelo mesmo conteúdo que `setup_upgrade` entrega por R$ 59,98, pagando duas vezes pelo
      relatório. O §58 vale aqui na forma mais direta possível: não cobrar de novo por algo já
      vendido.

      O caminho para quem já entrou é o upgrade, e ele existe exatamente para isso — ver a nota de
      preços em `PRODUCT_ENTITLEMENTS`, que documenta por que os dois caminhos chegam ao mesmo
      conteúdo com R$ 9,99 de diferença.
    */
    if (ENTRADAS.has(sku) && temRelatorio) return false;
    return true;
  };

  const disponiveis = all.filter((p) => oferecivel(p.sku));
  const pedido = produto ? disponiveis.filter((p) => p.sku === produto) : [];
  /*
    Um `?produto=` que não sobrevive ao filtro cai de volta na lista, em vez de dar tela vazia.

    O caso real é o link antigo: a pessoa guardou `/planos/<id>?produto=racket_report`, comprou por
    outro caminho e volta nele meses depois. Mostrar "nenhum produto disponível" ali seria descrever
    o sistema, não a situação dela.
  */
  const visible = produto ? (pedido.length > 0 ? pedido : disponiveis) : disponiveis;

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

        {/* Ver `pagamentoRecusado` acima para o caso que este bloco fecha. */}
        {pagamentoRecusado && (
          <div className="mt-8 rounded border-l-2 border-warn bg-warn/5 px-5 py-4">
            <p className="font-semibold">O pagamento não foi aprovado.</p>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-graphite">
              Na maioria das vezes isso não é problema com o seu cartão: o Mercado Pago recusa
              automaticamente compras que fogem do padrão de quem está comprando — cartão pouco
              usado naquele aparelho, primeira compra no site, duas compras seguidas. Nada foi
              cobrado.
            </p>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-graphite">
              O caminho com mais chance é o <strong>PIX</strong>, que não passa por essa análise e
              cai na hora. Pagar pelo aparelho e pelo cartão que você já usa em outras compras
              on-line também costuma resolver. Se preferir tentar o mesmo cartão de novo, espere
              alguns minutos — tentativas seguidas tendem a ser recusadas de novo.
            </p>
          </div>
        )}

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

        {/*
          O `id` existe para o formulário de cupom achar esta lista.

          Aplicado o desconto, o preço muda AQUI — e no celular o formulário fica bem abaixo dos
          cards, fora da tela. A mensagem de sucesso dizia "os valores abaixo" e eles estavam acima,
          o que faz a pessoa concluir que não pegou. Ver `coupon-form.tsx`.
        */}
        <div id="planos-lista" className="mt-8 space-y-4">
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

        {/*
          ═══ LISTA VAZIA PASSOU A TER DUAS CAUSAS ═══════════════════════════════════════════

          Antes só havia uma: a tabela de produtos vazia, e a mensagem era uma instrução técnica
          para o dono do site. Com o filtro por posse existe uma segunda, e ela é de CLIENTE — quem
          já comprou tudo chega aqui sem nada para ver. Mandar essa pessoa abrir `/admin/setup`
          seria responder à pergunta errada, com um endereço que ela não pode abrir.
        */}
        {visible.length === 0 &&
          (all.length === 0 ? (
            <p className="mt-8 rounded border border-warn/40 bg-warn/5 p-4 text-sm text-warn">
              Nenhum produto disponível no momento. Abra <code>/admin/setup</code> e clique em
              &ldquo;Criar produtos&rdquo;.
            </p>
          ) : (
            <div className="mt-8 rounded border border-court/30 bg-court/5 p-6">
              <p className="font-display text-lg font-semibold">Você já tem tudo desta análise.</p>
              <p className="mt-2 max-w-prose text-sm text-graphite">
                Não há mais nada a comprar aqui — o que você adquiriu já está liberado no seu
                relatório.
              </p>
              <Link
                href={`/resultado/${sessionId}`}
                className="mt-4 inline-block rounded bg-court px-5 py-2.5 text-sm font-semibold text-paper"
              >
                Abrir meu relatório
              </Link>
            </div>
          ))}

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
