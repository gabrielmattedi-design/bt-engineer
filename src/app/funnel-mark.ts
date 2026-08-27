import 'server-only';
import { markFunnel } from '@/database/repositories/funnel-repo';
import { existingVisitorToken } from '@/app/questionario/visitor';

/**
 * Marca um ponto do funil a partir de uma PÁGINA (Server Component).
 *
 * ═══ POR QUE ELE NÃO CRIA O COOKIE ═══════════════════════════════════════════════════════════
 *
 * Duas razões, e a segunda é a que decide.
 *
 * Server Components não podem escrever cookies no Next — só Server Actions e Route Handlers podem.
 * Tentar aqui lançaria em tempo de execução, numa página que o cliente está tentando ler.
 *
 * E, mesmo que pudessem, não deveria: quem chega ao relatório ou aos planos JÁ passou pelo
 * questionário e já tem cookie. Um visitante sem cookie nesses pontos é alguém que abriu um link
 * direto — contá-lo como parte do funil inflaria o topo com gente que nunca esteve nele.
 */
export async function markPageFunnel(marker: string): Promise<void> {
  const token = await existingVisitorToken();
  if (!token) return;
  await markFunnel(token, marker);
}
