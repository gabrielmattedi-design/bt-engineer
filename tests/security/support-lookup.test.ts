/**
 * A busca de atendimento encontra QUEM VOCÊ JÁ SABE — e nunca vira uma janela para folhear.
 *
 * ═══ O QUE ESTÁ EM JOGO ══════════════════════════════════════════════════════════════════════
 *
 * `/admin/analises` abre o relatório de outra pessoa: idade, altura, peso, condicionamento, estilo
 * de jogo e histórico de compra. É a tela mais sensível do sistema, e a única proteção real dela
 * não é a senha do admin — é o formato da consulta.
 *
 * Uma busca EXATA exige que o operador já tenha o identificador inteiro, vindo de um pedido de
 * suporte legítimo. Uma busca PARCIAL — `LIKE '%joao%'`, ou uma listagem de "análises recentes" —
 * dispensa isso e transforma atendimento em navegação pelos dados de todos os clientes.
 *
 * A distância entre as duas é uma linha de código. Por isso ela é testada, e não apenas comentada.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { classifyQuery } from '@/database/repositories/support-repo';
import { normalizeEmail } from '@/database/schema/users';

const REPO_SOURCE = readFileSync(
  join(__dirname, '..', '..', 'src', 'database', 'repositories', 'support-repo.ts'),
  'utf8',
);

describe('classificação do termo buscado', () => {
  it('reconhece e-mail, UUID e ID de gateway sem perguntar ao operador', () => {
    expect(classifyQuery('joao@exemplo.com')).toEqual({ kind: 'email', value: 'joao@exemplo.com' });
    expect(classifyQuery('02684ec8-74ed-4e75-a9d6-2faf7c421fe9')).toEqual({
      kind: 'uuid',
      value: '02684ec8-74ed-4e75-a9d6-2faf7c421fe9',
    });
    expect(classifyQuery('pi_3AbcDefGhiJklMno')).toEqual({
      kind: 'pagamento',
      value: 'pi_3AbcDefGhiJklMno',
    });
  });

  /**
   * `UNIQUE` no Postgres compara byte a byte. Sem normalizar na BUSCA também, um e-mail gravado em
   * minúsculas seria invisível para quem o digitasse como o cliente escreveu no pedido de suporte —
   * e o operador concluiria que a compra não existe.
   */
  it('normaliza o e-mail da mesma forma que a gravação', () => {
    const digitado = '  Joao.Silva@Gmail.COM ';
    const classificado = classifyQuery(digitado);

    expect(classificado).toEqual({ kind: 'email', value: 'joao.silva@gmail.com' });
    expect('value' in classificado && classificado.value).toBe(normalizeEmail(digitado));
  });

  /** UUID em maiúsculas é o mesmo UUID — copiar de um painel que formata assim não pode falhar. */
  it('aceita UUID em maiúsculas e o normaliza', () => {
    expect(classifyQuery('02684EC8-74ED-4E75-A9D6-2FAF7C421FE9')).toEqual({
      kind: 'uuid',
      value: '02684ec8-74ed-4e75-a9d6-2faf7c421fe9',
    });
  });

  /**
   * ─── O PISO CONTRA PESCA ────────────────────────────────────────────────────────────────────
   *
   * Termos curtos não servem para nenhuma busca legítima: UUIDs têm 36 caracteres, IDs de gateway
   * passam de 20, e-mails reais raramente têm menos de 8. Servem para descobrir o formato da busca
   * chutando — e é isso que o piso recusa.
   */
  it('recusa termos curtos demais para serem identificadores reais', () => {
    for (const curto of ['', '   ', 'a', '@', '1', 'joao', 'pi_1']) {
      const result = classifyQuery(curto);
      expect(result, `"${curto}" deveria ser recusado`).toHaveProperty('error');
    }
  });

  /**
   * Um e-mail pela metade é exatamente a busca parcial que a tela não faz. Recusar com uma mensagem
   * clara é melhor que classificá-lo como ID de gateway e devolver "nada encontrado" — que faria o
   * operador achar que o cliente não existe.
   */
  it('recusa e-mail incompleto em vez de tratá-lo como ID de pagamento', () => {
    for (const parcial of ['joao@', '@gmail.com', 'joao@gmail', 'joao silva@gmail.com']) {
      const result = classifyQuery(parcial);
      expect(result, `"${parcial}" deveria ser recusado`).toHaveProperty('error');
    }
  });
});

describe('a consulta nunca é parcial', () => {
  /**
   * A trava principal. Escrita sobre o CÓDIGO-FONTE, e não sobre o comportamento, porque o risco
   * não é a busca de hoje estar errada — é a de amanhã: alguém acrescenta `ilike` "para facilitar",
   * e nenhum teste de comportamento existente falharia.
   */
  it('o repositório não usa LIKE, ILIKE nem busca por similaridade', () => {
    for (const proibido of ['ilike', 'like(', 'notLike', 'similar to', '%']) {
      expect(
        REPO_SOURCE.toLowerCase().includes(proibido.toLowerCase()),
        `support-repo.ts contém "${proibido}" — a busca precisa ser exata`,
      ).toBe(false);
    }
  });

  it('não existe função que liste análises sem termo de busca', () => {
    /*
      Duas exceções deliberadas, e nenhuma delas devolve dado de cliente:

        `recentLookups`  — o LOG de auditoria (tipo da busca, contagem, horário).
        `anyEmailStored` — um BOOLEANO: existe algum e-mail no sistema? Não conta, não lista.

      Qualquer outra exportação que devolva uma coleção sem receber um termo seria uma listagem de
      clientes com outro nome, e é isso que esta asserção impede de entrar sem ser notada.
    */
    const exported = [...REPO_SOURCE.matchAll(/export async function (\w+)/g)].map((m) => m[1]);
    expect(exported.sort()).toEqual(['anyEmailStored', 'findAnalyses', 'recentLookups']);
  });

  /** O teto existe para que uma consulta larga apareça como larga, em vez de despejar tudo. */
  it('o número de resultados é limitado', () => {
    expect(REPO_SOURCE).toMatch(/MAX_MATCHES\s*=\s*\d+/);
    expect(REPO_SOURCE).toContain('slice(0, MAX_MATCHES)');
  });
});

describe('auditoria', () => {
  /**
   * O log registra que uma consulta ACONTECEU. Se registrasse o termo, teria e-mail dentro —
   * criando uma segunda tabela com dado pessoal, contra o §8 ("`users` é a única"), justamente no
   * lugar feito para proteger esse dado.
   */
  it('o registro guarda o tipo da busca, nunca o termo digitado', () => {
    const schema = readFileSync(
      join(__dirname, '..', '..', 'src', 'database', 'schema', 'support.ts'),
      'utf8',
    );

    expect(schema).toContain("text('query_kind')");
    for (const proibido of ["'query'", "'term'", "'email'", "'search'"]) {
      expect(schema, `support_lookups não pode ter coluna ${proibido}`).not.toContain(
        `text(${proibido})`,
      );
    }
  });

  /**
   * Toda busca que CHEGA AO BANCO passa pelo registro, não só as que acharam algo — é assim que uma
   * sequência de tentativas por e-mail com "sem resultado" fica visível como o que é.
   *
   * Termos malformados (curtos, e-mail pela metade) são recusados antes de qualquer consulta e não
   * geram registro: nada foi acessado, e logá-los só encheria a auditoria de ruído de digitação.
   */
  it('a busca grava o registro antes de devolver o resultado', () => {
    const body = REPO_SOURCE.slice(REPO_SOURCE.indexOf('export async function findAnalyses'));
    const registro = body.indexOf('await recordLookup(');
    const retorno = body.indexOf('return {');

    expect(registro, 'findAnalyses não chama recordLookup').toBeGreaterThan(-1);
    expect(registro, 'o registro precisa vir antes do retorno').toBeLessThan(retorno);
  });
});

describe('o e-mail está pronto, e a tela é honesta sobre ele não existir ainda', () => {
  /** Sem a coluna, a busca por e-mail seria um formulário de mentira: nunca acharia nada. */
  it('orders tem a coluna que liga um pedido à pessoa', () => {
    const commerce = readFileSync(
      join(__dirname, '..', '..', 'src', 'database', 'schema', 'commerce.ts'),
      'utf8',
    );
    expect(commerce).toContain("uuid('user_id')");
    expect(commerce).toContain('users.id');
  });

  /**
   * Dois "não encontrei" opostos: "esse endereço não comprou" (procure outro) e "nenhum endereço
   * foi coletado" (o checkout não pede e-mail; procure pelo ID do pagamento). Dizer o primeiro
   * quando o certo é o segundo manda o operador caçar um dado que não existe em lugar nenhum.
   */
  it('a busca distingue "não achei este e-mail" de "não há e-mail nenhum"', () => {
    expect(REPO_SOURCE).toContain('emailNotCollectedYet');
    expect(REPO_SOURCE).toContain('anyEmailStored');
  });

  /**
   * O aviso "a busca por e-mail ainda não encontra nada" precisa DESAPARECER quando passar a
   * encontrar. Como texto fixo ele seria verdade hoje e mentira depois, e ninguém voltaria aqui
   * para apagá-lo — um painel que mente sobre o próprio sistema é pior que um painel calado.
   */
  it('o aviso de "ainda não há e-mail" é condicional, não texto fixo', () => {
    const page = readFileSync(
      join(__dirname, '..', '..', 'src', 'app', 'admin', 'analises', 'page.tsx'),
      'utf8',
    );
    expect(page).toContain('anyEmailStored');
    expect(page).toMatch(/\{!emailsExist && \(/);
  });

  /**
   * O e-mail com erro de digitação é o dado que se veio buscar. Guardá-lo "corrigido" apagaria a
   * evidência de qual foi o erro — e é justamente por ele que a pessoa não recebeu nada.
   */
  it('o e-mail exibido é o que está gravado, sem correção silenciosa', () => {
    expect(REPO_SOURCE).toMatch(/email:\s*mine\.find/);
  });
});
