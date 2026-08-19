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
 * ─── POR QUE COM VARIÁVEL DE AMBIENTE, E COM PADRÃO ──────────────────────────────────────────
 *
 * O padrão é o domínio de produção, para que rodar local ou num preview não exija configurar nada e
 * o card saia igual ao que o cliente veria. A variável existe para o caso legítimo de um segundo
 * ambiente com endereço próprio — e é `NEXT_PUBLIC_` porque o card é renderizado no cliente.
 */

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tennisengineer.com.br';

/** Só o host, sem protocolo — a forma que se escreve num rodapé ou se lê em voz alta. */
export const SITE_DOMAIN = SITE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
