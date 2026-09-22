'use client';

import { useActionState } from 'react';
import { ajustarUsos, excluirCodigo } from './actions';

/**
 * Fixar quantos usos ainda cabem — o gesto que faltava ao lado de "recarregar".
 *
 * ═══ POR QUE DOIS CONTROLES, E NÃO UM ════════════════════════════════════════════════════════
 *
 * "Recarregar 20" e "deixar 2 sobrando" são pedidos diferentes, e espremê-los num campo só obriga
 * a fazer a conta ao contrário: para sobrarem 2 com 13 já usados, o teto teria de ir para 15 — uma
 * subtração de cabeça num campo que decide quantos produtos saem de graça.
 *
 * O valor inicial é o número que a linha acima já mostra como "restam N". Assim o campo começa
 * dizendo a verdade atual, e mexer nele é mover de onde se está — não adivinhar de onde se parte.
 */
export function AjustarUsosForm({ code, restantes }: { code: string; restantes: number }) {
  const [state, action, pendente] = useActionState(ajustarUsos, null);

  return (
    <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
      <input type="hidden" name="code" value={code} />
      <label className="text-sm text-graphite" htmlFor={`restantes-${code}`}>
        Deixar restando
      </label>
      <input
        id={`restantes-${code}`}
        name="restantes"
        type="number"
        min={0}
        defaultValue={restantes}
        className="w-20 rounded border border-line px-2 py-1 text-sm tabular-nums"
      />
      <span className="text-sm text-graphite">usos</span>
      <button
        type="submit"
        disabled={pendente}
        className="rounded border border-line px-3 py-1 text-sm font-medium
                   transition-colors hover:border-ink disabled:opacity-50"
      >
        {pendente ? 'Ajustando…' : 'Fixar'}
      </button>

      {state && 'ok' in state && <span className="text-sm text-court">{state.ok}</span>}
      {state && 'error' in state && <span className="text-sm text-warn">{state.error}</span>}
    </form>
  );
}

/**
 * Apagar um código.
 *
 * ═══ AS DUAS TRAVAS, E POR QUE NENHUMA É EXCESSO ═════════════════════════════════════════════
 *
 * **A caixa de confirmação** viaja no formulário em vez de ser um `confirm()` do navegador. A ação
 * de servidor precisa receber a intenção junto do pedido: sem isso, um F5 na página depois de
 * apagar reenviaria o POST e apagaria outro código sem ninguém ter confirmado de novo.
 *
 * **A recusa de apagar código usado** mora no repositório (`removerCupom`), porque é regra e não
 * aparência. `coupon_redemptions.code` e `orders.coupon_code` são texto solto, sem chave
 * estrangeira — apagar o cupom não apaga nada disso, só deixa o rastro apontando para um código
 * que não existe, e some a explicação de um pedido de R$ 39,99 no meio de uma lista de R$ 49,99.
 *
 * O botão aparece para todos mesmo assim: esconder para os usados faria a ausência parecer defeito
 * da tela. Ele recusa com o motivo e indica Desativar, que está ali do lado.
 */
export function ApagarCodigoForm({ code, usado }: { code: string; usado: boolean }) {
  const [state, action, pendente] = useActionState(excluirCodigo, null);

  return (
    <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
      <input type="hidden" name="code" value={code} />
      <label className="flex items-center gap-1.5 text-sm text-graphite">
        <input type="checkbox" name="confirmar" value="sim" className="h-4 w-4" />
        confirmo
      </label>
      <button
        type="submit"
        disabled={pendente}
        className="rounded border border-warn/50 px-3 py-1 text-sm font-medium text-warn
                   transition-colors hover:bg-warn hover:text-paper disabled:opacity-50"
      >
        {pendente ? 'Apagando…' : 'Apagar'}
      </button>

      {/*
        O aviso aparece ANTES de a pessoa tentar, e só no código que já tem uso.

        Deixar descobrir pelo erro é fazer alguém marcar a caixa, clicar num botão vermelho e só
        então saber que não podia — três passos para chegar a uma informação que cabia numa linha.
      */}
      {usado && !state && (
        <span className="text-xs text-graphite">
          já usado — só desativar
        </span>
      )}

      {state && 'ok' in state && <span className="text-sm text-court">{state.ok}</span>}
      {state && 'error' in state && (
        <span className="max-w-prose text-sm text-warn">{state.error}</span>
      )}
    </form>
  );
}
