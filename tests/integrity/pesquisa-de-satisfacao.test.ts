import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { lerResposta, resumirPesquisa, seguiu } from '@/lib/pesquisa';

/**
 * A pesquisa existe para responder uma pergunta de diagnóstico, e os testes abaixo protegem
 * justamente as contagens que essa resposta usa. Uma pesquisa cujo agrupamento está errado é pior
 * que nenhuma pesquisa: ela produz uma decisão confiante em cima de um número falso.
 */

function form(campos: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.append(k, v);
  return f;
}

describe('lerResposta', () => {
  it('sem a pergunta obrigatória, devolve null', () => {
    expect(lerResposta(form({}))).toBeNull();
    expect(lerResposta(form({ usou: 'qualquer_coisa' }))).toBeNull();
    expect(lerResposta(form({ sugestao: 'só o texto' }))).toBeNull();
  });

  it('lê a resposta completa de quem seguiu', () => {
    const r = lerResposta(
      form({
        usou: 'segui_tudo',
        efeito: 'melhorou_muito',
        nota_laudo: '5',
        sugestao: '  um plano de manutenção  ',
        pode_contatar: 'sim',
      }),
    );

    expect(r?.usou).toBe('segui_tudo');
    expect(r?.efeito).toBe('melhorou_muito');
    expect(r?.notaLaudo).toBe(5);
    expect(r?.sugestao).toBe('um plano de manutenção');
    expect(r?.podeContatar).toBe(true);
    expect(r?.impedimento).toBeNull();
  });

  it('⚠️ descarta o campo do ramo que a pessoa NÃO escolheu', () => {
    /*
      As duas ramificações ficam lado a lado na mesma página, sem JavaScript — então é possível
      marcar "segui tudo" e também um motivo de impedimento. Guardar os dois criaria uma linha que
      contradiz a si mesma, e a contagem de "não seguiu por custo" passaria a incluir quem seguiu.
    */
    const seguindo = lerResposta(
      form({ usou: 'segui_tudo', efeito: 'melhorou_muito', impedimento: 'custo', impedimento_outro: 'x' }),
    );
    expect(seguindo?.impedimento).toBeNull();
    expect(seguindo?.impedimentoOutro).toBeNull();

    const naoSeguindo = lerResposta(
      form({ usou: 'ainda_nao', impedimento: 'custo', efeito: 'melhorou_muito' }),
    );
    expect(naoSeguindo?.efeito).toBeNull();
    expect(naoSeguindo?.impedimento).toBe('custo');
  });

  it('o texto de "outro" só sobrevive colado ao motivo "outro"', () => {
    const outro = lerResposta(
      form({ usou: 'nao_vou', impedimento: 'outro', impedimento_outro: 'já tinha trocado antes' }),
    );
    expect(outro?.impedimentoOutro).toBe('já tinha trocado antes');

    const orfao = lerResposta(
      form({ usou: 'nao_vou', impedimento: 'custo', impedimento_outro: 'texto solto' }),
    );
    expect(orfao?.impedimentoOutro).toBeNull();
  });

  it('⚠️ nota fora da escala vira null, e não média envenenada', () => {
    for (const ruim of ['0', '6', '9', '-3', '4.5', 'cinco', '']) {
      expect(lerResposta(form({ usou: 'segui_tudo', nota_laudo: ruim }))?.notaLaudo).toBeNull();
    }
    expect(lerResposta(form({ usou: 'segui_tudo', nota_laudo: '1' }))?.notaLaudo).toBe(1);
    expect(lerResposta(form({ usou: 'segui_tudo', nota_laudo: '5' }))?.notaLaudo).toBe(5);
  });

  it('campo aberto é cortado em 2000 caracteres', () => {
    const r = lerResposta(form({ usou: 'segui_tudo', sugestao: 'a'.repeat(5000) }));
    expect(r?.sugestao).toHaveLength(2000);
  });

  it('resposta parcial é aceita — só a pergunta 1 é obrigatória', () => {
    const r = lerResposta(form({ usou: 'ainda_nao' }));
    expect(r).not.toBeNull();
    expect(r?.impedimento).toBeNull();
    expect(r?.notaLaudo).toBeNull();
    expect(r?.podeContatar).toBeNull();
  });

  it('"pode contatar" distingue não respondido de "prefiro não"', () => {
    expect(lerResposta(form({ usou: 'segui_tudo' }))?.podeContatar).toBeNull();
    expect(lerResposta(form({ usou: 'segui_tudo', pode_contatar: 'nao' }))?.podeContatar).toBe(false);
    expect(lerResposta(form({ usou: 'segui_tudo', pode_contatar: 'sim' }))?.podeContatar).toBe(true);
  });
});

describe('seguiu', () => {
  it('separa quem mexeu no equipamento de quem não mexeu', () => {
    expect(seguiu('segui_tudo')).toBe(true);
    expect(seguiu('segui_parte')).toBe(true);
    expect(seguiu('ainda_nao')).toBe(false);
    expect(seguiu('nao_vou')).toBe(false);
    expect(seguiu(null)).toBe(false);
  });
});

describe('resumirPesquisa', () => {
  const r = (usou: string | null, efeito: string | null, imp: string | null, nota: number | null) => ({
    usou,
    efeito,
    impedimento: imp,
    notaLaudo: nota,
  });

  it('⚠️ a taxa de resposta divide por ENVIADAS', () => {
    const s = resumirPesquisa(10, [r('segui_tudo', 'melhorou_muito', null, 5)]);
    expect(s.taxaDeResposta).toBe(10);
    expect(s.respondidas).toBe(1);
  });

  it('a taxa de ativação é a fração de quem mexeu no equipamento', () => {
    const s = resumirPesquisa(10, [
      r('segui_tudo', 'melhorou_muito', null, 5),
      r('segui_parte', 'igual', null, 4),
      r('ainda_nao', null, 'tempo', 3),
      r('nao_vou', null, 'custo', 2),
    ]);
    expect(s.taxaDeAtivacao).toBe(50);
  });

  it('as porcentagens de cada pergunta ignoram quem não respondeu AQUELA pergunta', () => {
    /*
      Só quem não seguiu responde "impedimento". Se a porcentagem dividisse por todas as respostas,
      "custo" apareceria como 25% quando é 50% de quem de fato não seguiu — e a leitura do gargalo
      sairia pela metade.
    */
    const s = resumirPesquisa(10, [
      r('segui_tudo', 'melhorou_muito', null, 5),
      r('segui_tudo', 'melhorou_pouco', null, 4),
      r('ainda_nao', null, 'custo', 3),
      r('nao_vou', null, 'tempo', 2),
    ]);

    const custo = s.impedimento.find((l) => l.valor === 'custo');
    expect(custo?.n).toBe(1);
    expect(custo?.porcento).toBe(50);

    const muito = s.efeito.find((l) => l.valor === 'melhorou_muito');
    expect(muito?.porcento).toBe(50);
  });

  it('sem nenhuma resposta, nada quebra e nada mente', () => {
    const s = resumirPesquisa(7, []);
    expect(s.respondidas).toBe(0);
    expect(s.taxaDeResposta).toBe(0);
    expect(s.notaMedia).toBeNull();
    expect(s.taxaDeAtivacao).toBeNull();
    expect(s.usou.every((l) => l.n === 0 && l.porcento === 0)).toBe(true);
  });

  it('sem nenhum envio, a taxa é 0 e não Infinity', () => {
    const s = resumirPesquisa(0, []);
    expect(Number.isFinite(s.taxaDeResposta)).toBe(true);
    expect(s.taxaDeResposta).toBe(0);
  });

  it('a nota média ignora quem deixou a nota em branco', () => {
    const s = resumirPesquisa(3, [
      r('segui_tudo', null, null, 5),
      r('segui_tudo', null, null, 3),
      r('ainda_nao', null, 'tempo', null),
    ]);
    expect(s.notaMedia).toBe(4);
  });

  it('toda opção aparece na contagem, inclusive com zero', () => {
    const s = resumirPesquisa(1, [r('segui_tudo', null, null, null)]);
    expect(s.usou).toHaveLength(4);
    expect(s.usou.find((l) => l.valor === 'nao_vou')?.n).toBe(0);
  });
});

/**
 * ═══ O REGISTRO DO ENVIO ═════════════════════════════════════════════════════════════════════
 *
 * Estes testes leem o CÓDIGO, e não o comportamento, porque o que eles protegem só acontece com
 * banco e provedor reais. O que está em jogo justifica a exceção.
 *
 * A linha da pesquisa nasce antes do disparo, para travar reenvio. Logo, ela significa "foi
 * tentado". Se o resultado do envio não voltar para a linha, uma recusa do provedor fica
 * indistinguível de um sucesso — e como a linha também é a trava, aquele cliente não entra na fila
 * nunca mais. A falha não atrasa a pesquisa dele: elimina. E o único sintoma é uma resposta que não
 * chega, que é igualzinho a alguém que não quis responder.
 */
describe('o resultado do envio volta para a linha', () => {
  const cron = readFileSync(
    join(process.cwd(), 'src/app/api/cron/pesquisa/route.ts'),
    'utf8',
  );
  const repo = readFileSync(
    join(process.cwd(), 'src/database/repositories/pesquisa-repo.ts'),
    'utf8',
  );

  it('o cron registra os DOIS desfechos, e não só o sucesso', () => {
    expect(cron).toMatch(/registrarEnvio\([\s\S]{0,80}ok: true/);
    expect(cron).toMatch(/registrarEnvio\([\s\S]{0,80}ok: false/);
  });

  /**
   * Reenvio só para a recusa explícita.
   *
   * `false` é o provedor dizendo que não mandou — repetir não duplica nada. `null` é desconhecido,
   * e pode ter saído; reenviar por via das dúvidas manda a mesma pesquisa duas vezes para o mesmo
   * cliente, que é exatamente o que esta tabela existe para impedir.
   *
   * A checagem precisa estar no REPOSITÓRIO, e não só no botão: um POST direto não passa pelo
   * botão, e a regra que protege o cliente não pode morar na camada que qualquer um pula.
   */
  it('só reenvia o que o provedor recusou explicitamente', () => {
    expect(repo).toContain('envioOk !== false');
    expect(repo).toMatch(/eq\(satisfactionSurveys\.envioOk, false\)/);
  });

  /** Ausência de registro não é sucesso. Somar os dois é como a informação se perde de novo. */
  it('a leitura distingue aceito, recusado e desconhecido', () => {
    const tela = readFileSync(join(process.cwd(), 'src/app/admin/pesquisa/envios.tsx'), 'utf8');
    expect(tela).toContain('envioOk === true');
    expect(tela).toContain('envioOk === false');
    expect(tela).toContain('envioOk === null');
  });
});
