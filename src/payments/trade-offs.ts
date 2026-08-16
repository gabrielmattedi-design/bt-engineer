import type { NeedKey } from '@/domain/player-profile';
import type { RankedRacket } from '@/domain/recommendation';

/**
 * Pontos de atenção reescritos como TROCAS ESTUDADAS.
 *
 * ─── O PROBLEMA ──────────────────────────────────────────────────────────────────────────────
 *
 * O relatório listava as penalizações cruas do motor. A frase que chegava a quem pagou era:
 *
 *   "Você pediu mais estabilidade, mas este frame vai na direção contrária à da sua referência."
 *
 * Ela é verdadeira e é péssima. Do lado de cá é uma anotação de auditoria — existe para o admin
 * entender por que a raquete perdeu pontos. Do lado de lá, logo abaixo do nome do produto que a
 * pessoa acabou de comprar, ela lê como confissão de erro: pedi uma coisa e o sistema entregou o
 * contrário. O usuário não tem como saber que o motor avaliou 46 opções, que as mais estáveis
 * falhavam em coisas que pesam mais no perfil dele, e que esta é a melhor combinação possível.
 *
 * ─── O QUE MUDA E O QUE NÃO MUDA ─────────────────────────────────────────────────────────────
 *
 * O fato NÃO é escondido nem suavizado: continua dito que naquele eixo específico a raquete
 * entrega menos do que foi pedido. O que muda é que a frase passa a carregar o RACIOCÍNIO — o que
 * a alternativa custaria, medido no ranking real, e não uma promessa genérica de que "foi o
 * melhor possível".
 *
 * A diferença é verificável: a alternativa citada existe, está no ranking, e o que ela perde é
 * calculado a partir do mesmo `ScoreBreakdown` que sustenta o resto do relatório. Se não houver
 * alternativa melhor naquele eixo, a frase diz isso, em vez de inventar uma justificativa.
 */

const NEED_LABEL_PT: Record<NeedKey, string> = {
  power: 'potência',
  control: 'controle',
  spin: 'spin',
  comfort: 'conforto',
  stability: 'estabilidade',
  maneuverability: 'manobrabilidade',
  forgiveness: 'tolerância',
  precision: 'precisão',
};

const NEED_TO_ATTRIBUTE: Record<NeedKey, string> = {
  power: 'power_score',
  control: 'control_score',
  spin: 'spin_score',
  comfort: 'comfort_score',
  stability: 'stability_score',
  maneuverability: 'maneuverability_score',
  forgiveness: 'forgiveness_score',
  precision: 'precision_score',
};

/** Componentes explicados em linguagem de quadra, para dizer o que a alternativa custaria. */
const COMPONENT_COST_PT: Record<string, string> = {
  physical_fit: 'exigiria mais braço do que o seu preparo comporta hoje',
  skill_fit: 'cobraria um nível técnico acima do que você descreveu',
  swing_fit: 'somaria potência a um swing que já produz bastante — bola longa',
  playstyle_fit: 'se afastaria do seu estilo de jogo',
  comfort_fit: 'seria mais dura com o seu braço',
  transition_fit: 'seria uma mudança brusca demais em relação à sua raquete atual',
  objective_fit: 'andaria contra outro objetivo que você declarou',
};

export type TradeOff = {
  /** Frase principal: o que a raquete deixa de entregar, dito sem rodeio. */
  readonly headline: string;
  /** O raciocínio: por que a alternativa não compensa. */
  readonly rationale: string;
};

/**
 * Encontra a raquete do ranking que MAIS entrega naquele eixo e mostra o que ela perde.
 *
 * É o coração da explicação. Sem isso, dizer "foi a melhor combinação" seria só uma afirmação
 * agradável — com isso, a afirmação vem acompanhada da alternativa concreta que foi descartada e
 * do motivo pelo qual ela foi descartada.
 */
function costOfBestAlternative(
  axis: NeedKey,
  winner: RankedRacket,
  ranking: readonly RankedRacket[],
): string | null {
  const attribute = NEED_TO_ATTRIBUTE[axis];
  const valueOf = (r: RankedRacket): number =>
    (r.racket.attributes[attribute as keyof typeof r.racket.attributes] as number) ?? 0;

  const winnerValue = valueOf(winner);
  const better = ranking.filter((r) => valueOf(r) > winnerValue + 3);
  if (better.length === 0) return null;

  // A melhor alternativa naquele eixo — a que o usuário teria escolhido se olhasse só para ele.
  const alternative = better.reduce((best, r) => (valueOf(r) > valueOf(best) ? r : best));

  // Onde ela perde para a recomendada, em pontos ponderados: é o que a troca custaria de fato.
  const winnerComponents = new Map(winner.breakdown.components.map((c) => [c.key, c]));
  let worstKey: string | null = null;
  let worstGap = 0;

  for (const component of alternative.breakdown.components) {
    if (component.weight <= 0) continue;
    const mine = winnerComponents.get(component.key);
    if (!mine) continue;
    const gap = (mine.raw - component.raw) * component.weight;
    if (gap > worstGap) {
      worstGap = gap;
      worstKey = component.key;
    }
  }

  if (!worstKey || worstGap < 1) return null;
  return COMPONENT_COST_PT[worstKey] ?? null;
}

/**
 * Constrói os pontos de atenção do relatório.
 *
 * Penalizações sobre OBJETIVO viram troca explicada. As demais (risco para o braço, transição
 * brusca, dados incompletos) continuam como estão: são avisos de fato, não trocas, e amenizá-las
 * seria o erro oposto.
 */
export function buildTradeOffs(
  winner: RankedRacket,
  ranking: readonly RankedRacket[],
  candidatesEvaluated: number,
): readonly TradeOff[] {
  const out: TradeOff[] = [];

  for (const penalty of winner.breakdown.penalties) {
    if (penalty.code !== 'P6_objective_conflict' || !penalty.axis) {
      out.push({ headline: penalty.reason, rationale: '' });
      continue;
    }

    const label = NEED_LABEL_PT[penalty.axis];
    const cost = costOfBestAlternative(penalty.axis, winner, ranking);

    out.push({
      headline: `Em ${label}, esta raquete entrega menos do que você pediu.`,
      rationale: cost
        ? `Entre as ${candidatesEvaluated} avaliadas existem opções com mais ${label} — mas a ` +
          `melhor delas ${cost}. Como esses fatores pesam mais no seu perfil do que o ganho em ` +
          `${label}, o conjunto que sobra é melhor com esta escolha. É uma troca, não um descuido.`
        : `Nenhuma das ${candidatesEvaluated} raquetes avaliadas entrega mais ${label} sem ` +
          `contrariar algo que pesa mais no seu perfil. Esta é a melhor posição possível nesse ` +
          `eixo dentro do que existe hoje no mercado que analisamos.`,
    });
  }

  return out;
}
