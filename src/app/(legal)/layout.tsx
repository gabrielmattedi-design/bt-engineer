import Link from 'next/link';
import { SiteHeader } from '@/components/marketing/site-header';
import { CONTATO_EMAIL } from '@/lib/contato';

/**
 * Moldura das páginas legais — privacidade e termos.
 *
 * ═══ POR QUE ELAS EXISTEM ════════════════════════════════════════════════════════════════════
 *
 * Três razões, e as três são práticas:
 *
 *   1. Meta e Google costumam exigir uma URL de política de privacidade para aprovar anúncio de
 *      produto pago. Sem ela, a campanha é recusada ou a conta fica marcada.
 *   2. O produto coleta e-mail e guarda respostas de questionário. Isso é tratamento de dado
 *      pessoal, e a LGPD pede que o titular saiba o que é guardado e como pedir para apagar.
 *   3. Venda a consumidor no Brasil tem prazo de arrependimento por lei. Escrever como ele
 *      funciona protege os dois lados: o cliente sabe o direito dele, e a operação sabe o limite.
 *
 * ═══ POR QUE DISCRETAS ═══════════════════════════════════════════════════════════════════════
 *
 * Elas cumprem uma obrigação, não vendem nada. Aparecem como dois links pequenos no rodapé, sem
 * banner, sem pop-up e sem interromper ninguém — que é possível justamente porque o produto não
 * usa rastreamento de terceiro: sem script externo não há o que consentir, e o aviso de cookies
 * que a maioria dos sites precisa exibir aqui não tem função.
 *
 * ═══ O QUE ESTE TEXTO NÃO É ══════════════════════════════════════════════════════════════════
 *
 * Não é peça jurídica revisada por advogado. É um texto honesto sobre o que o sistema faz de
 * verdade — e essa parte é verificável no código. A revisão profissional continua valendo a pena
 * antes de o volume crescer.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <article className="legal-prose">{children}</article>

        <p className="mt-12 border-t border-line pt-6 text-sm text-graphite">
          Dúvidas sobre este texto ou sobre seus dados:{' '}
          <a href={`mailto:${CONTATO_EMAIL}`} className="text-clay underline">
            {CONTATO_EMAIL}
          </a>
        </p>

        <nav className="mt-6 flex gap-4 text-sm text-graphite">
          <Link href="/privacidade" className="underline">
            Privacidade
          </Link>
          <Link href="/termos" className="underline">
            Termos
          </Link>
          <Link href="/" className="underline">
            Início
          </Link>
        </nav>
      </main>
    </>
  );
}
