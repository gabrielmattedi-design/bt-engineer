/**
 * Os jogadores da proposta (docs/PROPOSTA_MOTOR_BT.md §4.6), agora contra o motor de verdade.
 *
 * Cada caso tranca o COMPORTAMENTO que motivou uma regra, e não a lista exata de raquetes: um
 * catálogo que muda de preço muda o pódio, e um teste que falhasse a cada cotação seria desligado.
 * Onde a raquete exata importa — porque ela é a prova do defeito corrigido —, ela é citada.
 */

import { describe, expect, it } from 'vitest';
import { carregarCatalogo, recomendar } from '@/motor';
import { respostas } from './base';

const catalogo = carregarCatalogo();
const porId = new Map(catalogo.map((r) => [r.id, r]));

const INICIANTE = {
  tempo_bt: 'menos_6m',
  vezes_semana: 1,
  autoavaliacao: 'iniciante',
  troca_10_bolas: 'nao',
  smash_com_direcao: 'nao',
  lob_ate_o_fundo: 'nao',
  voleio_sob_pressao: 'nao',
  saque_com_intencao: 'nao',
} as const;

const AVANCADO = {
  tempo_bt: '2_5a',
  vezes_semana: 4,
  torneio: 'B',
  autoavaliacao: 'avancado',
  troca_10_bolas: 'sim',
  smash_com_direcao: 'sim',
  lob_ate_o_fundo: 'sim',
  voleio_sob_pressao: 'sim',
  saque_com_intencao: 'sim',
} as const;

describe('iniciante pequena, com dor no cotovelo, na faixa 1', () => {
  const r = recomendar(
    respostas({
      ...INICIANTE,
      idade: 30,
      altura_cm: 160,
      peso_kg: 55,
      sexo: 'feminino',
      forca: 'abaixo',
      dor_areas: ['cotovelo'],
      dor_quando: 'agora',
      dor_intensidade: 'moderada',
      velocidade_smash: 'lenta',
      faixa: 1,
    }),
    catalogo,
  );

  it('recebe três raquetes macias, todas abaixo do teto de firmeza da dor', () => {
    expect(r.podio).toHaveLength(3);
    for (const a of r.podio) {
      expect(a.ponto.resposta).toBeLessThanOrEqual(r.perfil.teto.resposta);
      expect(a.ponto.resposta).toBeLessThan(r.escala.mediaResposta);
    }
  });

  it('não recebe a Mormaii Kicks, a mais pesada do catálogo', () => {
    expect(r.podio.map((a) => a.raquete.id)).not.toContain('MORMAII-KICKS');
    expect(r.excluidas['MORMAII-KICKS']).toBe('acima_do_teto_fisico');
  });
});

describe('ex-tenista forte e avançado, que pede controle, na faixa 3', () => {
  const r = recomendar(
    respostas({
      ...AVANCADO,
      altura_cm: 185,
      peso_kg: 85,
      forca: 'acima',
      condicionamento: 'bom',
      esporte_origem: 'tenis',
      papel: 'ataco',
      movimento: 'amplo',
      velocidade_smash: 'muito_rapida',
      bolas: ['passam_fundo'],
      falta: ['controle'],
      faixa: 3,
    }),
    catalogo,
  );

  it('recebe três raquetes do lado firme da média — o 1º pedido pesa', () => {
    for (const a of r.podio) {
      expect(a.contraria_o_pedido).toBe(false);
      expect(a.ponto.resposta).toBeGreaterThanOrEqual(r.escala.mediaResposta);
    }
  });

  /**
   * O defeito da primeira versão: a capacidade física puxava o alvo de inércia a 96, e a Z Bruxo —
   * a resposta certa para este jogador — saía com nota 58. O teto protege quem tem pouco corpo; não
   * diz a quem tem muito que precisa de mais peso.
   */
  it('a Zand Z Bruxo encaixa, e não fica com nota de encaixe fraco', () => {
    expect(r.podio[0]!.raquete.id).toBe('ZAND-ZBRUXO');
    expect(r.podio[0]!.nota).toBeGreaterThan(90);
  });
});

describe('cotovelo forte, "sem limite" — a faixa vizinha como peso (§8.7)', () => {
  const r = recomendar(
    respostas({ dor_areas: ['cotovelo'], dor_quando: 'agora', dor_intensidade: 'forte', faixa: 3 }),
    catalogo,
  );

  it('a faixa 3 não tem raquetes macias o bastante, e o pódio traz as da faixa 2, com a penalidade', () => {
    expect(r.desceu_de_faixa).toBe(true);
    expect(r.podio).toHaveLength(3);
    for (const a of r.podio.filter((x) => x.faixa_vizinha)) expect(a.termos.penalidade_faixa).toBe(15);
  });

  it('desce UM degrau: nenhuma raquete da faixa 1 para quem disse "sem limite"', () => {
    for (const a of r.podio) expect(a.raquete.faixa).not.toBe(1);
  });

  it('nenhuma raquete do pódio fere o teto de firmeza da dor', () => {
    for (const a of r.podio) expect(a.ponto.resposta).toBeLessThanOrEqual(r.perfil.teto.resposta);
  });
});

/**
 * O caso que transformou as travas em peso (§8.7): ex-tenista intermediário, faixa 2, controle em
 * 1º lugar. A faixa só tem duas raquetes firmes. Com a premissa tudo-ou-nada, ela se desligava
 * inteira, e a 3ª vaga ia para a Heroes Show — macia, encaixe 10, o contrário do pedido.
 */
it('com poucas raquetes na faixa, a 3ª vaga não vai para a que contraria o pedido', () => {
  const r = recomendar(
    respostas({
      altura_cm: 176,
      peso_kg: 78,
      vezes_semana: 3,
      torneio: 'D',
      esporte_origem: 'tenis',
      troca_10_bolas: 'sim',
      papel: 'ataco',
      movimento: 'amplo',
      velocidade_smash: 'rapida',
      bolas: ['passam_fundo'],
      falta: ['controle', 'reacao_rede'],
      faixa: 2,
    }),
    catalogo,
  );
  expect(r.podio.map((a) => a.raquete.id)).not.toContain('HEROES-SHOW');
  for (const a of r.podio) expect(a.contraria_o_pedido).toBe(false);
});

it('na faixa vizinha, uma raquete parecida perde para a da faixa pedida', () => {
  const r = recomendar(respostas({ dor_areas: ['cotovelo'], dor_quando: 'agora', dor_intensidade: 'forte', faixa: 3 }), catalogo);
  const notas = r.podio.map((a) => a.nota);
  expect(notas).toEqual([...notas].sort((a, b) => b - a));
  for (const a of r.podio) if (a.faixa_vizinha) expect(a.nota).toBeLessThanOrEqual(100 - 15);
});

describe('a raquete atual', () => {
  it('uma raquete firme para quem tem dor no cotovelo é "troque já", pelo motivo da dor', () => {
    const r = recomendar(
      respostas({
        ...INICIANTE,
        dor_areas: ['cotovelo'],
        dor_quando: 'agora',
        dor_intensidade: 'forte',
        raquete_atual: { tipo: 'catalogo', id: 'ZAND-ZBRUXO' },
      }),
      catalogo,
    );
    expect(r.veredicto.tipo).toBe('troque_ja');
    if (r.veredicto.tipo !== 'sem_raquete') expect(r.veredicto.motivo).toBe('firme_demais_para_a_dor');
  });

  /**
   * A transição suaviza uma troca, e não pode impedir a raquete certa. Sem limite, a penalidade de
   * sair de uma atual inadequada chegava a 82 pontos, e a 1ª colocada saía com nota −44.
   */
  it('uma atual inadequada não derruba a nota de quem deveria substituí-la', () => {
    const comAtual = recomendar(respostas({ raquete_atual: { tipo: 'catalogo', id: 'QUICKSAND-KOMBAT' } }), catalogo);
    const semAtual = recomendar(respostas(), catalogo);
    expect(comAtual.podio[0]!.nota).toBeGreaterThan(semAtual.podio[0]!.nota - 10.01);
  });

  it('se ela é a 1ª colocada, o veredicto é "fique"', () => {
    const base = recomendar(respostas(), catalogo);
    const lider = base.podio[0]!.raquete.id;
    const r = recomendar(respostas({ raquete_atual: { tipo: 'catalogo', id: lider } }), catalogo);
    expect(r.veredicto.tipo).toBe('fique');
  });

  it('descrita pela pessoa, entra no mapa e o veredicto diz que é aproximado', () => {
    const r = recomendar(
      respostas({ raquete_atual: { tipo: 'descrita', nome: null, peso_g: 320, face: 'macia', material: 'carbono' } }),
      catalogo,
    );
    expect(r.veredicto.tipo).not.toBe('sem_raquete');
    if (r.veredicto.tipo !== 'sem_raquete') expect(r.veredicto.aproximada).toBe(true);
  });

  it('descrita sem nenhuma informação, não há veredicto — não se inventa uma raquete', () => {
    const r = recomendar(
      respostas({ raquete_atual: { tipo: 'descrita', nome: 'a do meu primo', peso_g: null, face: null, material: null } }),
      catalogo,
    );
    expect(r.veredicto.tipo).toBe('sem_raquete');
  });
});

it('gêmeas de especificação: AMA Kronos e Zand Z Jump nunca dividem o pódio', () => {
  expect(porId.get('AMA-KRONOS')!.resposta).toBe(porId.get('ZAND-ZJUMP')!.resposta);
  // A Kronos não tem preço, então quem pode entrar é a Z Jump — e a Kronos nunca entra junto.
  const r = recomendar(respostas({ ...AVANCADO, falta: ['controle'], faixa: 3 }), catalogo);
  const ids = r.podio.map((a) => a.raquete.id);
  expect(ids.includes('AMA-KRONOS') && ids.includes('ZAND-ZJUMP')).toBe(false);
});
