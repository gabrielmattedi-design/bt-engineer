/**
 * Um caso REAL para o pilar P4 — rodado pelo motor, não imaginado.
 *
 * ═══ POR QUE RODAR O MOTOR EM VEZ DE ESCREVER O DESFECHO ═════════════════════════════════════
 *
 * A tentação do pilar "O caso" é inventar um perfil e narrar o desfecho que soa bem: "jogador de 42
 * anos com bola curta → recebeu um quadro mais leve, e o problema era a massa". Plausível, bem
 * escrito, e possivelmente falso.
 *
 * O motor discorda de intuição com frequência — foi assim que a varredura de mil perfis achou que a
 * raquete atual vencia acima do teto em 68 casos, e que peso e inércia praticamente não se
 * correlacionam neste catálogo. Um post que narra o que "deveria" acontecer publica a intuição de
 * quem escreveu com a autoridade do produto por trás. É a alucinação mais cara possível, porque
 * parece exatamente com o produto funcionando.
 *
 * Então o caso sai daqui: perfil sintético → `recommend()` de verdade → o post narra o que o motor
 * decidiu, incluindo quando a decisão surpreende.
 *
 * ═══ POR QUE PERFIL SINTÉTICO, E NÃO CLIENTE REAL ════════════════════════════════════════════
 *
 * Análise de cliente é dado de pessoa identificável. Mesmo anonimizado, transformar o resultado de
 * alguém em post é risco de privacidade sem contrapartida — o caso sintético é igualmente
 * verdadeiro, porque passa pelo mesmo motor.
 *
 * Uso:  npx tsx .claude/skills/te-content/scripts/caso.ts '{"age":42,"weight_kg":80,...}'
 */

import { loadRacketCatalog, loadStringCatalog, DATASET_VERSION } from '@/data/load';
import { scoreRackets } from '@/recommendation/normalize/racket-attributes';
import { recommend, enrichProfileWithCatalog, buildCatalogScale } from '@/recommendation';
import { buildPlayerProfile } from '@/recommendation/profile/build-profile';
import { emptyAnswers, type QuestionnaireAnswers } from '@/recommendation/profile/answers';
import { visibleSteps, unansweredIn } from '@/components/quiz/steps';
import { stringDisplayName } from '@/domain/string';

const rackets = scoreRackets(loadRacketCatalog());
const strings = loadStringCatalog();
const escala = buildCatalogScale(rackets);

export function rodarCaso(respostas: Partial<QuestionnaireAnswers>) {
  const answers = { ...emptyAnswers(), ...respostas } as QuestionnaireAnswers;

  /*
    O perfil precisa ser um que o PRODUTO aceitaria.

    Idade, altura e peso são obrigatórios desde a guarda em `analyzeAnswers`, e a mesma checagem
    roda aqui contra as mesmas funções da tela. Um caso montado sobre respostas que o site recusaria
    narraria um caminho que nenhum leitor consegue percorrer — o mesmo defeito que a varredura de
    mil perfis teve por meses sem ninguém ver.
  */
  const faltando = visibleSteps(answers).flatMap((s) => unansweredIn(s, answers));
  if (faltando.length > 0) {
    throw new Error(
      `Este perfil seria recusado pelo site. Falta: ${faltando.map((q) => q.title).join(', ')}`,
    );
  }

  const profile = enrichProfileWithCatalog(buildPlayerProfile(answers), rackets, strings);
  const atual = answers.current_racket_id
    ? rackets.find((r) => r.variant.id === answers.current_racket_id)
    : undefined;

  const res = recommend({
    profile,
    rackets,
    strings,
    datasetVersion: DATASET_VERSION,
    mode: 'permissive',
    includeSetup: true,
    ...(atual ? { currentRacket: atual } : {}),
  });

  const top = res.podium[0];
  if (!top) throw new Error('O motor não devolveu pódio para este perfil.');

  return {
    perfil: {
      idade: answers.age,
      altura_cm: answers.height_cm,
      peso_kg: answers.weight_kg,
      nivel: answers.perceived_level,
      preparo: answers.fitness_level,
      swing: answers.swing_speed,
      prioridades: answers.missing_attributes,
      objetivo: answers.objective,
    },
    /** O teto é heurística NOSSA. A copy tem de dizer isso. Ver references/limites.md §3. */
    teto_de_peso_g: profile.frame_weight_ceiling_g,
    capacidade: profile.physical_capacity_score,
    podio: res.podium.map((e) => ({
      posicao: e.rank,
      /* O nome sai para a conferência interna. Publicá-lo segue a regra de limites.md §2. */
      raquete: e.racket.variant.product_name,
      match: Number(e.fit_score.toFixed(1)),
      percentis: {
        potencia: escala.position('power_score', e.racket.attributes.power_score),
        controle: escala.position('control_score', e.racket.attributes.control_score),
        spin: escala.position('spin_score', e.racket.attributes.spin_score),
        conforto: escala.position('comfort_score', e.racket.attributes.comfort_score),
      },
      componentes: e.breakdown.components
        .filter((c) => c.weight > 0)
        .map((c) => ({ eixo: c.key, nota: Number(c.raw.toFixed(1)), peso: c.weight })),
    })),
    /*
      `stringDisplayName` e não `.model.model`.

      A variante da corda é ANINHADA — `string_recommendation.variant.model` é o modelo e
      `.variant.variant` é a espessura. Montar o nome à mão aqui foi exatamente o erro que já
      imprimiu "undefined mm" num relatório desta sessão. O produto usa este helper; a skill usa o
      mesmo, senão as duas descrições da mesma corda divergem.
    */
    corda: res.string_recommendation
      ? {
          nome: stringDisplayName(
            res.string_recommendation.variant.model,
            res.string_recommendation.variant.variant,
          ),
          tipo: res.string_recommendation.variant.model.string_type,
        }
      : null,
    /* `lbs`, não `recommended_lbs`. O campo errado devolvia null em silêncio — e um post com a
       tensão faltando seria publicado sem ninguém notar que o caso rodou pela metade. */
    tensao_lbs: res.tension?.lbs ?? null,
    tensao_faixa_lbs: res.tension?.range_lbs ?? null,
  };
}

if (require.main === module) {
  const bruto = process.argv[2];
  if (!bruto) {
    console.error(
      'Passe as respostas em JSON. Idade, altura e peso são obrigatórios.\n' +
        'Ex.: npx tsx .claude/skills/te-content/scripts/caso.ts \'{"age":42,...}\'',
    );
    process.exit(1);
  }
  console.log(JSON.stringify(rodarCaso(JSON.parse(bruto)), null, 2));
}
