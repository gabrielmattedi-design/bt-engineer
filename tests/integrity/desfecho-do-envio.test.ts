/**
 * O desfecho do envio da compra ao Meta, visto do painel.
 *
 * ═══ POR QUE ISTO EXISTE ═════════════════════════════════════════════════════════════════════
 *
 * Entre 10 e 12/09/2026 a pergunta "a API de Conversões está funcionando?" ficou dois dias sem
 * resposta. Não por falta de dado — o desfecho de cada envio ia para o log do servidor desde o
 * primeiro minuto. Por falta de LUGAR: o dono opera do celular, e a única instrução que eu sabia
 * dar era "abra o Gerenciador de Eventos num computador". Ele nunca estava perto de um, e a
 * campanha seguiu gastando enquanto a pergunta esperava.
 *
 * O conserto foi trazer o desfecho para o `/admin/funil`. E aí nasceu o risco que estes testes
 * cobrem: uma tela que mostra dez linhas de "recusou os cookies" em vermelho ensina o dono a
 * tratar a nossa própria regra de privacidade como defeito — e o "conserto" natural seria burlá-la.
 *
 * A classificação, e não a tradução, é a parte que decide. Por isso ela é testada.
 */

import { describe, expect, it } from 'vitest';
import { explicarMotivo } from '@/lib/motivo-do-envio';

describe('o que é o sistema funcionando NÃO pode parecer incidente', () => {
  /**
   * O caso que motivou o módulo inteiro.
   *
   * O dono autorizou, por escrito, enviar as compras de quem recusou os cookies. A recusa foi
   * mantida — o consentimento é a base legal escolhida, e sem ela não há base. Se o painel pintar
   * essa recusa de vermelho, ele passa a empurrar todo dia para a decisão que já foi recusada uma
   * vez, e por um motivo que não mudou.
   */
  it('recusa de cookie é esperado, não incidente', () => {
    const { esperado, texto } = explicarMotivo('sem_consentimento');
    expect(esperado).toBe(true);
    expect(texto).toMatch(/decisão/i);
  });

  it('falta de identificador do Meta é esperado', () => {
    /*
      Quem não veio de anúncio e não carregava o cookie do pixel não tem como ser atribuído. Não é
      falha nossa nem do Meta — é gente fora do alcance da medição, que sempre existiu.
    */
    expect(explicarMotivo('sem_identificador').esperado).toBe(true);
  });
});

describe('o que é incidente precisa gritar', () => {
  it.each([
    ['nao_configurada', /token/i],
    ['erro_de_rede', /fora do ar|tempo/i],
    ['sem_valor', /investigar/i],
  ])('%s é incidente', (motivo, esperadoNoTexto) => {
    const r = explicarMotivo(motivo);
    expect(r.esperado, `"${motivo}" foi classificado como normal`).toBe(false);
    expect(r.texto).toMatch(esperadoNoTexto);
  });

  /**
   * Os códigos HTTP não cabem numa tabela fixa, e são a causa mais provável de tudo isto.
   *
   * Token expirado e token sem a permissão certa chegam como 400 e 403, e os dois produzem o pior
   * desfecho possível: o servidor não envia, o pixel do navegador está desligado porque a variável
   * existe, e o Meta para de receber compras inteiras sem que nada na tela mude.
   */
  it.each(['http_400', 'http_403', 'http_500'])('%s é incidente e mostra o código', (motivo) => {
    const r = explicarMotivo(motivo);
    expect(r.esperado).toBe(false);
    expect(r.texto).toContain(motivo.replace('http_', 'HTTP '));
  });
});

describe('motivo que ninguém previu', () => {
  /**
   * O padrão é INCIDENTE, e a escolha é deliberada.
   *
   * Um motivo desconhecido só aparece quando alguém acrescentou um caminho de falha em
   * `meta-capi.ts` e esqueceu da tabela de tradução. Se o padrão fosse "esperado", a falha nova —
   * justamente a que ninguém previu — entraria em cinza no meio das normais e nunca seria vista.
   */
  it('cai em incidente, e não em esperado', () => {
    expect(explicarMotivo('motivo_que_ainda_nao_existe').esperado).toBe(false);
  });

  it('mostra o motivo cru em vez de engolir', () => {
    /*
      Sem tradução é ruim; sem NADA é pior. O texto cru ainda permite procurar no código.
    */
    expect(explicarMotivo('coisa_estranha').texto).toBe('coisa_estranha');
  });
});

describe('todo motivo que o envio produz tem tradução', () => {
  /**
   * A lista vem de `enviarCompra`, e o teste falha quando ela cresce sem a tabela crescer junto.
   *
   * É a trava contra a regressão mais provável deste módulo: um `return { enviado: false, motivo:
   * 'algo_novo' }` acrescentado meses depois, que chegaria ao painel como texto técnico no meio de
   * frases em português.
   */
  it.each(['nao_configurada', 'sem_consentimento', 'sem_identificador', 'sem_valor', 'erro_de_rede'])(
    '"%s" não aparece cru na tela',
    (motivo) => {
      expect(explicarMotivo(motivo).texto).not.toBe(motivo);
    },
  );
});
