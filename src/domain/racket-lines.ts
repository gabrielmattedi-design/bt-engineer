/**
 * Posicionamento declarado de cada LINHA de raquete.
 *
 * ═══ POR QUE ISTO EXISTE ═════════════════════════════════════════════════════════════════════
 *
 * Os atributos de uma raquete saem de seis especificações publicadas. Quando dois produtos
 * publicam as mesmas seis, o motor produz o mesmo vetor — corretamente, porque é o limite honesto
 * do que aqueles dados permitem afirmar. É o caso da Babolat Pure Drive e da Pure Aero neste
 * catálogo: 300 g, balanço 320 mm, cabeça 100 pol², padrão 16×19, viga 23/26/23. Idênticas, campo
 * a campo.
 *
 * E o relatório dizia, em cima disso: "tecnicamente idêntica à 3ª (Babolat Pure Aero): mesmas
 * especificações publicadas, mesmo resultado na análise. Escolha por preço, disponibilidade ou
 * preferência de marca."
 *
 * As duas primeiras metades são verdadeiras. A terceira era um absurdo — as duas são Babolat, então
 * "preferência de marca" não separa nada —, e o conselho inteiro contraria o que qualquer pessoa
 * que joga sabe: Pure Drive e Pure Aero não são a mesma raquete. Uma é a linha de potência da
 * marca; a outra é a linha de spin. Apontado assim: "por mais que elas tenham as características
 * técnicas iguais, a gente sabe que não é".
 *
 * ═══ O QUE ESTA TABELA É, E O QUE ELA NÃO É ══════════════════════════════════════════════════
 *
 * ELA É o posicionamento que o próprio fabricante dá à linha — informação pública, estável e não
 * numérica. "Pure Aero é a linha de spin" está no material da Babolat há mais de uma década.
 *
 * ELA NÃO É uma especificação. Não tem unidade, não entra em nenhuma média, não altera nenhum
 * score e não muda o `fit_score` de ninguém. Inventar uma largura de viga ou um índice de rigidez
 * para "separar" as duas seria fabricar dado — exatamente o que §69 proíbe, e o motivo pelo qual a
 * saída não foi mexer nos números.
 *
 * ═══ ONDE ELA AGE ════════════════════════════════════════════════════════════════════════════
 *
 * Em dois lugares, os dois estreitos:
 *
 *   1. DESEMPATE, e só entre raquetes com `fit_score` EXATAMENTE igual. Quando o jogador pediu spin
 *      em primeiro lugar e o empate é entre a linha de spin e a linha de potência, a de spin vem na
 *      frente. Antes disso decidia uma função de hash do perfil — determinística e arbitrária, o
 *      que era o melhor possível enquanto não havia critério nenhum. Agora há um, para alguns pares.
 *
 *   2. O TEXTO do card, que passa a dizer o que de fato separa as duas em vez de mandar escolher
 *      por marca.
 *
 * ═══ POR QUE NEM TODA LINHA ESTÁ AQUI ════════════════════════════════════════════════════════
 *
 * Porque nem toda linha tem posicionamento inequívoco. HEAD Speed, HEAD Radical e HEAD Boom são
 * linhas declaradamente all-round: dizer que uma delas "é a de controle" seria inventar uma
 * convicção que o fabricante não tem. Elas ficam de fora, e o comportamento para elas continua
 * exatamente o que era — o desempate por perfil.
 *
 * A tabela silenciosa é a resposta certa para o caso duvidoso. Uma orientação errada aqui é pior
 * que orientação nenhuma: ela ordenaria com falsa confiança.
 */

import type { NeedKey } from './player-profile';

/**
 * Chave: o nome da LINHA (`variant.family`), que é único no catálogo.
 *
 * O valor é o eixo em torno do qual a linha é construída, no mesmo vocabulário das necessidades do
 * jogador — é isso que permite comparar diretamente com o que ele declarou querer.
 */
export const LINE_ORIENTATION: Readonly<Record<string, NeedKey>> = {
  // ── Babolat ──────────────────────────────────────────────────────────────────────────────
  'Pure Drive': 'power',
  'Pure Aero': 'spin',
  'Pure Strike': 'control',

  // ── Wilson ───────────────────────────────────────────────────────────────────────────────
  Blade: 'control',
  /* A Clash é vendida pela flexibilidade do quadro — é o argumento inteiro da linha. */
  Clash: 'comfort',
  Ultra: 'power',
  'Pro Staff': 'control',
  RF: 'control',
  Shift: 'spin',

  // ── Yonex ────────────────────────────────────────────────────────────────────────────────
  EZONE: 'power',
  VCORE: 'spin',
  /* Sucessora da VCORE Pro: a linha de toque e controle da marca. */
  Percept: 'control',

  // ── HEAD ─────────────────────────────────────────────────────────────────────────────────
  Extreme: 'spin',
  Gravity: 'control',
  /*
    Speed, Radical e Boom NÃO entram — ver a nota acima. São linhas all-round por definição do
    fabricante, e atribuir um eixo a elas seria decidir por ele.
  */
};

/** O eixo da linha, ou `null` quando ela não tem posicionamento declarado. */
export function lineOrientation(family: string | null | undefined): NeedKey | null {
  if (!family) return null;
  return LINE_ORIENTATION[family] ?? null;
}

/** Rótulos em português para o texto do relatório. */
export const ORIENTATION_LABEL_PT: Readonly<Record<string, string>> = {
  power: 'potência',
  spin: 'spin',
  control: 'controle',
  comfort: 'conforto',
};
