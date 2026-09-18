'use server';

import { redirect } from 'next/navigation';
import { registrarResposta } from '@/database/repositories/pesquisa-repo';
import { withAutoBootstrap } from '@/database/setup';
import { lerResposta } from '@/lib/pesquisa';

/**
 * Grava a resposta da pesquisa.
 *
 * ═══ POR QUE NÃO HÁ AUTENTICAÇÃO, E POR QUE ISSO ESTÁ CERTO ══════════════════════════════════
 *
 * Quem responde é um cliente que clicou num link de e-mail. Exigir login aqui derrubaria a taxa de
 * resposta a quase zero, e o que se protege não justifica: o token identifica um PEDIDO e só serve
 * para responder esta pesquisa. Ele não abre relatório, não mostra dado de compra, não concede
 * acesso a nada. O pior caso de um link vazado é alguém responder uma pesquisa no lugar de outro.
 *
 * O que a função NÃO faz é confiar no corpo: o token vem do formulário, mas a gravação só acontece
 * se ele existir no banco — `registrarResposta` devolve `false` quando o `update` não acha linha.
 *
 * ─── A VALIDAÇÃO ACONTECE AQUI, NO SERVIDOR ──────────────────────────────────────────────────
 *
 * `lerResposta` é a mesma função testada em `tests/integrity/pesquisa-de-satisfacao.test.ts`. Ela
 * descarta o ramo não escolhido, recusa nota fora da escala e corta texto sem limite. Um POST
 * direto, sem passar pela página, encontra exatamente as mesmas regras.
 */
export async function responderPesquisa(formData: FormData): Promise<void> {
  const token = String(formData.get('token') ?? '');
  const resposta = lerResposta(formData);

  /*
    Sem a pergunta obrigatória, volta para o formulário em vez de gravar meia resposta. O
    `required` do HTML já cobre o caminho normal; isto cobre o POST que não passou por ele.
  */
  if (token === '' || resposta === null) redirect(`/avaliacao/${token}`);

  await withAutoBootstrap(() => registrarResposta(token, resposta));

  redirect('/avaliacao/obrigado');
}
