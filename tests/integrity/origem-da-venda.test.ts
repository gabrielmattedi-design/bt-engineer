import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * ═══ A ORIGEM DE CADA VENDA, PEDIDO A PEDIDO ═════════════════════════════════════════════════
 *
 * A tela de funil já somava por origem, e isso nunca respondeu a pergunta que o dono fez em 18/09 e
 * repetiu em 21/09:
 *
 *   *"tem como eu saber das vendas que fiz ontem via link da bio? quantas foram após as 13 horas?"*
 *
 * Somatório por dia não cruza fonte com HORÁRIO — e o horário é o que liga uma venda a um post
 * publicado numa hora específica. Sem isso, "o reel vendeu" é impressão, e impressão é o que faz
 * repetir a coisa errada por um mês.
 *
 * A lista de vendas já tinha o horário. Faltava a origem na mesma linha.
 */
const REPO = readFileSync('src/database/repositories/commerce-repo.ts', 'utf8');
const TELA = readFileSync('src/app/admin/vendas/page.tsx', 'utf8');

/** Só o trecho da consulta, para as buscas não pegarem código de outro lugar do arquivo. */
const CONSULTA = /export async function vendasDesde\([\s\S]*?\n\}\n/.exec(REPO)?.[0] ?? '';

describe('a corrente que liga pedido a origem', () => {
  it('a consulta foi encontrada', () => {
    expect(CONSULTA, 'vendasDesde sumiu ou mudou de forma').not.toBe('');
  });

  /**
   * O pedido guarda a SESSÃO do navegador; a campanha guarda o HASH do cookie.
   * `anonymous_sessions` é o elo do meio. Tirar qualquer um dos dois joins deixa a coluna vazia
   * para todo mundo — e uma coluna sempre vazia lê como "ninguém veio de link marcado", que é uma
   * conclusão de negócio completamente errada.
   */
  it('passa por anonymous_sessions e chega em visitor_campaigns', () => {
    expect(CONSULTA).toContain('anonymousSessions');
    expect(CONSULTA).toContain('visitorCampaigns');
    expect(CONSULTA).toMatch(/visitorCampaigns\.visitorHash[\s\S]{0,80}cookieTokenHash/);
  });

  /**
   * ⚠️ `coalesce(sessão da análise, sessão do pedido)`, NESTA ORDEM.
   *
   * É a mesma de `processPaymentEvent` e de `dinheiroPorOrigem`, e a ordem é a regra: a pessoa pode
   * ter comprado de outro aparelho, e a identidade que vale é a de quem RESPONDEU o questionário —
   * é ela que carrega o cookie que viu o anúncio. Invertendo, a compra feita no computador depois
   * de responder no celular perderia a origem.
   */
  it('o dono do pedido é a sessão da análise antes da sessão do pedido', () => {
    expect(CONSULTA, 'a ordem do coalesce inverteu').toMatch(
      /coalesce\(\$\{recommendationSessions\.sessionId\},\s*\$\{orders\.sessionId\}\)/,
    );
  });

  /**
   * ⚠️ A TRAVA DE TEMPO, QUE É O QUE IMPEDE O NÚMERO BONITO E FALSO.
   *
   * Sem `paidAt >= campanha.createdAt`, o cliente que JÁ comprou, vê o anúncio depois e clica faz a
   * compra velha dele virar receita do criativo. O caso real que revelou isso em 09/09 está
   * documentado em `campaign-repo`: um criativo apareceu com 1 venda que aconteceu antes de o
   * anúncio existir.
   *
   * Com poucas vendas por criativo, uma ou duas dessas elegem o vencedor errado — e o erro vem
   * disfarçado de boa notícia.
   */
  it('não credita compra anterior ao clique', () => {
    expect(CONSULTA, 'a trava de tempo da atribuição caiu').toMatch(
      /gte\(\s*orders\.paidAt,\s*visitorCampaigns\.createdAt\s*\)/,
    );
  });

  /**
   * Sem origem o campo é `null`, e não três campos nulos soltos.
   *
   * `source` é `notNull` no esquema: a ausência dele é a ausência da LINHA inteira. Manter isso
   * visível no tipo impede que alguém leia `campaign: null` como "veio de algum lugar sem campanha".
   */
  it('ausência de origem é um nulo só', () => {
    expect(CONSULTA).toMatch(/origemSource === null[\s\S]{0,40}\? null/);
  });
});

describe('a tela não inventa nem esconde', () => {
  it('a coluna existe', () => {
    expect(TELA).toMatch(/<th[^>]*>Origem<\/th>/);
  });

  /**
   * ⚠️ "sem marcação", e nunca "—".
   *
   * É a mesma ausência que a tela de funil conta numa linha só, vista de perto: a pessoa chegou sem
   * link marcado. Um travessão leria como falha de registro nossa, e mandaria o dono procurar um
   * defeito que não existe — foi exatamente o tipo de caça que consumiu a tarde de 21/09.
   */
  it('quem chegou sem link marcado é nomeado, não apagado', () => {
    expect(TELA, 'a ausência de origem voltou a ser um travessão mudo').toContain('sem marcação');
  });

  /**
   * A mesma palavra nas duas telas, de propósito: quem lê "sem marcação" em Vendas tem de
   * reconhecer a linha "sem marcação" do funil como a mesma coisa. Vocabulário diferente para o
   * mesmo conceito é o que obriga a reconciliar de cabeça.
   */
  it('usa o mesmo nome que a tela de funil', () => {
    const FUNIL = readFileSync('src/app/admin/funil/page.tsx', 'utf8');
    expect(FUNIL).toContain('sem marcação');
  });
});
