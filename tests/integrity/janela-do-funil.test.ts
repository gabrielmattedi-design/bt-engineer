/**
 * A janela de tempo do painel do funil.
 *
 * ═══ POR QUE ISTO PRECISA DE TESTE ═══════════════════════════════════════════════════════════
 *
 * O painel passou a oferecer "Hoje" e "Ontem" para uma finalidade só: dividir o gasto de um dia
 * pelo número de vendas do MESMO dia e obter o CAC — o número que decide se o orçamento sobe.
 *
 * O Gerenciador de Anúncios reporta por dia de calendário no fuso da conta, que é o de Brasília. O
 * servidor da Vercel roda em UTC. Se "hoje" nascer da meia-noite de UTC, a janela pega das 21h de
 * ontem às 21h de hoje — perdendo o fim da noite, que neste produto é quando mais se vende.
 *
 * O erro não apareceria: os dois números existem, a divisão funciona, e o CAC sai plausível. Erro
 * plausível é o mais caro que existe, porque ninguém investiga.
 */

import { describe, expect, it } from 'vitest';
import { ehDiaDeCalendario, inicioDoDia, janelaDaData, janelaDoPeriodo } from '@/lib/periodo';

/** Brasília está 3 horas atrás de UTC. */
const TRES_HORAS = 3 * 60 * 60 * 1000;

describe('o dia de calendário é o de Brasília, não o do servidor', () => {
  /**
   * O caso que o módulo existe para acertar.
   *
   * 01:00 UTC do dia 12 é 22:00 de Brasília do dia 11. "Hoje", para quem está no Brasil, ainda é o
   * dia 11 — e as vendas das 22h precisam cair nele.
   */
  it('às 22h de Brasília, "hoje" ainda é o dia que está terminando', () => {
    const agora = new Date('2026-09-12T01:00:00Z');
    const { desde } = janelaDoPeriodo('hoje', agora);

    expect(desde?.toISOString()).toBe('2026-09-11T03:00:00.000Z');
  });

  it('meia-noite de Brasília é 03:00 UTC', () => {
    const agora = new Date('2026-09-11T15:00:00Z');
    expect(inicioDoDia(0, agora).toISOString()).toBe('2026-09-11T03:00:00.000Z');
  });

  it('o servidor em UTC não desloca o corte', () => {
    /*
      Duas leituras do MESMO dia de Brasília, feitas em horas de UTC bem distantes, precisam
      devolver o mesmo começo de dia. Se dependesse do relógio do servidor, elas divergiriam.
    */
    const cedo = inicioDoDia(0, new Date('2026-09-11T04:00:00Z'));
    const tarde = inicioDoDia(0, new Date('2026-09-12T02:59:00Z'));
    expect(cedo.toISOString()).toBe(tarde.toISOString());
  });
});

describe('"ontem" é um dia fechado', () => {
  it('vai da meia-noite de ontem à meia-noite de hoje', () => {
    const agora = new Date('2026-09-11T15:00:00Z');
    const { desde, ate } = janelaDoPeriodo('ontem', agora);

    expect(desde?.toISOString()).toBe('2026-09-10T03:00:00.000Z');
    expect(ate?.toISOString()).toBe('2026-09-11T03:00:00.000Z');
  });

  it('dura exatamente 24 horas', () => {
    const { desde, ate } = janelaDoPeriodo('ontem', new Date('2026-09-11T15:00:00Z'));
    expect(ate!.getTime() - desde!.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  /**
   * O fim é EXCLUSIVO, e o teste vive aqui porque a consequência é invisível.
   *
   * Com fim inclusivo, uma venda feita exatamente à meia-noite contaria em "ontem" E em "hoje". A
   * soma dos dias ficaria maior que o total, e um funil que não fecha é um funil em que ninguém
   * confia — inclusive nas linhas que estão certas.
   */
  it('o fim de ontem é o começo de hoje, sem sobreposição', () => {
    const agora = new Date('2026-09-11T15:00:00Z');
    expect(janelaDoPeriodo('ontem', agora).ate?.toISOString()).toBe(
      janelaDoPeriodo('hoje', agora).desde?.toISOString(),
    );
  });
});

describe('as janelas rolantes continuam rolantes', () => {
  /*
    "7 dias" segue sendo as últimas 168 horas, e não os 7 últimos dias de calendário.

    Mudar isso deslocaria de uma vez todos os números que o dono já viu, sem ganho: para ler
    tendência, rolante serve igual. A distinção está escrita na tela justamente para que ninguém
    use estes para fechar CAC.
  */
  it.each([
    ['7', 7],
    ['30', 30],
    ['90', 90],
  ])('"%s" volta %i dias a contar de agora', (periodo, dias) => {
    const agora = new Date('2026-09-11T15:00:00Z');
    const { desde, ate } = janelaDoPeriodo(periodo, agora);

    expect(desde!.getTime()).toBe(agora.getTime() - dias * 24 * 60 * 60 * 1000);
    expect(ate, 'janela rolante não tem fim — vai até agora').toBeNull();
  });

  it('sem parâmetro, 30 dias', () => {
    const agora = new Date('2026-09-11T15:00:00Z');
    expect(janelaDoPeriodo(undefined, agora).desde!.getTime()).toBe(
      agora.getTime() - 30 * 24 * 60 * 60 * 1000,
    );
  });

  it('valor inválido na URL cai em 30, e não em NaN', () => {
    /*
      O parâmetro vem da barra de endereço, ou seja, de qualquer um. `Number('banana')` é `NaN`, e
      uma data construída a partir de `NaN` produziria uma consulta que devolve tudo ou nada sem
      nenhum aviso na tela.
    */
    const agora = new Date('2026-09-11T15:00:00Z');
    for (const lixo of ['banana', '-5', '0', '']) {
      const { desde } = janelaDoPeriodo(lixo, agora);
      expect(Number.isFinite(desde!.getTime()), `"${lixo}" produziu data inválida`).toBe(true);
      expect(desde!.getTime()).toBe(agora.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  });
});

describe('escolher um dia no calendário', () => {
  /**
   * ═══ POR QUE ISTO EXISTE (12/09/2026) ══════════════════════════════════════════════════════
   *
   * Os botões cobriam hoje, ontem, e pulavam para 7 dias. Anteontem era inalcançável — e o dono
   * estava justamente montando a série de CAC dia a dia contra o gasto do Meta, que ele tem por
   * dia. Metade da série não tinha como ser lida.
   */
  it('devolve o dia fechado de Brasília, meia-noite a meia-noite', () => {
    const { desde, ate } = janelaDaData('2026-09-10')!;
    expect(desde?.toISOString()).toBe('2026-09-10T03:00:00.000Z');
    expect(ate?.toISOString()).toBe('2026-09-11T03:00:00.000Z');
  });

  it('dura exatamente 24 horas', () => {
    const { desde, ate } = janelaDaData('2026-09-10')!;
    expect(ate!.getTime() - desde!.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  /**
   * A data escolhida sai pela `janelaDoPeriodo`, que é quem a página chama.
   *
   * A ordem importa: `Number('2026-09-10')` é NaN, então se a data fosse avaliada DEPOIS do
   * `Number` ela cairia no padrão de 30 dias — a tela mostraria um mês inteiro com a data escrita
   * no campo. Erro que ninguém percebe, porque a tela não fica vazia.
   */
  it('a data escolhida não cai no padrão de 30 dias', () => {
    const agora = new Date('2026-09-12T15:00:00Z');
    const { desde, ate } = janelaDoPeriodo('2026-09-10', agora);

    expect(desde?.toISOString()).toBe('2026-09-10T03:00:00.000Z');
    expect(ate?.toISOString(), 'sem fim, virou janela rolante').toBe('2026-09-11T03:00:00.000Z');
  });

  it('encosta em "ontem" sem sobrepor', () => {
    /*
      Escolher no calendário o dia que o botão "Ontem" mostra tem de dar exatamente a mesma janela.
      Dois caminhos para o mesmo dia que discordassem por uma hora produziriam dois CAC diferentes
      para o mesmo dia — e nenhum jeito de saber qual.
    */
    const agora = new Date('2026-09-12T15:00:00Z');
    expect(janelaDoPeriodo('2026-09-11', agora)).toEqual(janelaDoPeriodo('ontem', agora));
  });

  describe('data que não existe não vira janela', () => {
    /*
      O parâmetro vem da barra de endereço. `2026-02-31` transbordando para março produziria uma
      janela silenciosamente deslocada — que é pior que um erro na tela.
    */
    it.each(['2026-02-31', '2026-13-01', '10/09/2026', '2026-9-10', 'banana', ''])(
      '"%s" é recusada',
      (lixo) => {
        expect(janelaDaData(lixo)).toBeNull();
      },
    );

    it('e cai no padrão de 30 dias em vez de quebrar', () => {
      const agora = new Date('2026-09-12T15:00:00Z');
      const { desde } = janelaDoPeriodo('2026-02-31', agora);
      expect(desde!.getTime()).toBe(agora.getTime() - 30 * 24 * 60 * 60 * 1000);
    });
  });
});

describe('quais períodos fecham CAC', () => {
  /**
   * Só dia de calendário serve para dividir gasto por vendas. A janela rolante de 7 dias não se
   * sobrepõe a dia nenhum do Gerenciador de Anúncios, e o resultado dessa divisão sai plausível —
   * que é o que o torna perigoso.
   */
  it.each(['hoje', 'ontem', '2026-09-10'])('"%s" é dia fechado', (p) => {
    expect(ehDiaDeCalendario(p)).toBe(true);
  });

  it.each(['7', '30', '90', 'tudo', undefined])('"%s" não é', (p) => {
    expect(ehDiaDeCalendario(p)).toBe(false);
  });
});

describe('"tudo" não tem limite', () => {
  it('nem começo nem fim', () => {
    expect(janelaDoPeriodo('tudo')).toEqual({ desde: null, ate: null });
  });
});

describe('a aritmética do fuso', () => {
  it('o começo do dia está sempre 3 horas à frente da meia-noite UTC do mesmo dia', () => {
    const agora = new Date('2026-09-11T15:00:00Z');
    const meiaNoiteUtc = Date.parse('2026-09-11T00:00:00Z');
    expect(inicioDoDia(0, agora).getTime() - meiaNoiteUtc).toBe(TRES_HORAS);
  });
});
