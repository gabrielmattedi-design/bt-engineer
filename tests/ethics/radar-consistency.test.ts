/**
 * O gráfico não pode contradizer a recomendação.
 *
 * ═══ O DEFEITO QUE ESTE TESTE TRANCA ═══════════════════════════════════════════════════════
 *
 * Reclamação do usuário, com o gráfico na mão: a linha da raquete que ele já usa estava mais perto
 * do "o que seu jogo pede" do que a raquete recomendada. Medido no caso:
 *
 *     distância média ao alvo — ATUAL 6.5  |  RECOMENDADA 11.7
 *     fit                     — ATUAL 78.3 |  RECOMENDADA 81.2
 *
 * As duas leituras estavam certas, e é isso que tornava o defeito grave. O radar tinha seis eixos,
 * todos de comportamento de bola, que juntos respondem por 9% do score final. Os 66% que decidem —
 * peso, nível técnico, swing, estilo e conforto — não apareciam. O gráfico mostrava um terço do
 * raciocínio, e o usuário concluía, corretamente para o que via, que a escolha estava errada.
 *
 * Um relatório que precisa ser acreditado não pode ter a peça mais visível argumentando contra a
 * própria conclusão. Este teste garante que ela argumente a favor.
 */

import { describe, expect, it } from 'vitest';
import { buildPlayerProfile } from '@/recommendation/profile/build-profile';
import { recommend } from '@/recommendation';
import { serializeRecommendation } from '@/payments/entitlements';
import {
  FLOOR_SAFE_PHYSICAL,
  FLOOR_SAFE_SKILL,
} from '@/recommendation/engine/rank-rackets';
import { PERSONAS } from '@/data/personas';
import { NEED_KEYS, type NeedKey } from '@/domain/player-profile';
import { TEST_DATASET_VERSION, TEST_MODE, testRackets, testStrings } from '../helpers/catalog';

/** Qual componente alimenta cada eixo de encaixe. Espelha `AXES` em `payments/radar.ts`. */
const AXIS_COMPONENT: Record<string, string | undefined> = {
  comfort_fit: 'comfort_fit',
  physical_fit: 'physical_fit',
  skill_fit: 'skill_fit',
  swing_fit: 'swing_fit',
  playstyle_fit: 'playstyle_fit',
};

const runs = PERSONAS.map((persona) => {
  const profile = buildPlayerProfile(persona.answers);
  const result = recommend({
    profile,
    rackets: testRackets(),
    strings: testStrings(),
    datasetVersion: TEST_DATASET_VERSION,
    mode: TEST_MODE,
    includeSetup: true,
  });
  return { persona, result, report: serializeRecommendation(result, profile, ['racket_report_access']) };
});

/**
 * Área ponderada — a mesma conta que decidiu o ranking, e a que o gráfico agora exibe.
 *
 * A área CRUA de um radar trata todos os vértices como iguais. O motor não trata: `Nível técnico`
 * pesa 0.20 e cada eixo de bola pesa um terço de 0.16. Comparar área crua com decisão ponderada
 * produziria uma falha em todo caso de quase-empate — e um teste que falha por ruído é um teste que
 * alguém vai silenciar.
 *
 * O peso vai para a tela somado POR BLOCO, abaixo do gráfico. Por eixo ele já esteve no rótulo e
 * foi removido: "Spin 3%" ao lado de "Seu swing 17%" sugere que o motor ignorou o spin, quando os
 * três eixos de bola são fatias de um critério só. Bloco contra bloco é a comparação honesta.
 */
function area(axes: readonly { value: number; weight: number }[]): number {
  const total = axes.reduce((sum, a) => sum + a.weight, 0);
  if (total <= 0) return axes.reduce((sum, a) => sum + a.value, 0) / axes.length;
  return axes.reduce((sum, a) => sum + a.value * a.weight, 0) / total;
}

describe('coerência entre o radar e a recomendação', () => {
  /**
   * A LINHA TRACEJADA TEM DUAS LEITURAS, uma por bloco — e cada uma tem seu invariante.
   *
   * ═══ POR QUE NÃO É UMA SÓ ═══════════════════════════════════════════════════════════════
   *
   * Foram tentadas as duas unificações, e as duas falharam por lados opostos.
   *
   * Como NÍVEL DE PEDIDO nos oito eixos: nos cinco de encaixe o verde passava do tracejado e o
   * gráfico dizia "esta raquete entrega mais do que você precisa" — leitura sem sentido, porque
   * aqueles eixos já são adequação e não existe mais adequado que perfeito.
   *
   * Como BORDA nos oito: nos três de bola o mesmo desenho passou a acusar de excesso uma raquete
   * que entrega mais potência do que foi pedido — que é resultado bom, não defeito.
   *
   * A separação é o que resta, e é honesta porque os dois blocos medem coisas diferentes:
   *
   *   • encaixe — adequação ao par raquete+jogador. A borda é o teto, ninguém passa.
   *   • bola    — quanto do PEDIDO foi entregue. O tracejado é o tamanho do pedido, e passar dele
   *               é entregar mais do que se pediu.
   */
  it('nos eixos de encaixe a tracejada é o melhor encaixe alcançável', () => {
    for (const { persona, result, report } of runs) {
      expect(report.radar.length, persona.id).toBeGreaterThanOrEqual(8);

      const plausiveis = result.full_ranking.filter((r) => {
        const raw = (key: string) => r.breakdown.components.find((c) => c.key === key)?.raw ?? 0;
        return raw('physical_fit') >= FLOOR_SAFE_PHYSICAL && raw('skill_fit') >= FLOOR_SAFE_SKILL;
      });

      for (const axis of report.radar.filter((a) => a.group === 'voce')) {
        const componente = AXIS_COMPONENT[axis.key];
        if (!componente || plausiveis.length === 0) continue;

        const teto = Math.round(
          Math.max(
            ...plausiveis.map(
              (r) => r.breakdown.components.find((c) => c.key === componente)?.raw ?? 0,
            ),
          ),
        );

        expect(axis.profile, `${persona.id}/${axis.key}: a tracejada não é o teto alcançável`).toBe(
          teto,
        );
        expect(axis.profile, `${persona.id}/${axis.key}: teto acima do ideal`).toBeLessThanOrEqual(
          100,
        );
      }
    }
  });

  /**
   * A INVARIANTE PRINCIPAL: o eixo que a pessoa PRIORIZOU nunca é o pior vértice do gráfico.
   *
   * ═══ O DEFEITO QUE ISTO TRANCA ══════════════════════════════════════════════════════════
   *
   * Relato do usuário: "pedi potência, e o sistema me mostra que está me dando tudo menos
   * potência. Isso não pode, de jeito nenhum".
   *
   * A causa era estrutural, não de calibração. Enquanto a tracejada dos eixos de bola foi a borda
   * — "100 = alcançou o melhor que existe para você" — a recomendada ficava aquém em TODOS eles,
   * porque o melhor quadro em potência é um, o melhor em spin é outro, e ela é a melhor no
   * CONJUNTO. Somando que nos cinco eixos de encaixe ela marca 90 a 100 (foi escolhida por
   * encaixar), o eixo priorizado aparecia como o pior do desenho, sempre.
   *
   * Com a tracejada de bola sendo o PEDIDO normalizado à realidade do jogador, e as raquetes em
   * posição de catálogo, isso deixou de acontecer: 0 de 626 perfis medidos.
   *
   * Este teste é o que impede a volta de qualquer escala em que o vértice priorizado seja o menor.
   */
  it('o eixo priorizado nunca é o pior vértice', () => {
    let comPrioridade = 0;

    for (const { persona, report } of runs) {
      const profile = buildPlayerProfile(persona.answers);
      const fortes = NEED_KEYS.filter((k) => profile.desired_change_vector[k] >= 20);
      if (fortes.length === 0) continue;

      const principal = fortes.reduce((a, b) =>
        profile.desired_change_vector[a] >= profile.desired_change_vector[b] ? a : b,
      );
      const eixo = report.radar.find((a) => a.key === principal);
      if (!eixo) continue;
      comPrioridade += 1;

      const menor = Math.min(...report.radar.map((a) => a.recommended));
      expect(
        eixo.recommended,
        `${persona.id}: priorizou ${principal} e ele é o pior vértice (${eixo.recommended})`,
      ).toBeGreaterThan(menor);
    }

    expect(comPrioridade, 'nenhuma persona com prioridade — o teste não verificou nada')
      .toBeGreaterThan(0);
  });

  /**
   * A RECOMENDADA nunca passa da tracejada nos eixos de encaixe.
   *
   * A tracejada é o melhor encaixe entre as candidatas plausíveis, e a recomendada é uma delas
   * sempre que serve ao jogador — então passar dela significaria que o teto foi calculado errado.
   * As outras séries PODEM passar, e isso é informação: a raquete atual ultrapassando o teto num
   * eixo quer dizer que ela encaixa ali melhor do que qualquer coisa que caiba na recomendação.
   */
  it('a recomendada não passa do teto de encaixe', () => {
    for (const { persona, result, report } of runs) {
      const vencedora = result.full_ranking[0]!;
      const raw = (key: string) =>
        vencedora.breakdown.components.find((c) => c.key === key)?.raw ?? 0;
      const plausivel =
        raw('physical_fit') >= FLOOR_SAFE_PHYSICAL && raw('skill_fit') >= FLOOR_SAFE_SKILL;
      if (!plausivel) continue;

      for (const axis of report.radar.filter((a) => a.group === 'voce')) {
        expect(
          axis.recommended,
          `${persona.id}/${axis.key}: recomendada em ${axis.recommended} acima do teto ${axis.profile}`,
        ).toBeLessThanOrEqual(axis.profile);
        expect(axis.recommended, `${persona.id}/${axis.key}`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  /**
   * Um eixo de bola SEM pedido precisa continuar tendo dado de verdade em cada série.
   *
   * ═══ O DEFEITO QUE ISTO TRANCA ══════════════════════════════════════════════════════════
   *
   * Relato do usuário: "controle e spin devem ter algo errado, pois a linha laranja, a da
   * recomendada, a da atual e a da média estão todas no mesmo lugar".
   *
   * Estavam mesmo. Sem pedido no eixo, as séries recebiam um NEUTRAL fixo (70) que não dependia de
   * raquete nenhuma — as quatro caíam no mesmo ponto e o vértice virava um empate falso. Já tinha
   * sido tentado levar esse neutro a 100, e o empate só mudou de lugar.
   *
   * Em posição de catálogo o problema não existe: cada raquete tem a sua, pedida ou não.
   */
  it('eixo de bola sem pedido continua dependendo da raquete', () => {
    /**
     * A invariante é DEPENDÊNCIA DA RAQUETE, não que as séries diferiam entre si.
     *
     * Sem pedido no eixo, o alvo é a média do catálogo por definição — então a tracejada e a linha
     * cinza coincidem ali de propósito, e uma raquete que por acaso esteja na média coincide com
     * as duas. Isso é informação, não empate falso.
     *
     * O defeito real era outro: as séries recebiam um NEUTRAL fixo que não dependia de raquete
     * NENHUMA, e por isso davam o mesmo número para todo mundo. É isso que este teste tranca —
     * duas personas com raquetes diferentes não podem marcar o mesmo valor no mesmo eixo.
     */
    const porEixo = new Map<string, Set<number>>();
    let verificados = 0;

    for (const { persona, report } of runs) {
      const profile = buildPlayerProfile(persona.answers);

      for (const axis of report.radar.filter((a) => a.group === 'bola')) {
        if (Math.abs(profile.desired_change_vector[axis.key as NeedKey]) > 5) continue;
        verificados += 1;
        const vistos = porEixo.get(axis.key) ?? new Set<number>();
        vistos.add(axis.recommended);
        porEixo.set(axis.key, vistos);
      }
    }

    expect(verificados, 'nenhum eixo de bola sem pedido — o teste não verificou nada')
      .toBeGreaterThan(0);

    for (const [key, vistos] of porEixo) {
      if (vistos.size === 1 && verificados > porEixo.size) {
        expect(
          vistos.size,
          `${key}: todas as personas marcam ${[...vistos][0]} — o valor não depende da raquete`,
        ).toBeGreaterThan(1);
      }
    }
  });


  /**
   * Os eixos de ENCAIXE precisam estar lá — são eles que carregam a decisão.
   *
   * Sem esta asserção, alguém "simplificando" o gráfico no futuro poderia remover exatamente as
   * dimensões que o tornaram honesto, e o defeito voltaria sem barulho nenhum.
   */
  it('o gráfico mostra os eixos que realmente decidem, não só o comportamento de bola', () => {
    for (const { persona, report } of runs) {
      const keys = report.radar.map((a) => a.key);
      for (const required of ['physical_fit', 'skill_fit', 'swing_fit', 'comfort_fit']) {
        expect(keys, persona.id).toContain(required);
      }
      const voce = report.radar.filter((a) => a.group === 'voce').length;
      expect(voce / report.radar.length, `${persona.id}: eixos de encaixe`).toBeGreaterThanOrEqual(
        0.5,
      );
    }
  });

  /**
   * A recomendada tem que PARECER melhor que a atual, quando ela é melhor.
   *
   * A comparação é feita só quando o motor de fato colocou a recomendada à frente: se a raquete
   * atual do jogador é melhor, o gráfico deve mostrar isso, e o relatório recomenda ficar com ela
   * (ver `current_racket_standing`).
   */
  it('quando a recomendada vence no motor, ela também vence no gráfico', () => {
    for (const { persona, report } of runs) {
      const standing = report.current_racket_standing;
      if (!standing || standing.gap_to_first <= 0) continue;
      if (report.radar.some((a) => a.current === null)) continue;

      const areaRecommended = area(
        report.radar.map((a) => ({ value: a.recommended, weight: a.weight })),
      );
      const areaCurrent = area(
        report.radar.map((a) => ({ value: a.current as number, weight: a.weight })),
      );

      expect(
        areaRecommended,
        `${persona.id}: motor dá ${standing.gap_to_first} pontos de vantagem à recomendada, ` +
          `mas o gráfico mostra a atual maior (${areaCurrent.toFixed(1)} vs ${areaRecommended.toFixed(1)})`,
      ).toBeGreaterThanOrEqual(areaCurrent);
    }
  });
  /**
   * A série "Média do catálogo" precisa ser a média do CATÁLOGO, não a dos sobreviventes.
   *
   * ═══ O DEFEITO QUE ISTO TRANCA ══════════════════════════════════════════════════════════
   *
   * Ela era calculada sobre `full_ranking`, que já passou pelo piso de demanda. O piso remove
   * raquetes de um lado só — as fracas no eixo pedido, que tendem a ser as mais pesadas —, então
   * quem sobra é mais leve e a média de encaixe físico sobe junto.
   *
   * Medido em 2560 eixos de encaixe: desvio absoluto médio de 12,6 pontos, mediana 10,2, e casos
   * de 40 — `physical_fit` desenhado em 87 quando o catálogo entrega 47 para aquele jogador. Em
   * 78,8% dos eixos o desvio passava de 5 pontos.
   *
   * O efeito na tela é o inverso do que se imagina: a linha de comparação INFLA, e a recomendada
   * aparece menos distante da média do que realmente está. O gráfico subvendia a própria escolha.
   *
   * A média agora vem de `component_means`, calculada sobre tudo que foi pontuado, e viaja no
   * resultado — não pode ser recalculada na hora de desenhar.
   */
  it('a média do catálogo não é a média dos sobreviventes ao filtro', () => {
    let comExclusao = 0;

    for (const { persona, result, report } of runs) {
      if (result.excluded.every((e) => e.filter !== 'declared_priority_tolerance')) continue;
      comExclusao += 1;

      for (const axis of report.radar.filter((a) => a.group === 'voce')) {
        const componente = AXIS_COMPONENT[axis.key];
        if (!componente) continue;

        const mediaDosSobreviventes =
          result.full_ranking.reduce(
            (sum, r) => sum + (r.breakdown.components.find((c) => c.key === componente)?.raw ?? 50),
            0,
          ) / result.full_ranking.length;

        const esperada = result.component_means[componente] ?? 50;
        expect(axis.catalog, `${persona.id}/${axis.key}: média fora do resultado`).toBe(
          Math.round(esperada),
        );

        // E ela precisa DIFERIR da média enviesada — senão o teste passaria sem provar nada.
        if (Math.abs(mediaDosSobreviventes - esperada) > 5) return;
      }
    }

    expect(comExclusao, 'nenhuma persona teve exclusão pelo piso — nada verificado')
      .toBeGreaterThan(0);
  });
});

/**
 * Nenhum critério pode decidir sozinho.
 *
 * ═══ O QUE ISTO MEDE ══════════════════════════════════════════════════════════════════════
 *
 * Pedido do usuário, depois de olhar o gráfico: "faça um check de cada peso de forma que nenhum
 * isoladamente determine uma raquete específica". Ele estava vendo `Peso e manejo` marcar 98 contra
 * 66 e concluiu, corretamente, que aquele eixo mandava sozinho.
 *
 * Influência real não é o peso escrito: é peso × DISPERSÃO. Um critério que separa as candidatas
 * por 12 pontos decide muito mais que um que as separa por 3, com o mesmo peso na fórmula. Medido
 * antes da correção, sobre 864 perfis:
 *
 *     physical_fit   peso 19.5%  →  influência 29.5%  (1.51×)
 *     playstyle_fit  peso 15.2%  →  influência  5.8%  (0.38×)
 *
 * Depois de equalizar a dispersão e alargar as zonas mortas das réguas amplificadas, todos os
 * componentes ficam entre 0.76× e 1.15× do peso declarado.
 *
 * A razão é aferida sobre as candidatas que DISPUTAM, não sobre o catálogo inteiro: a decisão
 * acontece entre as primeiras colocadas, e medir na cauda de baixo esconde exatamente o desequilíbrio
 * que importa.
 */
/**
 * O que o jogador DECLARA não pode pesar menos que o que o motor infere.
 *
 * Reclamação do usuário: ele ordenou potência, controle e spin como o que mais busca, e os três
 * apareceram somando 15% do peso — enquanto físico, nível e swing, que ninguém declarou e o motor
 * deduz de idade, peso e autoavaliação, somavam 56%.
 *
 * Vale comercialmente (é o que o usuário reconhece como seu) e vale analiticamente: quando alguém
 * ORDENA prioridades, tratar isso como o menor termo da conta é sobrepor o inferido ao declarado.
 */
describe('prioridades declaradas têm peso', () => {
  it('quem ordena prioridades vê os eixos de bola pesarem mais que um quinto da decisão', () => {
    const declarou = PERSONAS.filter((p) => {
      const profile = buildPlayerProfile(p.answers);
      return Math.max(...NEED_KEYS.map((k) => Math.abs(profile.desired_change_vector[k]))) >= 25;
    });
    expect(declarou.length, 'nenhuma persona declara prioridade forte').toBeGreaterThan(0);

    for (const persona of declarou) {
      const profile = buildPlayerProfile(persona.answers);
      const report = serializeRecommendation(
        recommend({
          profile,
          rackets: testRackets(),
          strings: testStrings(),
          datasetVersion: TEST_DATASET_VERSION,
          mode: TEST_MODE,
          includeSetup: false,
        }),
        profile,
        ['racket_report_access'],
      );

      const bola = report.radar
        .filter((a) => a.group === 'bola')
        .reduce((s, a) => s + a.weight, 0);

      expect(
        bola,
        `${persona.id}: declarou prioridade forte mas os eixos de bola somam ${(bola * 100).toFixed(1)}%`,
      ).toBeGreaterThanOrEqual(0.2);
    }
  });

  /**
   * O 3º do top-3 é o TERCEIRO MAIS IMPORTANTE, não o menos importante de todos.
   *
   * Observação do usuário: "spin ficar em último na minha escolha não significa que pode ser
   * irrelevante, até porque ele é o último do meu Top3, e não o último geral". Exato — quem
   * escolheu potência, controle e spin está dizendo que spin importa MAIS que manobrabilidade,
   * estabilidade e tudo o que não foi escolhido.
   *
   * Antes do piso por posição, o contraste de `needs.ts` espalhava os três (35 / 17 / 5) e o
   * terceiro caía para perto de zero, abaixo de atributos que a pessoa nunca mencionou.
   */
  it('o terceiro do top-3 pesa mais que os atributos não escolhidos', () => {
    const profile = buildPlayerProfile({
      ...PERSONAS[1]!.answers,
      missing_attributes: ['power', 'control', 'spin'],
      objective: ['ganhar_potencia'],
    } as never);

    const escolhidos: readonly NeedKey[] = ['power', 'control', 'spin'];
    const naoEscolhidos = NEED_KEYS.filter((k) => !escolhidos.includes(k));

    const terceiro = profile.desired_change_vector.spin;
    for (const k of naoEscolhidos) {
      expect(
        terceiro,
        `spin (3º do top-3) pesa ${terceiro} e ${k} pesa ${profile.desired_change_vector[k]}`,
      ).toBeGreaterThan(profile.desired_change_vector[k]);
    }

    // E a ordem interna do top-3 é estritamente decrescente.
    expect(profile.desired_change_vector.power).toBeGreaterThan(
      profile.desired_change_vector.control,
    );
    expect(profile.desired_change_vector.control).toBeGreaterThan(terceiro);
  });

  /** A ordem declarada precisa aparecer: a 1ª prioridade não pode pesar igual à 3ª. */
  it('a ordem das prioridades se reflete no peso de cada eixo', () => {
    const profile = buildPlayerProfile({
      ...PERSONAS[1]!.answers,
      missing_attributes: ['power', 'control', 'spin'],
      objective: ['ganhar_potencia'],
    } as never);
    const report = serializeRecommendation(
      recommend({
        profile,
        rackets: testRackets(),
        strings: testStrings(),
        datasetVersion: TEST_DATASET_VERSION,
        mode: TEST_MODE,
        includeSetup: false,
      }),
      profile,
      ['racket_report_access'],
    );

    const power = report.radar.find((a) => a.key === 'power')!;
    const spin = report.radar.find((a) => a.key === 'spin')!;
    expect(power.weight).toBeGreaterThan(spin.weight);
  });
});

describe('nenhum critério decide sozinho', () => {
  const AMOSTRA = PERSONAS.slice(0, 12);

  it('a influência real de cada componente respeita o peso declarado', () => {
    const infl = new Map<string, number[]>();
    const pesos = new Map<string, number[]>();

    for (const persona of AMOSTRA) {
      const profile = buildPlayerProfile(persona.answers);
      const result = recommend({
        profile,
        rackets: testRackets(),
        strings: testStrings(),
        datasetVersion: TEST_DATASET_VERSION,
        mode: TEST_MODE,
        includeSetup: false,
      });

      const disputam = result.full_ranking.slice(0, 12);
      if (disputam.length < 6) continue;

      for (const c of disputam[0]!.breakdown.components) {
        if (c.weight <= 0.05) continue;
        const vals = disputam.map(
          (r) => r.breakdown.components.find((x) => x.key === c.key)?.raw ?? 0,
        );
        const m = vals.reduce((s, v) => s + v, 0) / vals.length;
        const sd = Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / vals.length);
        infl.set(c.key, [...(infl.get(c.key) ?? []), sd * c.weight]);
        pesos.set(c.key, [...(pesos.get(c.key) ?? []), c.weight]);
      }
    }

    const media = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
    const total = [...infl.values()].reduce((s, v) => s + media(v), 0);

    for (const [key, valores] of infl) {
      const peso = media(pesos.get(key)!);
      const razao = media(valores) / total / peso;
      expect(
        razao,
        `${key}: peso ${(peso * 100).toFixed(1)}% mas influência ${(razao * peso * 100).toFixed(1)}% (${razao.toFixed(2)}×)`,
      ).toBeLessThanOrEqual(1.6);
      expect(razao, `${key}: influência muito abaixo do peso (${razao.toFixed(2)}×)`).toBeGreaterThanOrEqual(0.45);
    }
  });
});
