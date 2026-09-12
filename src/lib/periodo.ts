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

const UM_DIA_MS = 24 * 60 * 60 * 1000;

/** `2026-09-10` e nada mais. O traço é o que distingue uma data de `7`, `30` e `90`. */
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A janela de UM dia de calendário escolhido, em Brasília. `null` quando a data não existe.
 *
 * ═══ POR QUE ISTO PRECISOU EXISTIR (12/09/2026) ══════════════════════════════════════════════
 *
 * Os botões fixos cobriam hoje, ontem, e depois pulavam para 7 dias. Anteontem — e qualquer dia
 * antes dele — ficava inalcançável: a janela de 7 dias soma tudo e não separa nada.
 *
 * O dono estava montando a série de CAC dia a dia contra o gasto do Meta, que ele tem por dia no
 * aplicativo. Sem escolher a data, metade da série não tinha como ser lida.
 *
 * ─── O DESLOCAMENTO É MEDIDO NO DIA ESCOLHIDO ────────────────────────────────────────────────
 *
 * Mesmo cuidado de `inicioDoDia`, e aqui ele importa mais: a data escolhida pode estar meses atrás,
 * do outro lado de uma eventual virada de horário de verão. Medir o deslocamento hoje e aplicá-lo
 * num dia de fevereiro deslocaria a janela inteira em uma hora — e a hora perdida seria a do fim
 * da noite, que neste produto é quando mais se vende.
 */
export function janelaDaData(iso: string): Janela | null {
  if (!DATA_ISO.test(iso)) return null;

  const palpite = Date.parse(`${iso}T00:00:00Z`);
  if (!Number.isFinite(palpite)) return null;

  /*
    ═══ A VOLTA, PORQUE `Date.parse` TRANSBORDA EM SILÊNCIO ═══════════════════════════════════

    Eu tinha escrito aqui que o formato ISO valida o intervalo e que `2026-02-31` devolveria NaN.
    **Não devolve.** O teste mostrou que ele vira `2026-03-03` — o dia transborda para o mês
    seguinte, sem erro nenhum.

    Sem esta conferência, uma data impossível na barra de endereço abriria a janela de OUTRO dia,
    com a tela mostrando números perfeitamente plausíveis do dia errado. Comparar isso com o gasto
    do Meta daquela data produziria um CAC inventado.

    Ida e volta: se o instante não devolve a mesma data que entrou, a data não existe.
  */
  if (new Date(palpite).toISOString().slice(0, 10) !== iso) return null;

  return { desde: instanteReal(palpite), ate: instanteReal(palpite + UM_DIA_MS) };
}

/**
 * De "números do relógio de Brasília lidos como UTC" para o instante real.
 *
 * A meia-noite de Brasília do dia D vira `D T00:00:00Z` nessa leitura, e a do dia seguinte vira
 * exatamente `+24 h` — por isso somar um dia ANTES de corrigir funciona mesmo atravessando uma
 * mudança de fuso.
 */
function instanteReal(palpite: number): Date {
  const deslocamento = comoSeFosseUtc(new Date(palpite)) - palpite;
  return new Date(palpite - deslocamento);
}

/**
 * `true` quando o período é um dia fechado de calendário — o mesmo corte que o Gerenciador de
 * Anúncios usa, e portanto o único em que dividir gasto por vendas produz um CAC honesto.
 */
export function ehDiaDeCalendario(periodo: string | undefined): boolean {
  return periodo === 'hoje' || periodo === 'ontem' || (periodo !== undefined && DATA_ISO.test(periodo));
}

/**
 * Traduz o parâmetro da URL numa janela.
 *
 * `hoje`, `ontem` e uma data `AAAA-MM-DD` são dias de CALENDÁRIO, para casar com o relatório do
 * Meta. `7`, `30` e `90` continuam ROLANTES — mudá-los faria todos os números que o dono já viu se
 * deslocarem de uma vez, e a leitura de tendência não ganha nada com a troca.
 */
export function janelaDoPeriodo(periodo: string | undefined, agora: Date = new Date()): Janela {
  if (periodo === 'tudo') return { desde: null, ate: null };
  if (periodo === 'hoje') return { desde: inicioDoDia(0, agora), ate: null };
  if (periodo === 'ontem') return { desde: inicioDoDia(1, agora), ate: inicioDoDia(0, agora) };

  /*
    A data vem ANTES do `Number()`. `Number('2026-09-10')` é NaN, então sem esta linha a data cairia
    no padrão de 30 dias — mostrando um mês inteiro com uma data escrita no campo, que é o tipo de
    erro que ninguém percebe porque a tela não fica vazia.
  */
  if (periodo !== undefined) {
    const dia = janelaDaData(periodo);
    if (dia) return dia;
  }

  const dias = Number(periodo ?? 30);
  const validos = Number.isFinite(dias) && dias > 0 ? dias : 30;
  return { desde: new Date(agora.getTime() - validos * UM_DIA_MS), ate: null };
}
