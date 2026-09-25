import type { Respostas } from '@/motor';
import { respostas } from './base';

/** mulberry32 — o mesmo de `tests/helpers/varredura.ts`: determinístico, o perfil #91 é sempre o mesmo. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sortearPerfis(n: number, seed = 20260925): Respostas[] {
  const r = rng(seed);
  const um = <T,>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const alguns = <T,>(xs: readonly T[], max: number): T[] => {
    const k = Math.floor(r() * (max + 1));
    return [...xs].sort(() => r() - 0.5).slice(0, k);
  };
  const tri = ['sim', 'as_vezes', 'nao'] as const;
  const ids = ['ZAND-ZBRUXO', 'SHARK-TOUR', 'AMA-ATHENA', 'QUICKSAND-KOMBAT', 'MORMAII-KICKS', 'AMA-KRONOS'];
  return Array.from({ length: n }, () => {
    const dor = alguns(['cotovelo', 'ombro', 'punho'] as const, 2);
    const atual = um(['nenhuma', 'catalogo', 'descrita'] as const);
    return respostas({
      idade: 10 + Math.floor(r() * 66),
      altura_cm: 140 + Math.floor(r() * 60),
      peso_kg: 35 + Math.floor(r() * 90),
      sexo: um(['feminino', 'masculino', 'prefiro_nao_dizer', null] as const),
      forca: um(['abaixo', 'media', 'acima', 'bem_acima'] as const),
      condicionamento: um(['sedentario', 'moderado', 'bom', 'atletico'] as const),
      dor_areas: dor,
      dor_quando: dor.length ? um(['agora', 'ja_passou'] as const) : null,
      dor_intensidade: dor.length ? um(['leve', 'moderada', 'forte'] as const) : null,
      tempo_bt: um(['menos_6m', '6_12m', '1_2a', '2_5a', 'mais_5a'] as const),
      vezes_semana: 1 + Math.floor(r() * 5),
      aulas: um(['nunca', 'ja_fiz', 'faco'] as const),
      torneio: um(['nunca', 'iniciante', 'D', 'C', 'B', 'A', 'pro'] as const),
      esporte_origem: um(['tenis', 'padel', 'squash', 'nenhum'] as const),
      autoavaliacao: um(['iniciante', 'iniciante_avancado', 'intermediario', 'intermediario_avancado', 'avancado'] as const),
      troca_10_bolas: um(tri),
      smash_com_direcao: um(tri),
      lob_ate_o_fundo: um(tri),
      voleio_sob_pressao: um(tri),
      saque_com_intencao: um(tri),
      papel: um(['ataco', 'defendo', 'rede', 'construo', 'nao_sei'] as const),
      movimento: um(['amplo', 'curto', 'nao_sei'] as const),
      velocidade_smash: um(['lenta', 'moderada', 'rapida', 'muito_rapida', 'nao_sei'] as const),
      bolas: alguns(['curtas', 'passam_fundo', 'rede', 'sem_direcao', 'boa_profundidade'] as const, 2),
      sensacao_rede: um(['lenta', 'certa', 'leve_demais', 'nao_sei'] as const),
      falta: alguns(['potencia', 'controle', 'reacao_rede', 'peso_de_bola', 'conforto'] as const, 3),
      objetivo: um(['potencializar', 'mais_facil', 'evoluir', 'nao_sei'] as const),
      raquete_atual:
        atual === 'nenhuma'
          ? { tipo: 'nenhuma' }
          : atual === 'catalogo'
            ? { tipo: 'catalogo', id: um(ids) }
            : {
                tipo: 'descrita',
                nome: null,
                peso_g: um([null, 300, 315, 325, 335, 345]),
                face: um(['macia', 'media', 'dura', null] as const),
                material: um(['vidro', 'carbono', null] as const),
              },
      nao_gosta: alguns(['pesada', 'leve', 'dura', 'sem_controle', 'vibra', 'lenta_na_rede'] as const, 2),
      faixa: um([1, 2, 3] as const),
    });
  });
}
