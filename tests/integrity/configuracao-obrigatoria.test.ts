/**
 * A configuração que não tem padrão — e nunca aponta para o Tennis Engineer.
 *
 * ═══ O QUE ACONTECIA ═════════════════════════════════════════════════════════════════════════
 *
 * Este repositório é cópia integral do Tennis Engineer. Quatro módulos, com a variável ausente,
 * caíam na identidade dele:
 *
 *   src/lib/site.ts                     NEXT_PUBLIC_SITE_URL → o domínio dele
 *   src/email/send.ts                   EMAIL_FROM           → o remetente dele
 *   src/lib/contato.ts                  CONTACT_EMAIL        → a caixa de Gmail dele
 *   src/app/api/cron/pesquisa/route.ts  CONTATO_EMAIL        → o contato@ do domínio dele
 *
 * Nenhum deles dava erro. O sistema funcionava normalmente — com link de acesso, recibo, prévia
 * de WhatsApp e descadastro apontando para outra operação.
 *
 * E o quarto escondia um segundo defeito: o ensaio de /admin/pesquisa, que declara mandar "os
 * mesmos cabeçalhos do envio real", lia `CONTACT_EMAIL`; o envio real lia `CONTATO_EMAIL`. Dois
 * nomes para a mesma caixa, cada um com o seu padrão — o ensaio aprovava um destino e o cron usava
 * outro.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  apontaParaOProjetoAntigo,
  conferirAmbiente,
  OBRIGATORIAS,
  VARIAVEIS_DO_PROJETO,
} from '@/lib/ambiente';

const ROOT = join(__dirname, '..', '..');

/** Qual módulo recusa carregar sem cada variável. */
const MODULO_DE: Record<keyof typeof OBRIGATORIAS, string> = {
  NEXT_PUBLIC_SITE_URL: '@/lib/site',
  EMAIL_FROM: '@/email/send',
  CONTACT_EMAIL: '@/lib/contato',
};

const VALIDO = {
  NEXT_PUBLIC_SITE_URL: 'https://produto.test',
  EMAIL_FROM: 'Produto <nao-responda@produto.test>',
  CONTACT_EMAIL: 'contato@produto.test',
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('sem a variável, o módulo não carrega', () => {
  for (const [nome, modulo] of Object.entries(MODULO_DE)) {
    it(`${modulo} recusa carregar sem ${nome}`, async () => {
      vi.stubEnv(nome, '');
      vi.resetModules();
      await expect(import(modulo)).rejects.toThrow(nome);
    });
  }

  /**
   * O caso que motivou tudo: a variável copiada do projeto antigo. O módulo recusa mesmo com
   * valor presente e bem formado — presença não é o que importa, é para ONDE aponta.
   */
  it.each([
    ['NEXT_PUBLIC_SITE_URL', 'https://tennisengineer.com.br'],
    ['NEXT_PUBLIC_SITE_URL', 'https://www.tennisengineer.com.br'],
    ['NEXT_PUBLIC_SITE_URL', 'https://tennis-engineer.vercel.app'],
    ['EMAIL_FROM', 'Tennis Engineer <nao-responda@tennisengineer.com.br>'],
    ['CONTACT_EMAIL', 'tennisengineer.br@gmail.com'],
    ['CONTACT_EMAIL', 'contato@tennisengineer.com.br'],
  ] as const)('%s = %s é recusado', async (nome, valor) => {
    vi.stubEnv(nome, valor);
    vi.resetModules();
    await expect(import(MODULO_DE[nome])).rejects.toThrow(/Tennis Engineer/);
  });

  /** As URLs do produto são `${SITE_URL}/caminho`: barra no fim vira `//`, e http perde o HSTS. */
  it.each(['https://produto.test/', 'http://produto.test', 'produto.test', 'https://produto.test/br'])(
    'NEXT_PUBLIC_SITE_URL = %s é recusado',
    async (valor) => {
      vi.stubEnv('NEXT_PUBLIC_SITE_URL', valor);
      vi.resetModules();
      await expect(import('@/lib/site')).rejects.toThrow('NEXT_PUBLIC_SITE_URL');
    },
  );
});

describe('a trava não recusa o que é deste produto', () => {
  /**
   * `beachtennisengineer.com.br` contém `tennisengineer.com.br` como sufixo e é candidato real a
   * domínio deste projeto. Uma trava que o recusasse seria desligada no primeiro dia — e a
   * proteção iria junto.
   */
  it.each([
    'https://beachtennisengineer.com.br',
    'https://www.beachtennisengineer.com.br',
    'Beach Tennis Engineer <nao-responda@beachtennisengineer.com.br>',
    'beachtennisengineer.br@gmail.com',
    'https://bt-engineer.vercel.app',
    'https://beach-tennis-engineer.vercel.app',
  ])('%s passa', (valor) => {
    expect(apontaParaOProjetoAntigo(valor)).toBe(false);
  });

  it('um ambiente completo e novo passa no portão de build', () => {
    expect(conferirAmbiente(VALIDO)).toEqual([]);
  });
});

describe('o portão de build', () => {
  it('lista TODOS os problemas de uma vez, não um por deploy', () => {
    expect(conferirAmbiente({})).toHaveLength(Object.keys(OBRIGATORIAS).length);
  });

  /**
   * A varredura é do ambiente inteiro, não só das três. Se alguém adicionar o domínio antigo a
   * este projeto na Vercel, ele aparece numa variável que a própria hospedagem injeta.
   */
  it('recusa o domínio antigo em qualquer variável, inclusive as da hospedagem', () => {
    const problemas = conferirAmbiente({
      ...VALIDO,
      VERCEL_PROJECT_PRODUCTION_URL: 'www.tennisengineer.com.br',
    });
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain('VERCEL_PROJECT_PRODUCTION_URL');
  });

  it('roda antes do build, e antes da trava do catálogo', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    expect(pkg.scripts.build).toMatch(/^npm run config:gate && npm run dataset:gate && next build$/);
  });
});

describe('um nome só para o canal de contato', () => {
  it('o cron e o ensaio de /admin/pesquisa leem o descadastro do mesmo lugar', () => {
    const cron = readFileSync(join(ROOT, 'src/app/api/cron/pesquisa/route.ts'), 'utf8');
    const ensaio = readFileSync(join(ROOT, 'src/app/admin/pesquisa/acoes.ts'), 'utf8');
    for (const fonte of [cron, ensaio]) {
      expect(fonte).toContain("import { CONTATO_EMAIL } from '@/lib/contato'");
      expect(fonte).toContain('<mailto:${CONTATO_EMAIL}?subject=sair>');
    }
    expect(cron).not.toMatch(/process\.env\.CONTATO_EMAIL/);
  });
});

describe('o código inteiro', () => {
  const DIRETORIOS = ['src', 'scripts', 'tests'];
  const EXCECOES = new Set([
    join(ROOT, 'src', 'lib', 'ambiente.ts'), // a lista de bloqueio
    __filename, // os casos de teste acima
  ]);

  function fontes(dir: string): string[] {
    const saida: string[] = [];
    for (const entrada of readdirSync(dir)) {
      const full = join(dir, entrada);
      if (statSync(full).isDirectory()) saida.push(...fontes(full));
      else if (/\.(ts|tsx|mjs)$/.test(entrada)) saida.push(full);
    }
    return saida;
  }

  const TODOS = DIRETORIOS.flatMap((d) => fontes(join(ROOT, d)));

  const semComentarios = (arquivo: string): string =>
    readFileSync(arquivo, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');

  /**
   * Nem padrão, nem literal num componente, nem URL de exemplo num teste. Comentários ficam de fora:
   * eles contam a história desta correção e precisam poder citar o endereço antigo.
   */
  it('não escreve a identidade do Tennis Engineer fora de comentário', () => {
    const achados: string[] = [];
    for (const arquivo of TODOS) {
      if (EXCECOES.has(arquivo)) continue;
      for (const [i, linha] of semComentarios(arquivo).split('\n').entries()) {
        if (apontaParaOProjetoAntigo(linha)) achados.push(`${relative(ROOT, arquivo)}:${i + 1}`);
      }
    }
    expect(achados, `identidade do projeto antigo no código:\n  ${achados.join('\n  ')}`).toEqual([]);
  });

  /**
   * A lista de variáveis é a que o dono confere antes do primeiro deploy. Ela só serve se for
   * completa — uma variável lida no código e ausente da lista é exatamente a que fica sem
   * configurar, ou configurada com o valor do projeto antigo.
   */
  it('toda variável lida pelo código está em VARIAVEIS_DO_PROJETO, e só elas', () => {
    const lidas = new Set<string>();
    for (const arquivo of TODOS) {
      if (arquivo.startsWith(join(ROOT, 'tests'))) continue;
      for (const m of semComentarios(arquivo).matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) {
        lidas.add(m[1]!);
      }
    }
    lidas.delete('NODE_ENV'); // da plataforma
    lidas.delete('CHROMIUM_PATH'); // só o gerador de criativos, na máquina de quem faz arte

    expect([...lidas].sort()).toEqual([...VARIAVEIS_DO_PROJETO].sort());
  });
});
