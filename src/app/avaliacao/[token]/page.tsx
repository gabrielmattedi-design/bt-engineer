import { notFound } from 'next/navigation';
import { pesquisaPorToken } from '@/database/repositories/pesquisa-repo';
import { withAutoBootstrap } from '@/database/setup';
import { EFEITO, IMPEDIMENTO, USOU } from '@/lib/pesquisa';
import { responderPesquisa } from './action';

export const dynamic = 'force-dynamic';

/**
 * O formulário da pesquisa de satisfação.
 *
 * ═══ UMA PÁGINA SÓ, ROLANDO — E NÃO ETAPAS ══════════════════════════════════════════════════
 *
 * Cada "próximo" é um ponto de abandono, e cinco perguntas cabem numa tela de celular. Ver que é
 * curto já sobe a taxa de conclusão; um passo 1 de 5 faz o contrário.
 *
 * ═══ AS DUAS RAMIFICAÇÕES FICAM LADO A LADO ══════════════════════════════════════════════════
 *
 * Sem JavaScript nosso — o padrão do projeto —, esconder e mostrar exigiria script. Então as duas
 * aparecem, rotuladas "Se você seguiu" e "Se não seguiu", e a pessoa ignora a que não serve.
 *
 * Isso permite marcar as duas, e é o servidor que resolve: `lerResposta` DESCARTA o campo do ramo
 * não escolhido. Sem isso, "não seguiu por custo" passaria a contar gente que seguiu.
 *
 * ═══ SÓ A PERGUNTA 1 É OBRIGATÓRIA ═══════════════════════════════════════════════════════════
 *
 * E ela vem primeiro porque é a que decide o diagnóstico do projeto — quem abandonar no meio já
 * terá entregado o dado que mais importa. Resposta parcial vale muito mais que abandono.
 */
export default async function AvaliacaoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const pesquisa = await withAutoBootstrap(() => pesquisaPorToken(token));

  if (pesquisa === null) notFound();

  if (pesquisa.jaRespondida) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="font-display text-2xl font-semibold text-ink">Já recebi, obrigado.</h1>
        <p className="mt-3 text-graphite">
          Sua resposta está registrada. Se quiser corrigir ou acrescentar alguma coisa, é só
          escrever para contato@tennisengineer.com.br — eu leio todas.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <p className="text-sm font-semibold text-court">Tennis Engineer</p>
      <h1 className="mt-2 font-display text-2xl font-semibold text-ink">
        O que achou do seu setup?
      </h1>
      <p className="mt-3 text-graphite">
        Cinco perguntas, dois minutos. Só a primeira é obrigatória — o resto, responde o que quiser.
      </p>

      <form action={responderPesquisa} className="mt-8 space-y-8">
        <input type="hidden" name="token" value={pesquisa.token} />

        {/*
          O e-mail vem preenchido pelo código do link: quem clica não digita nada. O campo fica
          visível para conferência e é somente leitura — editá-lo não mudaria a identificação, que
          vem do token, e um campo editável que não muda nada engana quem o edita.
        */}
        <div>
          <label className="block text-sm text-graphite" htmlFor="email">
            Sua compra
          </label>
          <input
            id="email"
            type="email"
            defaultValue={pesquisa.email}
            readOnly
            className="mt-1 w-full rounded border border-line bg-paper px-3 py-2 text-ink"
          />
        </div>

        <fieldset>
          <legend className="font-semibold text-ink">
            1. Você chegou a usar alguma recomendação do laudo?
          </legend>
          <div className="mt-3 space-y-2">
            {USOU.map((o) => (
              <label key={o.valor} className="flex items-start gap-2 text-ink">
                <input type="radio" name="usou" value={o.valor} required className="mt-1" />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="rounded border border-line p-4">
          <legend className="px-1 text-sm font-semibold text-court">Se você seguiu</legend>
          <p className="text-ink">2. O que mudou na quadra?</p>
          <div className="mt-3 space-y-2">
            {EFEITO.map((o) => (
              <label key={o.valor} className="flex items-start gap-2 text-ink">
                <input type="radio" name="efeito" value={o.valor} className="mt-1" />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="rounded border border-line p-4">
          <legend className="px-1 text-sm font-semibold text-clay">Se você não seguiu</legend>
          <p className="text-ink">2. O que te impediu?</p>
          <div className="mt-3 space-y-2">
            {IMPEDIMENTO.map((o) => (
              <label key={o.valor} className="flex items-start gap-2 text-ink">
                <input type="radio" name="impedimento" value={o.valor} className="mt-1" />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
          <input
            type="text"
            name="impedimento_outro"
            placeholder="Se marcou “outro”, conta aqui"
            className="mt-3 w-full rounded border border-line px-3 py-2 text-ink"
          />
        </fieldset>

        <fieldset>
          <legend className="font-semibold text-ink">3. O laudo te ajudou a decidir?</legend>
          <div className="mt-3 flex gap-4">
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="flex flex-col items-center gap-1 text-ink">
                <input type="radio" name="nota_laudo" value={n} />
                <span className="text-sm">{n}</span>
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-graphite">1 = não ajudou · 5 = ajudou muito</p>
        </fieldset>

        <div>
          <label className="font-semibold text-ink" htmlFor="sugestao">
            4. O que você gostaria que o Tennis Engineer fizesse e ainda não faz?
          </label>
          <textarea
            id="sugestao"
            name="sugestao"
            rows={4}
            maxLength={2000}
            className="mt-2 w-full rounded border border-line px-3 py-2 text-ink"
          />
        </div>

        <fieldset>
          <legend className="font-semibold text-ink">
            5. Posso te procurar daqui a um mês para saber como ficou?
          </legend>
          <div className="mt-3 flex gap-6">
            <label className="flex items-center gap-2 text-ink">
              <input type="radio" name="pode_contatar" value="sim" />
              Pode
            </label>
            <label className="flex items-center gap-2 text-ink">
              <input type="radio" name="pode_contatar" value="nao" />
              Prefiro não
            </label>
          </div>
        </fieldset>

        <button
          type="submit"
          className="w-full rounded bg-court px-6 py-3 font-semibold text-paper hover:opacity-90"
        >
          Enviar
        </button>
      </form>
    </main>
  );
}
