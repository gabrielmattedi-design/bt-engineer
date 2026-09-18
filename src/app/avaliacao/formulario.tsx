import { EFEITO, IMPEDIMENTO, USOU } from '@/lib/pesquisa';

/**
 * O formulário da pesquisa de satisfação.
 *
 * ═══ POR QUE ELE SAIU DA PÁGINA ══════════════════════════════════════════════════════════════
 *
 * Ele vive em dois lugares: no link real que chega por e-mail (`/avaliacao/<token>`) e na PRÉVIA
 * que o dono do produto percorre antes de qualquer disparo (`/avaliacao/previa`). Duas cópias do
 * mesmo formulário divergiriam na primeira mudança de pergunta — e a prévia divergente é pior que
 * nenhuma prévia: ela dá confiança sobre uma tela que ninguém vai ver.
 *
 * Uma cópia só, e a prévia testa exatamente o que o cliente recebe.
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
export function FormularioDaPesquisa({
  token,
  email,
  action,
}: {
  /** Identifica o pedido. Na prévia vem vazio e o destino não grava nada. */
  token: string;
  email: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form action={action} className="mt-8 space-y-8">
      <input type="hidden" name="token" value={token} />

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
          defaultValue={email}
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
        className="w-full rounded bg-clay px-6 py-3 font-semibold text-white hover:opacity-90"
      >
        Enviar
      </button>
    </form>
  );
}
