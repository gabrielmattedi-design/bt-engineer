/**
 * As duas portas que dão acesso não aceitam palpites infinitos.
 *
 * ═══ O QUE ESTAVA ABERTO (auditoria de ago/2026) ═════════════════════════════════════════════
 *
 * Nenhuma das duas contava tentativas, e as duas concedem coisas caras:
 *
 *   • O login do painel. Errar não custava nada; acertar dá o painel inteiro — criar cupom de
 *     acesso total, mexer no modo de pagamento, rodar migração no banco.
 *   • O campo de código de convite. Errar não custava nada; acertar dá um relatório pago. E os
 *     códigos são PALAVRAS (`MAITE`), não cadeias aleatórias: um dicionário de nomes próprios
 *     chega lá em minutos.
 *
 * Nenhuma das duas deixava rastro, então nem depois daria para saber que alguém tentou.
 *
 * ═══ POR QUE ESTE TESTE É DE FONTE, E NÃO DE COMPORTAMENTO ═══════════════════════════════════
 *
 * O limitador vive no banco, e exercitá-lo de verdade exigiria Postgres — o que tiraria estes
 * testes do caminho rápido e faria com que deixassem de rodar. O que dá para garantir sem banco é
 * o que de fato regride: alguém reescrever a função e a chamada ao contador sumir junto.
 *
 * A aritmética do contador é testada à parte, em `computeFunnel`-style, na própria função pura.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');

function fonte(...partes: string[]): string {
  return readFileSync(join(ROOT, ...partes), 'utf8');
}

describe('login do painel', () => {
  const admin = fonte('src', 'app', 'admin', 'actions.ts');

  it('conta a tentativa antes de conferir a senha', () => {
    const posContagem = admin.indexOf('contarTentativa');
    const posVerificacao = admin.indexOf('verifyPassword(password)');

    expect(posContagem, 'o login não conta tentativas').toBeGreaterThan(-1);
    /*
      A ordem é o ponto. Contar só os erros deixaria quem conhece a senha certa intercalá-la entre
      palpites para zerar a conta — tentativas infinitas para descobrir o resto.
    */
    expect(
      posContagem,
      'contar depois de verificar permite zerar o contador com um acerto',
    ).toBeLessThan(posVerificacao);
  });

  it('libera a janela quando a senha acerta', () => {
    // Sem isto, um engano honesto de manhã deixaria o dono de fora à tarde.
    expect(admin).toContain('limparTentativas');
  });

  /**
   * A mensagem de recusa não pode revelar o estado do contador.
   *
   * "Faltam 3 tentativas" ensina ao atacante o tamanho da janela e o ritmo exato que passa
   * despercebido. Quem errou a própria senha não precisa desse número.
   */
  it('não diz quantas tentativas restam', () => {
    expect(admin).not.toMatch(/restantes|faltam \$\{|tentativas restantes/i);
  });
});

describe('resgate de código de convite', () => {
  const planos = fonte('src', 'app', 'planos', '[sessionId]', 'actions.ts');

  it('conta a tentativa antes de consultar o código', () => {
    const posContagem = planos.indexOf('contarTentativa');
    const posResgate = planos.indexOf('redeemCoupon({');

    expect(posContagem, 'o resgate de código não conta tentativas').toBeGreaterThan(-1);
    expect(posContagem).toBeLessThan(posResgate);
  });

  /**
   * A chave é o VISITANTE, não a porta.
   *
   * Aqui o tráfego legítimo é de muitas pessoas ao mesmo tempo. Um teto global transformaria um
   * ataque num bloqueio de todos os clientes reais — que é o objetivo do atacante, não o nosso.
   */
  it('o limite é por visitante', () => {
    expect(planos).toMatch(/coupon:\$\{/);
  });

  /**
   * O token do visitante não pode entrar em claro numa coluna que qualquer consulta lê. Seria uma
   * segunda cópia do segredo de sessão, num lugar em que ninguém espera encontrá-lo.
   */
  it('o token do visitante entra no contador como hash', () => {
    expect(planos).toContain('hashVisitante');
    expect(planos).not.toMatch(/coupon:\$\{token\}/);
  });
});

describe('cabeçalhos de segurança', () => {
  const config = fonte('next.config.mjs');

  it('o site não pode ser embutido em iframe', () => {
    // Clickjacking: um clique roubado no painel é uma migração rodada ou um cupom criado.
    expect(config).toContain('X-Frame-Options');
    expect(config).toContain('frame-ancestors');
  });

  /**
   * O mais importante da lista, e o menos óbvio.
   *
   * A URL do relatório É a chave de acesso a ele. Sem política de referer, clicar num link externo
   * a partir do relatório entrega essa chave, inteira, ao site de destino.
   */
  it('a URL do relatório não vaza pelo referer', () => {
    expect(config).toContain('Referrer-Policy');
    expect(config).toContain('strict-origin-when-cross-origin');
  });

  it('o painel não fica em cache de navegador compartilhado', () => {
    expect(config).toMatch(/\/admin\/:path\*/);
    expect(config).toContain('no-store');
  });
});

describe('injeção de HTML no relatório', () => {
  const pagina = fonte('src', 'app', 'resultado', '[sessionId]', 'page.tsx');

  /**
   * `boldify` alimenta o único `dangerouslySetInnerHTML` do produto.
   *
   * Hoje as linhas vêm só de constantes nossas e não é explorável. O escape entra porque o
   * questionário guarda texto livre — nome do jogador, descrição da raquete atual — e basta alguém
   * decidir citar um deles numa expectativa para o relatório passar a executar o que a pessoa
   * digitou, no navegador de quem abrir o link.
   */
  it('boldify escapa o HTML antes de converter o negrito', () => {
    const corpo = /function boldify[\s\S]*?\n}/.exec(pagina)?.[0] ?? '';
    expect(corpo, 'boldify sumiu ou mudou de forma').not.toBe('');
    expect(corpo, 'sem escape, texto livre viraria HTML executável').toContain('&lt;');

    const posEscape = corpo.indexOf('&lt;');
    const posNegrito = corpo.indexOf('<strong>');
    // Escapar depois de converter transformaria o próprio <strong> em texto visível.
    expect(posEscape).toBeLessThan(posNegrito);
  });

  /**
   * ═══ POR QUE PROCURA O USO, E NÃO A PALAVRA ════════════════════════════════════════════════
   *
   * A versão anterior contava arquivos que CONTINHAM a palavra, e quebrou no dia em que um
   * comentário explicou por que NÃO usou `dangerouslySetInnerHTML` — a rota de prévia do e-mail,
   * que serve o HTML como documento próprio justamente para não injetá-lo na página.
   *
   * O teste estava punindo a documentação da decisão certa. Pior: o caminho de menor resistência
   * para quem esbarrasse nele seria apagar o comentário, deixando o projeto com menos explicação e
   * o mesmo risco.
   *
   * Agora procura a FORMA de uso — o nome seguido de `=` (atributo JSX) ou `:` (dentro de um
   * objeto de props). Citar o nome em prosa não dispara; usá-lo, sim.
   */
  it('não existe outro innerHTML solto no produto', () => {
    const USO = /dangerouslySetInnerHTML\s*[=:]/;
    const suspeitos: string[] = [];
    for (const arquivo of varrer(join(ROOT, 'src'))) {
      if (USO.test(readFileSync(arquivo, 'utf8'))) {
        suspeitos.push(arquivo.replace(ROOT, ''));
      }
    }
    // Um só, e ele é este. Cada novo precisa de decisão consciente, não de descuido.
    expect(suspeitos).toEqual(['/src/app/resultado/[sessionId]/page.tsx']);
  });
});

function varrer(dir: string): string[] {
  const { readdirSync, statSync, existsSync } = require('node:fs') as typeof import('node:fs');
  if (!existsSync(dir)) return [];
  const saida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const full = join(dir, entrada);
    if (statSync(full).isDirectory()) saida.push(...varrer(full));
    else if (full.endsWith('.ts') || full.endsWith('.tsx')) saida.push(full);
  }
  return saida;
}

/**
 * O teto diário do cupom, e por que ele existe além do total.
 *
 * `max_uses` limita o estrago ACUMULADO; o teto diário limita a VELOCIDADE dele — e é a segunda
 * que dá tempo de reagir. Um código de convite que vaza é consumido por script em minutos: com
 * teto só total, quando o dono percebe já acabou.
 *
 * O código `MAITE` é o caso concreto. É uma palavra — nome próprio comum — e por isso o alvo mais
 * fácil do sistema. Ilimitado, um vazamento renderia relatórios de graça para sempre.
 */
describe('teto diário dos códigos de convite', () => {
  const repo = fonte('src', 'database', 'repositories', 'coupon-repo.ts');

  it('MAITE tem teto diário, mesmo sem teto total', () => {
    const bloco = /code: 'MAITE'[\s\S]*?\},/.exec(repo)?.[0] ?? '';
    expect(bloco, 'a semente do MAITE sumiu ou mudou de forma').not.toBe('');
    expect(bloco, 'sem teto diário, um vazamento é permanente').toMatch(/dailyLimit:\s*20/);
  });

  /**
   * A janela é MÓVEL (últimas 24 h), e não "desde a meia-noite".
   *
   * Meia-noite criaria um instante em que o teto zera, e um script paciente pegaria o fim de um dia
   * e o começo do outro — dois tetos cheios em poucos minutos, que é o oposto do que o limite serve.
   */
  it('a contagem usa janela móvel de 24 horas', () => {
    expect(repo).toMatch(/24 \* 60 \* 60 \* 1000/);
    expect(repo, 'a contagem sai dos resgates reais, não de um contador que precisa zerar').toContain(
      'couponRedemptions.redeemedAt',
    );
  });

  /**
   * Recusar por teto diário NÃO pode gastar um uso nem deixar a marca de resgate.
   *
   * Sem o desfazer, a análise da pessoa ficaria com um resgate registrado e sem acesso — o beco
   * permanente que o próprio arquivo documenta ter fechado uma vez.
   */
  it('a recusa por teto diário desfaz o registro do resgate', () => {
    const trecho = /if \(\(hoje\[0\]\?\.n \?\? 0\) > teto\) \{[\s\S]*?\}/.exec(repo)?.[0] ?? '';
    expect(trecho).toContain('delete(couponRedemptions)');
  });

  it('o teto diário é um desfecho próprio, distinto de esgotado', () => {
    /*
      A ação de quem lê é oposta: esgotado pede um código novo; teto diário passa sozinho. Juntar os
      dois faria o convidado gastar o tempo dele e o do dono por algo que se resolve amanhã.
    */
    expect(repo).toMatch(/kind: 'daily_limit'/);
    const planos = fonte('src', 'app', 'planos', '[sessionId]', 'actions.ts');
    expect(planos).toMatch(/case 'daily_limit'/);
    expect(planos).toMatch(/amanhã/);
  });
});

describe('teto global de tentativas de cupom', () => {
  const planos = fonte('src', 'app', 'planos', '[sessionId]', 'actions.ts');

  /**
   * O teto por visitante sozinho não barra um script.
   *
   * O visitante é um cookie que o atacante controla: limpar o cookie devolve as doze tentativas.
   * Ele protege contra distração, não contra intenção — e o global é o que fecha isso.
   */
  it('existe um teto global além do por visitante', () => {
    expect(planos).toContain('coupon-global');
    expect(planos).toMatch(/MAX_TENTATIVAS_CUPOM_GLOBAL/);
  });

  it('o global é conferido ANTES do por visitante', () => {
    // Ao contrário, um script gastaria uma linha no contador por visitante a cada tentativa,
    // enchendo a tabela sem nunca esbarrar no teto que de fato o barra.
    const g = planos.indexOf("contarTentativa('coupon-global'");
    const v = planos.indexOf('contarTentativa(`coupon:${');
    expect(g).toBeGreaterThan(-1);
    expect(g).toBeLessThan(v);
  });
});
