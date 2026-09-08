/**
 * Onde a raquete que o jogador JÁ TEM caiu no ranking — sobre vendas reais.
 *
 * ═══ AS DUAS PERGUNTAS ═══════════════════════════════════════════════════════════════════════
 *
 *   1. Em que porcentagem das análises pagas a raquete atual NÃO chegou ao pódio?
 *   2. Qual a posição MÉDIA da raquete atual no ranking completo?
 *
 * ═══ POR QUE UM SCRIPT, E NÃO UMA TELA DO /admin ═════════════════════════════════════════════
 *
 * Porque a resposta ainda não é um indicador que se acompanha: é uma medição que se faz uma vez
 * para decidir se existe pauta. Uma tela cria a expectativa de que o número deve ser olhado toda
 * semana, e este número só passa a significar alguma coisa quando o denominador crescer. Se um dia
 * virar rotina, a consulta migra para `funnel-repo.ts` sem mudar de forma.
 *
 * ═══ O QUE ENTRA NA CONTA, E O QUE FICA DE FORA ══════════════════════════════════════════════
 *
 * Denominador: análises com pedido `paid` E raquete atual RECONHECIDA no catálogo.
 *
 * As duas condições são exclusões deliberadas:
 *
 *   - **Sem pagamento não é venda.** O dono pediu vendas reais, e um relatório liberado por cupom
 *     ou convite não é uma. Eles continuam contados à parte, porque a diferença entre as duas
 *     populações é informação, não ruído.
 *   - **Raquete não reconhecida não tem posição.** Quem digitou texto livre que não casou com o
 *     catálogo (`unrecognized: true`) ou não declarou raquete nenhuma não pode ter uma colocação.
 *     Incluí-los inflaria artificialmente o "fora do pódio" com gente que nunca teve como estar
 *     nele — que é exatamente o tipo de número que soa ótimo e é falso.
 *
 * ═══ A ARMADILHA QUE ESTE SCRIPT SEPARA EM VEZ DE ESCONDER ═══════════════════════════════════
 *
 * Desde o motor 2.31.0 a raquete atual é RETIRADA do pódio de propósito quando está acima do teto
 * de peso do jogador (C-32 do CALIBRATION_LOG). Então "fora do pódio" passou a somar duas coisas
 * que não são a mesma:
 *
 *   (a) ela perdeu para outras três no mérito — o dado interessante;
 *   (b) nós a excluímos por regra, e ela poderia até ser a melhor pontuada.
 *
 * Publicar a soma como se fosse (a) seria usar contra o jogador uma decisão nossa. A saída separa
 * as duas, e a linha que pode virar arte é a (a).
 *
 * ═══ POR QUE A VERSÃO DO MOTOR APARECE NA SAÍDA ══════════════════════════════════════════════
 *
 * Análises gravadas em versões diferentes responderam a perguntas diferentes — o pódio de 2.30.0
 * não seguia as mesmas regras do de 2.33.0. Misturar tudo num percentual único produz um número
 * que não descreve nenhum motor. A quebra por versão deixa isso visível antes de virar copy.
 *
 * ═══ COMO RODAR ══════════════════════════════════════════════════════════════════════════════
 *
 *     DATABASE_URL='<url de produção>' npx tsx scripts/posicao-da-raquete-atual.ts
 *
 * Só faz SELECT. Não escreve nada, não lê e-mail, nome ou qualquer campo que identifique alguém —
 * o que sai daqui são contagens e médias.
 */

import { db, isDatabaseConfigured, schema } from '@/database/client';
import { and, eq, isNotNull } from 'drizzle-orm';

type Linha = {
  readonly sessionId: string;
  readonly engineVersion: string;
  readonly variantId: string;
  readonly podio: readonly string[];
  readonly pago: boolean;
};

function pct(parte: number, total: number): string {
  return total === 0 ? '—' : `${((parte / total) * 100).toFixed(1)}%`;
}

async function main(): Promise<void> {
  if (!isDatabaseConfigured()) {
    console.error(
      'DATABASE_URL não está definida.\n\n' +
        "Rode com:  DATABASE_URL='<url de produção>' npx tsx scripts/posicao-da-raquete-atual.ts",
    );
    process.exit(1);
  }

  const conn = db();

  /*
    Uma consulta só, e o cruzamento em memória.

    O pódio mora no `result` jsonb e a posição no ranking mora em `racket_rankings`. Dava para
    fazer tudo em SQL com `jsonb_array_elements`, e seria menos legível do que vale: o volume aqui
    é da ordem de dezenas ou centenas de linhas, não de milhões.
  */
  const sessoes = await conn
    .select({
      id: schema.recommendationSessions.id,
      engineVersion: schema.recommendationSessions.engineVersion,
      result: schema.recommendationSessions.result,
      profile: schema.playerProfiles.profile,
      orderStatus: schema.orders.status,
    })
    .from(schema.recommendationSessions)
    .innerJoin(
      schema.playerProfiles,
      eq(schema.recommendationSessions.playerProfileId, schema.playerProfiles.id),
    )
    .leftJoin(
      schema.orders,
      and(
        eq(schema.orders.recommendationSessionId, schema.recommendationSessions.id),
        eq(schema.orders.status, 'paid'),
      ),
    );

  const linhas: Linha[] = [];
  let semRaqueteAtual = 0;
  let naoReconhecida = 0;

  for (const s of sessoes) {
    const profile = s.profile as { current_racket?: { variant_id?: string | null; unrecognized?: boolean } | null };
    const atual = profile.current_racket;

    if (!atual) {
      semRaqueteAtual += 1;
      continue;
    }
    if (atual.unrecognized === true || !atual.variant_id) {
      naoReconhecida += 1;
      continue;
    }

    const result = s.result as { podium?: readonly { racket?: { variant?: { id?: string } } }[] };
    const podio = (result.podium ?? [])
      .map((e) => e.racket?.variant?.id)
      .filter((id): id is string => typeof id === 'string');

    linhas.push({
      sessionId: s.id,
      engineVersion: s.engineVersion,
      variantId: atual.variant_id,
      podio,
      pago: s.orderStatus === 'paid',
    });
  }

  const pagas = linhas.filter((l) => l.pago);

  /*
    A posição no ranking completo, para as análises pagas.

    `racket_rankings` guarda o ranking inteiro, e `excluded_by_filter` marca quem foi cortado por
    filtro duro. Uma raquete cortada NÃO tem posição — e ela não pode virar um número grande na
    média nem sumir da conta em silêncio. Sai contada à parte.
  */
  const posicoes: number[] = [];
  let semPosicao = 0;

  /*
    A separação prometida no cabeçalho: "fora do pódio" não é uma coisa só.

    ─── COMO SE DISTINGUE UMA DA OUTRA, COM O QUE ESTÁ GRAVADO ────────────────────────────────

    Duas marcas observáveis dizem que a saída foi NOSSA, e não do mérito da raquete:

      1. `excluded_by_filter` preenchido — filtro duro. Ela nem chegou a competir.
      2. rank ≤ 3 no ranking completo e mesmo assim fora do pódio. O ranking a pôs entre as três
         melhores e o pódio não a trouxe: só uma regra de pódio faz isso (o teto de peso da C-32,
         ou a diversidade de linha da C-36). Não existe outro caminho.

    O que sobra — fora do pódio E com rank ≥ 4 — é a raquete que simplesmente perdeu para três
    outras. Esse é o número que pode virar copy, e é sempre MENOR que o total.

    Sem esta separação o percentual usaria contra o jogador uma decisão de projeto nossa, que é
    precisamente o tipo de número que soa ótimo numa arte e não se sustenta se alguém perguntar.
  */
  let cortadaPorFiltro = 0;
  let retiradaPorRegra = 0;
  let perdeuNoMerito = 0;

  for (const l of pagas) {
    const linha = await conn
      .select({
        rank: schema.racketRankings.rank,
        excluida: schema.racketRankings.excludedByFilter,
      })
      .from(schema.racketRankings)
      .where(
        and(
          eq(schema.racketRankings.recommendationSessionId, l.sessionId),
          eq(schema.racketRankings.racketVariantId, l.variantId),
        ),
      )
      .limit(1);

    const r = linha[0];
    const noPodio = l.podio.includes(l.variantId);

    if (r === undefined || r.excluida !== null) {
      semPosicao += 1;
      if (!noPodio) cortadaPorFiltro += 1;
      continue;
    }

    posicoes.push(r.rank);
    if (noPodio) continue;

    if (r.rank <= 3) retiradaPorRegra += 1;
    else perdeuNoMerito += 1;
  }

  const foraDoPodio = pagas.filter((l) => !l.podio.includes(l.variantId));
  const media =
    posicoes.length === 0 ? null : posicoes.reduce((a, b) => a + b, 0) / posicoes.length;
  const mediana =
    posicoes.length === 0
      ? null
      : [...posicoes].sort((a, b) => a - b)[Math.floor(posicoes.length / 2)];

  const versoes = new Map<string, number>();
  for (const l of pagas) versoes.set(l.engineVersion, (versoes.get(l.engineVersion) ?? 0) + 1);

  console.log('═══ A RAQUETE ATUAL NO RANKING · vendas reais ═══\n');
  console.log(`análises no banco ................... ${sessoes.length}`);
  console.log(`  sem raquete atual declarada ....... ${semRaqueteAtual}`);
  console.log(`  raquete digitada não reconhecida .. ${naoReconhecida}`);
  console.log(`  com raquete atual reconhecida ..... ${linhas.length}`);
  console.log(`    dessas, PAGAS (a amostra) ....... ${pagas.length}`);
  console.log(`    sem pagamento (cupom/convite) ... ${linhas.length - pagas.length}\n`);

  if (pagas.length === 0) {
    console.log('Nenhuma venda paga com raquete atual reconhecida. Não há o que medir ainda.');
    console.log('\nAté existir amostra, o número NÃO pode ir para o Instagram:');
    console.log('references/limites.md §4 proíbe publicar venda ou cliente que ainda não existe.');
    return;
  }

  console.log('─── 1. fora do pódio ───');
  console.log(`fora do pódio (TOTAL) .............. ${foraDoPodio.length} de ${pagas.length}  (${pct(foraDoPodio.length, pagas.length)})`);
  console.log('  decomposto:');
  console.log(`  · perdeu no mérito ............... ${perdeuNoMerito} de ${pagas.length}  (${pct(perdeuNoMerito, pagas.length)})   ← o número publicável`);
  console.log(`  · retirada por regra de pódio .... ${retiradaPorRegra}   (rank ≤ 3 e fora — teto de peso ou linha repetida)`);
  console.log(`  · cortada por filtro duro ........ ${cortadaPorFiltro}   (nem chegou a competir)`);
  console.log('\n  Só a primeira linha descreve a raquete do jogador. As outras duas descrevem');
  console.log('  decisões nossas, e publicá-las como derrota dele seria desonesto.');
  console.log('\n─── 2. posição no ranking completo ───');
  console.log(`posição MÉDIA ...................... ${media === null ? '—' : media.toFixed(1)}`);
  console.log(`posição MEDIANA .................... ${mediana ?? '—'}`);
  console.log(`sem posição (cortada por filtro) ... ${semPosicao}`);

  console.log('\n─── versões de motor na amostra ───');
  for (const [v, n] of [...versoes.entries()].sort()) {
    console.log(`  ${v} .......... ${n}`);
  }
  if (versoes.size > 1) {
    console.log('\n  ⚠️  Mais de uma versão. O pódio mudou de regra entre elas — um percentual');
    console.log('     único não descreve nenhum motor. Ver o cabeçalho deste arquivo.');
  }

  /*
    O aviso de amostra pequena é do tamanho do risco, e não uma formalidade.

    Com 20 análises, uma única a mais ou a menos move o percentual em 5 pontos. Um número desses
    numa arte de Instagram é uma afirmação pública que a próxima semana desmente sozinha.
  */
  if (pagas.length < 30) {
    console.log(`\n⚠️  AMOSTRA PEQUENA (${pagas.length}). Uma análise a mais move o percentual em ${(100 / pagas.length).toFixed(1)} pontos.`);
    console.log('   Serve para decidir internamente. NÃO serve para virar número em arte.');
  }
}

void main().then(
  () => process.exit(0),
  (erro: unknown) => {
    console.error(erro);
    process.exit(1);
  },
);
