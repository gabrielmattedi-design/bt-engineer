'use client';

import { useActionState, useState } from 'react';
import { resetarFunil } from '../actions';

/**
 * Zerar a medição — recolhido, com confirmação digitada.
 *
 * ═══ POR QUE ISTO EXISTE ═════════════════════════════════════════════════════════════════════
 *
 * Pedido do dono na véspera do lançamento: "consegue zerar agora o funil, para eu ter real ideia
 * do público quando lançar?"
 *
 * A razão é boa. Todo marco gravado até aqui é ele mesmo testando — dezenas de questionários,
 * pagamentos aprovados e recusados, telas abertas e reabertas. Um funil que soma o dono ao público
 * não mede o público, e engana na direção otimista: quem testa completa o fluxo inteiro muito mais
 * do que um visitante real.
 *
 * ═══ POR QUE RECOLHIDO, E POR QUE DIGITADO ═══════════════════════════════════════════════════
 *
 * Este é o único controle destrutivo do painel, e o estrago dele é invisível na hora: depois de
 * zerar, a tela mostra zeros — que é exatamente o esperado de quem acabou de zerar de propósito.
 * Ninguém desconfia. A falta aparece semanas depois, quando alguém procura a comparação com o
 * período anterior e ela não existe mais. Não há backup destas linhas em lugar nenhum.
 *
 * Por isso duas travas em vez de um botão: ele fica atrás de um link discreto, e exigir a palavra
 * digitada garante que a mão não faça sozinha o que a cabeça não decidiu. O mesmo raciocínio do
 * campo de cupom recolhido em `coupon-form.tsx`, por motivo oposto — lá para não chamar atenção de
 * quem não precisa, aqui para não ser alcançado por acidente.
 *
 * A confirmação é revalidada no servidor. A daqui é conveniência; a de lá é a que protege.
 */
export function ResetFunnelForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(resetarFunil, undefined);

  const zerado = state !== undefined && 'ok' in state;

  if (zerado) {
    return (
      <p className="mt-12 rounded border border-line bg-white p-5 text-sm">
        <strong className="text-ink">Medição zerada.</strong>{' '}
        <span className="text-graphite">
          Saíram {state.marcos} {state.marcos === 1 ? 'marco' : 'marcos'} de funil e {state.origens}{' '}
          {state.origens === 1 ? 'registro' : 'registros'} de origem. Pedidos, análises e acessos
          não foram tocados — os relatórios já enviados continuam abrindo. A contagem recomeça no
          próximo visitante.
        </span>
      </p>
    );
  }

  return (
    <div className="mt-12 text-sm">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-graphite underline"
        >
          Zerar a medição
        </button>
      ) : (
        <form action={action} className="rounded border border-warn bg-warn/5 p-5">
          <p className="font-semibold text-ink">Zerar a medição</p>
          <p className="mt-2 max-w-prose leading-relaxed text-graphite">
            Apaga os marcos do funil e as origens de tráfego, para a contagem recomeçar do zero.
            Serve para separar os seus testes do público de verdade.
          </p>
          <p className="mt-2 max-w-prose leading-relaxed text-graphite">
            <strong className="text-ink">Não tem volta</strong> — não existe backup destas linhas.
            Pedidos, análises, acessos e cupons não são tocados: as compras de teste continuam
            existindo e os relatórios já enviados continuam abrindo.
          </p>

          <label className="mt-4 block">
            <span className="text-graphite">
              Digite <strong className="text-ink">ZERAR</strong> para confirmar:
            </span>
            <input
              name="confirmacao"
              autoComplete="off"
              className="mt-1 block w-40 rounded border border-line px-3 py-2 uppercase"
            />
          </label>

          {state !== undefined && 'error' in state && (
            <p className="mt-3 font-medium text-warn">{state.error}</p>
          )}

          <div className="mt-4 flex items-center gap-4">
            <button
              type="submit"
              disabled={pending}
              className="rounded bg-clay px-4 py-2 font-semibold text-white disabled:opacity-60"
            >
              {pending ? 'Zerando…' : 'Zerar agora'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-graphite underline">
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
