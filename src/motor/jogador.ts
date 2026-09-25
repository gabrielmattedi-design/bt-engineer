/**
 * Do questionário ao alvo no mapa — docs/PROPOSTA_MOTOR_BT.md §4 e §6.
 *
 * O jogador vira três coisas, todas na escala do catálogo (0 = a mais macia ou a mais leve na mão
 * que existe, 100 = a mais firme ou a mais pesada):
 *
 *   alvo        onde a raquete ideal dele fica
 *   teto        até onde ele pode ir sem risco — acima disso a raquete sai, não perde ponto
 *   prioridade  o que ele pediu em 1º lugar, que vira premissa (§4.3)
 *
 * Os mapas de pontuação de força, preparo, idade, nível e dor são os do Tennis Engineer, que
 * foram calibrados caso a caso contra relatos reais. Cada um diz de onde veio. O que é novo aqui é
 * o que o beach tennis muda: o esporte de origem, o papel na dupla, a sensação na rede.
 */

import type { Faixa } from './faixas';

type Tri = 'sim' | 'as_vezes' | 'nao';

export type Falta = 'potencia' | 'controle' | 'reacao_rede' | 'peso_de_bola' | 'conforto';

export type RaqueteAtual =
  | { readonly tipo: 'nenhuma' }
  | { readonly tipo: 'catalogo'; readonly id: string }
  | {
      readonly tipo: 'descrita';
      readonly nome: string | null;
      /** Pesada pela pessoa. Mais preciso que a faixa do fabricante — §5. */
      readonly peso_g: number | null;
      readonly face: 'macia' | 'media' | 'dura' | null;
      readonly material: 'vidro' | 'carbono' | null;
    };

export type Respostas = {
  // 1. corpo
  readonly idade: number;
  readonly altura_cm: number;
  readonly peso_kg: number;
  readonly sexo: 'feminino' | 'masculino' | 'prefiro_nao_dizer' | null;
  readonly forca: 'abaixo' | 'media' | 'acima' | 'bem_acima' | null;
  readonly condicionamento: 'sedentario' | 'moderado' | 'bom' | 'atletico' | null;
  // 2. dor
  readonly dor_areas: readonly ('cotovelo' | 'ombro' | 'punho')[];
  readonly dor_quando: 'agora' | 'ja_passou' | null;
  readonly dor_intensidade: 'leve' | 'moderada' | 'forte' | null;
  // 3. experiência
  readonly tempo_bt: 'menos_6m' | '6_12m' | '1_2a' | '2_5a' | 'mais_5a' | null;
  readonly vezes_semana: number | null;
  readonly aulas: 'nunca' | 'ja_fiz' | 'faco' | null;
  readonly torneio: 'nunca' | 'iniciante' | 'D' | 'C' | 'B' | 'A' | 'pro' | null;
  readonly esporte_origem: 'tenis' | 'padel' | 'squash' | 'nenhum' | null;
  readonly autoavaliacao:
    | 'iniciante'
    | 'iniciante_avancado'
    | 'intermediario'
    | 'intermediario_avancado'
    | 'avancado'
    | null;
  // 4. calibração
  readonly troca_10_bolas: Tri | null;
  readonly smash_com_direcao: Tri | null;
  readonly lob_ate_o_fundo: Tri | null;
  readonly voleio_sob_pressao: Tri | null;
  readonly saque_com_intencao: Tri | null;
  // 5. jogo
  readonly papel: 'ataco' | 'defendo' | 'rede' | 'construo' | 'nao_sei' | null;
  readonly movimento: 'amplo' | 'curto' | 'nao_sei' | null;
  readonly velocidade_smash: 'lenta' | 'moderada' | 'rapida' | 'muito_rapida' | 'nao_sei' | null;
  // 6. bola
  readonly bolas: readonly ('curtas' | 'passam_fundo' | 'rede' | 'sem_direcao' | 'boa_profundidade')[];
  readonly sensacao_rede: 'lenta' | 'certa' | 'leve_demais' | 'nao_sei' | null;
  // 7. prioridades, em ordem
  readonly falta: readonly Falta[];
  /** "Mudar algo" existia e saiu: não movia nada no motor, e pergunta que não alimenta nada não entra. */
  readonly objetivo: 'potencializar' | 'mais_facil' | 'evoluir' | 'nao_sei' | null;
  // 8. raquete atual
  readonly raquete_atual: RaqueteAtual;
  readonly nao_gosta: readonly ('pesada' | 'leve' | 'dura' | 'sem_controle' | 'vibra' | 'lenta_na_rede')[];
  // 9. faixa — "sem limite" é a faixa 3
  readonly faixa: Faixa;
};

export type Perfil = {
  readonly nivel: number;
  /** O nível na régua do fabricante, 1 a 4, para comparar com `nivel_indicado`. */
  readonly nivel_fabricante: number;
  readonly iniciante: boolean;
  readonly capacidade: number;
  readonly potencia_natural: number;
  readonly potencia_inferida: boolean;
  readonly sensibilidade_braco: number;
  readonly alvo: { readonly resposta: number; readonly inercia: number };
  readonly teto: { readonly resposta: number; readonly inercia: number };
  readonly primeira_prioridade: Falta | null;
  readonly faixa: Faixa;
  /** Cada ajuste aplicado aos alvos, legível — é o que o relatório e o admin mostram. */
  readonly ajustes: readonly string[];
};

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
const norm = (x: number, lo: number, hi: number): number => clamp((x - lo) / (hi - lo), 0, 1);
const media = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

// ─── Nível — o calibrado do Tennis Engineer, com as perguntas trocadas pelas do beach tennis ────

const TRI: Record<Tri, number> = { sim: 100, as_vezes: 55, nao: 15 };

/** A categoria de torneio é a evidência mais objetiva de nível que o questionário tem. */
const TORNEIO: Record<NonNullable<Respostas['torneio']>, number> = {
  nunca: 20,
  iniciante: 40,
  D: 55,
  C: 70,
  B: 82,
  A: 92,
  pro: 100,
};

const AUTOAVALIACAO: Record<NonNullable<Respostas['autoavaliacao']>, number> = {
  iniciante: 15,
  iniciante_avancado: 35,
  intermediario: 55,
  intermediario_avancado: 72,
  avancado: 88,
};

const ANOS: Record<NonNullable<Respostas['tempo_bt']>, number> = {
  menos_6m: 0.25,
  '6_12m': 0.75,
  '1_2a': 1.5,
  '2_5a': 3.5,
  mais_5a: 6,
};

/**
 * 0.60 objetivo, 0.25 experiência, 0.15 autoavaliação — os pesos de `calibrateLevel`.
 *
 * O autoavaliado pesa pouco porque tem viés conhecido nas duas direções. No beach tennis há um
 * terceiro: quem vem do tênis costuma se classificar pelo tênis.
 */
export function nivelCalibrado(a: Respostas): number {
  const objetivos = [
    a.troca_10_bolas,
    a.smash_com_direcao,
    a.lob_ate_o_fundo,
    a.voleio_sob_pressao,
    a.saque_com_intencao,
  ]
    .filter((x): x is Tri => x !== null)
    .map((x) => TRI[x]);
  if (a.torneio !== null) objetivos.push(TORNEIO[a.torneio]);

  const autoavaliado = a.autoavaliacao === null ? 45 : AUTOAVALIACAO[a.autoavaliacao];
  const objetivo = objetivos.length === 0 ? autoavaliado : media(objetivos);

  const aulas = a.aulas === 'faco' ? 1 : a.aulas === 'ja_fiz' ? 0.75 : 0.4;
  const experiencia =
    0.5 * norm(a.tempo_bt === null ? 1 : ANOS[a.tempo_bt], 0, 5) +
    0.3 * norm(a.vezes_semana ?? 1, 0, 4) +
    0.2 * aulas;

  return clamp(0.6 * objetivo + 0.25 * 100 * experiencia + 0.15 * autoavaliado, 0, 100);
}

// ─── Capacidade física — `computePhysicalCapacity` do Tennis Engineer, sem o backhand ────────────

const FORCA = { abaixo: 38, media: 58, acima: 78, bem_acima: 93 } as const;
const PREPARO = { sedentario: 35, moderado: 55, bom: 75, atletico: 92 } as const;
const SEXO_PORTE = { feminino: 0.9, masculino: 1.0, prefiro_nao_dizer: 0.95 } as const;

/** Platô até 34 anos, decai até 0,65 aos 65; 0,8 abaixo de 16 — `ageFactor`. */
function fatorIdade(idade: number): number {
  if (idade < 16) return 0.8;
  if (idade <= 34) return 1;
  if (idade >= 65) return 0.65;
  return 1 - ((idade - 34) / 31) * 0.35;
}

function porte(a: Respostas): number {
  const tamanho = 0.6 * norm(a.peso_kg, 45, 95) * 100 + 0.4 * norm(a.altura_cm, 150, 195) * 100;
  return clamp(tamanho * (a.sexo === null ? 1 : SEXO_PORTE[a.sexo]), 0, 100);
}

export function capacidadeFisica(a: Respostas): number {
  return clamp(
    0.3 * (a.forca === null ? 50 : FORCA[a.forca]) +
      0.18 * (a.condicionamento === null ? 50 : PREPARO[a.condicionamento]) +
      0.22 * porte(a) +
      0.14 * 100 * fatorIdade(a.idade) +
      0.16 * 100 * norm(a.vezes_semana ?? 1, 0, 4),
    0,
    100,
  );
}

// ─── Potência natural — quanto a pessoa já põe na bola sem a raquete ajudar ───────────────────────

const VELOCIDADE = { lenta: 20, moderada: 45, rapida: 72, muito_rapida: 90 } as const;

/**
 * Movimento amplo é o swing de tênis: longo, com o corpo. Curto é o de punho e antebraço, que é o
 * natural de quem aprendeu no beach tennis. Quem não sabe responder e veio do tênis quase sempre
 * trouxe o amplo — é o primeiro vício que o professor de beach tennis corrige.
 */
function movimento(a: Respostas): number {
  if (a.movimento === 'amplo') return 85;
  if (a.movimento === 'curto') return 25;
  return a.esporte_origem === 'tenis' ? 75 : 50;
}

export function potenciaNatural(
  a: Respostas,
  nivel: number,
  capacidade: number,
): { valor: number; inferida: boolean } {
  const conhecida = a.velocidade_smash !== null && a.velocidade_smash !== 'nao_sei';
  const velocidade = conhecida
    ? VELOCIDADE[a.velocidade_smash as keyof typeof VELOCIDADE]
    : 0.6 * nivel + 0.4 * capacidade;
  return {
    valor: clamp(0.45 * velocidade + 0.25 * movimento(a) + 0.2 * capacidade + 0.1 * nivel, 0, 100),
    inferida: !conhecida,
  };
}

// ─── Braço ────────────────────────────────────────────────────────────────────────────────────────

const AREA = { cotovelo: 75, ombro: 65, punho: 60 } as const;
const INTENSIDADE = { leve: 0.55, moderada: 0.8, forte: 1 } as const;

/**
 * `computeArmSensitivity`, com a recência reduzida às duas respostas que o questionário faz aqui.
 * "Já passou" vale 0,6: é o meio entre "últimos meses" (0,8) e "ano passado" (0,5) de lá.
 */
export function sensibilidadeBraco(a: Respostas): number {
  if (a.dor_areas.length === 0) return 0;
  const valores = a.dor_areas.map((x) => AREA[x]);
  const base = Math.min(95, Math.max(...valores) + (valores.length > 1 ? 10 : 0));
  const recencia = a.dor_quando === 'ja_passou' ? 0.6 : 1;
  const intensidade = a.dor_intensidade === null ? 1 : INTENSIDADE[a.dor_intensidade];
  return clamp(base * recencia * intensidade, 0, 95);
}

// ─── Os alvos ─────────────────────────────────────────────────────────────────────────────────────

/** 1º, 2º e 3º pedidos, na proporção +25 / +15 / +8 do vetor de necessidades de tênis. */
const PESO_DA_ORDEM = [15, 9, 5] as const;

/** O que cada pedido move, e para que lado: −1 puxa para macia/leve, +1 para firme/pesada. */
const DIRECAO_DO_PEDIDO: Record<Falta, { resposta: number; inercia: number }> = {
  potencia: { resposta: -1, inercia: 0 },
  controle: { resposta: 1, inercia: 0 },
  conforto: { resposta: -1, inercia: 0 },
  reacao_rede: { resposta: 0, inercia: -1 },
  peso_de_bola: { resposta: 0, inercia: 1 },
};

/**
 * O teto de firmeza por dor.
 *
 * Abaixo de 40 de sensibilidade não há teto: é dor leve e antiga, e a preferência por macia já
 * entra no alvo. Acima, o teto desce com a sensibilidade — cotovelo forte e atual (75) deixa até a
 * posição 40 do catálogo.
 *
 * ═══ A DOR NÃO MEXE NO TETO DE INÉRCIA — E ISSO É MEDIDO, NÃO ESQUECIDO ═══════════════════════
 *
 * O Tennis Engineer implementou "dor baixa o teto de peso" e retirou. A invariante "mais dor nunca
 * eleva um quadro mais rígido" quebrou: massa absorve choque, os quadros amigáveis ao braço eram os
 * mais pesados, e baixar o teto de quem tem dor no cotovelo removia justamente os que protegiam o
 * cotovelo. O que machuca é o choque e a rigidez, e isso aqui é o eixo de resposta.
 */
function tetoDeResposta(sensibilidade: number): number {
  return sensibilidade < 40 ? 100 : clamp(100 - 0.8 * sensibilidade, 20, 100);
}

/**
 * O teto de inércia pela capacidade física.
 *
 * Calibrado contra as posições reais do catálogo (percentis 5–95 da inércia). As duas raquetes
 * além do topo da escala são a Mormaii Kicks (122) e a Quicksand Kombat (160). Resultado:
 *
 *     capacidade 43 (1,60 m / 55 kg, força abaixo) → teto 96: saem Kicks e Kombat
 *     capacidade 62 (adulto médio)                  → teto 121: saem Kicks (122, por um ponto) e Kombat
 *     capacidade 92 (forte, atlético, grande)       → teto 160: nada sai
 *
 * O teto não fecha nenhuma das duas para todo mundo — "todo produto precisa ser a resposta de
 * alguém" (`6b55fef` no tênis). Mas, medido em 3.000 perfis, NENHUMA das duas chega a um pódio, e
 * o motivo não é o teto, é o alvo. A Kicks é macia, de iniciante e a mais pesada do catálogo: quem
 * aguenta o peso não pede uma raquete de iniciante. A Kombat tem balanço de 275–284 mm, 15 mm além
 * de qualquer outra, e nenhum jogo que o questionário descreve pede tanto. Fica registrado para a
 * varredura do catálogo, e não forçado aqui.
 *
 * O piso de 60 mantém a maior parte do catálogo de pé para o menor corpo possível. Um teto que o
 * motor não consegue honrar é pior que um teto mais frouxo — foi a lição do `CEILING_FLOOR_G` no
 * tênis, onde a válvula que protegia o ranking desligava o teto justamente de quem mais precisava.
 *
 * Menores de 16: no máximo 70, independente do porte. A reta lê o corpo de hoje e não lê o osso.
 */
function tetoDeInercia(capacidade: number, idade: number): number {
  const teto = clamp(40 + 1.3 * capacidade, 60, 200);
  return idade < 16 ? Math.min(teto, 70) : teto;
}

export function montarPerfil(a: Respostas): Perfil {
  const ajustes: string[] = [];
  const nivel = nivelCalibrado(a);
  const capacidade = capacidadeFisica(a);
  const potencia = potenciaNatural(a, nivel, capacidade);
  const sensibilidade = sensibilidadeBraco(a);

  /*
    Resposta: quem põe muita potência na bola precisa de face que segure; quem põe pouca, de face
    que empurre. EVA macio em batida forte vira trampolim e a bola voa.
  */
  let resposta = potencia.valor;
  /*
    Inércia: o jogo diz quanto quer mover; o corpo diz até onde pode, e isso é o TETO.

    A primeira versão punha a capacidade física no alvo, com peso 0,55. O ex-tenista forte de
    `tests/motor/podio.test.ts` ia a alvo 96, e as raquetes certas para ele saíam com nota 48 a 52.
    É o erro que o tênis já tinha nomeado: o limite existe para proteger quem tem pouco corpo, não
    para dizer a quem tem muito que precisa de mais peso. A capacidade fica com 0,10 — quem aguenta
    mais aproveita um pouco mais —, e o resto é potência e nível, centrados no meio do catálogo.
  */
  let inercia =
    50 + 0.35 * (potencia.valor - 50) + 0.15 * (nivel - 50) + 0.1 * (capacidade - 50);

  const ajustar = (eixo: 'resposta' | 'inercia', delta: number, motivo: string) => {
    if (delta === 0) return;
    if (eixo === 'resposta') resposta += delta;
    else inercia += delta;
    ajustes.push(`${eixo} ${delta > 0 ? '+' : ''}${delta}: ${motivo}`);
  };

  for (const b of a.bolas) {
    if (b === 'passam_fundo') ajustar('resposta', 12, 'as bolas passam do fundo');
    if (b === 'curtas') ajustar('resposta', -12, 'as bolas caem curtas');
    if (b === 'rede') ajustar('resposta', -6, 'as bolas vão na rede');
    if (b === 'sem_direcao') ajustar('resposta', -5, 'as bolas saem sem direção — pede tolerância');
  }

  if (a.papel === 'ataco') {
    ajustar('inercia', 10, 'ataca e finaliza — smash pede peso de bola');
    ajustar('resposta', 4, 'ataca e finaliza — bola forte pede face que segure');
  }
  if (a.papel === 'defendo') {
    ajustar('inercia', 4, 'defende — segurar bola forte pede estabilidade');
    ajustar('resposta', -4, 'defende — devolver sem força pede saída de bola');
  }
  if (a.papel === 'rede') {
    ajustar('inercia', -10, 'joga na rede — reação pede raquete leve na mão');
    ajustar('resposta', 4, 'joga na rede — voleio pede precisão');
  }
  if (a.papel === 'construo') ajustar('resposta', 6, 'constrói e coloca — pede controle');

  if (a.sensacao_rede === 'lenta') ajustar('inercia', -10, 'sente a raquete lenta na rede');
  if (a.sensacao_rede === 'leve_demais') ajustar('inercia', 10, 'sente a raquete leve demais na rede');

  a.falta.slice(0, 3).forEach((pedido, i) => {
    const peso = PESO_DA_ORDEM[i]!;
    const d = DIRECAO_DO_PEDIDO[pedido];
    ajustar('resposta', d.resposta * peso, `${i + 1}º pedido: ${pedido}`);
    ajustar('inercia', d.inercia * peso, `${i + 1}º pedido: ${pedido}`);
  });

  if (a.objetivo === 'mais_facil') {
    ajustar('resposta', -8, 'quer algo mais fácil');
    ajustar('inercia', -6, 'quer algo mais fácil');
  }
  if (a.objetivo === 'evoluir') ajustar('resposta', 8, 'quer evoluir para algo mais exigente');

  for (const q of a.nao_gosta) {
    if (q === 'pesada') ajustar('inercia', -12, 'acha a atual pesada');
    if (q === 'leve') ajustar('inercia', 12, 'acha a atual leve');
    if (q === 'lenta_na_rede') ajustar('inercia', -8, 'acha a atual lenta na rede');
    if (q === 'dura' || q === 'vibra') ajustar('resposta', -12, `acha a atual ${q === 'dura' ? 'dura' : 'vibrando'}`);
    if (q === 'sem_controle') ajustar('resposta', 12, 'sente falta de controle na atual');
  }

  if (sensibilidade > 0) {
    ajustar('resposta', -Math.round(0.3 * sensibilidade), 'dor no braço — face mais macia');
  }

  return {
    nivel,
    nivel_fabricante: 1 + (3 * nivel) / 100,
    iniciante: nivel < 35,
    capacidade,
    potencia_natural: potencia.valor,
    potencia_inferida: potencia.inferida,
    sensibilidade_braco: sensibilidade,
    alvo: { resposta: clamp(resposta, 0, 100), inercia: clamp(inercia, 0, 100) },
    teto: { resposta: tetoDeResposta(sensibilidade), inercia: tetoDeInercia(capacidade, a.idade) },
    primeira_prioridade: a.falta[0] ?? null,
    faixa: a.faixa,
    ajustes,
  };
}
