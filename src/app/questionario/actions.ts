'use server';

/**
 * Server Action que fecha o ciclo questionário → motor → payload.
 *
 * A UI NÃO calcula nada (§44). Ela envia respostas; este módulo orquestra as camadas 3, 4 e 5 e
 * devolve view models já serializados por entitlement.
 *
 * PERSISTÊNCIA: `src/database/repositories/session-repo.ts`. Com `DATABASE_URL` configurada grava
 * no Postgres; sem ela, em desenvolvimento, cai para arquivo. Em produção a ausência de banco LANÇA
 * — um relatório pago não pode viver em `/tmp`.
 */

import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { isMissingTable } from '@/database/setup';
import { extractFreeText } from '@/ai/extract-free-text';
import { DATASET_VERSION, loadRacketCatalog, loadStringCatalog } from '@/data/load';
import {
  buildCatalogScale,
  computeTension,
  enrichProfileWithCatalog,
  recommend,
  selectStringVariant,
} from '@/recommendation';
import { scoreRackets } from '@/recommendation/normalize/racket-attributes';
import { buildPlayerProfile } from '@/recommendation/profile/build-profile';
import type { QuestionnaireAnswers } from '@/recommendation/profile/answers';
import { datasetMode } from '@/domain/sourced';
import type { PlayerProfile } from '@/domain/player-profile';
import type { RecommendationResult } from '@/domain/recommendation';
import { loadRecommendation, saveRecommendation } from '@/database/repositories/session-repo';
import { markFunnel } from '@/database/repositories/funnel-repo';
import { visitorToken } from './visitor';
import {
  serializeRecommendation,
  serializeTeaser,
  type Entitlement,
  type ReportPayload,
  type TeaserPayload,
} from '@/payments/entitlements';

/** Catálogo pontuado uma vez por processo — 41 itens, ranking é O(n) e sub-milissegundo. */
let scoredCatalog: ReturnType<typeof scoreRackets> | null = null;
function catalog() {
  if (!scoredCatalog) scoredCatalog = scoreRackets(loadRacketCatalog());
  return scoredCatalog;
}

/**
 * Resultado da análise como VALOR, não como exceção.
 *
 * Antes esta função podia lançar, e a tela de processamento ficava girando para sempre: as sete
 * mensagens terminavam, `ready` nunca virava true e o usuário encarava uma tela morta sem nenhuma
 * explicação. Um erro que vira silêncio é pior que um erro que aparece.
 */
export type AnalysisResponse =
  | { readonly ok: true; readonly sessionId: string; readonly teaser: TeaserPayload }
  | { readonly ok: false; readonly reason: 'not_ready' | 'failed'; readonly message: string };

/**
 * Roda a análise completa. Retorna apenas o TEASER — o resultado fica no servidor até haver
 * entitlement (§32). O nome da raquete nunca chega ao cliente nesta etapa (§27).
 */
export async function analyzeAnswers(
  answers: QuestionnaireAnswers,
): Promise<AnalysisResponse> {
  // Camada 5 (opcional): texto livre → sinais. Falha ou ausência de chave devolve [].
  const signals = answers.free_text
    ? await extractFreeText(answers.free_text, { answeredFields: [] })
    : [];

  // Camadas 2 e 4: normalização + ranking determinístico.
  const strings = loadStringCatalog();

  /**
   * Camada 3: respostas + sinais → perfil. O merge nunca sobrescreve resposta objetiva (R-05).
   *
   * O enriquecimento contra o catálogo acontece AQUI, e não só dentro de `recommend`, porque é
   * este `profile` que vai para o banco. Antes, o registro gravado descrevia um jogador sem specs
   * de raquete e sem tipo de corda conhecidos, enquanto a análise ao lado tinha sido calculada com
   * todos esses dados — a entrada guardada não era a entrada do cálculo. Ver
   * `enrichProfileWithCatalog`.
   */
  const profile = enrichProfileWithCatalog(
    buildPlayerProfile(answers, signals),
    catalog(),
    strings,
  );

  const result = recommend({
    profile,
    rackets: catalog(),
    strings,
    datasetVersion: DATASET_VERSION,
    mode: datasetMode(),
    includeSetup: true,
  });

  const sessionId = randomUUID();

  try {
    /*
      O marco de conclusão fica AQUI e não na página seguinte.

      Terminar o questionário e a análise ser gravada com sucesso são o mesmo fato do ponto de
      vista do funil; separá-los criaria uma etapa fantasma entre os dois, com perda que não
      corresponde a desistência de ninguém.
    */
    await markFunnel(await visitorToken(), 'quiz:done');

    await saveRecommendation({
      sessionToken: await visitorToken(),
      publicId: sessionId,
      profile,
      result,
    });
  } catch (error) {
    // Causa mais provável em um ambiente recém-publicado: o banco existe, mas as tabelas ainda
    // não foram criadas. Vale distinguir, porque a ação de conserto é completamente diferente
    // de uma falha transitória — e quem lê a mensagem costuma ser o dono do site.
    if (isMissingTable(error)) {
      return {
        ok: false,
        reason: 'not_ready',
        message:
          'O sistema ainda não foi preparado: as tabelas do banco não existem. O administrador ' +
          'precisa concluir a preparação em /admin/setup.',
      };
    }
    return {
      ok: false,
      reason: 'failed',
      message: 'Não conseguimos salvar sua análise. Tente novamente em alguns instantes.',
    };
  }

  return { ok: true, sessionId, teaser: serializeTeaser(result, strings.variants.length) };
}

/**
 * Busca o relatório para uma sessão, respeitando os entitlements.
 *
 * `serializeRecommendation` lança se `racket_report_access` não estiver presente — não existe
 * caminho que devolva dados premium sem compra.
 */
export async function getReport(
  sessionId: string,
  granted: readonly Entitlement[],
): Promise<ReportPayload | null> {
  const stored = await loadRecommendation(sessionId);
  if (!stored) return null;

  /**
   * O setup pode ter sido comprado para uma raquete que NÃO é a 1ª colocada.
   *
   * O resultado gravado traz corda e tensão da vencedora, porque é o que o motor calcula por
   * padrão. Quando o jogador compra o upgrade e escolhe a 2ª ou a 3ª, recalculamos aqui — só a
   * parte de corda e tensão, sobre o mesmo ranking já persistido.
   *
   * Recalcular é preferível a gravar os três setups de antemão: dois deles nunca seriam lidos, e
   * o cálculo depende do catálogo de cordas, que muda com mais frequência que o de raquetes.
   */
  const result = withSetupFor(stored.result, stored.profile, stored.setupVariantId);
  return serializeRecommendation(result, stored.profile, granted);
}

/**
 * Devolve o resultado com corda e tensão recalculadas para a variante escolhida.
 *
 * Quando não há escolha, ou quando ela é a própria 1ª colocada, o resultado volta intacto.
 *
 * ═══ ESTA FUNÇÃO PRECISA CALCULAR EXATAMENTE COMO O MOTOR CALCULA ════════════════════════════
 *
 * Ela é o segundo caminho que produz um setup, e por isso é o lugar onde uma divergência aparece
 * como contradição na tela. Foi o que aconteceu, relatado com o relatório aberto: a raquete do
 * jogador estava no pódio, ele apontou o setup para ela, e o bloco "antes de trocar de raquete"
 * mostrava OUTRA corda para a MESMA raquete — as duas de poliéster, na mesma tensão, modelos
 * diferentes.
 *
 * Havia duas divergências, e as duas eram silenciosas:
 *
 *   1. A RÉGUA DO CATÁLOGO não era passada. Ela alimenta `computeStringTarget` — sem ela o alvo de
 *      corda muda, e com ele a escolha. O motor sempre passou; este caminho, nunca. Era um
 *      argumento OPCIONAL, e é por isso que ninguém percebeu: esquecê-lo não dava erro, dava outra
 *      resposta. Agora é obrigatório, e quem esquecer não compila — ver `selectStringVariant`.
 *
 *   2. O MODO estava fixo em `'permissive'`, enquanto o motor usa `datasetMode()`. Hoje os dois
 *      coincidem em produção, então isto não chegou a produzir efeito visível — o que é pior, não
 *      melhor: é um segundo cálculo esperando a configuração mudar para discordar do primeiro.
 *
 * Um argumento opcional que muda o resultado é uma armadilha de assinatura, e ela cobrou o preço
 * aqui. A régua é reconstruída a partir do catálogo, que é determinístico: o mesmo catálogo produz
 * a mesma régua que produziu na hora da análise.
 */
function withSetupFor(
  result: RecommendationResult,
  profile: PlayerProfile,
  variantId: string | null,
): RecommendationResult {
  if (!variantId) return result;

  const chosen = result.podium.find((entry) => entry.racket.variant.id === variantId);
  if (!chosen || chosen.rank === 1) return result;

  const strings = loadStringCatalog();
  const mode = datasetMode();
  const recommendation = selectStringVariant(
    profile,
    chosen.racket,
    strings,
    buildCatalogScale(catalog()),
    mode,
  );
  if (!recommendation) return result;

  return {
    ...result,
    string_recommendation: recommendation,
    tension: computeTension(chosen.racket, recommendation.variant, profile),
    setup_for_variant_id: variantId,
  };
}

export async function getTeaser(sessionId: string): Promise<TeaserPayload | null> {
  const stored = await loadRecommendation(sessionId);
  if (!stored) return null;
  return serializeTeaser(stored.result, loadStringCatalog().variants.length);
}

