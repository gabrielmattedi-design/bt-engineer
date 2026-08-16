import { clamp01 } from '@/domain/scores';
import { NEED_KEYS, NEED_TO_RACKET_ATTRIBUTE, type NeedKey, type PlayerProfile } from '@/domain/player-profile';
import type { RankedRacket, RecommendationResult } from '@/domain/recommendation';

/**
 * Dados do radar — quatro leituras sobre os mesmos seis eixos.
 *
 * ─── POR QUE NÃO EXISTE "MÉDIA DE JOGADORES DO SEU NÍVEL" ────────────────────────────────────
 *
 * A ideia original era comparar o jogador com a média de quem tem o mesmo nível. Seria o gráfico
 * mais interessante dos quatro, e não dá para fazê-lo hoje: não existe base de usuários. Publicar
 * uma curva chamada "média do seu nível" apoiada em nada seria inventar uma população — a mesma
 * coisa que o sistema de proveniência do catálogo existe para impedir, só que na camada de cima.
 *
 * Quando houver volume de questionários respondidos, essa série passa a ser calculável de verdade,
 * e entra sem mudar mais nada aqui: os eixos e a escala já são estes.
 *
 * ─── AS QUATRO SÉRIES, E O QUE CADA UMA É ────────────────────────────────────────────────────
 *
 *   perfil     — o que o SEU JOGO pede. Sai do questionário, não de raquete nenhuma.
 *   recomendada — o que a raquete escolhida entrega.
 *   atual      — o que a sua raquete de hoje entrega. Ausente quando não informada.
 *   catálogo   — a média das 46 avaliadas, que é a régua de "normal".
 *
 * A leitura que o gráfico permite é a que o relatório inteiro tenta sustentar: onde a recomendada
 * encosta no perfil, ela está resolvendo; onde ela se afasta, existe uma troca — e a série do
 * catálogo mostra se aquele afastamento é uma limitação do mercado ou uma escolha do motor.
 *
 * ─── A ESCALA É A MESMA DOS ÍNDICES ──────────────────────────────────────────────────────────
 *
 * Todos os valores passam pelas faixas do catálogo (`attribute_bands`), pelo mesmo motivo de
 * sempre: os atributos crus se aglomeram entre 40 e 55, e quatro polígonos quase sobrepostos não
 * mostram nada. Aqui a distorção seria pior que nos índices, porque a forma do polígono É a
 * informação.
 *
 * O perfil já nasce em 0–100 e não passa por faixa nenhuma — ele não é uma raquete, é uma
 * exigência. Colocá-lo na mesma escala visual é o que torna a comparação legível.
 */

export type RadarAxis = {
  readonly key: NeedKey;
  readonly label: string;
  /** O que o jogo do usuário pede neste eixo, 0–100. */
  readonly profile: number;
  readonly recommended: number;
  readonly current: number | null;
  readonly catalog: number;
};

const AXIS_LABEL_PT: Record<NeedKey, string> = {
  power: 'Potência',
  control: 'Controle',
  spin: 'Spin',
  comfort: 'Conforto',
  stability: 'Estabilidade',
  maneuverability: 'Manobrabilidade',
  forgiveness: 'Tolerância',
  precision: 'Precisão',
};

/**
 * Seis eixos, não oito.
 *
 * Um radar de oito pontas em tela de celular gasta metade da largura com rótulos e vira uma
 * mandala. `forgiveness` e `precision` ficam de fora porque são os mais correlacionados com
 * `control` e `power` — eles repetiriam a forma sem acrescentar leitura.
 */
const RADAR_AXES: readonly NeedKey[] = [
  'power',
  'control',
  'spin',
  'stability',
  'maneuverability',
  'comfort',
];

/** Mesma reposição usada pelos índices: a faixa real do catálogo vira 0–100. */
function position(
  bands: RecommendationResult['attribute_bands'],
  attribute: string,
  raw: number,
): number {
  const band = bands[attribute];
  if (!band || band[1] <= band[0]) return Math.round(raw);
  return Math.round(clamp01((raw - band[0]) / (band[1] - band[0])) * 100);
}

export function buildRadar(
  profile: PlayerProfile,
  winner: RankedRacket,
  ranking: readonly RankedRacket[],
  bands: RecommendationResult['attribute_bands'],
  currentRacket: RankedRacket | null,
): readonly RadarAxis[] {
  return RADAR_AXES.filter((need) => NEED_KEYS.includes(need)).map((need) => {
    const attribute = NEED_TO_RACKET_ATTRIBUTE[need];
    const valueOf = (r: RankedRacket): number =>
      (r.racket.attributes[attribute as keyof typeof r.racket.attributes] as number) ?? 0;

    const catalogMean =
      ranking.length === 0
        ? 50
        : ranking.reduce((sum, r) => sum + valueOf(r), 0) / ranking.length;

    return {
      key: need,
      label: AXIS_LABEL_PT[need],
      profile: Math.round(profile.needs[need]),
      recommended: position(bands, attribute, valueOf(winner)),
      current: currentRacket ? position(bands, attribute, valueOf(currentRacket)) : null,
      catalog: position(bands, attribute, catalogMean),
    };
  });
}
