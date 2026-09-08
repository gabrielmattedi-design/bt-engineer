/**
 * O consentimento decide se um terceiro pode ou não observar quem usa o produto.
 *
 * ═══ POR QUE ESTE TESTE ESTÁ EM `ethics/` E NÃO EM `unit/` ═══════════════════════════════════
 *
 * Porque o que ele protege não é uma função — é uma promessa escrita na página de privacidade. Um
 * defeito aqui não quebra tela nenhuma e não aparece em nenhum log: o site continua funcionando
 * perfeitamente enquanto carrega rastreamento para quem disse não.
 *
 * É o tipo de falha que ninguém descobre de dentro. Por isso o caso mais importante deste arquivo
 * é o mais chato de todos: cookie ausente NÃO é consentimento.
 */

import { describe, expect, it } from 'vitest';
import { CONSENT_COOKIE, parseConsent, podeRastrear } from '@/lib/consent';

describe('consentimento', () => {
  it('cookie ausente não autoriza nada', () => {
    for (const entrada of [null, undefined, '']) {
      expect(parseConsent(entrada)).toBe('nao_decidido');
      expect(podeRastrear(parseConsent(entrada))).toBe(false);
    }
  });

  it('só o valor exato "aceito" autoriza', () => {
    expect(podeRastrear(parseConsent(`${CONSENT_COOKIE}=aceito`))).toBe(true);

    /*
      A lista de negativas existe porque cada uma dessas strings já foi consentimento válido em
      algum sistema que confiava em "o cookie existe, então a pessoa aceitou". Aqui, qualquer coisa
      que não seja `aceito` é tratada como não-decidido — inclusive valores que PARECEM afirmativos.
    */
    for (const valor of ['true', '1', 'sim', 'yes', 'ACEITO', 'aceito-parcial', 'recusado', '']) {
      expect(
        podeRastrear(parseConsent(`${CONSENT_COOKIE}=${valor}`)),
        `"${valor}" não pode autorizar rastreamento`,
      ).toBe(false);
    }
  });

  it('a recusa é gravada, e não confundida com não ter respondido', () => {
    expect(parseConsent(`${CONSENT_COOKIE}=recusado`)).toBe('recusado');
  });

  it('acha o cookie no meio de outros, e não confunde com nome parecido', () => {
    const outros = 'te_visitor=abc; te_session=xyz';
    expect(podeRastrear(parseConsent(`${outros}; ${CONSENT_COOKIE}=aceito`))).toBe(true);
    expect(podeRastrear(parseConsent(`${CONSENT_COOKIE}=aceito; ${outros}`))).toBe(true);

    /* `te_consent_backup=aceito` não é `te_consent`. */
    expect(podeRastrear(parseConsent(`${CONSENT_COOKIE}_backup=aceito`))).toBe(false);
    expect(podeRastrear(parseConsent(`outro_${CONSENT_COOKIE}=aceito`))).toBe(false);
  });
});

/**
 * ═══ O PIXEL NÃO PODE SER CARREGADO FORA DO RAMO DO ACEITE ═══════════════════════════════════
 *
 * Os testes acima cobrem a decisão. Este cobre a EXECUÇÃO dela, lendo o componente como texto.
 *
 * É um teste incomum e ele existe por um motivo concreto: a proteção real do banner é estrutural —
 * a injeção do script mora dentro de um efeito que retorna cedo quando o estado não é `aceito`.
 * Uma refatoração que mova a injeção para fora desse efeito, ou que troque a condição, não quebra
 * nenhum outro teste e não muda nada na tela.
 */
describe('o carregamento do pixel', () => {
  it('só acontece dentro da condição de aceite', async () => {
    const { readFileSync } = await import('node:fs');
    const fonte = readFileSync('src/components/marketing/consent-banner.tsx', 'utf8');

    const injecao = fonte.indexOf('connect.facebook.net');
    expect(injecao, 'o componente deveria injetar o pixel').toBeGreaterThan(0);

    /* A guarda tem de vir ANTES da injeção, no mesmo efeito. */
    const guarda = fonte.indexOf("estado !== 'aceito'");
    expect(guarda, 'a guarda de consentimento sumiu').toBeGreaterThan(0);
    expect(guarda, 'a injeção do pixel passou a acontecer antes da guarda').toBeLessThan(injecao);
  });

  /**
   * ═══ O PIXEL NÃO PODE ALCANÇAR O QUESTIONÁRIO ══════════════════════════════════════════════
   *
   * O questionário pergunta sobre dor no cotovelo e sensibilidade no braço — dado de saúde. Mandar
   * isso ao Meta quebraria a promessa escrita em /privacidade e violaria a política de dados
   * sensíveis das ferramentas comerciais, que derruba conta de anúncios.
   *
   * A tentação é concreta e parece boa ideia: enviar nível, objetivo ou faixa de preço
   * "melhoraria a segmentação". Por isso a proibição não fica só no comentário — o módulo do pixel
   * não pode nem IMPORTAR de onde esses dados moram. Sem acesso, não há descuido possível.
   */
  it('o módulo do pixel não tem acesso a perfil, respostas nem resultado', async () => {
    const { readFileSync } = await import('node:fs');
    const fonte = readFileSync('src/lib/meta-pixel.ts', 'utf8');

    const proibidos = ['@/recommendation', '@/domain', '@/data', 'player-profile', 'answers'];
    for (const p of proibidos) {
      expect(
        fonte.includes(`from '${p}`) || fonte.includes(`from "${p}`),
        `meta-pixel.ts não pode importar de ${p} — ver o cabeçalho do arquivo`,
      ).toBe(false);
    }
  });

  it('nenhum outro arquivo carrega o script do Meta', async () => {
    const { globSync } = await import('node:fs');
    const arquivos = globSync('src/**/*.{ts,tsx}');

    const culpados = arquivos.filter((f) => {
      const { readFileSync } = require('node:fs') as typeof import('node:fs');
      return (
        readFileSync(f, 'utf8').includes('connect.facebook.net') &&
        !f.endsWith('consent-banner.tsx')
      );
    });

    expect(
      culpados,
      'o pixel só pode ser carregado pelo banner, que é onde mora a guarda de consentimento',
    ).toEqual([]);
  });
});
