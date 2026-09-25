/**
 * O endereço público do produto, em UM lugar só.
 *
 * ─── POR QUE ISTO EXISTE ─────────────────────────────────────────────────────────────────────
 *
 * O endereço estava escrito à mão dentro do card de compartilhamento — a imagem que a pessoa posta
 * no Instagram ou manda no grupo do clube. Enquanto o site vivia em `tennis-engineer.vercel.app`
 * isso era verdade; no minuto em que o domínio próprio entrou no ar, virou uma imagem divulgando o
 * endereço errado para todo mundo que a compartilhasse. E era o único lugar do código que sabia o
 * endereço, então nada apontou o erro.
 *
 * Endereço é configuração, não literal de componente.
 *
 * ─── POR QUE SEM PADRÃO ──────────────────────────────────────────────────────────────────────
 *
 * Havia um: o domínio de produção do Tennis Engineer, para que rodar local não exigisse configurar
 * nada. Este repositório é uma cópia daquele produto, e o mesmo padrão aqui faria todo link de
 * acesso, recibo e card compartilhado apontar para o site de OUTRA operação sem erro nenhum — ver
 * `src/lib/ambiente.ts`. Agora a variável é obrigatória, e a ausência dela impede o build.
 *
 * É `NEXT_PUBLIC_` porque o card é renderizado no cliente — e por isso ela aparece escrita por
 * extenso abaixo: o Next só a embute no navegador quando o nome está literal no fonte.
 */

import { exigir } from './ambiente';

export const SITE_URL = exigir('NEXT_PUBLIC_SITE_URL', process.env.NEXT_PUBLIC_SITE_URL);

/** Só o host, sem protocolo — a forma que se escreve num rodapé ou se lê em voz alta. */
export const SITE_DOMAIN = SITE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
