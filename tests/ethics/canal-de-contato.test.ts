/**
 * Nenhuma tela promete atendimento sem dizer onde.
 *
 * ═══ A PROMESSA QUEBRADA QUE ISTO TRANCA ═════════════════════════════════════════════════════
 *
 * Três telas diziam "fale com a gente" ou "responda o e-mail da compra que a gente resolve", e não
 * havia com quem falar: o remetente é `nao-responda@`, que não recebe por decisão de projeto, e
 * nenhuma página trazia endereço nenhum.
 *
 * O custo não é de imagem, é de caixa. Quem pagou e não recebeu o relatório tem exatamente um
 * caminho quando não encontra contato: abrir disputa no gateway. Some o valor, some a taxa, e fica
 * a marca de contestação na conta que recebe — para um problema que um e-mail resolveria em dois
 * minutos.
 *
 * A regressão é fácil de reintroduzir: qualquer frase gentil de "a gente resolve" escrita sem o
 * endereço ao lado recria o buraco, e nada no produto denuncia.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTATO_EMAIL } from '@/lib/contato';

const ROOT = join(__dirname, '..', '..');

/** As telas que oferecem ajuda em algum estado de falha. */
const TELAS = [
  join('src', 'app', 'entrar', 'actions.ts'),
  join('src', 'app', 'minhas-analises', 'page.tsx'),
  join('src', 'app', 'retorno', '[sessionId]', 'page.tsx'),
  join('src', 'email', 'templates.ts'),
];

describe('quem promete ajuda diz onde pedir', () => {
  for (const tela of TELAS) {
    it(`${tela.replace(/\\/g, '/')} traz o canal de contato`, () => {
      const fonte = readFileSync(join(ROOT, tela), 'utf8');
      expect(
        fonte,
        'esta tela oferece ajuda em um estado de falha e precisa dizer para onde escrever',
      ).toContain('CONTATO_EMAIL');
    });
  }

  /**
   * O endereço vive num módulo só.
   *
   * Ele aparece em cinco pontos — três telas, os e-mails e as páginas legais. Escrito à mão em
   * cada um, o dia em que mudar deixa alguma cópia para trás; e a cópia esquecida é justamente a
   * que alguém em apuro vai tentar usar.
   */
  it('o endereço não está escrito à mão em lugar nenhum', () => {
    const soltos: string[] = [];
    for (const arquivo of varrer(join(ROOT, 'src'))) {
      if (arquivo.endsWith(join('lib', 'contato.ts'))) continue;
      if (readFileSync(arquivo, 'utf8').includes(CONTATO_EMAIL)) {
        soltos.push(arquivo.replace(ROOT, ''));
      }
    }
    expect(soltos, 'importe CONTATO_EMAIL de @/lib/contato').toEqual([]);
  });
});

describe('páginas legais alcançáveis', () => {
  it('a home leva a privacidade e termos', () => {
    const home = readFileSync(join(ROOT, 'src', 'app', 'page.tsx'), 'utf8');
    // As plataformas de anúncio checam a existência da política antes de aprovar campanha, e um
    // cliente com problema procura o contato no rodapé antes de abrir disputa.
    expect(home).toContain('/privacidade');
    expect(home).toContain('/termos');
  });

  it('as duas páginas existem e nomeiam o responsável', () => {
    for (const rota of ['privacidade', 'termos']) {
      const fonte = readFileSync(join(ROOT, 'src', 'app', '(legal)', rota, 'page.tsx'), 'utf8');
      expect(fonte).toContain('CONTATO_EMAIL');
      expect(fonte).toContain('OPERACAO');
    }
  });

  /**
   * O prazo de arrependimento é direito do consumidor, não cortesia — e precisa estar escrito.
   * Sem prazo declarado, cada pedido vira negociação, e negociação recusada vira contestação.
   */
  it('os termos declaram o prazo de reembolso', () => {
    const termos = readFileSync(join(ROOT, 'src', 'app', '(legal)', 'termos', 'page.tsx'), 'utf8');
    expect(termos).toMatch(/sete dias/i);
    expect(termos).toMatch(/reembolso/i);
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
