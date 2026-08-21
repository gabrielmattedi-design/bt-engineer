/**
 * O gráfico não pode contradizer a recomendação.
 *
 * ═══ O DEFEITO QUE ESTE TESTE TRANCA ═════════════════════════════════════════════════════════
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
import { PERSONAS } from '@/data/personas';
import { NEED_KEYS, type NeedKey } from '@/domain/player-profile';
import { TEST_DATASET_VERSION, TEST_MODE, testRackets, testStrings } from '../helpers/catalog';

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
  return { persona, report: serializeRecommendation(result, profile, ['racket_report_access']) };
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
   * A BORDA É O IDEAL, e nenhuma raquete a ultrapassa.
   *
   * ═══ POR QUE A LINHA VOLTOU A SER CONSTANTE ════════════════════════════════════════════════
   *
   * Ela já foi 100 fixo e foi rejeitada — com razão, naquela época: as raquetes entravam em POSIÇÃO
   * DE CATÁLOGO, e nessa unidade a borda dizia mesmo "quero o máximo de tudo".
   *
   * Depois virou o teto da oferta (saturava, e descrevia um produto inexistente) e depois um nível
   * de pedido de 55 a 94 — que resolveu a saturação e criou um erro mais fundo: duas grandezas
   * diferentes no mesmo eixo. O verde é ADEQUAÇÃO, 100 = ideal para você; a laranja era INTENSIDADE
   * DE PEDIDO. O sintoma foi o usuário lendo "parece que a raquete me entrega muito mais do que eu
   * preciso" — leitura correta de um gráfico incoerente.
   *
   * Com tudo em adequação, o ideal É 100 por definição da escala, e "mais adequado que perfeito"
   * não existe. É isso que estas asserções trancam.
   */
  it('a borda é o ideal e nenhuma linha de raquete a ultrapassa', () => {
    for (const { persona, report } of runs) {
      expect(report.radar.length, persona.id).toBeGreaterThanOrEqual(8);

      for (const axis of report.radar) {
        expect(axis.profile, `${persona.id}/${axis.key}: a borda deixou de ser o ideal`).toBe(100);

        for (const [nome, valor] of [
          ['recomendada', axis.recommended],
          ['catálogo', axis.catalog],
          ['atual', axis.current],
        ] as const) {
          if (valor === null) continue;
          expect(valor, `${persona.id}/${axis.key}: ${nome} passou do ideal`).toBeLessThanOrEqual(
            axis.profile,
          );
          expect(valor, `${persona.id}/${axis.key}: ${nome}`).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  /**
   * A hierarquia saiu da geometria — e precisa continuar existindo em `weight`.
   *
   * Com a borda constante, o polígono sozinho não distingue o eixo que decide a compra do eixo que
   * não importa. O peso é o que carrega essa informação, somado POR BLOCO abaixo do gráfico (por
   * eixo ele já foi tentado e removido: "Spin 3%" ao lado de "Seu swing 17%" sugere que o motor
   * ignorou o spin, quando os três eixos de bola são fatias de um critério só).
   *
   * Se `weight` virar constante ou zerar, a borda constante passa a ser a objeção original — "não
   * tem inteligência nenhuma por trás" — sem nada para respondê-la.
   */
  it('o peso continua carregando a hierarquia que a borda não mostra', () => {
    for (const { persona, report } of runs) {
      const pesos = report.radar.map((a) => a.weight);

      /**
       * A soma NÃO é 1, e não deve ser: `transition_fit` — o tamanho da mudança em relação à
       * raquete atual — pesa até 0.11 e não é eixo do radar, porque não mede adequação a você,
       * mede distância do que você já tem. Medido nas 22 personas: a soma fica entre 0.887 e 1.000.
       *
       * O piso existe para pegar o caso em que um eixo perde o peso por engano e o gráfico passa a
       * dizer que aquele aspecto não pesou na decisão.
       */
      const soma = pesos.reduce((s, p) => s + p, 0);
      expect(soma, `${persona.id}: pesos somam ${soma}`).toBeGreaterThan(0.85);
      expect(soma, `${persona.id}: pesos somam ${soma}`).toBeLessThanOrEqual(1.001);

      expect(
        new Set(pesos.map((p) => p.toFixed(4))).size,
        `${persona.id}: todo eixo com o mesmo peso — a hierarquia sumiu`,
      ).toBeGreaterThan(1);
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
});

/**
 * Nenhum critério pode decidir sozinho.
 *
 * ═══ O QUE ISTO MEDE ═════════════════════════════════════════════════════════════════════════
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
