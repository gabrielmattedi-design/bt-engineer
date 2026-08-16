/**
 * O vetor de necessidades precisa DISCRIMINAR.
 *
 * ─── O DEFEITO ───────────────────────────────────────────────────────────────────────────────
 *
 * A versão anterior somava bônus a partir de 50 e quase nunca subtraía. Todo sinal empurrava algum
 * eixo para cima, e o radar mostrava um hexágono quase perfeito: o perfil pedia tudo.
 *
 * Um perfil que pede tudo não pede nada. Se todo usuário precisa de mais potência E mais controle
 * E mais spin, o vetor deixa de separar ninguém e a recomendação passa a ser decidida só por nível
 * e físico — duas pessoas com jogos opostos recebendo a mesma raquete.
 *
 * Os testes abaixo fixam as três propriedades que impedem isso de voltar.
 */

import { describe, expect, it } from 'vitest';
import { NEED_KEYS } from '@/domain/player-profile';
import { emptyAnswers, type QuestionnaireAnswers } from '@/recommendation/profile/answers';
import { computeNeeds, preservedNeeds } from '@/recommendation/profile/needs';
import { buildPlayerProfile } from '@/recommendation/profile/build-profile';
import { PERSONAS } from '@/data/personas';

const base = (over: Partial<QuestionnaireAnswers> = {}): QuestionnaireAnswers => ({
  ...emptyAnswers(),
  ...over,
});

const spreadOf = (needs: Record<string, number>): number =>
  Math.max(...NEED_KEYS.map((k) => Math.abs((needs[k] ?? 50) - 50)));

describe('contraste do vetor de necessidades', () => {
  it('quem não deu sinal nenhum fica neutro — e isso não é o mesmo que precisar de tudo', () => {
    const { needs, definition } = computeNeeds(base(), 0);
    for (const k of NEED_KEYS) expect(needs[k], k).toBe(50);
    expect(definition).toBe(0);
  });

  /**
   * O caso que produzia o hexágono cheio: alguém que reclama de tudo.
   *
   * O resultado correto NÃO é "precisa de tudo no máximo" — é "não há prioridade clara entre os
   * eixos", porque melhorar todos ao mesmo tempo é fisicamente impossível numa raquete.
   */
  it('quem pede tudo volta para perto do neutro, não para o máximo em tudo', () => {
    const tudo = base({
      current_racket_dislikes: [
        'falta_estabilidade',
        'acho_pesada',
        'falta_potencia',
        'falta_controle',
      ],
      missing_attributes: ['power', 'control', 'spin'],
      objective: ['mais_potencia', 'mais_controle', 'mais_spin', 'mais_conforto'],
    });

    const { needs } = computeNeeds(tudo, 0);
    const acima70 = NEED_KEYS.filter((k) => needs[k] >= 70);
    expect(acima70.length, `eixos acima de 70: ${acima70.join(', ')}`).toBeLessThanOrEqual(2);
  });

  it('quem pede uma coisa específica recebe um vetor afiado nela', () => {
    const { needs, definition } = computeNeeds(
      base({ current_racket_dislikes: ['falta_estabilidade'] }),
      0,
    );

    const maior = NEED_KEYS.reduce((a, b) => (needs[a] > needs[b] ? a : b));
    expect(maior).toBe('stability');
    expect(spreadOf(needs)).toBeGreaterThan(20);
    expect(definition).toBeGreaterThan(0.3);
  });

  /**
   * O mesmo sintoma com receitas opostas — a razão de existirem cruzamentos.
   *
   * Dar potência a quem tem swing rápido e bate curto aumenta o erro para fora: o problema dele é
   * ângulo de saída, não velocidade. A versão anterior tratava os dois casos igual.
   */
  it('bola curta pede POTÊNCIA no swing lento e SPIN no swing rápido', () => {
    const lento = computeNeeds(
      base({ ball_tendency: ['caem_curtas'], swing_speed: 'lenta' }),
      0,
    ).needs;
    const rapido = computeNeeds(
      base({ ball_tendency: ['caem_curtas'], swing_speed: 'muito_rapida' }),
      0,
    ).needs;

    expect(lento.power).toBeGreaterThan(lento.spin);
    expect(rapido.spin).toBeGreaterThan(rapido.power);
  });

  it('inconstância pede tolerância no iniciante e precisão no avançado', () => {
    const iniciante = computeNeeds(
      base({ ball_tendency: ['variam_demais'], perceived_level: 'iniciante' }),
      0,
    ).needs;
    const avancado = computeNeeds(
      base({ ball_tendency: ['variam_demais'], perceived_level: 'avancado' }),
      0,
    ).needs;

    expect(iniciante.forgiveness).toBeGreaterThan(iniciante.precision);
    expect(avancado.precision).toBeGreaterThan(avancado.forgiveness);
  });

  /**
   * O piso de conforto não é preferência, é limite físico — precisa sobreviver ao contraste, que
   * de outra forma o empurraria para baixo quando houvesse outro pedido forte.
   */
  it('dor no braço mantém conforto alto mesmo com outro pedido forte', () => {
    const { needs } = computeNeeds(
      base({ current_racket_dislikes: ['falta_potencia'], missing_attributes: ['power'] }),
      85,
    );
    expect(needs.comfort).toBeGreaterThanOrEqual(80);
  });
});

describe('o que o jogador gosta é preservado, não pedido', () => {
  it('gostar da potência marca o eixo como preservado', () => {
    expect(preservedNeeds(base({ current_racket_likes: ['gosto_da_potencia'] }))).toEqual(['power']);
  });

  it('"gosto de tudo nela" preserva todos os eixos', () => {
    const preserved = preservedNeeds(base({ current_racket_dislikes: ['gosto_de_tudo'] }));
    expect([...preserved].sort()).toEqual([...NEED_KEYS].sort());
  });

  it('não marcar nada não preserva nada', () => {
    expect(preservedNeeds(base())).toEqual([]);
  });
});

describe('as personas produzem perfis distintos entre si', () => {
  /**
   * A prova de que o contraste funciona no conjunto, e não só em casos construídos: se muitas
   * personas compartilhassem o mesmo eixo dominante, o vetor teria voltado a não discriminar.
   */
  it('o eixo dominante varia entre as personas', () => {
    const dominantes = new Set(
      PERSONAS.map((p) => {
        const { needs } = buildPlayerProfile(p.answers);
        return NEED_KEYS.reduce((a, b) => (needs[a] > needs[b] ? a : b));
      }),
    );
    expect(dominantes.size, `eixos dominantes distintos: ${[...dominantes].join(', ')}`)
      .toBeGreaterThanOrEqual(4);
  });

  it('as personas com sinal têm perfil com amplitude real', () => {
    const comSinal = PERSONAS.map((p) => buildPlayerProfile(p.answers)).filter(
      (prof) => prof.needs_definition > 0.3,
    );
    expect(comSinal.length, 'poucas personas com perfil definido').toBeGreaterThan(10);
    for (const prof of comSinal) expect(spreadOf(prof.needs)).toBeGreaterThan(15);
  });
});
