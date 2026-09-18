import type { Metadata } from 'next';
import { SiteHeader } from '@/components/marketing/site-header';
import { FormularioDaPesquisa } from '../formulario';
import { responderPrevia } from './action';

/**
 * A prévia da pesquisa — o mesmo formulário do cliente, sem gravar nada.
 *
 * ═══ PARA QUE ELA EXISTE ═════════════════════════════════════════════════════════════════════
 *
 * Nenhuma pesquisa foi disparada ainda, e a primeira vai para um cliente de verdade. Sem esta
 * página, a única forma de conhecer a experiência seria mandando o primeiro e-mail — isto é,
 * descobrir os defeitos junto com o cliente.
 *
 * ═══ POR QUE É PÚBLICA, E POR QUE ISSO É SEGURO ══════════════════════════════════════════════
 *
 * Exigir login aqui obrigaria a entrar no admin no celular para conferir como a tela se comporta no
 * celular — atrito na única coisa que esta página serve para fazer. E não há o que proteger: a
 * página não lê nem escreve nada, o e-mail exibido é inventado, e enviar não produz linha nenhuma.
 *
 * O `noindex` é o que impede o efeito colateral real: uma prévia indexada no Google concorrendo
 * com o site nas buscas por "Tennis Engineer".
 */
export const metadata: Metadata = {
  title: 'Prévia da pesquisa — Tennis Engineer',
  robots: { index: false, follow: false },
};

export default function PreviaPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-xl px-6 py-12">
        <p className="rounded border border-clay/40 bg-clay/5 p-3 text-sm text-ink">
          <strong>Prévia.</strong> Esta é exatamente a tela que o cliente vê ao clicar no e-mail. O
          botão enviar valida as respostas e leva ao agradecimento, mas <strong>não grava nada</strong>{' '}
          — não entra na leitura do painel nem conta nas médias.
        </p>

        <h1 className="mt-8 font-display text-2xl font-semibold text-ink">
          O que achou do seu setup?
        </h1>
        <p className="mt-3 text-graphite">
          Cinco perguntas, dois minutos. Só a primeira é obrigatória — o resto, responde o que
          quiser.
        </p>

        {/*
          Token vazio: não existe pedido nenhum por trás disto. A ação da prévia ignora o campo, e
          se um dia alguém apontar este formulário para a ação real, o token vazio faz `lerResposta`
          recusar em vez de gravar lixo.
        */}
        <FormularioDaPesquisa token="" email="cliente@exemplo.com" action={responderPrevia} />
      </main>
    </>
  );
}
