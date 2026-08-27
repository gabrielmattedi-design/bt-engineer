import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/marketing/site-header';
import { grantedEntitlements } from '@/database/repositories/session-repo';

export const dynamic = 'force-dynamic';

/**
 * A volta do gateway — a tela dos segundos entre pagar e receber.
 *
 * ═══ O DEFEITO QUE ESTA PÁGINA EXISTE PARA CONSERTAR ═════════════════════════════════════════
 *
 * O `back_urls.success` apontava direto para `/resultado/<id>`. Parece o destino óbvio, e é o
 * errado, porque naquele instante o acesso pode ainda não existir.
 *
 * Pagar e receber acesso são DOIS eventos, e eles chegam por caminhos diferentes. O comprador volta
 * pelo navegador, no milissegundo em que aperta "voltar ao site". A confirmação vem por outro
 * caminho — o gateway chamando o nosso servidor — e não há promessa nenhuma de ordem entre os dois.
 * Quando o navegador ganha a corrida, `/resultado` não encontra entitlement e redireciona para a
 * página de planos.
 *
 * O resultado é a pior tela possível: quem acabou de pagar R$ 49,99 é devolvido a uma página que
 * oferece, com preço e botão, exatamente o que ele acabou de comprar. Não parece uma espera —
 * parece que o dinheiro sumiu. É o momento em que um cliente pede reembolso ou abre disputa, e ele
 * teria acontecido com uma fração dos compradores reais, de forma intermitente e difícil de
 * reproduzir.
 *
 * Aconteceu no primeiro pagamento de teste da vida do sistema (ago/2026), que é a melhor hora
 * possível para acontecer.
 *
 * ═══ POR QUE ESTA PÁGINA NÃO CONCEDE NADA ════════════════════════════════════════════════════
 *
 * A tentação é óbvia: o Mercado Pago devolve `status=approved` na própria URL, e daria para liberar
 * o acesso ali mesmo. Seria um segundo caminho de concessão — e um que qualquer pessoa aciona
 * digitando o parâmetro na barra de endereço.
 *
 * O webhook é a origem única de entitlement em todo o sistema (§33), e continua sendo. Esta página
 * só ESPERA por ele. Ela nem lê a query string, o que é verificável em vez de prometido.
 *
 * ═══ POR QUE A ESPERA É NO SERVIDOR, COM RECARGA ═════════════════════════════════════════════
 *
 * Sem JavaScript de polling: a página se recarrega sozinha, e cada carga consulta o banco de novo.
 * É mais simples, funciona com JS desligado, e não deixa nenhuma requisição pendurada se a pessoa
 * fechar a aba.
 */

/** Quantas recargas antes de parar de dizer "já já". Em ~8s a confirmação normal já chegou. */
const TENTATIVAS = 4;
const INTERVALO_S = 2;

export default async function RetornoPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { sessionId } = await params;

  /*
    O único parâmetro lido é o CONTADOR de tentativas, e ele não decide acesso nenhum — só decide
    qual das duas frases aparece. O que decide acesso é `grantedEntitlements`, que lê o banco.
  */
  const { t } = await searchParams;
  const tentativa = Math.min(TENTATIVAS, Math.max(0, Number(t ?? 0) || 0));

  const granted = await grantedEntitlements(sessionId);
  if (granted.length > 0) redirect(`/resultado/${sessionId}`);

  const aindaEsperando = tentativa < TENTATIVAS;

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader tone="court" withTagline={false} />

      {/*
        A recarga é um `meta refresh` e não um `setTimeout`.

        Ela precisa funcionar mesmo com JavaScript desligado — quem paga por um link aberto dentro
        do app do banco ou de uma rede social está num navegador embutido, e é justamente ali que
        um script a mais é o que falha.
      */}
      {aindaEsperando && (
        <meta
          httpEquiv="refresh"
          content={`${INTERVALO_S};url=/retorno/${sessionId}?t=${tentativa + 1}`}
        />
      )}

      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        {aindaEsperando ? (
          <>
            <h1 className="font-display text-2xl font-semibold sm:text-3xl">
              Pagamento recebido. Estamos liberando seu relatório.
            </h1>
            <p className="mt-4 text-graphite">
              A confirmação leva alguns segundos para chegar. Esta página se atualiza sozinha — não
              precisa fazer nada.
            </p>
            <p className="mt-8 text-sm text-graphite" aria-live="polite">
              Verificando…
            </p>
          </>
        ) : (
          /*
            O fim da espera não é um erro, e não pode soar como um.

            Depois de ~8 segundos, o mais provável não é que o pagamento tenha falhado: é que ele
            está em análise, ou que a confirmação demorou mais que o normal. Dizer "não foi possível"
            aqui assustaria quem já pagou, sobre um dinheiro que quase sempre está a caminho.

            O que a pessoa precisa levar desta tela é que o acesso não depende de ela ficar aqui —
            o link chega por e-mail sozinho, e o relatório é dela quando chegar.
          */
          <>
            <h1 className="font-display text-2xl font-semibold sm:text-3xl">
              Seu pagamento está sendo confirmado.
            </h1>
            <p className="mt-4 text-graphite">
              Está demorando um pouco mais que o normal — acontece, e não significa que algo deu
              errado. Assim que a confirmação chegar, o link do seu relatório vai para o seu e-mail,
              mesmo que você feche esta página agora.
            </p>

            <div className="mt-8 flex flex-col items-center gap-4">
              <Link
                href={`/retorno/${sessionId}`}
                className="flex min-h-[56px] items-center justify-center rounded bg-court px-8
                           font-semibold text-white transition-opacity hover:opacity-90"
              >
                Verificar de novo
              </Link>
              <Link href="/minhas-analises" className="text-sm text-graphite underline">
                Ver minhas análises
              </Link>
            </div>

            <p className="mt-10 text-xs text-graphite">
              Se em alguns minutos nada chegar, responda o e-mail da compra que a gente resolve.
              Guarde o comprovante do Mercado Pago.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
