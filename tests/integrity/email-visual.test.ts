import { describe, expect, it } from 'vitest';
import {
  magicLinkEmail,
  reportReadyEmail,
  satisfactionSurveyEmail,
} from '../../src/email/templates';
import { AMOSTRAS, amostraPor } from '../../src/email/amostras';

/**
 * O visual do e-mail, travado por teste.
 *
 * ═══ POR QUE ISTO MERECE TESTE ═══════════════════════════════════════════════════════════════
 *
 * O e-mail é a única peça do produto que ninguém vê antes de chegar ao cliente. Uma página quebrada
 * se descobre abrindo o site; um e-mail quebrado se descobre pelo silêncio de quem não abriu.
 *
 * E o que quebra aqui não é código: é alguém, um dia, acrescentar um logotipo em PNG porque ficaria
 * mais bonito — e derrubar de uma vez a exibição no Gmail (que bloqueia imagem), a privacidade
 * (imagem hospedada avisa quando a mensagem foi aberta) e a entregabilidade (proporção
 * imagem/texto é métrica de filtro). Os três comentários em `templates.ts` explicam. Estes testes
 * fazem a explicação valer.
 */

const TODOS = [
  { nome: 'link de acesso', email: magicLinkEmail({ url: 'https://x.test/e/1', minutes: 15 }) },
  {
    nome: 'relatório pronto',
    email: reportReadyEmail({
      url: 'https://x.test/r/1',
      productName: 'Setup completo',
      amountCents: 4999,
    }),
  },
  { nome: 'pesquisa', email: satisfactionSurveyEmail({ url: 'https://x.test/avaliacao/t' }) },
] as const;

describe('o e-mail se veste de marca sem imagem nenhuma', () => {
  for (const { nome, email } of TODOS) {
    it(`${nome}: nenhuma tag de imagem`, () => {
      expect(email.html).not.toMatch(/<img\b/i);
      expect(email.html).not.toMatch(/<svg\b/i);
      /* `background:url(...)` é imagem por outro nome — e some no Outlook, que ignora fundo em CSS. */
      expect(email.html).not.toMatch(/url\(/i);
    });

    it(`${nome}: não busca nada de fora`, () => {
      /*
        Fonte do Google, CSS remoto, pixel de rastreio — tudo entra por um destes. Nenhum e-mail
        deste produto faz requisição externa: o que chega, chega inteiro.
      */
      expect(email.html).not.toMatch(/@import/i);
      expect(email.html).not.toMatch(/<link\b/i);
      expect(email.html).not.toMatch(/fonts\.(googleapis|gstatic)/i);
    });

    it(`${nome}: declara o esquema de cor para o modo escuro`, () => {
      expect(email.html).toContain('name="color-scheme"');
      expect(email.html).toContain('name="supported-color-schemes"');
    });

    /**
     * Gmail e Outlook reescrevem o `style` das mensagens no modo escuro; o atributo `bgcolor` é o
     * que sobrevive. Fundo declarado só em CSS é fundo que pode sumir — e texto escuro sobre fundo
     * escurecido é uma mensagem ilegível que não dá erro em lugar nenhum.
     */
    it(`${nome}: todo fundo em CSS também está em bgcolor`, () => {
      const tags = email.html.match(/<(?:body|table|td)\b[^>]*>/gi) ?? [];
      const semAtributo = tags.filter(
        (t) => /background-color:/i.test(t) && !/bgcolor=/i.test(t),
      );
      expect(semAtributo, 'fundo que some se o cliente reescrever o CSS').toEqual([]);
    });

    it(`${nome}: tem versão em texto de verdade`, () => {
      // Só-HTML é sinal clássico de spam, e o texto é o que aparece na prévia da caixa de entrada.
      expect(email.text.length).toBeGreaterThan(80);
      expect(email.text).not.toMatch(/<[a-z]/i);
    });
  }
});

describe('a regra da marca vale também no e-mail', () => {
  /**
   * Brand book: "A marca deve ser aplicada sempre em preto ou branco. Cores de destaque nunca são
   * aplicadas à marca."
   *
   * Este arquivo já quebrou essa regra uma vez — a wordmark saía em VERDE sobre fundo branco, que é
   * exatamente o que o book proíbe. O componente do site impede por construção (`Logo` só expõe
   * `tone: 'light' | 'dark'`); aqui o HTML é string, e string não tem construção que impeça nada.
   * Então impede o teste.
   */
  for (const { nome, email } of TODOS) {
    it(`${nome}: a wordmark é branca sobre o verde institucional`, () => {
      const faixa = /<div style="([^"]*)">TENNIS&nbsp;ENGINEER<\/div>/.exec(email.html);
      expect(faixa, 'a wordmark sumiu ou mudou de forma').not.toBeNull();

      const estilo = faixa?.[1] ?? '';
      expect(estilo).toContain('color:#FFFFFF');
      for (const acento of ['#0E3D2E', '#D85A2B', '#1491E6', '#FFC62E', '#3A7D63']) {
        expect(estilo, `a marca não pode ser pintada de ${acento}`).not.toContain(
          `color:${acento}`,
        );
      }
    });
  }
});

describe('o que o cliente clica', () => {
  for (const { nome, email } of TODOS) {
    /**
     * O botão pode falhar de muitas formas — bloqueado, não reconhecido, invisível num leitor de
     * tela, inexistente num relógio. O endereço escrito por extenso é o caminho que nunca falha, e
     * é também o que permite conferir para onde se está indo antes de clicar.
     */
    it(`${nome}: o endereço aparece escrito, e não só dentro do botão`, () => {
      const semBotao = email.html.replace(/<a\b[\s\S]*?<\/a>/g, '');
      expect(semBotao).toContain('https://x.test');
      expect(email.text).toContain('https://x.test');
    });
  }

  it('a pesquisa leva ao formulário, e não ao relatório', () => {
    const { html, text } = satisfactionSurveyEmail({ url: 'https://x.test/avaliacao/abc' });
    expect(html).toContain('https://x.test/avaliacao/abc');
    expect(text).toContain('https://x.test/avaliacao/abc');
  });
});

/**
 * As amostras do ensaio — o que o painel mostra e o que o botão de teste manda.
 *
 * ═══ POR QUE ISTO É QUESTÃO DE SEGURANÇA, E NÃO DE LAYOUT ════════════════════════════════════
 *
 * Cada e-mail deste produto carrega uma chave: a URL do relatório É o acesso ao relatório, e o link
 * de entrar é um token de uso único que abre a conta. Montar as amostras com valores reais seria
 * gerar chaves válidas para conferir tipografia — e elas ficariam para sempre na caixa de quem
 * recebeu o teste, e no encaminhamento dela.
 *
 * O teste fixa a regra: os destinos das amostras são páginas públicas, sem nada depois delas.
 */
describe('as amostras do ensaio não carregam chave nenhuma', () => {
  for (const amostra of AMOSTRAS) {
    it(`${amostra.id}: nenhum destino com segredo`, () => {
      const { html, text } = amostra.montar();
      for (const corpo of [html, text]) {
        // `/resultado/<id>` e `/retorno/<id>` são conteúdo de uma pessoa específica.
        expect(corpo).not.toMatch(/\/(resultado|retorno|planos|analise)\//);
        // `/entrar/<token>` abre a conta; `/entrar` sozinho é só a tela de login.
        expect(corpo).not.toMatch(/\/entrar\/\S/);
        // `/avaliacao/<token>` responde pelo pedido de alguém; `/avaliacao/previa` não grava nada.
        expect(corpo).not.toMatch(/\/avaliacao\/(?!previa)\S/);
      }
    });
  }

  /**
   * `List-Unsubscribe` é o que faz o Gmail desenhar "cancelar inscrição" no topo da mensagem. Ele
   * existe na pesquisa e NÃO nos transacionais — oferecer descadastro de um e-mail que a pessoa
   * comprou é convidá-la a perder o acesso ao produto (ver `email/send.ts`).
   *
   * Se a amostra marcasse o campo errado, o ensaio mostraria um botão que o cliente não vai ver, ou
   * esconderia um que ele vai — e o ensaio existe justamente para isso não acontecer.
   */
  it('só a pesquisa oferece descadastro', () => {
    const comDescadastro = AMOSTRAS.filter((a) => a.descadastro).map((a) => a.id);
    expect(comDescadastro).toEqual(['pesquisa']);
  });

  it('um modelo desconhecido cai na primeira amostra em vez de quebrar', () => {
    expect(amostraPor('xpto').id).toBe(AMOSTRAS[0]?.id);
    expect(amostraPor(null).id).toBe(AMOSTRAS[0]?.id);
    expect(amostraPor('pesquisa').id).toBe('pesquisa');
  });
});
