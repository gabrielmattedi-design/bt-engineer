import { loadRacketCatalog } from '@/data/load';
import { QuizClient } from './quiz-client';

/**
 * O catálogo é lido no SERVIDOR e passado como lista enxuta para a busca da raquete atual.
 *
 * São 46 variantes com id, marca e nome — poucos KB. Enviar isso de uma vez evita uma rota de
 * busca e faz a lista responder instantaneamente enquanto a pessoa digita, sem ida ao servidor a
 * cada tecla. Nenhuma especificação técnica vai junto: o cliente só precisa saber o que existe
 * para poder escolher.
 */
export default function QuestionarioPage() {
  const rackets = loadRacketCatalog().map((r) => ({
    id: r.id,
    brand: r.brand,
    name: r.product_name,
  }));

  return <QuizClient rackets={rackets} />;
}
