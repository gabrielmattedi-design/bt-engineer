import { loadRacketCatalog } from '@/data/load';
import { QuizClient } from './quiz-client';

/**
 * O catálogo é lido no SERVIDOR e passado como lista enxuta para a busca da raquete atual.
 *
 * São 46 variantes com id, marca, modelo e peso — poucos KB. Enviar isso de uma vez evita uma rota
 * de busca e faz a lista responder instantaneamente enquanto a pessoa digita, sem ida ao servidor
 * a cada tecla. Nenhuma especificação além do peso vai junto: o cliente só precisa saber o que
 * existe para poder escolher.
 *
 * ─── POR QUE A GERAÇÃO NÃO É ENVIADA ─────────────────────────────────────────────────────────
 *
 * O rótulo mostrado é `Pure Drive · 300 g`, não `Pure Drive Gen 11 (2025)`. A diferença muda quem
 * consegue responder a pergunta.
 *
 * Quase ninguém sabe de que geração é a própria raquete. Quem comprou uma Pure Drive em 2019 tem
 * uma Gen 9, mas o que ela sabe é que tem "uma Pure Drive de 300 g" — e diante de uma lista que
 * exibe "Gen 11 (2025)" ela conclui, corretamente, que aquela não é a dela. O resultado era o
 * pior possível: cair no texto livre e perder a comparação inteira, tendo a informação necessária
 * o tempo todo.
 *
 * E a informação É suficiente. O motor compara peso, cabeça, balanço e inércia — e essas quatro
 * grandezas quase não se movem entre gerações do mesmo modelo e peso: o que cada geração troca é
 * layup, material e pintura. Uma Pure Drive 300 g de 2019 e uma de 2025 têm o mesmo tamanho de
 * cabeça, o mesmo peso e balanço praticamente igual. Exigir a geração seria cobrar precisão que
 * não altera o cálculo, em troca de perder o dado.
 *
 * O peso entra no rótulo porque ele é o que a pessoa PODE distinguir — está impresso no cabo — e
 * é justamente onde as variantes de um mesmo modelo divergem de verdade (Team 285 g contra
 * Tour 305 g muda a recomendação).
 */
export default function QuestionarioPage() {
  const rackets = loadRacketCatalog().map((r) => ({
    id: r.id,
    brand: r.brand,
    model: r.model,
    weightG: r.specs.unstrung_weight_g,
  }));

  return <QuizClient rackets={rackets} />;
}
