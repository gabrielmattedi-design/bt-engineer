'use server';

import { markFunnel } from '@/database/repositories/funnel-repo';
import { visitorToken } from './visitor';

/**
 * Marcos do funil disparados pelo questionário — §16.
 *
 * ═══ POR QUE UMA SERVER ACTION, E NÃO UM SCRIPT DE ANALYTICS ═════════════════════════════════
 *
 * Porque não há script de rastreamento neste produto e não vai haver. O avanço de etapa é uma
 * chamada ao próprio servidor, com o cookie que já existe, gravando numa tabela que já é nossa. O
 * navegador do visitante não fala com ninguém além de nós — que é a única razão pela qual dá para
 * prometer isso na política de privacidade e cumprir.
 *
 * ═══ O QUE ELA NÃO PODE FAZER ════════════════════════════════════════════════════════════════
 *
 * Atrasar o clique. O avanço de etapa é a interação mais frequente do produto, e uma medição que
 * segura a transição vira o problema que deveria medir. O componente NÃO espera o retorno: dispara
 * e segue. `markFunnel` já engole os próprios erros, então não há promessa rejeitada solta.
 *
 * ═══ POR QUE ELA CRIA O COOKIE, AO CONTRÁRIO DO RESTO ════════════════════════════════════════
 *
 * O cookie nascia só no envio do questionário. Isso tornava invisível exatamente o que este funil
 * existe para ver: quem abre, responde três etapas e vai embora nunca chegava ao envio, e portanto
 * nunca ganhava identificador — o abandono some da medição por construção.
 *
 * Criar aqui é defensável porque abrir o questionário é ATO do visitante, não uma página que
 * passou na frente dele. Um `pageview` da home continua não gerando cookie nenhum.
 */

/** Faixa de etapas aceitas. Serve só para descartar entrada absurda, não para validar o quiz. */
const MAX_STEP = 20;

/**
 * Marca uma etapa alcançada do questionário. `0` é a abertura.
 *
 * `stepIndex` vem do cliente e é tratado como entrada não confiável: fora da faixa, é descartado
 * em silêncio. Um índice absurdo criaria uma linha de funil que não existe — e um painel com uma
 * etapa "42" é pior que um painel sem o dado, porque parece verdade.
 */
export async function trackQuizStep(stepIndex: number): Promise<void> {
  if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex > MAX_STEP) return;

  const token = await visitorToken();
  await markFunnel(token, stepIndex === 0 ? 'quiz:start' : `quiz:${stepIndex}`);
}
