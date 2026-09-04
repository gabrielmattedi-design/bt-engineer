'use client';

import { useActionState } from 'react';
import { reconciliarFunil } from '../actions';

/**
 * Oferece a limpeza dos marcos de relatório sem pagamento correspondente.
 *
 * ═══ POR QUE O BOTÃO SÓ EXISTE QUANDO HÁ O QUE LIMPAR ════════════════════════════════════════
 *
 * O componente inteiro é renderizado apenas quando a contagem é maior que zero. Um botão de
 * "reconciliar" permanente convidaria a clicar por hábito, e o clique num funil já coerente não faz
 * nada — o que ensina que o botão é inofensivo, exatamente a lição errada para um controle que
 * apaga linha.
 *
 * Aqui ele aparece porque existe uma incoerência concreta, diz quantas linhas são, e some quando o
 * problema acaba. A ausência do botão passa a ser a confirmação de que o funil está coerente.
 */
export function ReconciliarFunilForm({ quantidade }: { quantidade: number }) {
  const [estado, acao, pendente] = useActionState<
    { error: string } | { ok: true; apagados: number } | null,
    FormData
  >(async () => reconciliarFunil(), null);

  return (
    <form action={acao} className="mt-6 rounded border border-warn/40 bg-warn/5 p-5">
      <h3 className="font-display text-base font-semibold text-warn">
        {quantidade === 1
          ? '1 marco de relatório sem pagamento correspondente'
          : `${quantidade} marcos de relatório sem pagamento correspondente`}
      </h3>

      <p className="mt-2 max-w-prose text-sm leading-relaxed text-graphite">
        Resíduo da instrumentação antiga, que contava o relatório pelo navegador enquanto o
        pagamento era contado pela compra — o mesmo comprador em dois aparelhos virava duas pessoas.
        Isso já foi corrigido, mas marco gravado não se reescreve sozinho.
      </p>

      <p className="mt-2 max-w-prose text-sm leading-relaxed text-graphite">
        Limpar apaga <strong>só</strong> esses marcos de relatório. As visitas daquelas pessoas às
        etapas anteriores continuam contadas — elas passaram por ali de verdade; o que estava errado
        era a identidade do último marco, não a visita.
      </p>

      {estado && 'error' in estado && (
        <p className="mt-3 text-sm font-medium text-clay">{estado.error}</p>
      )}
      {estado && 'ok' in estado && (
        <p className="mt-3 text-sm font-medium text-court-mid">
          {estado.apagados === 0
            ? 'Nada a apagar — o funil já estava coerente.'
            : `${estado.apagados} ${estado.apagados === 1 ? 'marco removido' : 'marcos removidos'}.`}
        </p>
      )}

      <button
        type="submit"
        disabled={pendente}
        className="mt-4 rounded bg-court px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60"
      >
        {pendente ? 'Limpando…' : 'Limpar esses marcos'}
      </button>
    </form>
  );
}
