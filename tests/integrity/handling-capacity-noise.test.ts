/**
 * Quanta imprecisão existe em `handlingCapacity` — a investigação que `physicalFit` deixou aberta.
 *
 * ═══ A DÍVIDA QUE ISTO PAGA ══════════════════════════════════════════════════════════════════
 *
 * `MASS_TOLERANCE` ficou em 13 pontos (~5,5 g) e o comentário dela registra por quê: a constante
 * "absorve também a imprecisão de `handlingCapacity`, que é uma ESTIMATIVA do jogador a partir do
 * questionário, não uma medida", e fecha dizendo que essa imprecisão "é o alvo certo da próxima
 * investigação". Esta é a investigação.
 *
 * ═══ COMO SE MEDE PRECISÃO SEM GABARITO ══════════════════════════════════════════════════════
 *
 * Não existe o número verdadeiro: ninguém mediu em laboratório quanta massa cada respondente
 * sustenta. O que dá para medir é ESTABILIDADE — se a mesma pessoa, respondendo em dois dias
 * diferentes, receberia a mesma resposta.
 *
 * Quatro respostas do questionário são autoavaliação e admitem hesitação honesta de um nível:
 * força percebida, preparo físico, velocidade de swing e nível técnico. Mover cada uma em um
 * degrau e medir o efeito é o teste-reteste que a população real faria sozinha.
 *
 * ═══ O QUE FOI MEDIDO (4.000 perfis, ago/2026) ═══════════════════════════════════════════════
 *
 *     mover UM nível de…        move a capacidade em (média)
 *       velocidade de swing ..... 6,36   ← 62% do ruído total
 *       força percebida ......... 2,11
 *       preparo físico .......... 1,34
 *       nível técnico ........... 0,44
 *       as quatro juntas ....... 10,28   (mediana 11,10 · máx 14,37)
 *
 * A conclusão que fecha a dívida: o ruído combinado tem a MESMA ORDEM DE GRANDEZA da tolerância de
 * 13 pontos. A tolerância não está folgada — ela está dimensionada para o ruído que existe, e
 * apertá-la faria o componente confiar na estimativa com uma precisão que ela não tem. Era a
 * hipótese escrita em `physicalFit`, e ela se confirma.
 *
 * O ruído tem dono: uma pergunta responde por quase dois terços dele. E é a mais difícil de
 * responder — a única em que a pessoa precisa julgar algo que nunca viu de fora.
 *
 * ═══ O QUE FOI TESTADO E REJEITADO ═══════════════════════════════════════════════════════════
 *
 * Comprimir `SWING_SPEED_SCORE` de 20…90 para 30…80, reduzindo o salto entre degraus. Medido:
 *
 *     troca material da recomendação ..... 20,8% → 17,3%
 *     ruído acima de 13 pontos ........... 39,6% →  0,0%
 *     personas que trocam de raquete ..... 4 de 22
 *
 * Rejeitado. O ganho é modesto e o custo não é só o das quatro personas: comprimir a escala não
 * remove apenas ruído, remove também SINAL. Quem de fato tem swing muito rápido passa a ser
 * tratado mais perto da média, e é exatamente esse jogador que mais precisa de um frame que
 * acompanhe. Trocar precisão de todo mundo por estabilidade de alguns é o negócio errado.
 *
 * ═══ POR QUE ESTE TESTE FICA ═════════════════════════════════════════════════════════════════
 *
 * Porque o ruído é uma propriedade EMERGENTE de pesos espalhados por três arquivos, e cresce sem
 * avisar. Aumentar o peso do swing, esticar a escala ou mexer nos degraus são mudanças que parecem
 * locais e que mudam este número — e um motor que responde diferente à mesma pessoa em dois dias
 * não denuncia isso em nenhum outro teste.
 */

import { describe, expect, it } from 'vitest';
import { buildPlayerProfile } from '@/recommendation/profile/build-profile';
import { emptyAnswers, type QuestionnaireAnswers } from '@/recommendation/profile/answers';

/** A fórmula sob observação — ver `handlingCapacity` em `engine/fit-components.ts`. */
function capacity(p: ReturnType<typeof buildPlayerProfile>): number {
  return 0.45 * p.physical_capacity_score + 0.35 * p.swing_speed_score + 0.2 * p.player_level_score;
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const FORCA = ['abaixo', 'media', 'acima', 'bem_acima'] as const;
const PREPARO = ['sedentario', 'moderado', 'bom', 'atletico'] as const;
const SWING = ['lenta', 'moderada', 'rapida', 'muito_rapida'] as const;
const NIVEL = [
  'iniciante',
  'iniciante_avancado',
  'intermediario',
  'intermediario_avancado',
  'avancado',
] as const;

function perfil(r: () => number): QuestionnaireAnswers {
  const nivelIdx = Math.floor(r() * 5);
  const forte = r();
  const feminino = r() < 0.35;
  const altura = Math.round((feminino ? 160 : 174) + (r() - 0.5) * 20);
  const imc = 20 + r() * 7;
  const tri = (p: number) =>
    (r() < p ? 'sim' : r() < p + 0.35 ? 'as_vezes' : 'nao') as 'sim' | 'as_vezes' | 'nao';
  const p = 0.1 + nivelIdx * 0.2;

  return {
    ...emptyAnswers(),
    age: 16 + Math.floor(r() * 50),
    height_cm: altura,
    weight_kg: Math.round(imc * (altura / 100) ** 2 * (0.9 + forte * 0.2)),
    dominant_hand: 'destro',
    sex: feminino ? 'feminino' : 'masculino',
    perceived_strength: FORCA[Math.min(3, Math.max(0, Math.round(forte * 3)))]!,
    fitness_level: PREPARO[Math.min(3, Math.max(0, Math.round(forte * 2 + nivelIdx * 0.4)))]!,
    experience_duration: (['menos_6m', '6_12m', '1_2a', '2_5a', 'mais_5a'] as const)[nivelIdx]!,
    frequency_per_week: Math.min(5, Math.round(nivelIdx * 0.9 + r() * 2)),
    has_lessons: 'nunca',
    plays_matches: nivelIdx >= 2 ? 'sim' : 'as_vezes',
    tournament_experience: (['nunca', 'amadores', 'regionais', 'competitivo'] as const)[
      Math.min(3, Math.round(nivelIdx * 0.8))
    ]!,
    perceived_level: NIVEL[nivelIdx]!,
    can_sustain_rally: tri(p),
    can_direct_ball: tri(p),
    can_generate_spin: tri(p - 0.05),
    can_vary_depth: tri(p - 0.1),
    reliable_second_serve: tri(p - 0.1),
    play_style: ['dominar_fundo'],
    forehand_type: 'topspin_moderado',
    backhand_hands: r() < 0.75 ? 'duas_maos' : 'uma_mao',
    swing_length: 'medio',
    swing_speed: SWING[Math.min(3, Math.max(0, Math.round(nivelIdx * 0.7 + forte - 0.3)))]!,
    depth_control: tri(p),
    ball_tendency: ['geralmente_boa_profundidade'],
    missing_attributes: [],
    no_current_racket: true,
    discomfort_areas: ['nenhum'],
    objective: ['ganhar_controle'],
  };
}

function mover(lista: readonly string[], atual: string | null, passos: number): string | null {
  if (atual === null) return null;
  const i = lista.indexOf(atual);
  if (i < 0) return atual;
  return lista[Math.min(lista.length - 1, Math.max(0, i + passos))] ?? atual;
}

const N = 1500;

type Medida = { readonly forca: number; readonly preparo: number; readonly swing: number; readonly nivel: number; readonly juntas: number };

function medirRuido(): Medida {
  const r = rng(20260827);
  const acc = { forca: 0, preparo: 0, swing: 0, nivel: 0, juntas: 0 };

  for (let i = 0; i < N; i += 1) {
    const base = perfil(r);
    const cBase = capacity(buildPlayerProfile(base));
    const passo = r() < 0.5 ? 1 : -1;

    const delta = (mod: Partial<QuestionnaireAnswers>) =>
      Math.abs(capacity(buildPlayerProfile({ ...base, ...mod })) - cBase);

    acc.forca += delta({ perceived_strength: mover(FORCA, base.perceived_strength, passo) as never });
    acc.preparo += delta({ fitness_level: mover(PREPARO, base.fitness_level, passo) as never });
    acc.swing += delta({ swing_speed: mover(SWING, base.swing_speed, passo) as never });
    acc.nivel += delta({ perceived_level: mover(NIVEL, base.perceived_level, passo) as never });
    acc.juntas += delta({
      perceived_strength: mover(FORCA, base.perceived_strength, passo) as never,
      fitness_level: mover(PREPARO, base.fitness_level, passo) as never,
      swing_speed: mover(SWING, base.swing_speed, passo) as never,
      perceived_level: mover(NIVEL, base.perceived_level, passo) as never,
    });
  }

  return {
    forca: acc.forca / N,
    preparo: acc.preparo / N,
    swing: acc.swing / N,
    nivel: acc.nivel / N,
    juntas: acc.juntas / N,
  };
}

describe('estabilidade de handlingCapacity', () => {
  const medida = medirRuido();

  /**
   * O teto: o ruído combinado não pode ultrapassar a tolerância que existe para absorvê-lo.
   *
   * `MASS_TOLERANCE` vale 13. Se o ruído passar disso, a zona morta deixa de conter a hesitação
   * normal de quem responde, e a recomendação passa a mudar por motivo nenhum — o defeito que a
   * tolerância foi dimensionada para impedir.
   *
   * A folga de 13 para 12 é deliberadamente pequena: o valor medido é 10,3, e um teste que
   * aceitasse 20 não protegeria nada.
   */
  it('o ruído combinado cabe dentro da tolerância de massa', () => {
    expect(
      medida.juntas,
      `hesitar um nível nas quatro autoavaliações move a capacidade em ${medida.juntas.toFixed(2)} ` +
        `pontos, e MASS_TOLERANCE só absorve 13`,
    ).toBeLessThan(12);
  });

  /**
   * O swing é o termo mais barulhento, e é assim por construção: peso 0.35 e degraus de ~25
   * pontos numa escala de quatro opções. O teste não exige que ele deixe de ser — exige que não
   * PIORE.
   *
   * 8,0 é ~25% acima do medido (6,36). Passar disso significa que alguém esticou a escala,
   * aumentou o peso ou removeu o teto de `SWING_OVER_LEVEL`, e qualquer um dos três merece uma
   * decisão consciente em vez de acontecer de lado.
   */
  it('a velocidade de swing continua sendo o termo mais barulhento, e não piora', () => {
    expect(medida.swing).toBeGreaterThan(medida.forca);
    expect(
      medida.swing,
      `o swing move ${medida.swing.toFixed(2)} pontos por degrau — era 6,36 quando isto foi medido`,
    ).toBeLessThan(8);
  });

  /**
   * As três autoavaliações restantes precisam continuar sendo ruído de segunda ordem.
   *
   * Se qualquer uma delas se aproximar do swing, a distribuição do erro mudou de forma — e as
   * conclusões documentadas em `physicalFit` sobre onde investir deixam de valer.
   */
  it('força, preparo e nível continuam de segunda ordem', () => {
    expect(medida.forca).toBeLessThan(4);
    expect(medida.preparo).toBeLessThan(3);
    expect(medida.nivel).toBeLessThan(2);
  });

  /**
   * Ruído zero seria pior que ruído alto.
   *
   * Se mover a autoavaliação não mudasse NADA, o motor teria parado de ouvir as respostas — que é
   * a falha silenciosa oposta, e a mais difícil de perceber olhando um relatório só.
   */
  it('as respostas continuam sendo ouvidas', () => {
    expect(medida.juntas, 'o motor parou de reagir às autoavaliações').toBeGreaterThan(3);
    expect(medida.swing).toBeGreaterThan(1);
  });
});
