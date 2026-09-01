/**
 * A home tem saída depois do preço.
 *
 * ═══ O VAZAMENTO QUE ISTO TRANCA ═════════════════════════════════════════════════════════════
 *
 * A página tinha UM caminho para o questionário: o botão do herói. Os seis pilares, o fluxo, "Como
 * funciona", a seção de medida e os dois preços vinham todos depois dele, e terminavam no rodapé
 * sem nenhuma forma de começar.
 *
 * O prejuízo é o inverso do que parece. Quem sai no primeiro terço não ia converter de qualquer
 * jeito; quem lê os dois cards de preço até o fim é a pessoa MAIS convencida da página — e era
 * exatamente ela que precisava rolar dois mil pixels de volta para agir.
 *
 * Este teste existe porque a regressão é invisível: a página continua bonita, o herói continua
 * convertendo alguém, e a perda aparece só como um número de conversão mais baixo que ninguém
 * consegue explicar.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const HOME = readFileSync(join(__dirname, '..', '..', 'src', 'app', 'page.tsx'), 'utf8');

describe('caminhos para o questionário na home', () => {
  const chamadas = [...HOME.matchAll(/href="\/questionario"/g)];

  it('há mais de uma, e não só a do herói', () => {
    expect(
      chamadas.length,
      'quem lê a página inteira precisa poder começar sem rolar de volta ao topo',
    ).toBeGreaterThanOrEqual(2);
  });

  /**
   * A ordem importa tanto quanto a existência.
   *
   * Pedir a ação ANTES de a pessoa saber quanto custa produz o abandono mais caro do funil: alguém
   * começa o questionário, responde sete etapas e desiste ao ver o preço. No painel isso aparece
   * como problema do questionário, quando o problema foi a ordem da página.
   */
  it('a última chamada vem depois dos preços', () => {
    /*
      A âncora é a LEITURA do preço, não o número.

      O valor saiu do JSX (§34) e passou a vir do banco, via `precosPublicados()`. Procurar
      "R$ 49,99" no arquivo não encontra mais nada — e o teste falharia dizendo "o preço sumiu da
      home", que é falso e mandaria alguém procurar o problema no lugar errado.
    */
    const ultimoPreco = HOME.lastIndexOf('precos.full_setup');
    const ultimaChamada = chamadas[chamadas.length - 1]!.index;

    expect(ultimoPreco, 'o preço sumiu da home').toBeGreaterThan(-1);
    expect(
      ultimaChamada,
      'a chamada final precisa vir depois do preço, não antes',
    ).toBeGreaterThan(ultimoPreco);
  });

  /**
   * A objeção deste ponto da página é específica: a pessoa acabou de ler dois preços, e a dúvida
   * imediata é se o botão leva a um pagamento. A resposta existe no herói, a dois mil pixels daqui,
   * e precisa existir de novo ao lado do botão que ela está prestes a clicar.
   */
  it('a chamada final responde se é pago', () => {
    const depoisDoPreco = HOME.slice(HOME.lastIndexOf('precos.full_setup'));
    expect(depoisDoPreco).toMatch(/gratuito/i);
    expect(depoisDoPreco).toMatch(/sem cadastro/i);
  });
});
