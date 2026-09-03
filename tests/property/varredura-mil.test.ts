/**
 * MIL PERFIS, NOVE INVARIANTES.
 *
 * ═══ POR QUE UMA VARREDURA GRANDE, SE JÁ EXISTEM 22 PERSONAS ═════════════════════════════════
 *
 * As personas são casos escolhidos a dedo, e é isso que as torna boas: cada uma existe porque
 * alguém identificou um risco. Mas elas só encontram o que já foi imaginado.
 *
 * Três defeitos reais deste produto passaram por elas e caíram aqui, na primeira execução:
 *
 *   1. 21 cards diziam "escolhemos um frame mais CONTIDO" e, três blocos abaixo, "entre as mais
 *      POTENTES do catálogo". O par exige potência natural alta E frame potente ao mesmo tempo —
 *      uma combinação que uma varredura anterior de 202 cenários não produziu nenhuma vez.
 *
 *   2. 9 perfis recebiam quadro acima do teto que o próprio perfil declarava, um deles com 300 g
 *      contra um teto de 278 g. A válvula que protege o ranking de ficar pequeno demais desligava
 *      o teto inteiro, e quem mais precisava do limite era exatamente quem o perdia.
 *
 *   3. 83 perfis saíam com a 1ª colocada abaixo de `MIN_TOP_MATCH` — o pior com 39,9% — e nenhuma
 *      linha dizendo isso. A constante existia desde sempre e era usada em UM lugar: um teste.
 *      O produto nunca a consultou.
 *
 * ═══ POR QUE ELA É DETERMINÍSTICA ═══════════════════════════════════════════════════════════
 *
 * A semente é fixa. Uma varredura aleatória de verdade falharia em perfis diferentes a cada
 * execução, e um teste que muda de opinião entre dois `npm test` é ignorado em uma semana. Aqui o
 * perfil #91 é sempre o mesmo perfil, e a mensagem de falha traz o número.
 *
 * Custo: ~3 segundos. Barato para o que cobre.
 */
import { loadRacketCatalog, loadStringCatalog, DATASET_VERSION } from '@/data/load';
import { scoreRackets, massIndex } from '@/recommendation/normalize/racket-attributes';
import { buildPlayerProfile, ceilingCapacityFactor } from '@/recommendation/profile/build-profile';
import { recommend, enrichProfileWithCatalog, buildCatalogScale } from '@/recommendation';
import { serializeRecommendation, type Entitlement } from '@/payments/entitlements';
import { MIN_TOP_MATCH, TECHNICAL_TIE_THRESHOLD } from '@/domain/reference-ranges';
import { emptyAnswers, type QuestionnaireAnswers } from '@/recommendation/profile/answers';

const rackets = scoreRackets(loadRacketCatalog());
const strings = loadStringCatalog();
const escala = buildCatalogScale(rackets);
const TUDO: Entitlement[] = ['racket_report_access', 'full_setup_access', 'rank2_access', 'rank3_access'];
const PESOS = rackets.map((r) => r.variant.specs.unstrung_weight_g!).sort((a, b) => a - b);

/** mulberry32 — pequeno, determinístico e suficiente para amostrar um espaço de respostas. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r = rng(20260903);
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
const entre = (lo: number, hi: number): number => Math.round(lo + r() * (hi - lo));

const NIVEIS = ['iniciante','iniciante_avancado','intermediario','intermediario_avancado','avancado'] as const;
const TECNICA: Record<string, readonly [string,string,string,string,string]> = {
  iniciante: ['nao','nao','nao','nao','nao'],
  iniciante_avancado: ['as_vezes','as_vezes','nao','nao','nao'],
  intermediario: ['sim','as_vezes','as_vezes','as_vezes','as_vezes'],
  intermediario_avancado: ['sim','sim','as_vezes','sim','as_vezes'],
  avancado: ['sim','sim','sim','sim','sim'],
};
const ESTILOS = ['baseline','aggressive_baseliner','counterpuncher','heavy_spin','flat_hitter','all_court','serve_and_volley','net_player'];
const OBJETIVOS = ['potencializar','ganhar_potencia','ganhar_controle','mais_spin','atacar_mais','mais_conforto','mais_estabilidade','mais_facil','mais_exigente'];
const FALTA = ['power','control','spin','stability','comfort','maneuverability','precision'];
const DORES = ['cotovelo','ombro','punho'];

export type Sim = { readonly n: number; readonly answers: QuestionnaireAnswers };

export function gerar(quantos: number): Sim[] {
  const out: Sim[] = [];
  for (let n = 1; n <= quantos; n++) {
    const sexo = r() < 0.5 ? 'masculino' : 'feminino';
    const idade = entre(10, 80);
    const baseAlt = sexo === 'masculino' ? 176 : 164;
    const altura = Math.max(140, Math.min(200, baseAlt + entre(-16, 16)));
    // IMC plausível: 17 a 33.
    const imc = 17 + r() * 16;
    const peso = Math.max(35, Math.round(imc * (altura / 100) ** 2));
    const nivel = idade < 14 ? pick(['iniciante','iniciante_avancado'] as const) : pick(NIVEIS);
    const [rally, dir, spin, prof, saque] = TECNICA[nivel]!;
    const temDor = r() < 0.25;
    const nFalta = 1 + Math.floor(r() * 3);
    const falta = [...new Set(Array.from({ length: nFalta }, () => pick(FALTA)))];

    out.push({
      n,
      answers: {
        ...emptyAnswers(),
        dominant_hand: r() < 0.88 ? 'destro' : 'canhoto',
        age: idade, height_cm: altura, weight_kg: peso, sex: sexo,
        perceived_strength: pick(['abaixo','media','acima','bem_acima'] as const),
        fitness_level: pick(['sedentario','moderado','bom','atletico'] as const),
        frequency_per_week: entre(0, 5),
        experience_duration: pick(['menos_1a','1_2a','2_5a','mais_5a'] as const),
        has_lessons: pick(['nunca','ja_fiz','atualmente'] as const),
        plays_matches: pick(['nao','as_vezes','sim'] as const),
        tournament_experience: pick(['nunca','amadores','federados'] as const),
        perceived_level: nivel,
        can_sustain_rally: rally, can_direct_ball: dir, can_generate_spin: spin,
        can_vary_depth: prof, reliable_second_serve: saque,
        play_style: [pick(ESTILOS)],
        forehand_type: pick(['plano','topspin_moderado','topspin_acentuado','nao_sei'] as const),
        backhand_hands: pick(['uma_mao','duas_maos'] as const),
        swing_length: pick(['curto','medio','longo'] as const),
        swing_speed: pick(['lenta','moderada','rapida','muito_rapida','nao_sei'] as const),
        depth_control: pick(['sim','as_vezes','nao'] as const),
        ball_tendency: [pick(['nenhuma','saem_longas','caem_curtas','variam_demais'])],
        discomfort_areas: temDor ? [pick(DORES)] : ['nenhum'],
        ...(temDor ? {
          discomfort_status: r() < 0.5 ? 'atual' : 'passado',
          discomfort_intensity: pick(['leve','moderado','forte'] as const),
          discomfort_from_tennis: pick(['sim','nao'] as const),
        } : {}),
        no_current_racket: true,
        missing_attributes: falta,
        objective: [pick(OBJETIVOS)],
        string_budget: pick(['economico','equilibrado','premium'] as const),
        string_breakage: pick(['nunca','raramente','a_cada_2_3_meses','mensalmente','semanalmente'] as const),
      } as QuestionnaireAnswers,
    });
  }
  return out;
}

// ── invariantes ────────────────────────────────────────────────────────────
const COMPLEMENTA = /complementa a potência que seu swing ainda não entrega/;
const CONTIDO_ABS = /a potência vem mais de você do que da raquete/;
const CONTIDO_REL = /escolhemos um frame mais contido/;
const MAIS_POTENTES = /entre as mais potentes do catálogo/;

export type Falha = { readonly regra: string; readonly n: number; readonly detalhe: string };

export function auditar(sims: readonly Sim[]): { falhas: Falha[]; stats: Record<string, number> } {
  const falhas: Falha[] = [];
  const add = (regra: string, n: number, detalhe: string) => falhas.push({ regra, n, detalhe });
  let somaMatch = 0, comDor = 0, tetoAtivo = 0, empatesAmplos = 0;

  for (const { n, answers } of sims) {
    const profile = enrichProfileWithCatalog(buildPlayerProfile(answers), rackets, strings);
    const res = recommend({
      profile, rackets, strings, datasetVersion: DATASET_VERSION,
      mode: 'permissive', includeSetup: true,
    });

    // 1. Todo perfil recebe pódio.
    if (res.podium.length === 0) { add('pódio vazio', n, `avaliadas ${res.candidates_evaluated}`); continue; }
    const top = res.podium[0]!;
    somaMatch += top.fit_score;
    if (answers.discomfort_areas.some((x) => x !== 'nenhum')) comDor += 1;

    // 2. Match abaixo do piso EXIGE aviso. O número baixo é honesto; o silêncio não é.
    const payloadCedo = serializeRecommendation(res, profile, TUDO);
    const aviso = (payloadCedo as { low_match_note?: string | null }).low_match_note ?? null;
    if (top.fit_score < MIN_TOP_MATCH && !aviso) {
      add('match abaixo do piso SEM aviso', n, `${top.fit_score.toFixed(2)} < ${MIN_TOP_MATCH}`);
    }
    if (top.fit_score >= MIN_TOP_MATCH && aviso) {
      add('aviso de match baixo em perfil bom', n, `${top.fit_score.toFixed(2)}`);
    }

    // 3. O teto declarado é honrado.
    const teto = profile.frame_weight_ceiling_g;
    if (teto !== null) {
      if (teto < PESOS[PESOS.length - 1]!) tetoAtivo += 1;
      /*
        O teto pode AFROUXAR quando o catálogo não tem quadros leves o bastante — nesse caso ele
        fica nos mais leves que existem, e o limite efetivo é o 6º mais leve. O que não pode é a
        recomendação passar disso.
      */
      const MIN_SOBREVIVENTES = 6;
      const tetoEfetivo = Math.max(teto, PESOS[MIN_SOBREVIVENTES - 1] ?? teto);
      for (const e of res.podium) {
        const g = e.racket.variant.specs.unstrung_weight_g;
        if (g !== null && g > tetoEfetivo) {
          add('teto não honrado', n, `teto ${teto} g (efetivo ${tetoEfetivo}) · ${e.rank}ª tem ${g} g`);
          break;
        }
      }
      if (teto > 320) add('teto acima do limite da reta', n, `${teto} g`);
    }

    // 4. Ranking monotônico.
    for (let i = 1; i < res.full_ranking.length; i++) {
      if (res.full_ranking[i - 1]!.fit_score < res.full_ranking[i]!.fit_score) {
        add('ranking não monotônico', n, `posição ${i}`); break;
      }
    }

    // 5. Setup: corda e tensão existem quando pedidos.
    if (!res.string_recommendation) add('sem corda recomendada', n, '');
    if (!res.tension) add('sem tensão recomendada', n, '');

    // 6. Textos que se desmentem.
    const payload = payloadCedo;
    for (const card of payload.podium) {
      const c = card as unknown as {
        locked: boolean; product_name: string;
        why?: readonly string[]; expectations?: readonly string[];
      };
      if (c.locked) continue;
      const why = (c.why ?? []).join('\n'), exp = (c.expectations ?? []).join('\n');
      if (COMPLEMENTA.test(why) && CONTIDO_ABS.test(exp)) add('potência: complementa + contido', n, c.product_name);
      if (CONTIDO_REL.test(why) && MAIS_POTENTES.test(exp)) add('potência: contido + mais potentes', n, c.product_name);
    }

    // 7. Frases que saíram da vitrine não podem voltar.
    const sep = (payload as { separation?: { message: string } }).separation;
    if (sep) {
      if (/% delas/.test(sep.message)) add('separação publica a fração', n, '');
      if (/especificaç(ão|ões) publicad/.test(sep.message)) add('empate cita seis especificações', n, '');
      if (/\d+% do catálogo/.test(sep.message)) add('separação diz "% do catálogo"', n, '');
      const empatadas = res.full_ranking.filter((x) => top.fit_score - x.fit_score < TECHNICAL_TIE_THRESHOLD).length;
      if (empatadas / Math.max(1, res.full_ranking.length) >= 0.2) empatesAmplos += 1;
    }

    // 8. A massa recomendada não pode ficar absurdamente longe da capacidade.
    const cap = 0.45 * profile.physical_capacity_score + 0.35 * profile.swing_speed_score + 0.2 * profile.player_level_score;
    const pos = escala.position('mass_index', massIndex(top.racket.variant.specs)!);
    if (pos - cap > 40) add('massa muito acima da capacidade', n, `posição ${pos.toFixed(0)} vs capacidade ${cap.toFixed(0)}`);

    // 9. O fator de capacidade fica na faixa declarada.
    const f = ceilingCapacityFactor(answers);
    if (f < 0.9 - 1e-9 || f > 1.1 + 1e-9) add('fator fora da faixa 0,90–1,10', n, f.toFixed(4));
  }

  return {
    falhas,
    stats: {
      perfis: sims.length,
      matchMedio: Number((somaMatch / sims.length).toFixed(2)),
      comDor,
      tetoAtivo,
      empatesAmplos,
    },
  };
}


import { describe, expect, it } from 'vitest';

describe('varredura de mil perfis', () => {
  const { falhas, stats } = auditar(gerar(1000));

  /**
   * Uma asserção só, com TODAS as falhas na mensagem.
   *
   * Um `expect` por invariante daria nove falhas separadas para o mesmo perfil quebrado e
   * esconderia o padrão. O que interessa ao ler o erro é quantos perfis quebraram, por qual regra,
   * e o número de um exemplo para reproduzir.
   */
  it('nenhum perfil viola as invariantes do produto', () => {
    const porRegra = new Map<string, Falha[]>();
    for (const f of falhas) {
      const lista = porRegra.get(f.regra) ?? [];
      lista.push(f);
      porRegra.set(f.regra, lista);
    }

    const resumo = [...porRegra]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([regra, fs]) => {
        const exemplos = fs.slice(0, 3).map((f) => `#${f.n} ${f.detalhe}`).join(' | ');
        return `${fs.length}x ${regra} — ${exemplos}`;
      })
      .join('\n    ');

    expect(falhas.length, `\n    ${resumo}\n`).toBe(0);
  });

  /** Guardas da própria varredura: se ela parar de exercitar o motor, para de provar qualquer coisa. */
  it('a varredura exercita de fato o espaço do questionário', () => {
    expect(stats.perfis).toBe(1000);
    expect(stats.comDor, 'nenhum perfil com histórico articular').toBeGreaterThan(100);
    expect(stats.tetoAtivo, 'o teto de peso não restringiu ninguém').toBeGreaterThan(300);
  });

  /** A média é o sinal mais estável de calibração — um perfil oscila, mil não. */
  it('o match médio se mantém no patamar calibrado', () => {
    expect(stats.matchMedio, `média atual ${stats.matchMedio}`).toBeGreaterThan(80);
  });
});
