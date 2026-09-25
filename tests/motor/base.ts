import type { Respostas } from '@/motor';

/** Um jogador intermediário típico, sem dor e sem raquete. Cada teste troca só o que quer medir. */
export function respostas(parcial: Partial<Respostas> = {}): Respostas {
  return {
    idade: 35,
    altura_cm: 175,
    peso_kg: 75,
    sexo: 'masculino',
    forca: 'media',
    condicionamento: 'moderado',
    dor_areas: [],
    dor_quando: null,
    dor_intensidade: null,
    tempo_bt: '1_2a',
    vezes_semana: 2,
    aulas: 'ja_fiz',
    torneio: 'nunca',
    esporte_origem: 'nenhum',
    autoavaliacao: 'intermediario',
    troca_10_bolas: 'as_vezes',
    smash_com_direcao: 'as_vezes',
    lob_ate_o_fundo: 'as_vezes',
    voleio_sob_pressao: 'as_vezes',
    saque_com_intencao: 'as_vezes',
    papel: 'nao_sei',
    movimento: 'nao_sei',
    velocidade_smash: 'moderada',
    bolas: [],
    sensacao_rede: 'certa',
    falta: [],
    objetivo: 'nao_sei',
    raquete_atual: { tipo: 'nenhuma' },
    nao_gosta: [],
    faixa: 2,
    ...parcial,
  };
}
