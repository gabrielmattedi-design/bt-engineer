/**
 * As respostas como a TELA as guarda, e a conversão para o que o motor lê.
 *
 * ═══ POR QUE DOIS FORMATOS ══════════════════════════════════════════════════════════════════════
 *
 * O formulário trabalha com um registro plano: cada pergunta é uma chave, e "ainda não respondeu" é
 * `null`. É o que permite guardar rascunho, validar pergunta por pergunta e esconder as condicionais.
 * O motor precisa de outra coisa — a raquete atual como UM valor (nenhuma, do catálogo ou descrita),
 * "não sei" como ausência, e os campos do corpo garantidamente presentes.
 *
 * `paraRespostas` é a única ponte, e ela desconfia do que recebe. A tela é uma das portas; um POST
 * direto no Server Action é outra, e ele entra sem passar por botão nenhum — foi assim que o Tennis
 * Engineer descobriu que precisava conferir as obrigatórias no servidor também.
 */

import type { Faixa, Falta, Respostas } from '@/motor';

/** Registro plano, uma chave por pergunta. `null` = ainda não respondida. */
export type RespostasDoQuestionario = {
  idade: number | null;
  altura_cm: number | null;
  peso_kg: number | null;
  sexo: string | null;
  forca: string | null;
  condicionamento: string | null;

  dor_areas: string[];
  dor_quando: string | null;
  dor_intensidade: string | null;

  tempo_bt: string | null;
  vezes_semana: number | null;
  aulas: string | null;
  torneio: string | null;
  esporte_origem: string | null;
  autoavaliacao: string | null;

  troca_10_bolas: string | null;
  smash_com_direcao: string | null;
  lob_ate_o_fundo: string | null;
  voleio_sob_pressao: string | null;
  saque_com_intencao: string | null;

  papel: string | null;
  movimento: string | null;
  velocidade_smash: string | null;

  bolas: string[];
  sensacao_rede: string | null;

  falta: string[];
  objetivo: string | null;

  raquete_tipo: string | null;
  raquete_id: string | null;
  raquete_nome: string | null;
  raquete_peso_g: number | null;
  raquete_face: string | null;
  raquete_material: string | null;
  nao_gosta: string[];

  faixa: number | null;
};

export type Chave = keyof RespostasDoQuestionario;

/** Função, e não constante: cada chamada devolve um objeto novo, nunca um compartilhado. */
export function respostasVazias(): RespostasDoQuestionario {
  return {
    idade: null,
    altura_cm: null,
    peso_kg: null,
    sexo: null,
    forca: null,
    condicionamento: null,
    dor_areas: [],
    dor_quando: null,
    dor_intensidade: null,
    tempo_bt: null,
    vezes_semana: null,
    aulas: null,
    torneio: null,
    esporte_origem: null,
    autoavaliacao: null,
    troca_10_bolas: null,
    smash_com_direcao: null,
    lob_ate_o_fundo: null,
    voleio_sob_pressao: null,
    saque_com_intencao: null,
    papel: null,
    movimento: null,
    velocidade_smash: null,
    bolas: [],
    sensacao_rede: null,
    falta: [],
    objetivo: null,
    raquete_tipo: null,
    raquete_id: null,
    raquete_nome: null,
    raquete_peso_g: null,
    raquete_face: null,
    raquete_material: null,
    nao_gosta: [],
    faixa: null,
  };
}

/**
 * As opções que a tela oferece e significam "nenhum destes". Elas não chegam ao motor como item de
 * lista: dor "nenhuma" é lista de dores vazia, e não uma dor chamada "nenhuma".
 */
export const NENHUM = {
  dor_areas: 'nenhuma',
  bolas: 'boa_profundidade',
  nao_gosta: 'nada',
} as const;

export type Conversao =
  | { readonly ok: true; readonly respostas: Respostas }
  | { readonly ok: false; readonly invalidas: readonly Chave[] };

/** O valor pertence ao conjunto que o motor aceita? Um valor fora dele é recusado, não coagido. */
function de<T extends string>(valor: string | null, aceitos: readonly T[]): T | null {
  return valor !== null && (aceitos as readonly string[]).includes(valor) ? (valor as T) : null;
}

const TRI = ['sim', 'as_vezes', 'nao'] as const;

export function paraRespostas(q: RespostasDoQuestionario): Conversao {
  const invalidas: Chave[] = [];
  const exigir = <T,>(chave: Chave, valor: T | null): T => {
    if (valor === null) invalidas.push(chave);
    return valor as T;
  };
  const numero = (chave: Chave, v: number | null, min: number, max: number): number | null =>
    v !== null && Number.isFinite(v) && v >= min && v <= max ? v : (invalidas.push(chave), null);

  const idade = numero('idade', q.idade, 10, 90);
  const altura_cm = numero('altura_cm', q.altura_cm, 140, 210);
  const peso_kg = numero('peso_kg', q.peso_kg, 35, 150);

  const dores = q.dor_areas.filter((x) => x !== NENHUM.dor_areas);
  const dor_areas = dores.map((x) => de(x, ['cotovelo', 'ombro', 'punho'] as const));
  if (dor_areas.includes(null) || (q.dor_areas.length === 0)) invalidas.push('dor_areas');
  const temDor = dores.length > 0;

  const tipo = exigir('raquete_tipo', de(q.raquete_tipo, ['nenhuma', 'catalogo', 'descrita'] as const));
  const naoSei = (v: string | null) => (v === 'nao_sei' ? null : v);

  const raquete_atual: Respostas['raquete_atual'] =
    tipo === 'catalogo'
      ? { tipo: 'catalogo', id: exigir('raquete_id', q.raquete_id && q.raquete_id.length > 0 ? q.raquete_id : null) }
      : tipo === 'descrita'
        ? {
            tipo: 'descrita',
            nome: q.raquete_nome?.trim() || null,
            peso_g: q.raquete_peso_g === null ? null : numero('raquete_peso_g', q.raquete_peso_g, 250, 420),
            face: de(naoSei(q.raquete_face), ['macia', 'media', 'dura'] as const),
            material: de(naoSei(q.raquete_material), ['vidro', 'carbono'] as const),
          }
        : { tipo: 'nenhuma' };

  const falta = q.falta.map((x) => de(x, ['potencia', 'controle', 'reacao_rede', 'peso_de_bola', 'conforto'] as const));
  if (falta.length === 0 || falta.length > 3 || falta.includes(null)) invalidas.push('falta');

  const bolas = q.bolas
    .filter((x) => x !== NENHUM.bolas)
    .map((x) => de(x, ['curtas', 'passam_fundo', 'rede', 'sem_direcao'] as const));
  if (q.bolas.length === 0 || bolas.includes(null)) invalidas.push('bolas');

  const nao_gosta = q.nao_gosta
    .filter((x) => x !== NENHUM.nao_gosta)
    .map((x) => de(x, ['pesada', 'leve', 'dura', 'sem_controle', 'vibra', 'lenta_na_rede'] as const));
  if (nao_gosta.includes(null)) invalidas.push('nao_gosta');

  const faixa = q.faixa === 1 || q.faixa === 2 || q.faixa === 3 ? (q.faixa as Faixa) : null;

  const respostas: Respostas = {
    idade: idade!,
    altura_cm: altura_cm!,
    peso_kg: peso_kg!,
    sexo: de(q.sexo, ['feminino', 'masculino', 'prefiro_nao_dizer'] as const),
    forca: exigir('forca', de(q.forca, ['abaixo', 'media', 'acima', 'bem_acima'] as const)),
    condicionamento: exigir('condicionamento', de(q.condicionamento, ['sedentario', 'moderado', 'bom', 'atletico'] as const)),
    dor_areas: dor_areas.filter((x): x is NonNullable<typeof x> => x !== null),
    dor_quando: temDor ? exigir('dor_quando', de(q.dor_quando, ['agora', 'ja_passou'] as const)) : null,
    dor_intensidade: temDor ? exigir('dor_intensidade', de(q.dor_intensidade, ['leve', 'moderada', 'forte'] as const)) : null,
    tempo_bt: exigir('tempo_bt', de(q.tempo_bt, ['menos_6m', '6_12m', '1_2a', '2_5a', 'mais_5a'] as const)),
    vezes_semana: numero('vezes_semana', q.vezes_semana, 1, 5),
    aulas: exigir('aulas', de(q.aulas, ['nunca', 'ja_fiz', 'faco'] as const)),
    torneio: exigir('torneio', de(q.torneio, ['nunca', 'iniciante', 'D', 'C', 'B', 'A', 'pro'] as const)),
    esporte_origem: exigir('esporte_origem', de(q.esporte_origem, ['tenis', 'padel', 'squash', 'nenhum'] as const)),
    autoavaliacao: exigir(
      'autoavaliacao',
      de(q.autoavaliacao, ['iniciante', 'iniciante_avancado', 'intermediario', 'intermediario_avancado', 'avancado'] as const),
    ),
    troca_10_bolas: exigir('troca_10_bolas', de(q.troca_10_bolas, TRI)),
    smash_com_direcao: exigir('smash_com_direcao', de(q.smash_com_direcao, TRI)),
    lob_ate_o_fundo: exigir('lob_ate_o_fundo', de(q.lob_ate_o_fundo, TRI)),
    voleio_sob_pressao: exigir('voleio_sob_pressao', de(q.voleio_sob_pressao, TRI)),
    saque_com_intencao: exigir('saque_com_intencao', de(q.saque_com_intencao, TRI)),
    papel: exigir('papel', de(q.papel, ['ataco', 'defendo', 'rede', 'construo', 'nao_sei'] as const)),
    movimento: exigir('movimento', de(q.movimento, ['amplo', 'curto', 'nao_sei'] as const)),
    velocidade_smash: exigir(
      'velocidade_smash',
      de(q.velocidade_smash, ['lenta', 'moderada', 'rapida', 'muito_rapida', 'nao_sei'] as const),
    ),
    bolas: bolas.filter((x): x is NonNullable<typeof x> => x !== null),
    sensacao_rede: exigir('sensacao_rede', de(q.sensacao_rede, ['lenta', 'certa', 'leve_demais', 'nao_sei'] as const)),
    falta: falta.filter((x): x is Falta => x !== null),
    objetivo: exigir('objetivo', de(q.objetivo, ['potencializar', 'mais_facil', 'evoluir', 'nao_sei'] as const)),
    raquete_atual,
    nao_gosta: tipo === 'nenhuma' ? [] : nao_gosta.filter((x): x is NonNullable<typeof x> => x !== null),
    faixa: exigir('faixa', faixa),
  };

  return invalidas.length > 0 ? { ok: false, invalidas: [...new Set(invalidas)] } : { ok: true, respostas };
}
