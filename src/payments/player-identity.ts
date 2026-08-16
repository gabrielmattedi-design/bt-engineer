import { NEED_KEYS, type NeedKey, type PlayerProfile } from '@/domain/player-profile';
import type { PlayStyle } from '@/domain/racket';

/**
 * A frase que descreve o jogador tenisticamente — o que dá cara de "colecionável" ao card.
 *
 * ─── POR QUE ELA É DERIVADA, E NÃO SORTEADA ──────────────────────────────────────────────────
 *
 * Um gerador de frases bonitas produziria algo compartilhável e vazio: duas pessoas com jogos
 * opostos receberiam elogios intercambiáveis, e a primeira vez que dois amigos comparassem os
 * cards ficaria claro que o texto não diz nada. O card é peça de divulgação — ele só divulga se
 * quem recebe reconhecer a pessoa na descrição.
 *
 * Por isso a frase sai dos MESMOS números que sustentam a recomendação: o estilo dominante, o eixo
 * que o perfil mais pede e o nível calibrado. Se o motor mudar de opinião sobre o jogador, a frase
 * muda junto — ela não é enfeite, é a mesma leitura em outra linguagem.
 *
 * ─── E POR QUE ELA É CURTA ───────────────────────────────────────────────────────────────────
 *
 * Cabe numa linha do card e é lida em dois segundos, que é o tempo que alguém dá a uma imagem no
 * celular de outra pessoa.
 */

/** Substantivo do arquétipo, a partir do estilo dominante e do nível. */
const ARCHETYPE: Record<PlayStyle, readonly [iniciante: string, avancado: string]> = {
  baseline: ['Jogador de fundo', 'Construtor de ponto'],
  aggressive_baseliner: ['Atacante de fundo', 'Agressor de linha de base'],
  counterpuncher: ['Devolvedor paciente', 'Contra-atacante'],
  heavy_spin: ['Jogador de topspin', 'Especialista em giro pesado'],
  flat_hitter: ['Batedor direto', 'Batedor chapado'],
  all_court: ['Jogador versátil', 'Jogador de quadra toda'],
  serve_and_volley: ['Jogador ofensivo', 'Saque e voleio'],
  net_player: ['Jogador de rede', 'Voleador'],
};

/** Complemento a partir do eixo que o perfil mais pede. */
const PURSUIT: Record<NeedKey, string> = {
  power: 'em busca de peso na bola',
  control: 'em busca de precisão',
  spin: 'em busca de giro',
  comfort: 'que joga sem castigar o braço',
  stability: 'que quer firmeza no impacto',
  maneuverability: 'que precisa de velocidade de braço',
  forgiveness: 'em busca de constância',
  precision: 'atrás do alvo pequeno',
};

/** Complemento alternativo quando o perfil não tem eixo dominante. */
const BALANCED = 'de jogo equilibrado';

/**
 * Eixo que cada arquétipo JÁ carrega no nome.
 *
 * Sem isto a frase se mordia: "Especialista em giro pesado em busca de giro". A repetição não é só
 * feia — ela desperdiça a metade da frase que deveria acrescentar informação, e num texto de uma
 * linha essa metade é tudo o que existe.
 */
const STYLE_IMPLIES: Partial<Record<PlayStyle, NeedKey>> = {
  heavy_spin: 'spin',
  flat_hitter: 'precision',
  aggressive_baseliner: 'power',
  counterpuncher: 'forgiveness',
  net_player: 'maneuverability',
  serve_and_volley: 'maneuverability',
};

export type PlayerIdentity = {
  /** "Contra-atacante em busca de giro" */
  readonly phrase: string;
  /** Nível por extenso, para a linha secundária do card. */
  readonly level: string;
};

function levelLabel(score: number): string {
  if (score < 30) return 'Iniciante';
  if (score < 50) return 'Iniciante avançado';
  if (score < 70) return 'Intermediário';
  if (score < 85) return 'Intermediário avançado';
  return 'Avançado';
}

export function buildPlayerIdentity(profile: PlayerProfile): PlayerIdentity {
  const styles = Object.entries(profile.style_weights) as Array<[PlayStyle, number]>;
  const dominantStyle = styles.reduce((best, cur) => (cur[1] > best[1] ? cur : best), [
    'all_court' as PlayStyle,
    0,
  ]);

  const advanced = profile.player_level_score >= 60;
  const archetype = profile.style_declared
    ? (ARCHETYPE[dominantStyle[0]]?.[advanced ? 1 : 0] ?? 'Jogador versátil')
    : 'Jogador versátil';

  /**
   * O complemento só entra quando o perfil REALMENTE tem um eixo dominante.
   *
   * `needs_definition` mede a nitidez do vetor de necessidades. Perto de zero significa que a
   * pessoa não marcou preferência forte — e inventar uma perseguição ali seria descrevê-la por
   * algo que ela não disse, exatamente o que a frase precisa evitar para valer alguma coisa.
   */
  const ranked = [...NEED_KEYS].sort((a, b) => profile.needs[b] - profile.needs[a]);
  const implied = STYLE_IMPLIES[dominantStyle[0]];

  // Se o eixo mais forte é o que o arquétipo já nomeia, o complemento vai para o segundo.
  const dominantNeed =
    ranked[0] === implied ? (ranked[1] ?? ranked[0]!) : ranked[0]!;

  const pursuit =
    profile.needs_definition >= 0.35 && profile.needs[dominantNeed] >= 58
      ? PURSUIT[dominantNeed]
      : BALANCED;

  return {
    phrase: `${archetype} ${pursuit}`,
    level: levelLabel(profile.player_level_score),
  };
}
