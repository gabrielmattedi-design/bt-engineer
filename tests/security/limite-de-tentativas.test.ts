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

  it('não existe outro innerHTML solto no produto', () => {
    const suspeitos: string[] = [];
    for (const arquivo of varrer(join(ROOT, 'src'))) {
      if (readFileSync(arquivo, 'utf8').includes('dangerouslySetInnerHTML')) {
        suspeitos.push(arquivo.replace(ROOT, ''));
      }
    }
    // Um só, e ele é este. Cada novo precisa de decisão consciente, não de descuido.
    expect(suspeitos).toHaveLength(1);
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
