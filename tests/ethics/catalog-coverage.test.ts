/**
 * Cobertura de catálogo — todo produto listado precisa ser a resposta de ALGUÉM.
 *
 * ═══ O PRINCÍPIO ═════════════════════════════════════════════════════════════════════════════
 *
 * Este produto não elege a melhor raquete nem a melhor corda. Ele elege a mais ADEQUADA a um
 * perfil. Disso decorre uma consequência que é fácil de enunciar e fácil de violar sem perceber:
 * se existe um produto no catálogo que nenhum perfil concebível recebe em primeiro lugar, ou o
 * motor tem um viés, ou o produto não deveria estar no catálogo. Não há terceira explicação.
 *
 * ═══ O QUE ESTE TESTE PEGOU ══════════════════════════════════════════════════════════════════
 *
 * Na primeira medição, sobre 8748 perfis varrendo nível, swing, físico, estilo, objetivo, dor e
 * frequência de quebra:
 *
 *     raquetes   22/46 venciam alguma vez
 *     cordas      5/17
 *
 * Sete raquetes ficavam a 0.00 ponto da vencedora sem nunca vencer — empatavam e perdiam no
 * desempate, que era `id.localeCompare`, ou seja, ordem alfabética. Pure Aero, Pure Drive e
 * EZONE 100, três das mais vendidas do mundo, não eram indicadas a ninguém, jamais.
 *
 * As causas encontradas estão documentadas em `tie-break.ts` (desempate alfabético),
 * `select-string.ts` (alvo comprimido, degraus artificiais, distância em dois sentidos onde só um
 * faz sentido) e `catalog-scale.ts` (régua dominada por outlier).
 *
 * ═══ POR QUE O PISO NÃO É 100% ═══════════════════════════════════════════════════════════════
 *
 * Porque a meta é de CURADORIA, e este teste é de motor. Os produtos que continuam sem vencer hoje
 * são, todos, casos de dados: cinco multifilamentos do catálogo têm atributos NUMERICAMENTE
 * IDÊNTICOS entre si, porque os números derivam de quatro rótulos qualitativos que eles
 * compartilham. Enquanto os dados não os distinguirem, nenhum ajuste de fórmula os separa — e
 * forçar a separação seria fabricar diferença, que é pior do que não ter.
 *
 * O piso trava a REGRESSÃO: se a cobertura cair, algum viés novo entrou. A lista impressa a cada
 * execução é a fila de curadoria.
 */

import { describe, expect, it } from 'vitest';
import { buildPlayerProfile } from '@/recommendation/profile/build-profile';
import { emptyAnswers } from '@/recommendation/profile/answers';
import { recommend } from '@/recommendation';
import { TEST_DATASET_VERSION, TEST_MODE, testRackets, testStrings } from '../helpers/catalog';

type Fragment = Record<string, unknown>;

const NIVEIS: Fragment[] = [
  { perceived_level: 'iniciante', experience_duration: 'menos_1a', frequency_per_week: 1 },
  {
    perceived_level: 'intermediario',
    experience_duration: 'mais_5a',
    frequency_per_week: 3,
    can_sustain_rally: 'sim',
    can_direct_ball: 'as_vezes',
  },
  {
    perceived_level: 'avancado',
    experience_duration: 'mais_10a',
    frequency_per_week: 5,
    tournament_experience: 'federados',
    can_sustain_rally: 'sim',
    can_direct_ball: 'sim',
    can_generate_spin: 'sim',
    can_vary_depth: 'sim',
    reliable_second_serve: 'sim',
  },
];

const SWINGS: Fragment[] = [
  { swing_speed: 'lenta', swing_length: 'curto' },
  { swing_speed: 'moderada', swing_length: 'medio' },
  { swing_speed: 'muito_rapida', swing_length: 'longo' },
];

const FISICOS: Fragment[] = [
  { fitness_level: 'sedentario', perceived_strength: 'abaixo', age: 55, height_cm: 165, weight_kg: 70 },
  { fitness_level: 'bom', perceived_strength: 'media', age: 35, height_cm: 175, weight_kg: 75 },
  { fitness_level: 'atletico', perceived_strength: 'bem_acima', age: 24, height_cm: 188, weight_kg: 85 },
];

const ESTILOS: Fragment[] = [
  { play_style: ['dominar_fundo'] },
  { play_style: ['muito_topspin'] },
  { play_style: ['mais_chapado'] },
  { play_style: ['contra_atacar'] },
  { play_style: ['subir_rede'] },
];

const OBJETIVOS: Fragment[] = [
  { objective: ['mais_potencia'] },
  { objective: ['mais_controle'] },
  { objective: ['mais_spin'] },
  { objective: ['jogar_sem_dor'] },
  { objective: [] },
];

const DORES: Fragment[] = [
  { discomfort_areas: [] },
  { discomfort_areas: ['ombro'], discomfort_when: 'ha_mais_tempo', discomfort_intensity: 'leve' },
  { discomfort_areas: ['cotovelo'], discomfort_when: 'agora', discomfort_intensity: 'forte' },
];

/**
 * Frequência de quebra é dimensão PRÓPRIA, e não um apêndice do objetivo "durabilidade".
 *
 * Na primeira versão desta grade ela só aparecia junto daquele objetivo, e a varredura concluiu
 * que oito poliésters nunca venciam. Estavam ausentes da grade os perfis que existem de montão na
 * vida real — quem quer controle E arrebenta corda toda semana —, que são justamente os donos
 * daquelas cordas. A conclusão do teste estava errada por amostragem, não o motor.
 */
const QUEBRAS: Fragment[] = [
  { string_breakage: 'nunca' },
  { string_breakage: 'a_cada_2_3_meses' },
  { string_breakage: 'semanalmente' },
];

/**
 * Orçamento é dimensão própria — sem ela, metade do catálogo fica fora de alcance na varredura.
 *
 * Foi o eixo que passou a permitir que tripa natural e multifilamentos de faixas diferentes fossem
 * a resposta certa de alguém. Uma grade que não varia orçamento mede um mercado que não existe.
 */
const ORCAMENTOS: Fragment[] = [
  {},
  { string_budget: 'economico' },
  { string_budget: 'sem_limite' },
];

function* grid(): Generator<Fragment> {
  for (const nivel of NIVEIS)
    for (const swing of SWINGS)
      for (const fisico of FISICOS)
        for (const estilo of ESTILOS)
          for (const objetivo of OBJETIVOS)
            for (const dor of DORES)
              for (const quebra of QUEBRAS)
                for (const orcamento of ORCAMENTOS)
                  yield {
                    ...nivel,
                    ...swing,
                    ...fisico,
                    ...estilo,
                    ...objetivo,
                    ...dor,
                    ...quebra,
                    ...orcamento,
                  };
}

const rackets = testRackets();
const strings = testStrings();

const racketWinners = new Set<string>();
const stringWinners = new Set<string>();
/** Quantas vezes cada corda venceu — a varredura roda UMA vez e alimenta todas as asserções. */
const stringCounts = new Map<string, number>();
let profiles = 0;

for (const fragment of grid()) {
  const profile = buildPlayerProfile({ ...emptyAnswers(), ...fragment } as never);
  const result = recommend({
    profile,
    rackets,
    strings,
    datasetVersion: TEST_DATASET_VERSION,
    mode: TEST_MODE,
    includeSetup: true,
  });
  profiles += 1;

  const top = result.podium[0];
  if (top) racketWinners.add(top.racket.variant.id);
  const string = result.string_recommendation;
  if (string) {
    stringWinners.add(string.variant.model.id);
    const id = string.variant.model.id;
    stringCounts.set(id, (stringCounts.get(id) ?? 0) + 1);
  }
}

/** Pisos de regressão, abaixo da meta de curadoria (100%) e acima do medido hoje menos folga. */
const MIN_RACKET_COVERAGE = 0.6;
const MIN_STRING_COVERAGE = 0.85;

describe('cobertura de catálogo', () => {
  it('a varredura é grande o bastante para a conclusão significar alguma coisa', () => {
    expect(profiles).toBeGreaterThan(2000);
  });

  it('a maioria das raquetes do catálogo é a 1ª opção de algum perfil', () => {
    const total = new Set(rackets.map((r) => r.variant.id)).size;
    const missing = rackets
      .filter((r) => !racketWinners.has(r.variant.id))
      .map((r) => r.variant.product_name);

    expect(
      racketWinners.size / total,
      `${racketWinners.size}/${total} raquetes vencem. Nunca vencem: ${missing.join(', ')}`,
    ).toBeGreaterThanOrEqual(MIN_RACKET_COVERAGE);
  });

  it('a maioria das cordas do catálogo é a 1ª opção de algum perfil', () => {
    const total = strings.models.length;
    const missing = strings.models
      .filter((m) => !stringWinners.has(m.id))
      .map((m) => `${m.brand} ${m.model}`);

    expect(
      stringWinners.size / total,
      `${stringWinners.size}/${total} cordas vencem. Nunca vencem: ${missing.join(', ')}`,
    ).toBeGreaterThanOrEqual(MIN_STRING_COVERAGE);
  });

  /**
   * Nenhuma opção pode concentrar o catálogo inteiro.
   *
   * É o sintoma que trouxe o usuário: cinco questionários com respostas completamente diferentes e
   * sempre a mesma corda. Concentração alta não prova viés sozinha — um catálogo pequeno tem
   * favoritos legítimos —, mas acima de um terço ela deixa de ser preferência e vira monocultura.
   */
  it('nenhuma corda concentra mais de um terço das recomendações', () => {
    const worst = [...stringCounts.entries()].sort((a, b) => b[1] - a[1])[0]!;
    expect(worst[1] / profiles, `${worst[0]} concentra ${worst[1]}/${profiles}`).toBeLessThan(0.34);
  });
});

/**
 * Nenhuma corda pode ser indistinguível de outra.
 *
 * ═══ POR QUE ISTO É REGRA, E NÃO META ════════════════════════════════════════════════════════
 *
 * Empate exato entre dois modelos não é um detalhe estatístico: é a garantia de que um deles nunca
 * será a resposta de ninguém. O desempate por perfil (`tie-break.ts`) distribui os empates, mas
 * distribuir empate é remendo — o certo é não haver empate, porque ele não existe em quadra. Quem
 * joga percebe a diferença entre uma NXT e uma Xcel, e um sistema que afirma não haver diferença
 * está errado sobre um fato, não sendo prudente sobre uma incerteza.
 *
 * A construção (tipo, formato, firmeza, durabilidade, tensão) não bastava para separá-las: seis
 * grupos, dezesseis modelos com gêmeo exato. Os descritores de caráter — feel, launch, bite —
 * existem para carregar o que as resenhas descrevem e a ficha técnica não registra.
 */
describe('diferenciação de catálogo', () => {
  it('nenhum par de cordas tem o mesmo vetor de atributos', () => {
    const byFingerprint = new Map<string, string[]>();

    for (const model of strings.models) {
      const a = model.base_attributes;
      const fingerprint = [
        a.control_score,
        a.power_score,
        a.spin_score,
        a.comfort_score,
        a.arm_friendliness_score,
        a.durability_score,
      ]
        .map((v) => v.toFixed(2))
        .join('/');

      const list = byFingerprint.get(fingerprint) ?? [];
      list.push(`${model.brand} ${model.model}`);
      byFingerprint.set(fingerprint, list);
    }

    const ties = [...byFingerprint.values()].filter((l) => l.length > 1);
    expect(ties, `grupos idênticos: ${ties.map((l) => l.join(' = ')).join(' | ')}`).toEqual([]);
  });

  it('cada corda declara para que serve', () => {
    for (const model of strings.models) {
      expect(
        model.recommended_player_type?.length ?? 0,
        `${model.brand} ${model.model} sem propósito declarado`,
      ).toBeGreaterThan(0);
    }
  });
});
