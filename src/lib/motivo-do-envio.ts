/**
 * O motivo de uma compra não ter chegado ao Meta, traduzido e classificado.
 *
 * ═══ POR QUE A CLASSIFICAÇÃO É A PARTE QUE IMPORTA ═══════════════════════════════════════════
 *
 * "Não enviou" tem causas que exigem ações OPOSTAS, e as duas chegam aqui com a mesma cara:
 *
 *   - **Esperado** — quem recusou os cookies não deve mesmo ser enviado. É a nossa regra de
 *     privacidade funcionando. Pintar isso de vermelho ensinaria o dono a tratar a própria decisão
 *     de LGPD como defeito, e o "conserto" seria burlá-la.
 *   - **Incidente** — token errado, Meta recusando, rede caindo. Alguém precisa mexer hoje.
 *
 * Sem a distinção, um painel com dez linhas de "sem_consentimento" parece um sistema quebrado, e
 * um com uma linha de `http_400` no meio delas passa despercebido. É exatamente ao contrário.
 *
 * Vive em `lib/` e não na página porque é regra, e regra se testa.
 */

export type MotivoExplicado = {
  readonly texto: string;
  /** `true` = o sistema fez o que devia. `false` = alguém precisa agir. */
  readonly esperado: boolean;
};

const CONHECIDOS: Record<string, MotivoExplicado> = {
  sem_consentimento: {
    texto: 'Recusou os cookies — não enviamos, por decisão',
    esperado: true,
  },
  sem_identificador: {
    texto: 'Sem identificador do Meta (não veio de anúncio e não tinha o cookie do pixel)',
    esperado: true,
  },
  nao_configurada: {
    texto: 'Token da API não está configurado na Vercel',
    esperado: false,
  },
  sem_valor: {
    texto: 'Valor do pedido ilegível — investigar',
    esperado: false,
  },
  erro_de_rede: {
    texto: 'Meta fora do ar ou tempo esgotado',
    esperado: false,
  },
};

export function explicarMotivo(motivo: string): MotivoExplicado {
  const conhecido = CONHECIDOS[motivo];
  if (conhecido) return conhecido;

  /*
    Os `http_<código>` carregam o código na própria string, então não cabem numa tabela fixa.
    400 e 403 são quase sempre token expirado ou sem a permissão `ads_management` — a causa que
    mais custou tempo neste projeto.
  */
  if (motivo.startsWith('http_')) {
    return {
      texto: `Meta recusou (${motivo.replace('http_', 'HTTP ')}) — token ou permissão`,
      esperado: false,
    };
  }

  /*
    Motivo desconhecido é INCIDENTE, e não o contrário.

    Um motivo novo só aparece aqui quando alguém acrescentou um caminho de falha em `meta-capi.ts`
    e esqueceu desta tabela. Tratar o desconhecido como esperado esconderia justamente a falha que
    ninguém previu — que é a que mais precisa ser vista.
  */
  return { texto: motivo, esperado: false };
}
