/**
 * TRAVA DE RELEASE — docs/DATA_SOURCING.md §3, docs/00_RISKS_AND_DECISIONS.md#r-01.
 *
 * Roda antes do build de produção (`npm run build`). Falha se o catálogo não estiver apto a
 * sustentar uma recomendação PAGA. Isto é um portão de CI, não uma boa intenção: é o que impede
 * o produto de ser vendido com dataset em estado `pending_verification`.
 *
 *   NODE_ENV=production          → estrito, bloqueia
 *   DATASET_MODE=strict          → estrito, bloqueia
 *   caso contrário               → relatório informativo, não bloqueia (desenvolvimento)
 */

import { analyzeCoverage } from '../src/data/coverage';
import { catalogStats, loadRacketCatalog, loadStringCatalog } from '../src/data/load';
import { scoreRackets } from '../src/recommendation/normalize/racket-attributes';
import { MIN_DATA_COMPLETENESS } from '../src/domain/reference-ranges';

const RESET = '[0m';
const RED = '[31m';
const YELLOW = '[33m';
const GREEN = '[32m';
const DIM = '[2m';

const strict = process.env.NODE_ENV === 'production' || process.env.DATASET_MODE === 'strict';

function main(): void {
  const rackets = loadRacketCatalog();
  const strings = loadStringCatalog();
  const stats = catalogStats();
  const scored = scoreRackets(rackets);
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log('\n═══ Tennis Engineer — verificação do dataset ═══\n');
  console.log(`Modo: ${strict ? 'ESTRITO (bloqueia)' : 'permissivo (informativo)'}`);
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
