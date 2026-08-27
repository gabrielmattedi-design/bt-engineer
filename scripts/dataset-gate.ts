/**
 * TRAVA DE RELEASE — docs/DATA_SOURCING.md §3, docs/00_RISKS_AND_DECISIONS.md#r-01.
 *
 * Roda antes do build de produção (`npm run build`). Falha se o catálogo não estiver apto a
 * sustentar uma recomendação PAGA. Isto é um portão de CI, não uma boa intenção: é o que impede
 * o produto de ser vendido com dataset em estado `pending_verification`.
 *
 *   NODE_ENV=production                → estrito, bloqueia
 *   DATASET_MODE=strict                → estrito, bloqueia
 *   caso contrário                     → relatório informativo (desenvolvimento)
 *
 *   ALLOW_UNVERIFIED_DATASET=true      → não bloqueia, mas grita
 *
 * A última é a saída para colocar um AMBIENTE DE TESTES no ar antes de a curadoria terminar. Ela
 * tem nome longo e explícito de propósito: ninguém a liga por acidente achando que é uma flag de
 * performance. Quando ativa, o site inteiro exibe um aviso permanente de que está em modo de
 * testes e não deve cobrar de ninguém — o §69 continua valendo, e o que ele proíbe é VENDER com
 * dado não conferido, não é publicar uma versão de testes.
 */

import { analyzeCoverage } from '../src/data/coverage';
import { catalogStats, loadRacketCatalog, loadStringCatalog } from '../src/data/load';
import { scoreRackets } from '../src/recommendation/normalize/racket-attributes';
import { MIN_DATA_COMPLETENESS } from '../src/domain/reference-ranges';

/**
 * Idade a partir da qual uma variante entra no aviso de revisão de catálogo.
 *
 * Três anos porque o ciclo típico das quatro marcas é de dois: em três anos, uma linha que não
 * ganhou sucessora é exceção de verdade (a HEAD Ti.S6 é vendida há duas décadas), e uma que ganhou
 * já está saindo do estoque das lojas.
 */
const CATALOG_REVIEW_AFTER_YEARS = 3;

const RESET = '[0m';
const RED = '[31m';
const YELLOW = '[33m';
const GREEN = '[32m';
const DIM = '[2m';

export const ALLOW_UNVERIFIED = process.env.ALLOW_UNVERIFIED_DATASET === 'true';

const strict =
  !ALLOW_UNVERIFIED &&
  (process.env.NODE_ENV === 'production' || process.env.DATASET_MODE === 'strict');

function main(): void {
  const rackets = loadRacketCatalog();
  const strings = loadStringCatalog();
  const stats = catalogStats();
  const scored = scoreRackets(rackets);
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log('\n═══ Tennis Engineer — verificação do dataset ═══\n');
  console.log(`Modo: ${strict ? 'ESTRITO (bloqueia)' : 'permissivo (informativo)'}`);
  if (ALLOW_UNVERIFIED) {
    console.log(
      `${YELLOW}⚠  ALLOW_UNVERIFIED_DATASET=true — a trava de release está DESLIGADA.${RESET}\n` +
        `${DIM}   Use isto apenas em ambiente de testes. O site exibirá um aviso permanente e${RESET}\n` +
        `${DIM}   NÃO deve cobrar de ninguém enquanto a curadoria não terminar.${RESET}`,
    );
  }
  console.log(
    `Raquetes: ${stats.rackets}  ·  verificadas: ${stats.racketsVerified}/${stats.rackets}`,
  );
  console.log(
    `Cordas: ${stats.stringModels} modelos, ${stats.stringVariants} variantes  ·  verificadas: ${stats.stringVariantsVerified}/${stats.stringVariants}\n`,
  );

  // ── 1. Verificação de procedência ────────────────────────────────────────────────────────
  const unverifiedRackets = rackets.filter((r) => r.verification_state !== 'verified');
  if (unverifiedRackets.length > 0) {
    const msg =
      `${unverifiedRackets.length} de ${rackets.length} variantes de raquete não estão verificadas. ` +
      'Uma recomendação paga não pode se apoiar em dados não conferidos contra a fonte ' +
      '(docs/DATA_SOURCING.md §3). Use /admin/verificacao.';
    (strict ? errors : warnings).push(msg);
  }

  const unverifiedStrings = strings.variants.filter((v) => v.verification_state !== 'verified');
  if (unverifiedStrings.length > 0) {
    const msg =
      `${unverifiedStrings.length} de ${strings.variants.length} variantes de corda não estão verificadas. ` +
      'A REGRA DE INTEGRIDADE exige que cada combinação marca+modelo+gauge seja confirmada como ' +
      'produto real e comercialmente disponível.';
    (strict ? errors : warnings).push(msg);
  }

  const unknownAvailability = strings.variants.filter(
    (v) => v.brazil_availability_status === 'unknown',
  );
  if (unknownAvailability.length > 0) {
    const msg = `${unknownAvailability.length} variantes de corda com disponibilidade no Brasil desconhecida.`;
    (strict ? errors : warnings).push(msg);
  }

  /**
   * ── 1b. Envelhecimento do catálogo ───────────────────────────────────────────────────────
   *
   * As marcas renovam cada linha a cada dois anos, e o catálogo não avisa quando fica para trás:
   * um seed escrito em 2024 continua carregando, validando e pontuando perfeitamente em 2026 —
   * só que recomendando uma Pure Drive de 2021 que ninguém mais fabrica. Nenhum teste pega isso,
   * porque a estrutura do dado continua correta; o que envelheceu foi o MUNDO.
   *
   * Este bloco é um lembrete visível a cada build, não uma trava. Existe modelo que permanece em
   * linha por muitos anos (a HEAD Ti.S6 é vendida há duas décadas), então reprovar por idade
   * produziria falso positivo — mas passar em silêncio produz o erro caro.
   */
  const thisYear = new Date().getFullYear();
  /*
    A confirmação da curadoria silencia o aviso — mas só enquanto for recente.

    Sem isso, um modelo que fica anos em linha gera o mesmo aviso a cada build, sem nada a fazer a
    respeito. Aviso que sempre aparece e nunca exige ação para de ser lido, e leva junto os que
    importam. Com prazo, a pergunta volta a ser feita quando volta a valer a pena fazê-la: a
    confirmação descreve o mercado do dia em que foi dada, não uma verdade permanente.
  */
  const confirmadaRecentemente = (iso: string | null): boolean => {
    if (!iso) return false;
    const anos = (Date.now() - new Date(iso).getTime()) / (365.25 * 24 * 3600 * 1000);
    return anos < CATALOG_REVIEW_AFTER_YEARS;
  };

  const aging = rackets
    .filter(
      (r) =>
        r.year !== null &&
        thisYear - r.year >= CATALOG_REVIEW_AFTER_YEARS &&
        !confirmadaRecentemente(r.generation_confirmed_at),
    )
    .sort((a, b) => (a.year ?? 0) - (b.year ?? 0));

  if (aging.length > 0) {
    warnings.push(
      `${aging.length} variantes com ${CATALOG_REVIEW_AFTER_YEARS}+ anos — confira se a marca ` +
        `já lançou geração nova: ` +
        aging.map((r) => `${r.product_name}`).join(', '),
    );
  }

  // ── 2. Completude de dados ───────────────────────────────────────────────────────────────
  const belowMinimum = scored.filter(
    (r) => r.attributes.data_completeness < MIN_DATA_COMPLETENESS,
  );
  if (belowMinimum.length > 0) {
    errors.push(
      `${belowMinimum.length} variantes abaixo da completude mínima (${MIN_DATA_COMPLETENESS}): ` +
        belowMinimum.map((r) => r.variant.product_name).join(', '),
    );
  }

  const avgCompleteness =
    scored.reduce((s, r) => s + r.attributes.data_completeness, 0) / scored.length;
  console.log(`Completude média dos dados: ${(avgCompleteness * 100).toFixed(1)}%`);
  if (avgCompleteness < 0.8) {
    warnings.push(
      `Completude média em ${(avgCompleteness * 100).toFixed(1)}%. Os campos de laboratório ` +
        '(swingweight, RA, twistweight) estão null por não serem publicados pelo fabricante. ' +
        'Anexar medições tier 3 elevaria a confiança de todos os relatórios.',
    );
  }

  // ── 3. Nenhuma especificação sem procedência ─────────────────────────────────────────────
  for (const r of rackets) {
    for (const [field, value] of Object.entries(r.specs)) {
      if (value === null || Array.isArray(value)) continue;
      if (field === 'beam_width_avg_mm') continue; // derivado em runtime
      if (!(field in r.provenance)) {
        errors.push(`${r.product_name}: campo "${field}" tem valor mas não tem procedência.`);
      }
    }
  }

  // ── 4. Cobertura por segmento de jogador ─────────────────────────────────────────────────
  const coverage = analyzeCoverage(rackets);
  console.log('\nCobertura por segmento:');
  for (const r of coverage.results) {
    const icon = r.ok ? `${GREEN}✓${RESET}` : `${YELLOW}✗${RESET}`;
    console.log(`  ${icon} ${r.label}: ${r.found}/${r.required}`);
  }
  for (const gap of coverage.gaps) {
    warnings.push(`Lacuna de catálogo — ${gap.label} (${gap.found}/${gap.required}): ${gap.rationale}`);
  }

  // ── Resultado ────────────────────────────────────────────────────────────────────────────
  if (warnings.length > 0) {
    console.log(`\n${YELLOW}AVISOS (${warnings.length}):${RESET}`);
    for (const w of warnings) console.log(`  ${YELLOW}!${RESET} ${w}\n`);
  }

  if (errors.length > 0) {
    console.log(`\n${RED}ERROS (${errors.length}):${RESET}`);
    for (const e of errors) console.log(`  ${RED}✗${RESET} ${e}\n`);
    console.log(
      `${RED}Dataset NÃO apto para produção.${RESET} ` +
        `${DIM}Um dado inventado é pior que um dado ausente (§69).${RESET}\n`,
    );
    process.exit(1);
  }

  if (strict) {
    console.log(`\n${GREEN}✓ Dataset apto para produção.${RESET}\n`);
  } else {
    console.log(
      `\n${DIM}Modo permissivo: nada bloqueado. Em produção, os avisos acima virariam erros.${RESET}\n`,
    );
  }
}

main();
