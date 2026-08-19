import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/marketing/site-header';
import { currentUser } from '@/auth/session';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Acessar minhas análises — Tennis Engineer',
};

/**
 * `/entrar` — o caminho de volta.
 *
 * Existe para o caso mais comum de suporte: a pessoa comprou, perdeu o link (fechou o navegador,
 * trocou de celular, limpou os cookies) e não tem como voltar ao que pagou.
 */
export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ link?: string }>;
}) {
  // Já entrou: mandar de volta ao formulário seria pedir de novo o que ele já tem.
  if (await currentUser()) redirect('/minhas-analises');

  const { link } = await searchParams;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-lg px-6 py-16">
        <h1 className="font-display text-3xl font-bold">Acessar minhas análises</h1>
        <p className="mt-3 leading-relaxed text-graphite">
          Perdeu o link do seu relatório? Ele não se perde: está guardado e ligado ao e-mail da
          compra.
        </p>

        {/*
          O link que não funcionou vira instrução, não acusação. O motivo mais provável é o mais
          banal — o link ficou parado na caixa de entrada mais de 15 minutos —, e a solução é
          idêntica nos três casos possíveis: pedir outro, aqui embaixo.
        */}
        {link === 'expirado' && (
          <p className="mt-6 rounded border border-warn/40 bg-warn/5 p-4 text-sm leading-relaxed text-warn">
            Esse link não vale mais — ou passou dos 15 minutos, ou já tinha sido usado. Peça um novo
            abaixo.
          </p>
        )}

        <LoginForm />

        <p className="mt-10 border-t border-line pt-6 text-sm leading-relaxed text-graphite">
          <strong className="text-ink">Por que não tem senha?</strong> Porque você não precisa de
          mais uma. Quem tem acesso ao seu e-mail é você — é a mesma prova que um &ldquo;esqueci
          minha senha&rdquo; usaria, sem a senha na frente.
        </p>
      </main>
    </>
  );
}
