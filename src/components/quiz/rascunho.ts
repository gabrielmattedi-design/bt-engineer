import { emptyAnswers, type QuestionnaireAnswers } from '@/recommendation/profile/answers';

/**
 * O rascunho do questionário, guardado na aba enquanto a pessoa responde.
 *
 * ═══ O DEFEITO QUE ISTO CONSERTA — MEDIDO EM CLIENTES REAIS (21/09/2026) ═════════════════════
 *
 * ⚠️ 16:47–16:49. Quatro `POST 404` em `/questionario`, dois identificadores diferentes:
 *
 *   [Error: Failed to find Server Action "40191954f3455125391e64d889e71…"]
 *
 * Duas pessoas responderam quinze perguntas, apertaram enviar, e receberam erro. Uma tentou três
 * vezes antes de desistir.
 *
 * A causa imediata foi um deploy: o Next gera identificadores novos para as ações de servidor a
 * cada build, e quem já estava com a página aberta continua com o código velho no navegador. O
 * `POST` dela aponta para uma ação que deixou de existir.
 *
 * ─── MAS O DEPLOY É A CAUSA MENOS IMPORTANTE ───────────────────────────────────────────────
 *
 * A tela de erro dizia: *"Suas respostas não foram perdidas — tente novamente."* **Era mentira.**
 * `QuizForm` guardava as respostas em `useState`; a tela de erro o desmontava; "Tentar novamente"
 * o remontava com `emptyAnswers`. A pessoa perdia o questionário inteiro depois de ler que não
 * tinha perdido nada.
 *
 * E isso não depende de deploy nenhum: vale para 4G oscilando, timeout, aba recarregada sem
 * querer. O tráfego desta campanha é Instagram, ou seja, quase todo celular em rede móvel — a
 * conexão instável é o caso FREQUENTE, e o deploy só é o que deixou rastro no log.
 *
 * ═══ POR QUE `sessionStorage`, E NÃO `localStorage` ══════════════════════════════════════════
 *
 * As respostas incluem lesões, dores e desconforto no braço — informação de saúde. `sessionStorage`
 * vive só naquela aba e é apagado quando ela fecha; `localStorage` ficaria no aparelho até alguém
 * limpar, inclusive num celular emprestado ou compartilhado.
 *
 * O rascunho também é APAGADO assim que a análise é criada (`limparRascunho`): a partir daí o dado
 * vive no servidor, com a sessão da pessoa, e a cópia no navegador não serve para mais nada.
 *
 * Nada aqui sai do aparelho. É a mesma informação que ela está digitando na tela, guardada por
 * alguns minutos para não ter que digitar duas vezes.
 */

const CHAVE = 'te:rascunho:v1';

export type Rascunho = {
  readonly answers: QuestionnaireAnswers;
  readonly stepIndex: number;
};

/**
 * Toda leitura passa por aqui, e ela desconfia do que leu.
 *
 * ⚠️ O conteúdo de `sessionStorage` é editável por quem estiver no navegador e sobrevive a mudanças
 * no questionário — um rascunho gravado antes de uma pergunta ser renomeada voltaria com uma chave
 * que não existe mais. Confiar nele daria um objeto com a forma errada circulando pelo motor.
 *
 * A reconstrução parte de `emptyAnswers` e só aceita chaves que ele já tem, com o tipo que ele já
 * espera. Chave desconhecida é descartada; valor de tipo errado é ignorado e fica o padrão. O pior
 * caso possível é a pessoa reencontrar uma pergunta em branco — e não um envio malformado.
 */
function mesclar(bruto: unknown): QuestionnaireAnswers {
  /* `emptyAnswers` é uma FUNÇÃO — cada chamada devolve um objeto novo, nunca um compartilhado. */
  const vazio = emptyAnswers();
  if (typeof bruto !== 'object' || bruto === null) return vazio;

  const lido = bruto as Record<string, unknown>;
  const saida: Record<string, unknown> = { ...vazio };

  for (const chave of Object.keys(vazio)) {
    if (!(chave in lido)) continue;

    const valor = lido[chave];
    const padrao = saida[chave];

    if (Array.isArray(padrao)) {
      /* Lista só volta como lista de texto — é como todas elas são hoje. */
      if (Array.isArray(valor) && valor.every((v) => typeof v === 'string')) {
        saida[chave] = valor;
      }
      continue;
    }

    if (valor === null || typeof valor === 'string' || typeof valor === 'number') {
      saida[chave] = valor;
    }
  }

  return saida as QuestionnaireAnswers;
}

/**
 * Guarda o rascunho. Nunca lança.
 *
 * `sessionStorage` lança em aba anônima de alguns navegadores e quando a cota estoura. Derrubar o
 * questionário para salvar um rascunho seria trocar o problema pelo seu dobro: a função existe para
 * a pessoa não perder o que respondeu, não para ser mais um jeito de perder.
 */
export function salvarRascunho(answers: QuestionnaireAnswers, stepIndex: number): void {
  try {
    sessionStorage.setItem(CHAVE, JSON.stringify({ answers, stepIndex }));
  } catch {
    /* Sem rascunho a pessoa segue respondendo normalmente — só perde a rede de proteção. */
  }
}

export function lerRascunho(): Rascunho | null {
  try {
    const cru = sessionStorage.getItem(CHAVE);
    if (!cru) return null;

    const bruto: unknown = JSON.parse(cru);
    if (typeof bruto !== 'object' || bruto === null) return null;

    const { answers, stepIndex } = bruto as { answers?: unknown; stepIndex?: unknown };

    return {
      answers: mesclar(answers),
      /*
        A etapa volta como número são e não-negativo. `QuizForm` já limita o índice ao número de
        etapas visíveis — que muda conforme as respostas —, então o teto fica com ele.
      */
      stepIndex: typeof stepIndex === 'number' && Number.isInteger(stepIndex) && stepIndex >= 0
        ? stepIndex
        : 0,
    };
  } catch {
    return null;
  }
}

export function limparRascunho(): void {
  try {
    sessionStorage.removeItem(CHAVE);
  } catch {
    /* Ignorado pelo mesmo motivo de `salvarRascunho`. */
  }
}
