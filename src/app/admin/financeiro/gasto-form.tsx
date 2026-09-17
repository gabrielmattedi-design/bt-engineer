'use client';

import { useActionState } from 'react';
import { salvarGastoDoDia } from '../actions';

/**
 * O campo de gasto de um dia, dentro da linha dele na tabela.
 *
 * ═══ POR QUE UM FORMULÁRIO POR LINHA, E NÃO UM FORMULÁRIO PARA A TABELA ══════════════════════
 *
 * Um formulário só, com trinta campos e um botão "salvar tudo", erra de um jeito específico: um
 * valor digitado errado no meio faz o lote inteiro voltar com erro, e quem lê não sabe qual linha
 * reclamou. Pior, o trabalho das outras 29 linhas se perde.
 *
 * Linha a linha, cada dia é uma gravação independente. O gasto de ontem entra em dez segundos e
 * nada mais na tela é tocado — que é o uso real: uma linha por dia, todo dia.
 *
 * ─── O BOTÃO SÓ APARECE QUANDO O VALOR MUDA ──────────────────────────────────────────────────
 *
 * Sem isso, a tabela fica com um botão "Salvar" repetido em cada linha, e o dia já preenchido
 * parece pendente. Com `defaultValue` no input e o botão escondido até haver mudança, a tela mostra
 * só o que de fato falta fazer.
 */
export function GastoForm({
  dia,
  valorAtual,
}: {
  readonly dia: string;
  readonly valorAtual: string;
}) {
  const [state, action, pending] = useActionState(salvarGastoDoDia, undefined);
  const erro = state !== undefined && 'error' in state ? state.error : null;

  return (
    <form action={action} className="flex items-center justify-end gap-1">
      <input type="hidden" name="dia" value={dia} />
      <input
        type="text"
        inputMode="decimal"
        name="gasto"
        defaultValue={valorAtual}
        placeholder="—"
        aria-label={`Gasto de ${dia}`}
        className={`w-24 rounded border px-2 py-1 text-right text-sm tabular-nums ${
          erro !== null ? 'border-clay' : 'border-line'
        } ${valorAtual === '' ? 'bg-paper' : 'bg-white'}`}
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-line px-2 py-1 text-xs text-graphite hover:border-ink disabled:opacity-50"
      >
        {pending ? '…' : 'ok'}
      </button>
      {erro !== null && <span className="text-xs text-clay">{erro}</span>}
    </form>
  );
}
