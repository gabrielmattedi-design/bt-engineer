/**
 * A janela de tempo do painel — e por que "ontem" não é "as últimas 24 horas".
 *
 * ═══ O PROBLEMA QUE ISTO RESOLVE ═════════════════════════════════════════════════════════════
 *
 * O painel nasceu com janelas ROLANTES: "7 dias" significa as últimas 168 horas a contar de agora.
 * Para ler tendência, serve bem.
 *
 * Para fechar o CAC, não serve de jeito nenhum. O Gerenciador de Anúncios reporta gasto por **dia
 * de calendário**, no fuso da conta. Dividir o gasto de um dia de calendário pelas vendas de uma
 * janela rolante é dividir duas coisas que não se sobrepõem — e o número sai plausível, que é o que
 * o torna perigoso.
 *
 * ═══ POR QUE O FUSO ESTÁ ESCRITO AQUI, E NÃO HERDADO DO SERVIDOR ═════════════════════════════
 *
 * O servidor da Vercel roda em UTC. "Meia-noite" para ele é 21h de Brasília — então "ontem" pegaria
 * das 21h de anteontem às 21h de ontem, perdendo justamente o fim de noite, que é quando este
 * produto mais vende.
 *
 * O fuso da conta de anúncios é o de Brasília, e é ele que define o dia que o Meta reporta. Fixar o
 * mesmo aqui é o que faz os dois números serem comparáveis.
 *
 * O deslocamento é calculado pelo `Intl` a cada chamada, e não fixado em -3: o Brasil já teve
 * horário de verão e pode voltar a ter. Um `-3` escrito à mão funcionaria por anos e erraria por
 * uma hora exatamente na semana em que ninguém lembra do porquê.
 */

const FUSO = 'America/Sao_Paulo';

export type Janela = {
  /** Início inclusivo. `null` = desde sempre. */
  readonly desde: Date | null;
  /** Fim EXCLUSIVO. `null` = até agora. */
  readonly ate: Date | null;
};

/** O mesmo instante, lido como se os números do relógio de `fuso` fossem UTC. */
function comoSeFosseUtc(instante: Date): number {
  const s = new Intl.DateTimeFormat('sv-SE', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(instante);
  return Date.parse(`${s.replace(' ', 'T')}Z`);
}

/**
 * O instante UTC em que começou o dia `diasAtras` no calendário de Brasília.
 *
 * `diasAtras = 0` devolve a meia-noite de hoje; `1`, a de ontem.
 */
export function inicioDoDia(diasAtras: number, agora: Date = new Date()): Date {
  const relogioLocal = new Date(comoSeFosseUtc(agora));
  relogioLocal.setUTCDate(relogioLocal.getUTCDate() - diasAtras);
  relogioLocal.setUTCHours(0, 0, 0, 0);

  /*
    `relogioLocal` carrega os números certos lidos como UTC — precisa voltar para o instante real.

    O deslocamento é medido NO DIA em questão, e não hoje: numa eventual virada de horário de verão,
    o dia de ontem pode ter tido outro deslocamento, e usar o de hoje deslocaria a janela inteira
    em uma hora.
  */
  const palpite = relogioLocal.getTime();
  const deslocamento = comoSeFosseUtc(new Date(palpite)) - palpite;
  return new Date(palpite - deslocamento);
}

/**
 * Traduz o parâmetro da URL numa janela.
 *
 * `hoje` e `ontem` são dias de CALENDÁRIO, para casar com o relatório do Meta. `7`, `30` e `90`
 * continuam ROLANTES — mudá-los faria todos os números que o dono já viu se deslocarem de uma vez,
 * e a leitura de tendência não ganha nada com a troca.
 */
export function janelaDoPeriodo(periodo: string | undefined, agora: Date = new Date()): Janela {
  if (periodo === 'tudo') return { desde: null, ate: null };
  if (periodo === 'hoje') return { desde: inicioDoDia(0, agora), ate: null };
  if (periodo === 'ontem') return { desde: inicioDoDia(1, agora), ate: inicioDoDia(0, agora) };

  const dias = Number(periodo ?? 30);
  const validos = Number.isFinite(dias) && dias > 0 ? dias : 30;
  return { desde: new Date(agora.getTime() - validos * 24 * 60 * 60 * 1000), ate: null };
}
