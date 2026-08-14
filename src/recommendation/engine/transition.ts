/**
 * Análise de transição — §22.
 *
 * "O que você provavelmente perceberá em quadra?" — e, com o mesmo destaque, o que vai piorar.
 * Exibir trade-off é credibilidade (§62); esconder é o que transforma análise em propaganda.
 */

import { round } from '@/domain/scores';
import type { ScoredRacket } from '@/domain/racket';
import type { PlayerProfile } from '@/domain/player-profile';
import type { SpecComparison, TransitionAnalysis } from '@/domain/recommendation';
import { resolveStrungWeight } from '@/recommendation/normalize/racket-attributes';

function compare(
  label: string,
  current: number | null,
  recommended: number | null,
  unit: string,
  interpret: (delta: number) => string,
): SpecComparison {
  if (current === null || recommended === null) {
    return {
      label,
      current,
      recommended,
      unit,
      delta: null,
      direction: 'unknown',
      interpretation: 'Sem dado verificado para comparar.',
    };
  }
  const delta = round(recommended - current, 1);
  const direction = Math.abs(delta) < 0.5 ? 'same' : delta > 0 ? 'up' : 'down';
  return {
    label,
    current: round(current, 1),
    recommended: round(recommended, 1),
    unit,
    delta,
    direction,
    interpretation: direction === 'same' ? 'Praticamente igual.' : interpret(delta),
  };
}

export function analyzeTransition(
  profile: PlayerProfile,
  recommended: ScoredRacket,
  current: ScoredRacket | null,
): TransitionAnalysis {
  if (!current) {
    return {
      available: false,
      comparisons: [],
      expectations: [],
      attention_points: profile.current_racket?.unrecognized
        ? [
            'Não reconhecemos sua raquete atual no catálogo, então não foi possível comparar ' +
              'especificações. A recomendação foi feita a partir do seu perfil.',
          ]
        : [],
    };
  }

  const cs = current.variant.specs;
  const rs = recommended.variant.specs;
  const ca = current.attributes;
  const ra = recommended.attributes;

  const comparisons: SpecComparison[] = [
    compare(
      'Peso (encordoada)',
      resolveStrungWeight(cs).value,
      resolveStrungWeight(rs).value,
      'g',
      (d) =>
        d > 0
          ? 'Mais massa: ganho de estabilidade e penetração, com maior custo físico ao longo da partida.'
          : 'Menos massa: mais fácil de acelerar, com alguma perda de estabilidade contra bolas pesadas.',
    ),
    compare('Cabeça', cs.head_size_sq_in, rs.head_size_sq_in, 'sq in', (d) =>
      d > 0
        ? 'Área útil maior: mais tolerância em bolas descentralizadas.'
        : 'Área útil menor: mais precisão, exigindo contato mais consistente.',
    ),
    compare('Swingweight', cs.swingweight, rs.swingweight, '', (d) =>
      d > 0
        ? 'Mais inércia: bola mais pesada, exigindo preparação mais cedo.'
        : 'Menos inércia: mais rápido em defesa e na rede.',
    ),
    compare('Balanço', cs.balance_mm, rs.balance_mm, 'mm', (d) =>
      d > 0
        ? 'Mais peso na cabeça: mais potência natural, menos manobrabilidade.'
        : 'Mais peso no cabo: mais manobrabilidade, menos plow-through.',
    ),
    compare('Rigidez (RA)', cs.stiffness_ra, rs.stiffness_ra, '', (d) =>
      d > 0
        ? 'Frame mais rígido: resposta mais direta, mais vibração transmitida.'
        : 'Frame mais flexível: mais conforto e sensação de bola, resposta menos imediata.',
    ),
    compare(
      'Padrão de cordas',
      cs.string_pattern_mains,
      rs.string_pattern_mains,
      'mains',
      (d) =>
        d > 0
          ? 'Padrão mais denso: mais controle e durabilidade, menos spin e potência.'
          : 'Padrão mais aberto: mais spin e altura de bola, menos durabilidade da corda.',
    ),
    compare('Potência (índice)', ca.power_score, ra.power_score, '', (d) =>
      d > 0 ? 'Mais potência gratuita do frame.' : 'Frame mais contido; a potência virá mais de você.',
    ),
    compare('Controle (índice)', ca.control_score, ra.control_score, '', (d) =>
      d > 0 ? 'Mais controle direcional.' : 'Menos controle, mais tolerância.',
    ),
    compare('Spin (índice)', ca.spin_score, ra.spin_score, '', (d) =>
      d > 0 ? 'Maior potencial de rotação.' : 'Menor potencial de rotação, trajetória mais plana.',
    ),
    compare('Estabilidade (índice)', ca.stability_score, ra.stability_score, '', (d) =>
      d > 0 ? 'Mais firme contra bolas pesadas.' : 'Menos firme contra bolas pesadas.',
    ),
    compare('Manobrabilidade (índice)', ca.maneuverability_score, ra.maneuverability_score, '', (d) =>
      d > 0 ? 'Mais fácil de acelerar e reposicionar.' : 'Exige mais preparação e força.',
    ),
  ];

  const expectations: string[] = [];
  const attention: string[] = [];

  const gain = (label: string, delta: number, threshold: number): boolean => {
    const c = comparisons.find((x) => x.label === label);
    return c?.delta != null && c.delta * Math.sign(delta) > threshold;
  };

  if (gain('Estabilidade (índice)', 1, 6)) {
    expectations.push('Você deve sentir a raquete mais firme no impacto contra bolas pesadas.');
  }
  if (gain('Controle (índice)', 1, 6)) {
    expectations.push('A bola deve ficar mais previsível quando você acelera o swing.');
  }
  if (gain('Spin (índice)', 1, 6)) {
    expectations.push('Deve ser mais fácil elevar a bola e produzir rotação com o mesmo gesto.');
  }
  if (gain('Potência (índice)', 1, 6)) {
    expectations.push('Menos esforço para chegar ao fundo da quadra.');
  }
  if (gain('Manobrabilidade (índice)', 1, 6)) {
    expectations.push('Reação mais rápida em defesa, no bloqueio e na rede.');
  }

  // Pontos de atenção têm o MESMO destaque dos ganhos. Isto é deliberado.
  if (gain('Manobrabilidade (índice)', -1, 6)) {
    attention.push(
      'Esta raquete é mais exigente em swings atrasados: você precisará preparar o golpe mais cedo.',
    );
  }
  if (gain('Potência (índice)', -1, 6)) {
    attention.push(
      'O frame entrega menos potência gratuita — nas primeiras semanas a bola pode cair mais curta ' +
        'até o ajuste do swing.',
    );
  }
  if (gain('Rigidez (RA)', 1, 3)) {
    attention.push('Frame mais rígido que o atual: acompanhe o conforto nas primeiras semanas.');
  }
  if (gain('Peso (encordoada)', 1, 15)) {
    attention.push(
      'Aumento relevante de peso: espere adaptação de 2 a 3 semanas, especialmente no fim das partidas.',
    );
  }
  if (gain('Cabeça', -1, 4)) {
    attention.push('Cabeça menor reduz a margem de erro em bolas descentralizadas.');
  }

  if (expectations.length === 0) {
    expectations.push(
      'As diferenças são pequenas: a proposta aqui é refinar o que já funciona, não mudar seu jogo.',
    );
  }

  return { available: true, comparisons, expectations, attention_points: attention };
}
