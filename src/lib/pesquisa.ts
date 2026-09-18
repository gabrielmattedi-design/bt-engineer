/**
 * As perguntas da pesquisa de satisfação, e a leitura das respostas.
 *
 * ═══ POR QUE AS OPÇÕES VIVEM AQUI, E NÃO NO JSX ══════════════════════════════════════════════
 *
 * As mesmas listas são usadas em três lugares: desenhar o formulário, validar o que chega no
 * servidor e agrupar as respostas na tela do painel. Copiadas, elas discordam — e a discordância
 * aparece do pior jeito possível: a pessoa marca uma opção, o servidor não reconhece o valor e a
 * resposta some sem erro.
 *
 * ─── A PERGUNTA 1 É A ÚNICA OBRIGATÓRIA, E É DE PROPÓSITO ────────────────────────────────────
 *
 * Ela vem primeiro no formulário porque é a que decide o diagnóstico do projeto:
 *
 *   segui + melhorou  → o produto funciona; o próximo passo é derivado
 *   segui + não senti → o problema é a recomendação, e mora no motor
 *   NÃO segui         → o problema é ATIVAÇÃO: o laudo não leva à ação
 *
 * O terceiro caso é o mais provável e o menos considerado, e nenhuma métrica atual o enxerga.
 * Sendo a primeira pergunta, quem abandonar no meio já terá entregado o dado que mais importa.
 */

export const USOU = [
  { valor: 'segui_tudo', label: 'Segui tudo — raquete, corda e tensão' },
  { valor: 'segui_parte', label: 'Segui em parte' },
  { valor: 'ainda_nao', label: 'Ainda não, mas pretendo' },
  { valor: 'nao_vou', label: 'Não vou seguir' },
] as const;

export const EFEITO = [
  { valor: 'melhorou_muito', label: 'Melhorou bastante' },
  { valor: 'melhorou_pouco', label: 'Melhorou um pouco' },
  { valor: 'igual', label: 'Ficou igual' },
  { valor: 'piorou', label: 'Piorou' },
] as const;

export const IMPEDIMENTO = [
  { valor: 'custo', label: 'Custo da raquete ou da corda' },
  { valor: 'tempo', label: 'Ainda não tive tempo' },
  { valor: 'discordei', label: 'Não concordei com a recomendação' },
  { valor: 'nao_entendi', label: 'Não entendi direito o que fazer' },
  { valor: 'outro', label: 'Outro motivo' },
] as const;

export type Usou = (typeof USOU)[number]['valor'];
export type Efeito = (typeof EFEITO)[number]['valor'];
export type Impedimento = (typeof IMPEDIMENTO)[number]['valor'];

/** Quem marcou uma destas de fato mexeu no equipamento — é o corte de "seguiu". */
const SEGUIU: readonly string[] = ['segui_tudo', 'segui_parte'];

export function seguiu(usou: string | null): boolean {
  return usou !== null && SEGUIU.includes(usou);
}

export type Resposta = {
  readonly usou: Usou;
  readonly efeito: Efeito | null;
  readonly impedimento: Impedimento | null;
  readonly impedimentoOutro: string | null;
  readonly notaLaudo: number | null;
  readonly sugestao: string | null;
  readonly podeContatar: boolean | null;
};

const LIMITE_TEXTO = 2000;

function umDe<T extends string>(
  lista: readonly { readonly valor: T }[],
  v: FormDataEntryValue | null,
): T | null {
  const s = typeof v === 'string' ? v : '';
  return lista.find((o) => o.valor === s)?.valor ?? null;
}

function texto(v: FormDataEntryValue | null): string | null {
  if (typeof v !== 'string') return null;
  const limpo = v.trim().slice(0, LIMITE_TEXTO);
  return limpo === '' ? null : limpo;
}

/**
 * Lê o formulário e devolve a resposta, ou `null` se a pergunta obrigatória não veio.
 *
 * ═══ AS TRÊS COISAS QUE ESTA FUNÇÃO IMPEDE ═══════════════════════════════════════════════════
 *
 * **1. Resposta incoerente.** Quem marcou "segui tudo" e, por algum caminho, mandou também um
 * motivo de impedimento — os dois campos existem na mesma página, sem JavaScript, então isso é
 * possível. Guardar os dois criaria uma linha que contradiz a si mesma, e a contagem de
 * "não seguiu por custo" passaria a incluir gente que seguiu. Aqui o campo que não pertence ao
 * ramo escolhido é DESCARTADO, e não apenas ignorado na leitura.
 *
 * **2. Nota fora da escala.** O formulário oferece 1 a 5; um POST direto pode mandar 9 ou −3.
 * Fora da faixa vira `null`, não vira média envenenada.
 *
 * **3. Texto sem limite.** Campo aberto é campo aberto para qualquer coisa. 2000 caracteres é
 * generoso para uma sugestão e barato para o banco.
 */
export function lerResposta(form: FormData): Resposta | null {
  const usou = umDe(USOU, form.get('usou'));
  if (usou === null) return null;

  const respondeuSeguindo = seguiu(usou);
  const impedimento = respondeuSeguindo ? null : umDe(IMPEDIMENTO, form.get('impedimento'));

  const notaBruta = Number(form.get('nota_laudo'));
  const notaLaudo =
    Number.isInteger(notaBruta) && notaBruta >= 1 && notaBruta <= 5 ? notaBruta : null;

  const contato = form.get('pode_contatar');

  return {
    usou,
    efeito: respondeuSeguindo ? umDe(EFEITO, form.get('efeito')) : null,
    impedimento,
    /* O "outro" só faz sentido colado no motivo "outro"; solto, viraria texto órfão. */
    impedimentoOutro: impedimento === 'outro' ? texto(form.get('impedimento_outro')) : null,
    notaLaudo,
    sugestao: texto(form.get('sugestao')),
    podeContatar: contato === 'sim' ? true : contato === 'nao' ? false : null,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════════
   A LEITURA — o que o painel mostra
   ═══════════════════════════════════════════════════════════════════════════════════════════════ */

export type LinhaDeContagem = {
  readonly valor: string;
  readonly label: string;
  readonly n: number;
  readonly porcento: number;
};

export type ResumoDaPesquisa = {
  readonly enviadas: number;
  readonly respondidas: number;
  readonly taxaDeResposta: number;
  readonly usou: readonly LinhaDeContagem[];
  readonly efeito: readonly LinhaDeContagem[];
  readonly impedimento: readonly LinhaDeContagem[];
  /** `null` sem nenhuma nota — média de lista vazia é `NaN`, e `NaN` na tela vira "NaN". */
  readonly notaMedia: number | null;
  /** Fração de quem mexeu no equipamento, entre quem respondeu. É o número-âncora da tela. */
  readonly taxaDeAtivacao: number | null;
};

type RespostaCrua = {
  readonly usou: string | null;
  readonly efeito: string | null;
  readonly impedimento: string | null;
  readonly notaLaudo: number | null;
};

function contar(
  lista: readonly { readonly valor: string; readonly label: string }[],
  valores: readonly (string | null)[],
): LinhaDeContagem[] {
  const total = valores.filter((v) => v !== null).length;
  return lista.map((o) => {
    const n = valores.filter((v) => v === o.valor).length;
    return { ...o, n, porcento: total > 0 ? (n / total) * 100 : 0 };
  });
}

export function resumirPesquisa(
  enviadas: number,
  respostas: readonly RespostaCrua[],
): ResumoDaPesquisa {
  const respondidas = respostas.length;
  const notas = respostas.map((r) => r.notaLaudo).filter((n): n is number => n !== null);
  const comUsou = respostas.filter((r) => r.usou !== null);

  return {
    enviadas,
    respondidas,
    /*
      A taxa divide por ENVIADAS, e não por respondidas.

      Parece óbvio escrito assim, e é exatamente o tipo de divisão que sai errada quando alguém
      quer que o número fique bonito. Uma "taxa de resposta" de 100% é sinal de que se dividiu pela
      coisa errada.
    */
    taxaDeResposta: enviadas > 0 ? (respondidas / enviadas) * 100 : 0,
    usou: contar(USOU, respostas.map((r) => r.usou)),
    efeito: contar(EFEITO, respostas.map((r) => r.efeito)),
    impedimento: contar(IMPEDIMENTO, respostas.map((r) => r.impedimento)),
    notaMedia: notas.length > 0 ? notas.reduce((s, n) => s + n, 0) / notas.length : null,
    taxaDeAtivacao:
      comUsou.length > 0
        ? (comUsou.filter((r) => seguiu(r.usou)).length / comUsou.length) * 100
        : null,
  };
}
