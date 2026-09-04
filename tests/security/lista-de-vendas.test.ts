/**
 * `/admin/vendas` mostra vendas — e só isso.
 *
 * ═══ POR QUE UMA LISTA DE CLIENTES PRECISA DE TESTE ══════════════════════════════════════════
 *
 * `/admin/analises` recusa listar de propósito, com o motivo escrito: busca exata é ferramenta de
 * atendimento, lista é janela para folhear os dados de todos os clientes, "e a diferença entre as
 * duas coisas é uma linha de código".
 *
 * Esta tela é essa linha de código, escrita de propósito e para outra pergunta. O risco não é ela
 * existir: é ela crescer. Uma lista de vendas que amanhã ganha "buscar por parte do e-mail",
 * "mostrar o relatório aqui mesmo" ou "incluir quem tem acesso" vira, sem nenhuma decisão, a coisa
 * que a outra tela recusa ser.
 *
 * Os testes leem o fonte porque é lá que essas três coisas apareceriam.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LANCAMENTO } from '@/database/repositories/commerce-repo';

const ROOT = join(__dirname, '..', '..');
const PAGE = join(ROOT, 'src', 'app', 'admin', 'vendas', 'page.tsx');
const REPO = join(ROOT, 'src', 'database', 'repositories', 'commerce-repo.ts');

function sourceWithoutComments(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('a lista conta venda, e não acesso', () => {
  const repo = sourceWithoutComments(REPO);

  it('filtra por pagamento confirmado', () => {
    expect(repo).toMatch(/vendasDesde[\s\S]*eq\(orders\.status, 'paid'\)/);
  });

  it('não lê a tabela de entitlements', () => {
    /*
      Acesso por cupom NÃO é venda. Se a lista contasse entitlement, o MAITE apareceria como
      receita de R$ 0,00 e o dono veria clientes onde tem convidados — o número que ele usa para
      decidir preço passaria a incluir quem não pagou.
    */
    const corpo = repo.slice(repo.indexOf('export async function vendasDesde'));
    expect(corpo).not.toContain('entitlements');
  });

  it('diz quantos pedidos ficaram fora do corte', () => {
    // Uma lista filtrada que não declara o que escondeu mente por omissão: a soma não bateria com
    // o extrato do gateway e não haveria como saber se falta dinheiro ou se falta linha.
    expect(repo).toContain('anterioresAoCorte');
  });
});

describe('comparação de data usa operador tipado, nunca template `sql` cru', () => {
  /*
    ═══ A FALHA QUE ISTO IMPEDE DE VOLTAR ═══════════════════════════════════════════════════════

    A primeira versão desta tela comparava datas com `sql`${orders.paidAt} >= ${desde}``. O SQL
    gerado é idêntico ao do operador tipado; o PARÂMETRO não é:

      gte(orders.paidAt, desde)  →  '2026-09-03T21:00:00.000Z'   (string ISO, via mapToDriverValue)
      sql`... >= ${desde}`       →  Date { ... }                  (objeto cru, sem mapeamento)

    O template pula o `mapToDriverValue` da coluna e entrega um `Date` solto ao driver. Em produção
    a página respondeu "Application error: a server-side exception has occurred", e nada tinha
    avisado antes: build limpo, typecheck limpo, testes verdes — porque nenhum dos três executa a
    consulta.

    O resto do projeto já fazia certo (`funnel-repo`, `coupon-repo`). Esta era a única exceção, e
    foi a única que quebrou — o que é o argumento inteiro a favor de seguir o padrão de casa mesmo
    quando as duas formas "parecem iguais".
  */
  const repo = readFileSync(REPO, 'utf8');

  it('não compara coluna de data dentro de template `sql`', () => {
    const suspeitas = [...repo.matchAll(/sql`[^`]*(?:paidAt|createdAt|paid_at|created_at)[^`]*`/g)]
      .map((m) => m[0])
      .filter((s) => /[<>]=?/.test(s));
    expect(suspeitas).toEqual([]);
  });

  it('usa `gte` e `lt` importados do drizzle', () => {
    expect(repo).toMatch(/import \{[^}]*\bgte\b[^}]*\} from 'drizzle-orm'/);
    expect(repo).toMatch(/import \{[^}]*\blt\b[^}]*\} from 'drizzle-orm'/);
  });
});

describe('o corte é o lançamento, e é explícito', () => {
  it('a constante é anterior a agora', () => {
    expect(LANCAMENTO.getTime()).toBeLessThan(Date.now());
  });

  it('é 03/09/2026 às 18h no horário de Brasília', () => {
    /*
      Fixado no teste porque a data é um fato sobre o passado, não uma preferência: tudo pago antes
      dela é o dono testando. Se alguém mudar a constante por engano, a receita muda em silêncio —
      e receita inflada é o número que faz decidir errado sobre preço e sobre anúncio.
    */
    expect(LANCAMENTO.toISOString()).toBe('2026-09-03T21:00:00.000Z');
    expect(
      LANCAMENTO.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }),
    ).toBe('03/09/2026, 18:00');
  });
});

describe('a tela não vira a janela que `/admin/analises` recusa ser', () => {
  const page = sourceWithoutComments(PAGE);

  it('exige autenticação antes de qualquer leitura', () => {
    const auth = page.indexOf('isAuthenticated');
    const leitura = page.indexOf('vendasDesde');
    expect(auth).toBeGreaterThan(-1);
    expect(auth).toBeLessThan(leitura);
  });

  it('leva ao relatório por link, sem embutir o conteúdo', () => {
    expect(page).toContain('/resultado/${v.publicId}');
    // `getReport` traria o relatório para dentro da lista — ler o de um cliente tem de ser um ato.
    expect(page).not.toContain('getReport');
  });

  it('registra o acesso', () => {
    expect(page).toContain('registrarAcessoAVendas');
  });

  it('não tem campo de busca', () => {
    // Busca vive em `/admin/analises`, exata e registrada. Um campo aqui duplicaria a porta de
    // entrada com a regra mais frouxa das duas.
    expect(page).not.toContain('<form');
    expect(page).not.toContain('<input');
  });
});

describe('as duas telas continuam separadas', () => {
  it('`/admin/analises` não passa a listar', () => {
    const analises = sourceWithoutComments(
      join(ROOT, 'src', 'app', 'admin', 'analises', 'page.tsx'),
    );
    expect(analises).not.toContain('vendasDesde');
  });

  it('a tela nova está na navegação', () => {
    // O comentário de `nav.tsx` conta o defeito que isso evita: a tela do funil existiu sem
    // caminho até ela porque cada tela tinha a própria cópia da lista de links.
    expect(readFileSync(join(ROOT, 'src', 'app', 'admin', 'nav.tsx'), 'utf8')).toContain(
      "'/admin/vendas'",
    );
  });
});
