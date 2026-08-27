/**
 * Datas e horas em horário do Brasil — sempre.
 *
 * ═══ O DEFEITO QUE ISTO CONSERTA ═════════════════════════════════════════════════════════════
 *
 * `toLocaleString('pt-BR')` não escolhe fuso: ele escolhe IDIOMA, e formata no fuso de quem está
 * executando. Em produção quem executa é um servidor da Vercel, que roda em UTC. O resultado é uma
 * data escrita em português, com aparência de correta, três horas adiantada.
 *
 * "27 de agosto às 19:16" para uma compra feita às 16:16. Nada denuncia: o formato está certo, o
 * idioma está certo, o dia quase sempre está certo. E quando não está — qualquer coisa comprada
 * depois das 21h aparece no dia seguinte — o erro parece um bug do banco, não do formato.
 *
 * Foi encontrado na lista de análises, onde a hora existe justamente para separar duas compras do
 * mesmo dia. Uma hora errada ali não é cosmética: é a informação que faz o item ser identificável.
 *
 * ═══ POR QUE FUSO FIXO, E NÃO O DO VISITANTE ═════════════════════════════════════════════════
 *
 * O fuso do visitante só existe no navegador, e estas telas são renderizadas no servidor. Buscá-lo
 * no cliente significaria renderizar a hora errada primeiro e corrigir depois — a data pulando na
 * frente da pessoa — ou um erro de hidratação a cada carga.
 *
 * O produto vende no Brasil, em português, com preço em real. Um cliente viajando vê o horário de
 * Brasília, que é o mesmo do comprovante do Mercado Pago e o mesmo do e-mail que ele recebeu. Isso
 * é melhor que a hora local dele divergindo de todos os outros registros da compra.
 */

const FUSO = 'America/Sao_Paulo';

/** "27 de agosto de 2026" */
export function dataLonga(quando: Date): string {
  return quando.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: FUSO,
  });
}

/** "16:16" */
export function hora(quando: Date): string {
  return quando.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: FUSO,
  });
}

/** "27/08/2026 16:16" — para tabelas, onde a linha precisa caber. */
export function dataCurta(quando: Date | string): string {
  const d = typeof quando === 'string' ? new Date(quando) : quando;
  return d.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: FUSO,
  });
}
