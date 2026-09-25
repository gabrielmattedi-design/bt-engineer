/**
 * O motor — docs/PROPOSTA_MOTOR_BT.md §4, §5 e §8.
 *
 * Ordem, e por que é esta:
 *
 *   1. segurança      teto físico, teto de firmeza por dor, profissional para iniciante — EXCLUI
 *   2. preço          acima da faixa pedida, ou dois degraus abaixo — EXCLUI
 *   3. nota           distância ao alvo, e PESOS: nível do fabricante, transição, faixa vizinha,
 *                     1º pedido contrariado
 *   4. pódio          3 modelos, ≤ 2 por marca, gêmeas colapsadas
 *
 * ═══ POR QUE A MAIOR PARTE DAS TRAVAS VIROU PESO (25/09/2026) ══════════════════════════════════
 *
 * Decisão do dono, depois de testar na bancada: "como tem número estreito de raquetes por preço,
 * as travas precisam ser mais sutis, mais peso e menos cancelamento".
 *
 * O caso que decidiu: ex-tenista intermediário, faixa 2, controle como 1º pedido. A faixa tem só
 * duas raquetes firmes. A premissa, que era tudo-ou-nada, não fechava três e se desligava inteira,
 * e a 3ª vaga ia para a menos pior de todas — uma raquete macia com encaixe 10, o contrário do que
 * ele pediu. Com 10 a 12 raquetes por faixa, qualquer trava que cancela esvazia o que sobra, e o
 * que sobra é o que ninguém escolheria.
 *
 * Como peso, a premissa e a faixa vizinha competem com o resto: pesam o bastante para decidir
 * entre duas raquetes parecidas, e não o bastante para empurrar uma que não serve.
 *
 * ─── O QUE CONTINUA EXCLUINDO, E POR QUÊ ────────────────────────────────────────────────────────
 *
 * Segurança. Uma raquete que machuca não pode ganhar o pódio por ser boa em todo o resto, e peso é
 * justamente o que permite isso. É a regra do tênis: "pedido declarado não sobrepõe limitação
 * física real".
 *
 * E o teto de preço. Recomendar acima do que a pessoa disse que quer gastar é recomendar nada. O
 * piso virou peso só até UM degrau abaixo: quem escolheu a faixa 3 nunca recebe uma raquete da 1
 * (a decisão do "sem limite não recebe raquete de R$ 800" continua de pé).
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

/**
 * Uma raquete um degrau abaixo da faixa pedida perde 15 pontos.
 *
 * Relevante: ela só passa na frente de uma raquete da faixa pedida que encaixa pelo menos 15 pontos
 * pior. É o caso da 3ª vaga com encaixe 10 — uma raquete de R$ 1.300 com encaixe 70 vale mais para
 * essa pessoa do que uma de R$ 1.800 que não serve. E não anula: entre duas raquetes parecidas, a
 * da faixa que ela escolheu ganha sempre.
 */
export const PENALIDADE_FAIXA_VIZINHA = 15;

/**
 * O 1º pedido contrariado: 0,6 por ponto do lado errado da média do catálogo, no máximo 20.
 *
 * Era exclusão (`bc2d3ee` no tênis), e aqui virou peso pelo motivo do cabeçalho. O teto de 20 é o
 * que mantém o pedido "relevante, sem anular": uma raquete no extremo oposto do que foi pedido
 * perde 20 pontos, que é o que separa uma recomendação boa de uma fraca, mas não é o bastante para
 * tirar do pódio a única que serve em todo o resto.
 */
const PENALIDADE_PREMISSA_POR_PONTO = 0.6;
const TETO_PENALIDADE_PREMISSA = 20;

export type Exclusao =
  | 'fora_da_faixa'
  | 'sem_preco'
  | 'acima_do_teto_fisico'
  | 'firme_demais_para_a_dor'
  | 'profissional_para_iniciante';

export type Avaliada = {
  readonly raquete: Raquete;
  /** Posição no mapa, na escala do catálogo. */
  readonly ponto: { readonly resposta: number; readonly inercia: number };
  readonly nota: number;
  readonly termos: {
    readonly distancia: number;
    readonly penalidade_nivel: number;
    readonly penalidade_transicao: number;
    readonly penalidade_faixa: number;
    readonly penalidade_premissa: number;
  };
  /** Veio de um degrau abaixo da faixa pedida — o relatório diz, e diz por quê. */
  readonly faixa_vizinha: boolean;
  /** Fica do lado contrário da média no eixo do 1º pedido. */
  readonly contraria_o_pedido: boolean;
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
  /**
   * Todas as candidatas que passaram pela segurança e pelo preço, em ordem de nota. É a auditoria:
   * o admin vê por que uma raquete NÃO entrou, com os termos de cada uma — o que o tênis guarda em
   * `racket_rankings.breakdown` pela mesma razão.
   */
  readonly ranking: readonly Avaliada[];
  /** Gêmeas de especificação que ficaram de fora porque a irmã entrou: id da que entrou → ids. */
  readonly gemeas: Readonly<Record<string, readonly string[]>>;
  readonly empate_no_topo: boolean;
  /** Alguma raquete do pódio veio de um degrau abaixo da faixa pedida. */
  readonly desceu_de_faixa: boolean;
  /** O pódio veio com menos de três e o relatório precisa dizer por quê. */
  readonly podio_incompleto: boolean;
  /** A 1ª colocada ficou abaixo de `NOTA_MINIMA_DE_ENCAIXE` — o relatório diz, em vez de vender. */
  readonly encaixe_fraco: boolean;
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
 * O quanto a raquete contraria o 1º pedido — a premissa de `bc2d3ee` no tênis, agora como peso.
 *
 * Quem pede controle em 1º lugar não deveria receber raquete do lado macio da média do catálogo;
 * quem pede reação na rede, uma do lado pesado. Sem isso, a nota — que mede distância a um alvo que
 * mistura tudo o que a pessoa respondeu — pode entregar ao primeiro pedido exatamente o contrário
 * do que foi pedido. Devolve quantos pontos do lado errado da média a raquete está.
 */
function contraOPedido(p: { resposta: number; inercia: number }, perfil: Perfil, e: Escala): number {
  switch (perfil.primeira_prioridade) {
    case 'controle':
      return Math.max(0, e.mediaResposta - p.resposta);
    case 'potencia':
    case 'conforto':
      return Math.max(0, p.resposta - e.mediaResposta);
    case 'reacao_rede':
      return Math.max(0, p.inercia - e.mediaInercia);
    case 'peso_de_bola':
      return Math.max(0, e.mediaInercia - p.inercia);
    default:
      return 0;
  }
}

function avaliar(
  r: Pick<Raquete, 'resposta' | 'inercia' | 'nivel_fabricante'> & { faixa: Faixa | null },
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
  const faixa_vizinha = r.faixa !== null && r.faixa < perfil.faixa;
  const penalidade_faixa = faixa_vizinha ? PENALIDADE_FAIXA_VIZINHA : 0;
  const contra = contraOPedido(p, perfil, e);
  const penalidade_premissa = Math.min(TETO_PENALIDADE_PREMISSA, contra * PENALIDADE_PREMISSA_POR_PONTO);
  return {
    ponto: p,
    // Entre 0 e 100: é lida como porcentagem de encaixe, e "−44%" não significa nada para ninguém.
    nota: Math.max(
      0,
      100 - PONTOS_POR_DISTANCIA * distancia - penalidade_nivel - penalidade_transicao - penalidade_faixa - penalidade_premissa,
    ),
    termos: { distancia, penalidade_nivel, penalidade_transicao, penalidade_faixa, penalidade_premissa },
    faixa_vizinha,
    contraria_o_pedido: contra > 0,
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

  // 1–2. segurança e preço: as únicas exclusões
  const pisoDePreco = Math.max(1, perfil.faixa - 1);
  const candidatas: Raquete[] = [];
  for (const r of catalogo) {
    const seguranca = motivoDeSeguranca(ponto(r, escala), r, perfil);
    if (r.faixa === null) excluidas[r.id] = 'sem_preco';
    else if (r.faixa > perfil.faixa || r.faixa < pisoDePreco) excluidas[r.id] = 'fora_da_faixa';
    else if (seguranca) excluidas[r.id] = seguranca;
    else candidatas.push(r);
  }

  // 3. nota, com os pesos; desempate por distância e por id, para não depender da ordem da planilha
  const avaliadas: Avaliada[] = candidatas
    .map((r) => ({ raquete: r, ...avaliar(r, perfil, escala, pontoAtual, pesoTransicao) }))
    .sort(
      (x, y) =>
        y.nota - x.nota || x.termos.distancia - y.termos.distancia || x.raquete.id.localeCompare(y.raquete.id),
    );

  // 4. pódio
  const montado = montarPodio(avaliadas);
  const { podio, gemeas } = montado;

  // veredicto sobre a atual — nos dois produtos (§1.1)
  let veredicto: Veredicto = { tipo: 'sem_raquete' };
  if (atual && pontoAtual) {
    // A atual é avaliada sem os pesos de preço: o veredicto é sobre o encaixe, não sobre quanto custou.
    const av = avaliar({ ...atual.eixos, faixa: perfil.faixa }, perfil, escala, null, 0);
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
    ranking: avaliadas,
    gemeas,
    empate_no_topo: podio.length > 1 && podio[0]!.nota - podio[1]!.nota < EMPATE_TECNICO,
    desceu_de_faixa: podio.some((a) => a.faixa_vizinha),
    podio_incompleto: podio.length < TAMANHO_DO_PODIO,
    encaixe_fraco: podio.length === 0 || podio[0]!.nota < NOTA_MINIMA_DE_ENCAIXE,
    veredicto,
    excluidas,
    escala,
  };
}
