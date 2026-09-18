'use server';

import { redirect } from 'next/navigation';
import { lerResposta } from '@/lib/pesquisa';

/**
 * O "enviar" da prévia — percorre o caminho inteiro e não grava nada.
 *
 * ═══ POR QUE ELA VALIDA DE VERDADE ═══════════════════════════════════════════════════════════
 *
 * Seria mais simples redirecionar direto para o obrigado. Aí a prévia deixaria de testar a única
 * parte que pode surpreender: `lerResposta` é quem recusa resposta sem a pergunta 1, descarta o
 * ramo não escolhido e corta texto longo. Quem percorre a prévia precisa sentir esses limites,
 * porque é neles que a experiência do cliente pode travar.
 *
 * O que ela NÃO faz é tocar no banco. Nenhuma linha em `satisfaction_surveys`, nenhuma estatística
 * contaminada. A tela de leitura precisa continuar mostrando só o que clientes de verdade
 * responderam — uma prévia que entra na média envenena o número que a pesquisa existe para medir.
 */
export async function responderPrevia(formData: FormData): Promise<void> {
  const resposta = lerResposta(formData);

  if (resposta === null) redirect('/avaliacao/previa');

  redirect('/avaliacao/obrigado?previa=1');
}
