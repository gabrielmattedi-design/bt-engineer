/**
 * O motor — docs/PROPOSTA_MOTOR_BT.md §4 e §5.
 *
 * Ordem, e por que é esta:
 *
 *   1. faixa de preço        piso e teto; é o que a pessoa disse que quer gastar
 *   2. segurança             teto físico, teto de firmeza por dor, profissional para iniciante
 *      └─ faixa sem 3 seguras → desce UM degrau (§4.5)
 *   3. premissa              o 1º pedido não recebe raquete do lado errado da média
 *   4. nota                  distância ao alvo, nível do fabricante, transição
 *   5. pódio                 3 modelos, ≤ 2 por marca, gêmeas colapsadas
 *
 * A segurança vem antes da nota porque ela exclui, não desconta: uma raquete que machuca não pode
 * ganhar o pódio por ser boa em todo o resto.
 */

import { escalaDo, inercia, posicao, resposta, type Escala, type Raquete } from './catalogo';
import type { Faixa } from './faixas';
import { montarPerfil, type Perfil, type Respostas } from './jogador';

export const MOTOR_VERSAO = '0.1.0';

/** Diferença de nota abaixo da qual duas raquetes estão em empate técnico. A mesma do tênis. */
export const EMPATE_TECNICO = 2;
export const MAX_POR_MARCA = 2;
const TAMANHO_DO_PODIO = 3;

/**
 * Inércia acima do alvo custa 1,4; abaixo, 0,8.
 *
 * É a assimetria do `physical_fit` de tênis: passar do que o braço move produz atraso e sobrecarga,
 * ficar abaixo produz só perda de peso de bola. Errar para o lado leve é jogável; para o pesado,
 * não.
 */
const CUSTO_INERCIA_ACIMA = 1.4;
const CUSTO_INERCIA_ABAIXO = 0.8;
const PONTOS_POR_DISTANCIA = 1.2;
/** Por degrau de fabricante além de meio degrau de folga. */
const PENALIDADE_NIVEL = 8;
/**
 * A troca é suave até 15 pontos de distância no mapa; a partir daí custa 0,3 por ponto, e NUNCA
 * mais de 10 no total.
 *
 * Sem o limite, a varredura achou 1ªs colocadas com nota −44: a raquete atual da pessoa estava
 * longe do alvo, e o motor punia em até 82 pontos justamente o movimento de sair dela. A transição
 * existe para suavizar uma troca, e no tênis ela pesava 0,06 e "nunca deve impedir a raquete
 * correta". Quando a atual fere a segurança, a penalidade é zero: ali a troca não é opção.
 */
const ZONA_MORTA_TRANSICAO = 15;
const CUSTO_TRANSICAO = 0.3;
const TETO_TRANSICAO = 10;

/**
 * Abaixo disto a 1ª colocada é um encaixe fraco, e o relatório precisa dizer isso.
 *
 * No tênis, a varredura achou 83 perfis com a 1ª abaixo do mínimo e nenhuma linha dizendo isso: a
 * constante existia e só um teste a consultava. Aqui ela sai no resultado. O valor é provisório,
 * medido na varredura de `tests/motor/varredura.test.ts`, e vai ser revisto com o relatório na tela.
 */
export const NOTA_MINIMA_DE_ENCAIXE = 50;

export type Exclusao =
  | 'fora_da_faixa'
  | 'sem_preco'
  | 'acima_do_teto_fisico'
  | 'firme_demais_para_a_dor'
  | 'profissional_para_iniciante'
  | 'premissa_do_primeiro_pedido';

export type Avaliada = {
  readonly raquete: Raquete;
  /** Posição no mapa, na escala do catálogo. */
  readonly ponto: { readonly resposta: number; readonly inercia: number };
  readonly nota: number;
  readonly termos: {
    readonly distancia: number;
    readonly penalidade_nivel: number;
    readonly penalidade_transicao: number;
  };
};

export type Veredicto =
  | { readonly tipo: 'sem_raquete' }
  | {
      readonly tipo: 'fique' | 'troque' | 'troque_ja';
      readonly aproximada: boolean;
      readonly avaliada: Omit<Avaliada, 'raquete'> & { readonly raquete: Raquete | null };
      /** Por que "troque já" — o filtro de segurança que a atual fere. */
      readonly motivo: Exclusao | null;
    };

export type Resultado = {
  readonly versao: string;
  readonly perfil: Perfil;
  readonly podio: readonly Avaliada[];
  /** Gêmeas de especificação que ficaram de fora porque a irmã entrou: id da que entrou → ids. */
  readonly gemeas: Readonly<Record<string, readonly string[]>>;
  readonly empate_no_topo: boolean;
  /** A faixa de onde o pódio saiu. Difere da pedida só quando desceu um degrau por segurança. */
  readonly faixa_usada: Faixa;
  readonly desceu_de_faixa: boolean;
  /** O pódio veio com menos de três e o relatório precisa dizer por quê. */
  readonly podio_incompleto: boolean;
  /** A 1ª colocada ficou abaixo de `NOTA_MINIMA_DE_ENCAIXE` — o relatório diz, em vez de vender. */
  readonly encaixe_fraco: boolean;
  readonly premissa_aplicada: boolean;
  readonly veredicto: Veredicto;
  readonly excluidas: Readonly<Record<string, Exclusao>>;
  readonly escala: Escala;
};

function ponto(r: { resposta: number; inercia: number }, e: Escala) {
  return { resposta: posicao(r.resposta, e.resposta), inercia: posicao(r.inercia, e.inercia) };
}

function motivoDeSeguranca(p: { resposta: number; inercia: number }, r: Raquete | null, perfil: Perfil): Exclusao | null {
  // A dor primeiro: para quem tem, é o motivo que importa dizer.
  if (p.resposta > perfil.teto.resposta) return 'firme_demais_para_a_dor';
  if (p.inercia > perfil.teto.inercia) return 'acima_do_teto_fisico';
  if (r && perfil.iniciante && r.nivel_fabricante >= 4) return 'profissional_para_iniciante';
  return null;
}

/**
 * A premissa do 1º pedido — `bc2d3ee` no tênis.
 *
 * Quem pede controle em 1º lugar não recebe raquete do lado macio da média do catálogo; quem pede
 * reação na rede não recebe uma do lado pesado. Sem isso, a nota — que mede distância a um alvo
 * que mistura tudo o que a pessoa respondeu — pode entregar ao primeiro pedido exatamente o
 * contrário do que foi pedido, e o relatório não teria como explicar.
 */
function feremAPremissa(p: { resposta: number; inercia: number }, perfil: Perfil, e: Escala): boolean {
  switch (perfil.primeira_prioridade) {
    case 'controle':
      return p.resposta < e.mediaResposta;
    case 'potencia':
    case 'conforto':
      return p.resposta > e.mediaResposta;
    case 'reacao_rede':
      return p.inercia > e.mediaInercia;
    case 'peso_de_bola':
      return p.inercia < e.mediaInercia;
    default:
      return false;
  }
}

function avaliar(
  r: Pick<Raquete, 'resposta' | 'inercia' | 'nivel_fabricante'>,
  perfil: Perfil,
  e: Escala,
  atual: { resposta: number; inercia: number } | null,
  pesoTransicao: number,
): Omit<Avaliada, 'raquete'> {
  const p = ponto(r, e);
  const dr = p.resposta - perfil.alvo.resposta;
  const di = p.inercia - perfil.alvo.inercia;
  const distancia = Math.hypot(dr, di * (di > 0 ? CUSTO_INERCIA_ACIMA : CUSTO_INERCIA_ABAIXO));
  const penalidade_nivel =
    Math.max(0, Math.abs(r.nivel_fabricante - perfil.nivel_fabricante) - 0.5) * PENALIDADE_NIVEL;
  const penalidade_transicao =
    atual === null
      ? 0
      : Math.min(
          TETO_TRANSICAO * pesoTransicao,
          Math.max(0, Math.hypot(p.resposta - atual.resposta, p.inercia - atual.inercia) - ZONA_MORTA_TRANSICAO) *
            CUSTO_TRANSICAO *
            pesoTransicao,
        );
  return {
    ponto: p,
    // Entre 0 e 100: é lida como porcentagem de encaixe, e "−44%" não significa nada para ninguém.
    nota: Math.max(0, 100 - PONTOS_POR_DISTANCIA * distancia - penalidade_nivel - penalidade_transicao),
    termos: { distancia, penalidade_nivel, penalidade_transicao },
  };
}

/**
 * A raquete atual como ponto no mapa.
 *
 * Do catálogo, entra com as specs. Descrita, entra pelo que a pessoa sabe e o resto é a média do
 * catálogo — e o veredicto diz que é aproximado. A sensação da face vira EVA (macia = soft, média =
 * medium, dura = hard) e o material vira face (vidro, ou carbono 3K, o mais comum do catálogo).
 * Sem nenhuma das três informações, não há ponto: inventar uma raquete inteira para poder dar
 * veredicto seria dar um veredicto sobre uma raquete que não existe.
 */
function raqueteAtual(
  a: Respostas,
  catalogo: readonly Raquete[],
): { raquete: Raquete | null; eixos: { resposta: number; inercia: number; nivel_fabricante: number }; aproximada: boolean } | null {
  const atual = a.raquete_atual;
  if (atual.tipo === 'nenhuma') return null;
  if (atual.tipo === 'catalogo') {
    const r = catalogo.find((x) => x.id === atual.id);
    return r ? { raquete: r, eixos: r, aproximada: false } : null;
  }
  if (atual.peso_g === null && atual.face === null && atual.material === null) return null;

  const m = (f: (r: Raquete) => number) => catalogo.reduce((s, r) => s + f(r), 0) / catalogo.length;
  const eva = atual.face === 'macia' ? 0.3 : atual.face === 'media' ? 0.55 : atual.face === 'dura' ? 0.85 : m((r) => r.eva);
  const face = atual.material === 'vidro' ? 0.1 : atual.material === 'carbono' ? 0.45 : m((r) => r.face);
  const peso = atual.peso_g ?? m((r) => r.peso_g);
  return {
    raquete: null,
    eixos: {
      resposta: resposta(eva, face, m((r) => r.espessura_mm)),
      inercia: inercia(peso, m((r) => r.balanco_mm)),
      nivel_fabricante: m((r) => r.nivel_fabricante),
    },
    aproximada: true,
  };
}

/** Mesma especificação no mapa: não há o que as distinga para a pessoa. */
const mesmaEspecificacao = (a: Raquete, b: Raquete): boolean =>
  a.resposta === b.resposta && a.inercia === b.inercia && a.nivel_fabricante === b.nivel_fabricante;

/** Três modelos, no máximo dois por marca, gêmeas de especificação colapsadas na melhor. */
function montarPodio(avaliadas: readonly Avaliada[]): {
  podio: Avaliada[];
  gemeas: Record<string, string[]>;
} {
  const podio: Avaliada[] = [];
  const gemeas: Record<string, string[]> = {};
  const porMarca = new Map<string, number>();
  for (const av of avaliadas) {
    const irma = podio.find((p) => mesmaEspecificacao(p.raquete, av.raquete));
    if (irma) {
      (gemeas[irma.raquete.id] ??= []).push(av.raquete.id);
      continue;
    }
    if (podio.length === TAMANHO_DO_PODIO) continue;
    if ((porMarca.get(av.raquete.marca) ?? 0) >= MAX_POR_MARCA) continue;
    podio.push(av);
    porMarca.set(av.raquete.marca, (porMarca.get(av.raquete.marca) ?? 0) + 1);
  }
  return { podio, gemeas };
}

export function recomendar(respostas: Respostas, catalogo: readonly Raquete[]): Resultado {
  const perfil = montarPerfil(respostas);
  const escala = escalaDo(catalogo);
  const atual = raqueteAtual(respostas, catalogo);
  const pontoAtual = atual ? ponto(atual.eixos, escala) : null;
  const atualInsegura = pontoAtual !== null && motivoDeSeguranca(pontoAtual, atual!.raquete, perfil) !== null;
  const pesoTransicao = atualInsegura ? 0 : respostas.objetivo === 'potencializar' ? 2 : 1;
  const excluidas: Record<string, Exclusao> = {};

  const seguras = (faixa: Faixa): Raquete[] =>
    catalogo.filter((r) => {
      if (r.faixa === null) return false;
      if (r.faixa !== faixa) return false;
      return motivoDeSeguranca(ponto(r, escala), r, perfil) === null;
    });

  // 1–2. faixa e segurança, com a descida de um degrau
  let candidatas = seguras(perfil.faixa);
  let faixa_usada: Faixa = perfil.faixa;
  if (candidatas.length < TAMANHO_DO_PODIO && perfil.faixa > 1) {
    faixa_usada = (perfil.faixa - 1) as Faixa;
    candidatas = [...candidatas, ...seguras(faixa_usada)];
  }
  const permitidas = new Set([perfil.faixa, faixa_usada]);
  for (const r of catalogo) {
    if (r.preco_brl === null) excluidas[r.id] = 'sem_preco';
    else if (!permitidas.has(r.faixa!)) excluidas[r.id] = 'fora_da_faixa';
    else {
      const m = motivoDeSeguranca(ponto(r, escala), r, perfil);
      if (m) excluidas[r.id] = m;
    }
  }

  const nota = (rs: readonly Raquete[]): Avaliada[] =>
    rs
      .map((r) => ({ raquete: r, ...avaliar(r, perfil, escala, pontoAtual, pesoTransicao) }))
      .sort(
        (x, y) =>
          y.nota - x.nota ||
          x.termos.distancia - y.termos.distancia ||
          x.raquete.id.localeCompare(y.raquete.id),
      );

  /*
    3. premissa, e ela só vale se o pódio MONTADO com ela tiver três raquetes.

    A primeira versão conferia só se sobravam três candidatas. A varredura achou 60 pódios de duas
    na faixa 1: a premissa deixava três, duas delas da Total, e o limite de duas por marca derrubava
    a terceira. A premissa protege o 1º pedido; ela não pode custar a terceira raquete do pódio.

    4. nota. Na descida de faixa a ordem é pela nota, e não "as da faixa pedida primeiro". A primeira
    versão punha as da faixa pedida na frente, e o atacante avançado com dor no ombro que pediu a
    faixa 3 recebia a AMA Athena em 1º com nota 30, à frente de raquetes da faixa 2 com nota 62. "As
    mais caras que servem ao seu jogo" exige que sirvam.
  */
  const semFerir = candidatas.filter((r) => !feremAPremissa(ponto(r, escala), perfil, escala));
  let montado = montarPodio(nota(candidatas));
  let premissa_aplicada = false;
  if (semFerir.length < candidatas.length) {
    const comPremissa = montarPodio(nota(semFerir));
    if (comPremissa.podio.length === TAMANHO_DO_PODIO) {
      montado = comPremissa;
      premissa_aplicada = true;
      for (const r of candidatas) if (!semFerir.includes(r)) excluidas[r.id] = 'premissa_do_primeiro_pedido';
    }
  }
  const { podio, gemeas } = montado;

  // veredicto sobre a atual — nos dois produtos (§1.1)
  let veredicto: Veredicto = { tipo: 'sem_raquete' };
  if (atual && pontoAtual) {
    const av = avaliar(atual.eixos, perfil, escala, null, 0);
    const motivo = motivoDeSeguranca(av.ponto, atual.raquete, perfil);
    const lider = podio[0];
    const tipo =
      motivo !== null
        ? 'troque_ja'
        : !lider || lider.raquete.id === atual.raquete?.id || av.nota >= lider.nota - EMPATE_TECNICO
          ? 'fique'
          : 'troque';
    veredicto = { tipo, aproximada: atual.aproximada, avaliada: { ...av, raquete: atual.raquete }, motivo };
  }

  return {
    versao: MOTOR_VERSAO,
    perfil,
    podio,
    gemeas,
    empate_no_topo: podio.length > 1 && podio[0]!.nota - podio[1]!.nota < EMPATE_TECNICO,
    faixa_usada,
    desceu_de_faixa: faixa_usada !== perfil.faixa,
    podio_incompleto: podio.length < TAMANHO_DO_PODIO,
    encaixe_fraco: podio.length === 0 || podio[0]!.nota < NOTA_MINIMA_DE_ENCAIXE,
    premissa_aplicada,
    veredicto,
    excluidas,
    escala,
  };
}
