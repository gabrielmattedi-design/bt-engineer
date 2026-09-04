'use client';

import { useActionState } from 'react';
import { reconciliarFunil } from '../actions';

type Resultado = { error: string } | { ok: true; relatorios: number; convidados: number } | null;

/**
 * Oferece a limpeza das incoerências do funil.
 *
 * ═══ POR QUE O BOTÃO SÓ EXISTE QUANDO HÁ O QUE LIMPAR ════════════════════════════════════════
 *
 * O componente inteiro é renderizado apenas quando alguma contagem é maior que zero. Um botão de
 * "reconciliar" permanente convidaria a clicar por hábito, e o clique num funil já coerente não faz
 * nada — o que ensina que o botão é inofensivo, exatamente a lição errada para um controle que
 * apaga linha.
 *
 * Aqui ele aparece porque existe uma incoerência concreta, diz quantas linhas são, e some quando o
 * problema acaba. A ausência do botão passa a ser a confirmação de que o funil fecha.
 *
 * ═══ POR QUE AS DUAS CAUSAS DIVIDEM UM BOTÃO, MAS NÃO UMA FRASE ══════════════════════════════
 *
 * São dois defeitos de origens diferentes — um é resíduo de instrumentação antiga, o outro é
 * convidado que nunca deveria ter entrado — e cada um tem a própria linha, porque quem lê precisa
 * saber o que está apagando. O botão é um só porque a decisão é uma só: deixar o funil coerente.
 */
export function ReconciliarFunilForm({
  relatorios,
  convidados,
}: {
  relatorios: number;
  convidados: number;
}) {
  const [estado, acao, pendente] = useActionState<Resultado, FormData>(
    async () => reconciliarFunil(),
    null,
  );

  return (
    <form action={acao} className="mt-6 rounded border border-warn/40 bg-warn/5 p-5">
      <h3 className="font-display text-base font-semibold text-warn">O funil não está fechando</h3>

      <ul className="mt-3 space-y-3 text-sm leading-relaxed text-graphite">
        {relatorios > 0 && (
          <li>
            <strong className="text-ink">
              {relatorios === 1
                ? '1 marco de relatório sem pagamento correspondente'
                : `${relatorios} marcos de relatório sem pagamento correspondente`}
            </strong>
            <br />
            Resíduo da instrumentação antiga, que contava o relatório pelo navegador enquanto o
            pagamento era contado pela compra — o mesmo comprador em dois aparelhos virava duas
            pessoas. Já corrigido, mas marco gravado não se reescreve sozinho. Limpar apaga só esses
            marcos de relatório; as visitas daquelas pessoas às etapas anteriores continuam
            contadas, porque elas passaram por ali de verdade.
          </li>
        )}

        {convidados > 0 && (
          <li>
            <strong className="text-ink">
              {convidados === 1
                ? '1 jornada de convidado ainda contada'
                : `${convidados} jornadas de convidado ainda contadas`}
            </strong>
            <br />
            Quem entrou por cupom de acesso passa a sair do funil no momento do resgate, mas quem
            resgatou antes desta mudança continua contado — inflando o topo e afundando a taxa de
            conversão com gente que foi convidada a não pagar. Quem usou cupom de DESCONTO não entra
            aqui: essa pessoa pagou, e é cliente.
          </li>
        )}
      </ul>

      {estado && 'error' in estado && (
        <p className="mt-3 text-sm font-medium text-clay">{estado.error}</p>
      )}
      {estado && 'ok' in estado && (
        <p className="mt-3 text-sm font-medium text-court-mid">
          {estado.relatorios === 0 && estado.convidados === 0
            ? 'Nada a apagar — o funil já estava coerente.'
            : [
                estado.relatorios > 0
                  ? `${estado.relatorios} ${estado.relatorios === 1 ? 'marco de relatório removido' : 'marcos de relatório removidos'}`
                  : null,
                estado.convidados > 0
                  ? `${estado.convidados} ${estado.convidados === 1 ? 'jornada de convidado removida' : 'jornadas de convidado removidas'}`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
        </p>
      )}

      <button
        type="submit"
        disabled={pendente}
        className="mt-4 rounded bg-court px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60"
      >
        {pendente ? 'Limpando…' : 'Deixar o funil coerente'}
      </button>
    </form>
  );
}
