/**
 * O questionário do beach tennis, como DADO — docs/PROPOSTA_MOTOR_BT.md §6.
 *
 * As perguntas vivem aqui, e não em JSX, pelo mesmo motivo do questionário de tênis: a tela, a
 * validação do servidor, o PDF de revisão e a página de teste leem a MESMA lista. Uma segunda cópia
 * das perguntas divergiria da primeira na próxima alteração, em silêncio.
 *
 * Toda pergunta é obrigatória, salvo marcação. "Não sei" é uma resposta, e é oferecido onde a
 * pessoa pode legitimamente não saber — e o motor sabe o que fazer com ele.
 */

import type { Chave, RespostasDoQuestionario } from './respostas';
import { NENHUM } from './respostas';

export type Opcao = { readonly valor: string; readonly rotulo: string; readonly dica?: string };

type Base = {
  readonly chave: Chave;
  readonly titulo: string;
  readonly ajuda?: string;
  readonly opcional?: boolean;
  readonly mostrarSe?: (r: RespostasDoQuestionario) => boolean;
};

export type Pergunta =
  | (Base & { readonly tipo: 'unica'; readonly numerica?: true; readonly opcoes: readonly Opcao[] })
  | (Base & {
      readonly tipo: 'multipla';
      readonly max: number;
      /** A ORDEM de escolha importa — as prioridades. */
      readonly ordenada?: true;
      /** A opção "nenhum destes", que desmarca as outras e é desmarcada por elas. */
      readonly exclusiva?: string;
      readonly opcoes: readonly Opcao[];
    })
  | (Base & { readonly tipo: 'numero'; readonly min: number; readonly max: number; readonly unidade: string })
  | (Base & { readonly tipo: 'raquete' })
  | (Base & { readonly tipo: 'texto'; readonly maxCaracteres: number; readonly exemplo: string });

export type Etapa = {
  readonly id: string;
  readonly rotulo: string;
  readonly aviso?: string;
  readonly perguntas: readonly Pergunta[];
};

const TRI: readonly Opcao[] = [
  { valor: 'sim', rotulo: 'Sim' },
  { valor: 'as_vezes', rotulo: 'Às vezes' },
  { valor: 'nao', rotulo: 'Não' },
];

const temDor = (r: RespostasDoQuestionario) => r.dor_areas.some((x) => x !== NENHUM.dor_areas);
const temRaquete = (r: RespostasDoQuestionario) =>
  r.raquete_tipo === 'catalogo' || r.raquete_tipo === 'descrita';

export const ETAPAS: readonly Etapa[] = [
  {
    id: 'corpo',
    rotulo: 'Seu corpo',
    perguntas: [
      { tipo: 'numero', chave: 'idade', titulo: 'Qual sua idade?', min: 10, max: 90, unidade: 'anos' },
      { tipo: 'numero', chave: 'altura_cm', titulo: 'Sua altura', min: 140, max: 210, unidade: 'cm' },
      { tipo: 'numero', chave: 'peso_kg', titulo: 'Seu peso', min: 35, max: 150, unidade: 'kg' },
      {
        tipo: 'unica',
        chave: 'sexo',
        opcional: true,
        titulo: 'Sexo biológico',
        ajuda:
          'Opcional. Afina um pouco a leitura de altura e peso. Sua resposta sobre força pesa bem mais do que esta.',
        opcoes: [
          { valor: 'feminino', rotulo: 'Feminino' },
          { valor: 'masculino', rotulo: 'Masculino' },
          { valor: 'prefiro_nao_dizer', rotulo: 'Prefiro não dizer' },
        ],
      },
      {
        tipo: 'unica',
        chave: 'forca',
        titulo: 'Como você descreveria sua força física?',
        opcoes: [
          { valor: 'abaixo', rotulo: 'Abaixo da média', dica: 'Bola forte do adversário costuma empurrar sua raquete.' },
          { valor: 'media', rotulo: 'Média', dica: 'Segura bola forte, mas não sobra força para acelerar sempre.' },
          { valor: 'acima', rotulo: 'Acima da média', dica: 'Acelera o braço quando quer, mesmo em bola difícil.' },
          { valor: 'bem_acima', rotulo: 'Bem acima da média', dica: 'Treina força fora da quadra, ou é naturalmente muito forte.' },
        ],
      },
      {
        tipo: 'unica',
        chave: 'condicionamento',
        titulo: 'E seu condicionamento?',
        opcoes: [
          { valor: 'sedentario', rotulo: 'Sedentário', dica: 'Cansa antes do fim do jogo.' },
          { valor: 'moderado', rotulo: 'Moderado', dica: 'Aguenta o jogo, sente no fim do segundo set.' },
          { valor: 'bom', rotulo: 'Bom', dica: 'Joga dois ou três jogos seguidos sem cair de rendimento.' },
          { valor: 'atletico', rotulo: 'Atlético', dica: 'Treina fisicamente com regularidade.' },
        ],
      },
    ],
  },
  {
    id: 'dor',
    rotulo: 'Braço',
    aviso:
      'Não fazemos diagnóstico. A raquete certa ajuda, mas não substitui a avaliação de um profissional de saúde.',
    perguntas: [
      {
        tipo: 'multipla',
        chave: 'dor_areas',
        titulo: 'Você sente ou já sentiu dor ao jogar em…',
        max: 3,
        exclusiva: NENHUM.dor_areas,
        opcoes: [
          { valor: 'cotovelo', rotulo: 'Cotovelo' },
          { valor: 'ombro', rotulo: 'Ombro' },
          { valor: 'punho', rotulo: 'Punho' },
          { valor: NENHUM.dor_areas, rotulo: 'Nenhum desses' },
        ],
      },
      {
        tipo: 'unica',
        chave: 'dor_quando',
        titulo: 'Essa dor é de agora ou já passou?',
        mostrarSe: temDor,
        opcoes: [
          { valor: 'agora', rotulo: 'Sinto agora' },
          { valor: 'ja_passou', rotulo: 'Já passou' },
        ],
      },
      {
        tipo: 'unica',
        chave: 'dor_intensidade',
        titulo: 'Qual a intensidade?',
        mostrarSe: temDor,
        opcoes: [
          { valor: 'leve', rotulo: 'Leve', dica: 'Incomoda, mas não muda como eu jogo.' },
          { valor: 'moderada', rotulo: 'Moderada', dica: 'Me faz evitar alguns golpes.' },
          { valor: 'forte', rotulo: 'Forte', dica: 'Já me tirou da quadra, ou quase.' },
        ],
      },
    ],
  },
  {
    id: 'experiencia',
    rotulo: 'Experiência',
    perguntas: [
      {
        tipo: 'unica',
        chave: 'tempo_bt',
        titulo: 'Há quanto tempo você joga beach tennis?',
        opcoes: [
          { valor: 'menos_6m', rotulo: 'Menos de 6 meses' },
          { valor: '6_12m', rotulo: '6 a 12 meses' },
          { valor: '1_2a', rotulo: '1 a 2 anos' },
          { valor: '2_5a', rotulo: '2 a 5 anos' },
          { valor: 'mais_5a', rotulo: 'Mais de 5 anos' },
        ],
      },
      {
        tipo: 'unica',
        chave: 'vezes_semana',
        numerica: true,
        titulo: 'Quantas vezes por semana você joga?',
        opcoes: [
          { valor: '1', rotulo: '1' },
          { valor: '2', rotulo: '2' },
          { valor: '3', rotulo: '3' },
          { valor: '4', rotulo: '4' },
          { valor: '5', rotulo: '5 ou mais' },
        ],
      },
      {
        tipo: 'unica',
        chave: 'aulas',
        titulo: 'Você faz ou já fez aulas?',
        opcoes: [
          { valor: 'nunca', rotulo: 'Nunca fiz' },
          { valor: 'ja_fiz', rotulo: 'Já fiz' },
          { valor: 'faco', rotulo: 'Faço atualmente' },
        ],
      },
      {
        tipo: 'unica',
        chave: 'torneio',
        titulo: 'Joga ou já jogou torneio? Em qual categoria?',
        opcoes: [
          { valor: 'nunca', rotulo: 'Nunca joguei' },
          { valor: 'iniciante', rotulo: 'Iniciante' },
          { valor: 'D', rotulo: 'D' },
          { valor: 'C', rotulo: 'C' },
          { valor: 'B', rotulo: 'B' },
          { valor: 'A', rotulo: 'A' },
          { valor: 'pro', rotulo: 'Profissional / Open' },
        ],
      },
      {
        tipo: 'unica',
        chave: 'esporte_origem',
        titulo: 'Antes do beach tennis, você jogou outro esporte de raquete?',
        opcoes: [
          { valor: 'tenis', rotulo: 'Tênis' },
          { valor: 'padel', rotulo: 'Padel' },
          { valor: 'squash', rotulo: 'Squash' },
          { valor: 'nenhum', rotulo: 'Nenhum' },
        ],
      },
      {
        tipo: 'unica',
        chave: 'autoavaliacao',
        titulo: 'Como você se classificaria hoje?',
        opcoes: [
          { valor: 'iniciante', rotulo: 'Iniciante' },
          { valor: 'iniciante_avancado', rotulo: 'Iniciante avançado' },
          { valor: 'intermediario', rotulo: 'Intermediário' },
          { valor: 'intermediario_avancado', rotulo: 'Intermediário avançado' },
          { valor: 'avancado', rotulo: 'Avançado' },
        ],
      },
    ],
  },
  {
    id: 'calibracao',
    rotulo: 'Seu jogo hoje',
    aviso: 'Sem julgamento — estas respostas pesam mais que a autoavaliação, e é por isso que ajudam.',
    perguntas: [
      { tipo: 'unica', chave: 'troca_10_bolas', titulo: 'Você sustenta uma troca de 10 bolas ou mais?', opcoes: TRI },
      { tipo: 'unica', chave: 'smash_com_direcao', titulo: 'Seu smash tem direção, e não só força?', opcoes: TRI },
      { tipo: 'unica', chave: 'lob_ate_o_fundo', titulo: 'Seu lob defensivo chega até o fundo?', opcoes: TRI },
      { tipo: 'unica', chave: 'voleio_sob_pressao', titulo: 'Você bloqueia um voleio sob pressão na rede?', opcoes: TRI },
      { tipo: 'unica', chave: 'saque_com_intencao', titulo: 'Você saca com intenção — escolhendo lugar ou efeito?', opcoes: TRI },
    ],
  },
  {
    id: 'jogo',
    rotulo: 'Como você joga',
    perguntas: [
      {
        tipo: 'unica',
        chave: 'papel',
        titulo: 'Na dupla, qual é o seu papel?',
        opcoes: [
          { valor: 'ataco', rotulo: 'Ataco e finalizo', dica: 'Quem fecha o ponto no smash.' },
          { valor: 'defendo', rotulo: 'Defendo e devolvo tudo', dica: 'Quem segura a bola forte e não deixa cair.' },
          { valor: 'rede', rotulo: 'Fico na rede', dica: 'Voleio, reflexo, bola no pé do adversário.' },
          { valor: 'construo', rotulo: 'Construo e coloco', dica: 'Quem arma o ponto com colocação.' },
          { valor: 'nao_sei', rotulo: 'Ainda não sei' },
        ],
      },
      {
        tipo: 'unica',
        chave: 'movimento',
        titulo: 'Seu movimento de golpe é…',
        opcoes: [
          { valor: 'amplo', rotulo: 'Amplo', dica: 'Braço inteiro, com o corpo — o golpe de quem veio do tênis.' },
          { valor: 'curto', rotulo: 'Curto', dica: 'Punho e antebraço, compacto.' },
          { valor: 'nao_sei', rotulo: 'Não sei dizer' },
        ],
      },
      {
        tipo: 'unica',
        chave: 'velocidade_smash',
        titulo: 'A velocidade do seu smash é…',
        opcoes: [
          { valor: 'lenta', rotulo: 'Lenta' },
          { valor: 'moderada', rotulo: 'Moderada' },
          { valor: 'rapida', rotulo: 'Rápida' },
          { valor: 'muito_rapida', rotulo: 'Muito rápida' },
          { valor: 'nao_sei', rotulo: 'Não sei', dica: 'A gente estima pelo seu nível e pelo seu físico.' },
        ],
      },
    ],
  },
  {
    id: 'bola',
    rotulo: 'Sua bola',
    perguntas: [
      {
        tipo: 'multipla',
        chave: 'bolas',
        titulo: 'Suas bolas costumam…',
        ajuda: 'Até duas.',
        max: 2,
        exclusiva: NENHUM.bolas,
        opcoes: [
          { valor: 'curtas', rotulo: 'Cair curtas' },
          { valor: 'passam_fundo', rotulo: 'Passar do fundo' },
          { valor: 'rede', rotulo: 'Ir na rede' },
          { valor: 'sem_direcao', rotulo: 'Sair sem direção' },
          { valor: NENHUM.bolas, rotulo: 'Nenhum desses — têm boa profundidade' },
        ],
      },
      {
        tipo: 'unica',
        chave: 'sensacao_rede',
        titulo: 'Na rede, sua raquete parece…',
        opcoes: [
          { valor: 'lenta', rotulo: 'Lenta para reagir' },
          { valor: 'certa', rotulo: 'Na medida' },
          { valor: 'leve_demais', rotulo: 'Leve demais', dica: 'A bola forte empurra a raquete.' },
          { valor: 'nao_sei', rotulo: 'Não sei dizer' },
        ],
      },
    ],
  },
  {
    id: 'prioridades',
    rotulo: 'O que você quer',
    perguntas: [
      {
        tipo: 'multipla',
        chave: 'falta',
        titulo: 'Do que você sente falta no seu jogo?',
        ajuda: 'Até três, na ordem de importância. O primeiro que você tocar é o que mais pesa.',
        max: 3,
        ordenada: true,
        opcoes: [
          { valor: 'potencia', rotulo: 'Potência', dica: 'A bola sair com mais força sem eu fazer mais força.' },
          { valor: 'controle', rotulo: 'Controle', dica: 'A bola ir onde eu quero.' },
          { valor: 'reacao_rede', rotulo: 'Reação na rede', dica: 'Raquete mais rápida na mão.' },
          { valor: 'peso_de_bola', rotulo: 'Peso de bola', dica: 'Bola que pesa no adversário, e raquete que não treme na bola forte.' },
          { valor: 'conforto', rotulo: 'Conforto', dica: 'Menos impacto e vibração no braço.' },
        ],
      },
      {
        tipo: 'unica',
        chave: 'objetivo',
        titulo: 'O que você espera da próxima raquete?',
        opcoes: [
          { valor: 'potencializar', rotulo: 'Potencializar o jogo que já tenho', dica: 'Mudança pequena, sem estranhar.' },
          { valor: 'mais_facil', rotulo: 'Algo mais fácil de jogar' },
          { valor: 'evoluir', rotulo: 'Evoluir para algo mais exigente' },
          { valor: 'nao_sei', rotulo: 'Ainda não sei' },
        ],
      },
    ],
  },
  {
    id: 'raquete',
    rotulo: 'Sua raquete',
    perguntas: [
      {
        tipo: 'unica',
        chave: 'raquete_tipo',
        titulo: 'Você tem raquete própria?',
        opcoes: [
          { valor: 'catalogo', rotulo: 'Tenho — vou procurar na lista' },
          { valor: 'descrita', rotulo: 'Tenho, mas não está na lista ou não sei o modelo' },
          { valor: 'nenhuma', rotulo: 'Ainda não tenho' },
        ],
      },
      {
        tipo: 'raquete',
        chave: 'raquete_id',
        titulo: 'Qual é a sua raquete?',
        mostrarSe: (r) => r.raquete_tipo === 'catalogo',
      },
      {
        tipo: 'texto',
        chave: 'raquete_nome',
        opcional: true,
        titulo: 'Qual o nome dela, se souber?',
        maxCaracteres: 80,
        exemplo: 'Ex.: uma Mormaii que comprei em 2023',
        mostrarSe: (r) => r.raquete_tipo === 'descrita',
      },
      {
        tipo: 'numero',
        chave: 'raquete_peso_g',
        opcional: true,
        titulo: 'Quanto ela pesa?',
        ajuda: 'Uma balança de cozinha resolve em 30 segundos, e é mais preciso que o número do fabricante. Pode pular.',
        min: 280,
        max: 380,
        unidade: 'g',
        mostrarSe: (r) => r.raquete_tipo === 'descrita',
      },
      {
        tipo: 'unica',
        chave: 'raquete_face',
        titulo: 'Como é a face dela ao bater na bola?',
        mostrarSe: (r) => r.raquete_tipo === 'descrita',
        opcoes: [
          { valor: 'macia', rotulo: 'Macia', dica: 'A bola sai fácil, parece que afunda na face.' },
          { valor: 'media', rotulo: 'Média' },
          { valor: 'dura', rotulo: 'Dura', dica: 'Seca, precisa bater forte para a bola andar.' },
          { valor: 'nao_sei', rotulo: 'Não sei dizer' },
        ],
      },
      {
        tipo: 'unica',
        chave: 'raquete_material',
        titulo: 'De que material é a face?',
        mostrarSe: (r) => r.raquete_tipo === 'descrita',
        opcoes: [
          { valor: 'vidro', rotulo: 'Fibra de vidro' },
          { valor: 'carbono', rotulo: 'Carbono' },
          { valor: 'nao_sei', rotulo: 'Não sei' },
        ],
      },
      {
        tipo: 'multipla',
        chave: 'nao_gosta',
        titulo: 'O que você NÃO gosta nela?',
        ajuda: 'Até duas.',
        max: 2,
        exclusiva: NENHUM.nao_gosta,
        mostrarSe: temRaquete,
        opcoes: [
          { valor: 'pesada', rotulo: 'É pesada' },
          { valor: 'leve', rotulo: 'É leve demais' },
          { valor: 'dura', rotulo: 'É dura' },
          { valor: 'vibra', rotulo: 'Vibra no braço' },
          { valor: 'sem_controle', rotulo: 'Falta controle' },
          { valor: 'lenta_na_rede', rotulo: 'É lenta na rede' },
          { valor: NENHUM.nao_gosta, rotulo: 'Nada — gosto dela' },
        ],
      },
    ],
  },
  {
    id: 'faixa',
    rotulo: 'Quanto investir',
    perguntas: [
      {
        tipo: 'unica',
        chave: 'faixa',
        numerica: true,
        titulo: 'Quanto você quer investir na raquete?',
        ajuda: 'A recomendação sai de dentro da faixa que você escolher.',
        opcoes: [
          { valor: '1', rotulo: 'Até R$ 1.500', dica: 'Fibra de vidro e carbono 3K de entrada.' },
          { valor: '2', rotulo: 'De R$ 1.500 a R$ 2.200', dica: 'Carbono 3K e 12K das linhas intermediárias e avançadas.' },
          { valor: '3', rotulo: 'Acima de R$ 2.200, ou sem limite', dica: 'As linhas de topo, em geral mais firmes.' },
        ],
      },
    ],
  },
];

export function etapasVisiveis(r: RespostasDoQuestionario): readonly Etapa[] {
  return ETAPAS.map((e) => ({ ...e, perguntas: e.perguntas.filter((p) => !p.mostrarSe || p.mostrarSe(r)) })).filter(
    (e) => e.perguntas.length > 0,
  );
}

export function respondida(p: Pergunta, r: RespostasDoQuestionario): boolean {
  if (p.opcional) return true;
  const v = r[p.chave];
  switch (p.tipo) {
    case 'unica':
      return typeof v === 'number' ? Number.isFinite(v) : typeof v === 'string' && v.length > 0;
    case 'multipla':
      return Array.isArray(v) && v.length > 0;
    case 'numero':
      return typeof v === 'number' && Number.isFinite(v);
    case 'raquete':
    case 'texto':
      return typeof v === 'string' && v.trim().length > 0;
  }
}

export function pendentes(r: RespostasDoQuestionario): readonly Pergunta[] {
  return etapasVisiveis(r).flatMap((e) => e.perguntas.filter((p) => !respondida(p, r)));
}
