import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { lerRascunho, limparRascunho, salvarRascunho } from '@/components/quiz/rascunho';
import { emptyAnswers } from '@/recommendation/profile/answers';

/**
 * ═══ O QUESTIONÁRIO NÃO PODE SER PERDIDO ═════════════════════════════════════════════════════
 *
 * ⚠️ CASO REAL, MEDIDO EM CLIENTES (21/09/2026)
 *
 * Quatro `POST 404` em `/questionario` entre 16:47 e 16:49, dois identificadores diferentes:
 *
 *   [Error: Failed to find Server Action "40191954f3455125391e64d889e71…"]
 *
 * Duas pessoas responderam quinze perguntas, apertaram enviar e receberam erro. Uma tentou três
 * vezes. E a tela dizia *"Suas respostas não foram perdidas"* — **mentira**: `QuizForm` remontava
 * com `emptyAnswers()` e o questionário inteiro sumia.
 *
 * O deploy foi só a causa que deixou rastro. O mesmo acontece com 4G oscilando, que é o caso
 * frequente num tráfego que vem quase todo do Instagram, em celular.
 */

/**
 * `sessionStorage` de mentira, porque o ambiente dos testes é `node`.
 *
 * Deliberadamente burro: guarda string e devolve string. Um duble esperto esconderia justamente os
 * defeitos de serialização que estes testes existem para pegar.
 */
function instalarSessionStorage(): Map<string, string> {
  const dados = new Map<string, string>();
  const falso = {
    getItem: (k: string) => dados.get(k) ?? null,
    setItem: (k: string, v: string) => void dados.set(k, String(v)),
    removeItem: (k: string) => void dados.delete(k),
  };
  (globalThis as unknown as { sessionStorage: unknown }).sessionStorage = falso;
  return dados;
}

describe('o rascunho sobrevive e volta inteiro', () => {
  beforeEach(() => {
    instalarSessionStorage();
  });

  it('o que entrou é o que volta', () => {
    const respostas = {
      ...emptyAnswers(),
      age: 34,
      dominant_hand: 'destro' as const,
      play_style: ['fundo', 'agressivo'] as readonly string[],
    };

    salvarRascunho(respostas, 4);
    const lido = lerRascunho();

    expect(lido?.stepIndex).toBe(4);
    expect(lido?.answers.age).toBe(34);
    expect(lido?.answers.dominant_hand).toBe('destro');
    expect(lido?.answers.play_style).toEqual(['fundo', 'agressivo']);
  });

  /**
   * ⚠️ A ORDEM DAS LISTAS É A PRIORIDADE.
   *
   * `missing_attributes` é ordenada por prioridade e é "a entrada mais influente do vetor de
   * necessidades" (ver `answers.ts`). Um rascunho que devolvesse a lista embaralhada mudaria a
   * recomendação em silêncio — o pior desfecho possível para um recurso que existe para ajudar.
   */
  it('a ordem das listas é preservada', () => {
    const respostas = {
      ...emptyAnswers(),
      missing_attributes: ['controle', 'potencia', 'conforto'] as readonly string[],
    };

    salvarRascunho(respostas, 0);

    expect(lerRascunho()?.answers.missing_attributes).toEqual([
      'controle',
      'potencia',
      'conforto',
    ]);
  });

  it('sem rascunho gravado a leitura devolve nulo', () => {
    expect(lerRascunho()).toBeNull();
  });

  /** Depois da análise o dado vive no servidor, e a cópia com lesões e dores sai do aparelho. */
  it('limpar apaga de verdade', () => {
    salvarRascunho({ ...emptyAnswers(), age: 40 }, 2);
    limparRascunho();
    expect(lerRascunho()).toBeNull();
  });
});

describe('a leitura desconfia do que encontra', () => {
  let dados: Map<string, string>;

  beforeEach(() => {
    dados = instalarSessionStorage();
  });

  const gravar = (valor: unknown): void => {
    dados.set('te:rascunho:v1', JSON.stringify(valor));
  };

  /**
   * O conteúdo é editável por quem estiver no navegador e sobrevive a mudanças no questionário.
   * Um rascunho antigo pode trazer chave que não existe mais — e confiar nele faria um objeto de
   * forma errada circular pelo motor.
   */
  it('chave desconhecida é descartada', () => {
    gravar({ answers: { age: 30, inventada: 'xxx' }, stepIndex: 1 });

    const lido = lerRascunho();
    expect(lido?.answers.age).toBe(30);
    expect(Object.keys(lido?.answers ?? {})).toEqual(Object.keys(emptyAnswers()));
  });

  it('valor de tipo errado vira o padrão, e não quebra o resto', () => {
    gravar({ answers: { age: { malicioso: true }, dominant_hand: 'canhoto' }, stepIndex: 0 });

    const lido = lerRascunho();
    expect(lido?.answers.age, 'objeto passou como idade').toBeNull();
    expect(lido?.answers.dominant_hand, 'a resposta boa ao lado foi descartada junto').toBe(
      'canhoto',
    );
  });

  it('lista com item não-texto é recusada inteira', () => {
    gravar({ answers: { play_style: ['fundo', { x: 1 }] }, stepIndex: 0 });
    expect(lerRascunho()?.answers.play_style).toEqual([]);
  });

  it('etapa inválida volta para zero', () => {
    for (const ruim of [-3, 1.5, 'quatro', null, undefined]) {
      gravar({ answers: {}, stepIndex: ruim });
      expect(lerRascunho()?.stepIndex, `stepIndex ${String(ruim)} passou`).toBe(0);
    }
  });

  it('conteúdo ilegível não derruba nada', () => {
    dados.set('te:rascunho:v1', 'isto não é json {{{');
    expect(lerRascunho()).toBeNull();
  });

  /**
   * `sessionStorage` lança em aba anônima de alguns navegadores e quando a cota estoura. Derrubar o
   * questionário para salvar um rascunho seria trocar o problema pelo seu dobro.
   */
  it('armazenamento indisponível não lança', () => {
    (globalThis as unknown as { sessionStorage: unknown }).sessionStorage = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
      removeItem: () => {
        throw new Error('bloqueado');
      },
    };

    expect(() => salvarRascunho(emptyAnswers(), 0)).not.toThrow();
    expect(() => limparRascunho()).not.toThrow();
    expect(lerRascunho()).toBeNull();
  });
});

describe('a tela de erro faz o que promete', () => {
  const CLIENTE = readFileSync('src/app/questionario/quiz-client.tsx', 'utf8');
  const FORMULARIO = readFileSync('src/components/quiz/quiz-form.tsx', 'utf8');

  /**
   * ⚠️ Só recarregar traz o código novo.
   *
   * Quando a aba está com código velho, chamar a ação de novo chama a MESMA ação inexistente. Foi
   * o que aconteceu com um cliente em 21/09, três vezes seguidas. Um botão "tentar novamente" que
   * não recarrega é um botão que repete o erro.
   */
  it('a falha de conexão recarrega em vez de repetir a chamada', () => {
    expect(CLIENTE, 'a falha de rede deixou de pedir recarregamento').toMatch(
      /catch[\s\S]{0,1200}?recarregar: true/,
    );
    expect(CLIENTE).toContain('window.location.reload()');
  });

  /** Recusa do servidor NÃO recarrega: o código do cliente está bom e o erro se repetiria igual. */
  it('a recusa do servidor não recarrega', () => {
    expect(CLIENTE).toMatch(/message: response\.message, recarregar: false/);
  });

  /**
   * A frase mentiu uma vez, para duas pessoas, num domingo. Ela só pode existir porque o rascunho
   * existe — se alguém remover o salvamento, esta promessa volta a ser falsa.
   */
  it('a promessa de não perder as respostas é sustentada pelo rascunho', () => {
    expect(CLIENTE, 'a tela promete algo que ninguém garante mais').toContain(
      'Suas respostas estão salvas',
    );
    expect(FORMULARIO, 'o rascunho deixou de ser salvo').toContain('salvarRascunho(answers');
    expect(FORMULARIO, 'o rascunho deixou de ser restaurado').toContain('lerRascunho()');
    expect(CLIENTE, 'o rascunho deixou de ser apagado depois da análise').toContain(
      'limparRascunho()',
    );
  });
});
