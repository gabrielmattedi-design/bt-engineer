/**
 * O link de acesso por e-mail — o que ele não pode deixar de garantir.
 *
 * ═══ O QUE ESTÁ EM JOGO ══════════════════════════════════════════════════════════════════════
 *
 * Este link é a chave dos relatórios que a pessoa comprou. Ele viaja por e-mail — um canal que não
 * é seguro, que guarda mensagens para sempre e que é encaminhado por engano com frequência. Cada
 * propriedade testada aqui existe por causa de uma forma concreta de isso dar errado.
 *
 * Boa parte das asserções é sobre o CÓDIGO-FONTE, e não sobre comportamento. É deliberado: o risco
 * não é o código de hoje estar errado — está certo, foi medido. É a alteração de amanhã que troca
 * um `UPDATE` atômico por um `SELECT` seguido de `UPDATE` "para ficar mais legível", sem que
 * nenhum teste de comportamento perceba.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { authConfigured } from '@/auth/session';
import { magicLinkEmail, reportReadyEmail } from '@/email/templates';

const SRC = join(__dirname, '..', '..', 'src');
const read = (...p: string[]) => readFileSync(join(SRC, ...p), 'utf8');

/**
 * O arquivo sem comentários.
 *
 * As asserções de ausência precisam disto. Neste projeto os comentários explicam POR QUE cada
 * decisão foi tomada, e explicar "não usamos `Math.random` porque é previsível" faz o texto conter
 * exatamente o que a asserção proíbe — reprovando o código por documentar a própria regra.
 */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const SESSION = read('auth', 'session.ts');
const REPO = read('database', 'repositories', 'auth-repo.ts');
const SCHEMA = read('database', 'schema', 'auth.ts');
const ACTIONS = read('app', 'entrar', 'actions.ts');
const SEND = read('email', 'send.ts');

describe('o token', () => {
  /**
   * `Math.random()` é previsível: observando saídas anteriores dá para reconstruir o estado do
   * gerador e prever as próximas. Num token de acesso, isso é o mesmo que publicar as chaves.
   */
  it('vem de aleatoriedade criptográfica, nunca de Math.random', () => {
    expect(REPO).toContain('randomBytes(32)');
    expect(code(REPO)).not.toContain('Math.random');
  });

  /**
   * O valor bruto vai no e-mail; o banco guarda só o hash. Assim um dump, um log de query ou um
   * backup mal guardado não entregam acesso a nenhuma conta com link pendente.
   */
  it('é gravado como hash, nunca em texto puro', () => {
    expect(REPO).toContain("createHash('sha256')");
    expect(SCHEMA).toContain("text('token_hash')");

    // A inserção precisa gravar o hash — o token cru não pode aparecer como valor de coluna.
    expect(REPO).toMatch(/tokenHash:\s*hash\(token\)/);
    expect(code(REPO)).not.toMatch(/tokenHash:\s*token\b/);
  });

  it('tem prazo e marca de consumo no esquema', () => {
    expect(SCHEMA).toContain("timestamp('expires_at'");
    expect(SCHEMA).toContain("timestamp('consumed_at'");
  });
});

describe('o consumo do link', () => {
  /**
   * ─── POR QUE UMA INSTRUÇÃO SÓ ───────────────────────────────────────────────────────────────
   *
   * Com `SELECT` seguido de `UPDATE`, dois acessos simultâneos ao mesmo link — o que acontece de
   * verdade quando um filtro de e-mail abre a URL antes da pessoa — passariam os dois pelo
   * `SELECT` antes de qualquer `UPDATE`, e o uso único deixaria de ser único.
   *
   * Num `UPDATE ... WHERE consumed_at IS NULL ... RETURNING`, o banco serializa: a segunda
   * tentativa não encontra linha e volta vazia.
   */
  it('é um UPDATE atômico com guarda, não um SELECT seguido de UPDATE', () => {
    const fn = REPO.slice(REPO.indexOf('export async function consumeLoginToken'));
    const corpo = fn.slice(0, fn.indexOf('\nexport '));

    expect(corpo).toContain('.update(loginTokens)');
    expect(corpo).toContain('isNull(loginTokens.consumedAt)');
    expect(corpo).toContain('gt(loginTokens.expiresAt');
    expect(corpo).toContain('.returning(');

    // Um SELECT em `loginTokens` antes do update seria a versão com corrida.
    expect(code(corpo)).not.toMatch(/\.from\(loginTokens\)/);
  });

  /**
   * Entrar não pode ser consequência de VISITAR a URL. Filtros corporativos de e-mail abrem os
   * links recebidos para inspecioná-los; se a visita consumisse, o filtro gastaria o link e a
   * pessoa encontraria "inválido" no primeiro clique.
   */
  it('acontece num POST, e a página do link não consome nada', () => {
    const pagina = read('app', 'entrar', '[token]', 'page.tsx');
    expect(pagina).toContain('<form action={confirmLink}');
    expect(code(pagina)).not.toContain('consumeLoginToken');
  });
});

describe('o formulário de acesso não denuncia quem é cliente', () => {
  /**
   * Se a tela dissesse "esse e-mail não tem conta", qualquer pessoa descobriria, um endereço por
   * vez, quem comprou aqui. É pouco para o negócio e pode ser muito para o titular do endereço.
   */
  it('e-mail desconhecido e e-mail enviado produzem a mesma resposta', () => {
    const fn = ACTIONS.slice(ACTIONS.indexOf('export async function requestLink'));
    const corpo = fn.slice(0, fn.indexOf('\nexport '));

    // `unknown_email` não pode virar mensagem própria — só o caminho de emissão é tratado.
    expect(code(corpo)).not.toContain("kind === 'unknown_email'");
    expect(corpo).toContain("result.kind === 'issued'");
    expect(corpo).toContain('return { sent: true }');
  });

  /** O teto protege o dono do endereço: sem ele, o formulário vira ferramenta de assédio. */
  it('há limite de pedidos por endereço, contado no banco', () => {
    expect(REPO).toContain('MAX_PER_WINDOW');
    expect(REPO).toContain('rate_limited');
    expect(REPO).toMatch(/count\(\*\)/);
  });

  /**
   * A conta nasce na COMPRA. Criar usuário a partir do formulário público deixaria qualquer um
   * encher a tabela com endereços de terceiros — cada um recebendo um e-mail que nunca pediu.
   */
  it('pedir link não cria usuário', () => {
    const fn = REPO.slice(REPO.indexOf('export async function requestLoginLink'));
    const corpo = fn.slice(0, fn.indexOf('\nexport '));
    expect(code(corpo)).not.toContain('.insert(users)');
  });
});

describe('a sessão', () => {
  const original = process.env.AUTH_SECRET;
  afterEach(() => {
    if (original === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = original;
  });

  it('exige segredo longo, e não funciona sem ele', () => {
    delete process.env.AUTH_SECRET;
    expect(authConfigured()).toBe(false);

    process.env.AUTH_SECRET = 'curto-demais';
    expect(authConfigured()).toBe(false);

    process.env.AUTH_SECRET = 'a'.repeat(32);
    expect(authConfigured()).toBe(true);
  });

  /**
   * Um segredo padrão estaria no repositório, ou seja, seria público — e qualquer pessoa forjaria
   * um cookie válido para qualquer conta. Falhar fechado é a única opção defensável.
   */
  it('não tem segredo padrão em lugar nenhum', () => {
    expect(code(SESSION)).not.toMatch(/AUTH_SECRET\s*(\?\?|\|\|)\s*['"`]/);
  });

  /**
   * Comparação ingênua devolve mais rápido quanto antes surgir o primeiro byte diferente. Medindo
   * o tempo, dá para descobrir a assinatura byte a byte sem nunca conhecer o segredo.
   */
  it('compara a assinatura em tempo constante', () => {
    expect(SESSION).toContain('timingSafeEqual');
  });

  it('o cookie é httpOnly e não viaja em claro em produção', () => {
    expect(SESSION).toContain('httpOnly: true');
    expect(SESSION).toContain("secure: process.env.NODE_ENV === 'production'");
  });
});

describe('o envio de e-mail', () => {
  /**
   * Sem chave configurada, o pior desfecho é dizer que enviou: a pessoa espera, procura no spam,
   * tenta de novo, e nada saiu. Melhor admitir que o envio não está ligado.
   */
  it('sem chave, admite que não enviou em vez de fingir sucesso', () => {
    expect(SEND).toContain("reason: 'not_configured'");
    const fn = ACTIONS.slice(ACTIONS.indexOf('export async function requestLink'));
    expect(fn).toContain('if (!sent.ok)');
  });

  /** Em produção o corpo carrega um link de acesso válido — e log é lido por mais gente do que se imagina. */
  it('nunca imprime o corpo do e-mail no log de produção', () => {
    expect(SEND).toMatch(/NODE_ENV !== 'production'[\s\S]{0,200}console\.log/);
  });
});

describe('os e-mails', () => {
  const link = magicLinkEmail({ url: 'https://tennisengineer.com.br/entrar/abc123', minutes: 15 });
  const recibo = reportReadyEmail({
    url: 'https://tennisengineer.com.br/resultado/xyz',
    productName: 'Análise completa',
    amountCents: 4999,
  });

  /**
   * Mensagem só-HTML é sinal clássico de spam e os filtros pontuam por isso. O texto também é o
   * que aparece na prévia da lista de mensagens, antes de a pessoa abrir.
   */
  it.each([
    ['link de acesso', link],
    ['recibo', recibo],
  ])('%s tem versão em texto e assunto', (_nome, email) => {
    expect(email.subject.length).toBeGreaterThan(10);
    expect(email.text.length).toBeGreaterThan(60);
    expect(email.html).toContain('<!doctype html>');
  });

  /**
   * Botão é imagem-de-link para muita gente: alguns clientes bloqueiam, outros a pessoa não
   * confia, e num leitor de tela ele pode não existir. A URL escrita é o caminho que nunca falha.
   */
  it('o endereço aparece também como texto, não só dentro do botão', () => {
    const url = 'https://tennisengineer.com.br/entrar/abc123';
    expect(link.text).toContain(url);
    // Duas ocorrências no HTML: o href do botão e a linha copiável embaixo dele.
    expect(link.html.split(url).length - 1).toBeGreaterThanOrEqual(2);
  });

  /**
   * Clientes de e-mail não são navegadores: o Outlook desktop renderiza com o motor do Word e o
   * Gmail remove `<style>`. Fonte externa e CSS em bloco simplesmente não chegam.
   */
  it('não depende de recurso externo nem de CSS em bloco', () => {
    for (const email of [link, recibo]) {
      expect(email.html).not.toContain('<style');
      expect(email.html).not.toContain('@font-face');
      expect(email.html).not.toMatch(/<link[^>]+stylesheet/);
      expect(email.html).not.toMatch(/<img[^>]+src="http/);
    }
  });

  it('o recibo mostra o que foi comprado e por quanto', () => {
    expect(recibo.html).toContain('Análise completa');
    expect(recibo.html).toContain('49,99');
  });
});
