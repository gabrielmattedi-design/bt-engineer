import 'server-only';
import { markFunnelBySessionId } from '@/database/repositories/funnel-repo';
import { analysisOwnerSessionId } from '@/database/repositories/session-repo';

/**
 * Marca um ponto do funil pela ANÁLISE, e não pelo navegador que está olhando.
 *
 * ═══ O QUE ESTAVA ERRADO AQUI ════════════════════════════════════════════════════════════════
 *
 * Este arquivo continha `markPageFunnel`, que resolvia o cookie `te_visitor` da requisição e
 * gravava o marco nele. Parece a coisa óbvia — é a pessoa que está na tela —, e produz uma
 * contagem errada em três situações que acontecem o tempo todo:
 *
 *   · O comprador abre o relatório no computador e depois no celular. Dois cookies, duas pessoas.
 *   · Alguém compra o pacote simples e dias depois o upgrade de outro aparelho. Dois pagamentos
 *     de duas "pessoas" — quando o comprador é UM.
 *   · O link da prévia é mandado para um amigo. O amigo nunca respondeu o questionário, então
 *     entra no meio do funil sem ter passado pelo topo, e a etapa fica acima de 100% da anterior.
 *
 * Os três são a mesma confusão: cookie é APARELHO, e o funil mede PESSOAS.
 *
 * ═══ POR QUE A DONA DA ANÁLISE É A IDENTIDADE CERTA ══════════════════════════════════════════
 *
 * Da prévia em diante, toda etapa acontece sobre uma análise específica — ela está na URL. E toda
 * análise tem exatamente uma sessão anônima que a criou: quem respondeu o questionário. Essa
 * sessão não muda quando a pessoa troca de aparelho, não se duplica quando ela compra duas vezes,
 * e não nasce quando um terceiro abre o link.
 *
 * O efeito é que o funil vira o que o nome promete: a jornada de uma análise, do questionário ao
 * relatório, contada uma vez em cada etapa. Nenhuma etapa pode passar da anterior, porque todas
 * contam o mesmo conjunto de donos.
 *
 * ═══ O QUE ISTO DEIXA DE MEDIR, DE PROPÓSITO ═════════════════════════════════════════════════
 *
 * Quantos aparelhos abriram, e quantas visitas cada etapa teve. São perguntas de tráfego, não de
 * conversão — e se um dia virarem pergunta, são outra tabela. A nota no topo de `funnel.ts` já
 * decidiu isso: esta tabela responde "quantos ALCANÇARAM este ponto", e nada além.
 *
 * As etapas do questionário continuam no cookie, e é o único jeito: elas acontecem ANTES de a
 * análise existir. Como quem responde e quem é dono da análise são a mesma sessão, as duas metades
 * do funil se encontram no mesmo hash sem emenda.
 */
export async function markAnalysisFunnel(publicId: string, marker: string): Promise<void> {
  const dono = await analysisOwnerSessionId(publicId);
  if (!dono) return;
  await markFunnelBySessionId(dono, marker);
}
