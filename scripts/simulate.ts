/**
 * Recommendation Simulator (CLI) — §47.
 *
 * "Criar ferramenta essencial: Recommendation Simulator. Permitir criar manualmente um perfil.
 * Rodar algoritmo. Mostrar ranking completo 1–20, scores, componentes, penalizações, justificativas.
 * Isso será essencial para validar o produto."
 *
 * Roda EXATAMENTE o mesmo `recommend()` de produção — sem mocks, sem caminho alternativo. É por isso
 * que ele vale como ferramenta de validação, e é o que a fronteira arquitetural garante.
 *
 *   npm run simulate                       # matriz de todas as personas
 *   npm run simulate -- p05                # ranking completo + auditoria de uma persona
 *   npm run simulate -- p05 --top 20       # profundidade do ranking
 *   npm run simulate -- p05 --breakdown 3  # abre o ScoreBreakdown dos 3 primeiros
 */

import { DATASET_VERSION, loadRacketCatalog, loadStringCatalog } from '../src/data/load';
import { scoreRackets } from '../src/recommendation/normalize/racket-attributes';
import { buildPlayerProfile } from '../src/recommendation/profile/build-profile';
import { recommend } from '../src/recommendation';
import { CONFIDENCE_LABEL_PT } from '../src/recommendation/confidence';
import { PERSONAS } from '../tests/personas/fixtures/personas';

const B = '[1m';
const DIM = '[2m';
const R = '[0m';
const GREEN = '[32m';
const YELLOW = '[33m';
const RED = '[31m';
const CYAN = '[36m';

const args = process.argv.slice(2);
const personaId = args.find((a) => !a.startsWith('--'));
const topN = Number.parseInt(args[args.indexOf('--top') + 1] ?? '20', 10) || 20;
const breakdownN = Number.parseInt(args[args.indexOf('--breakdown') + 1] ?? '0', 10) || 0;

const rackets = scoreRackets(loadRacketCatalog());
const strings = loadStringCatalog();

function run(personaIndex: number) {
  const persona = PERSONAS[personaIndex]!;
  const profile = buildPlayerProfile(persona.answers);
  const result = recommend({
    profile,
    rackets,
    strings,
    datasetVersion: DATASET_VERSION,
    mode: 'permissive',
    includeSetup: true,
  });
  return { persona, profile, result };
}

/**
 * Padding sobre TEXTO PURO. As cores são aplicadas DEPOIS de padear, nunca antes — medir o
 * comprimento de uma string já colorida conta os códigos ANSI e desalinha as colunas.
 */
function pad(text: string, n: number): string {
  if (text.length > n - 1) return `${text.slice(0, n - 2)}\u2026 `;
  return text + ' '.repeat(n - text.length);
}

/** Padeia e só então colore. */
function padColored(text: string, n: number, color: string): string {
  return `${color}${pad(text, n)}${R}`;
}

function scoreColor(score: number): string {
  if (score >= 85) return GREEN;
  if (score >= 75) return CYAN;
  if (score >= 65) return YELLOW;
  return RED;
}

// ── Modo matriz: todas as personas ────────────────────────────────────────────────────────────
function runMatrix(): void {
  console.log(`\n${B}═══ Tennis Engineer — matriz de personas ═══${R}\n`);
  console.log(
    `${DIM}Catálogo: ${rackets.length} raquetes · ${strings.variants.length} variantes de corda · dataset ${DATASET_VERSION}${R}\n`,
  );

  console.log(
    `${B}${pad('#', 5)}${pad('Persona', 34)}${pad('Fit', 7)}${pad('Conf', 8)}Top 1${R}`,
  );
  console.log('─'.repeat(100));

  const modelCounts = new Map<string, number>();
  let fitSum = 0;
  const confCounts = { high: 0, medium: 0, low: 0 };

  for (let i = 0; i < PERSONAS.length; i += 1) {
    const { persona, result } = run(i);
    const top = result.podium[0] ?? result.full_ranking[0];
    if (!top) {
      console.log(`${pad(persona.id, 5)}${pad(persona.name, 34)}${RED}sem pódio${R}`);
      continue;
    }

    const name = top.racket.variant.product_name;
    modelCounts.set(name, (modelCounts.get(name) ?? 0) + 1);
    fitSum += top.fit_score;
    confCounts[result.confidence.level] += 1;

    const tie = result.podium[1]?.technical_tie_with_previous ? ` ${DIM}(empate)${R}` : '';
    console.log(
      pad(persona.id, 5) +
        pad(persona.name, 34) +
        padColored(`${top.fit_score.toFixed(0)}%`, 7, scoreColor(top.fit_score)) +
        pad(CONFIDENCE_LABEL_PT[result.confidence.level], 8) +
        name +
        tie,
    );
  }

  console.log('\n' + '─'.repeat(100));
  console.log(`${B}Diagnóstico agregado${R}`);
  console.log(`  Fit médio do Top 1: ${(fitSum / PERSONAS.length).toFixed(1)}`);
  console.log(
    `  Confiança: ${confCounts.high} alta · ${confCounts.medium} média · ${confCounts.low} baixa`,
  );

  // Alerta de concentração (§ ADMIN_SPEC §7): um modelo dominando indica peso mal calibrado
  // ou lacuna de catálogo.
  const sorted = [...modelCounts.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`\n  ${B}Modelos mais recomendados${R}`);
  for (const [name, count] of sorted.slice(0, 5)) {
    const share = (count / PERSONAS.length) * 100;
    const flag = share > 25 ? ` ${YELLOW}← concentração > 25%, auditar${R}` : '';
    console.log(`    ${count}× (${share.toFixed(0)}%) ${name}${flag}`);
  }
  console.log(
    `\n  ${DIM}Diversidade: ${modelCounts.size} modelos distintos em ${PERSONAS.length} personas${R}\n`,
  );
}

// ── Modo detalhe: uma persona ─────────────────────────────────────────────────────────────────
function runDetail(id: string): void {
  const index = PERSONAS.findIndex((p) => p.id === id);
  if (index < 0) {
    console.error(`Persona "${id}" não encontrada. Disponíveis: ${PERSONAS.map((p) => p.id).join(', ')}`);
    process.exit(1);
  }

  const { persona, profile, result } = run(index);

  console.log(`\n${B}═══ ${persona.name} (${persona.id}) ═══${R}`);
  console.log(`${DIM}${persona.description}${R}\n`);

  console.log(`${B}Perfil calculado${R}`);
  console.log(
    `  nível ${profile.player_level_score.toFixed(0)} ` +
      `${DIM}(objetivo ${profile.objective_level_score.toFixed(0)} / percebido ${profile.perceived_level_score})${R}`,
  );
  console.log(
    `  swing ${profile.swing_speed_score.toFixed(0)}${profile.swing_speed_inferred ? ` ${DIM}(inferido)${R}` : ''} · ` +
      `comprimento ${profile.swing_length} · potência natural ${profile.natural_power_score.toFixed(0)}`,
  );
  console.log(
    `  físico ${profile.physical_capacity_score.toFixed(0)} · sensibilidade no braço ${profile.arm_sensitivity_score}`,
  );
  console.log(
    `  necessidades: ` +
      Object.entries(profile.needs)
        .filter(([, v]) => v !== 50)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ') || '  necessidades: neutras',
  );
  if (profile.contradictions.length > 0) {
    console.log(`  ${YELLOW}contradições: ${profile.contradictions.map((c) => c.code).join(', ')}${R}`);
  }

  console.log(`\n${B}Ranking (${result.candidates_evaluated} avaliadas)${R}`);
  console.log(
    `${DIM}${pad('#', 4)}${pad('Fit', 7)}${pad('Raquete', 40)}${pad('Fís', 6)}${pad('Nív', 6)}${pad('Swi', 6)}${pad('Est', 6)}${pad('Obj', 6)}${pad('Cnf', 6)}${pad('Trn', 6)}Pen${R}`,
  );

  for (const entry of result.full_ranking.slice(0, topN)) {
    const c = new Map(entry.breakdown.components.map((x) => [x.key, x.raw]));
    const penalty = entry.breakdown.penalties.reduce((s, p) => s + p.points, 0);
    const inPodium = result.podium.some((p) => p.racket.variant.id === entry.racket.variant.id);
    const marker = inPodium ? `${GREEN}▸${R}` : ' ';

    console.log(
      `${marker}${pad(String(entry.rank), 3)}` +
        padColored(entry.fit_score.toFixed(1), 7, scoreColor(entry.fit_score)) +
        pad(entry.racket.variant.product_name, 40) +
        pad((c.get('physical_fit') ?? 0).toFixed(0), 6) +
        pad((c.get('skill_fit') ?? 0).toFixed(0), 6) +
        pad((c.get('swing_fit') ?? 0).toFixed(0), 6) +
        pad((c.get('playstyle_fit') ?? 0).toFixed(0), 6) +
        pad((c.get('objective_fit') ?? 0).toFixed(0), 6) +
        pad((c.get('comfort_fit') ?? 0).toFixed(0), 6) +
        pad((c.get('transition_fit') ?? 0).toFixed(0), 6) +
        (penalty > 0 ? `${RED}−${penalty.toFixed(1)}${R}` : `${DIM}—${R}`),
    );
  }

  // §48 — por que ganhou, por que perdeu.
  if (breakdownN > 0) {
    for (const entry of result.full_ranking.slice(0, breakdownN)) {
      console.log(`\n${B}Auditoria — #${entry.rank} ${entry.racket.variant.product_name}${R}`);
      console.log(`  ${DIM}completude de dados: ${(entry.breakdown.data_completeness * 100).toFixed(0)}%${R}`);
      for (const comp of entry.breakdown.components) {
        console.log(
          `  ${pad(comp.key, 18)} ${pad(comp.raw.toFixed(1), 7)} × ${pad(comp.weight.toFixed(3), 7)} = ${comp.contribution.toFixed(2)}`,
        );
        for (const term of comp.terms) {
          if (term.note) console.log(`      ${DIM}${term.label}: ${term.note}${R}`);
        }
      }
      for (const g of entry.breakdown.gained) console.log(`  ${GREEN}+${R} ${g}`);
      for (const l of entry.breakdown.lost) console.log(`  ${RED}−${R} ${l}`);
    }
  }

  // Excluídos por filtro duro — tão importante quanto ver quem entrou.
  if (result.excluded.length > 0) {
    console.log(`\n${B}Excluídos por filtro duro (${result.excluded.length})${R}`);
    for (const ex of result.excluded.slice(0, 10)) {
      console.log(`  ${RED}✗${R} ${pad(ex.product_name, 40)} ${DIM}${ex.filter}: ${ex.reason}${R}`);
    }
  }

  console.log(`\n${B}Setup${R}`);
  if (result.string_recommendation && result.tension) {
    const s = result.string_recommendation;
    const t = result.tension;
    console.log(
      `  ${s.variant.model.brand} ${s.variant.model.model} ${s.variant.variant.gauge_mm.toFixed(2)} mm ` +
        `${DIM}(${s.variant.model.string_type}, fit ${s.fit_score})${R}`,
    );
    console.log(`  ${t.lbs} lbs / ${t.kg} kg · faixa ${t.range_lbs[0]}–${t.range_lbs[1]} lbs`);
    console.log(
      `  ${DIM}base ${t.base_lbs} (${t.base_source})${t.anchored_to_current ? `, ancorado ${(t.anchor_weight * 100).toFixed(0)}%` : ''}${t.clamped_by ? `, limitado por ${t.clamped_by}` : ''}${R}`,
    );
    if (s.gauge_note) console.log(`  ${DIM}${s.gauge_note}${R}`);
  } else {
    console.log(`  ${YELLOW}nenhuma corda passou nos filtros${R}`);
  }

  console.log(
    `\n${B}Confiança:${R} ${CONFIDENCE_LABEL_PT[result.confidence.level]} (${result.confidence.score.toFixed(0)})`,
  );
  for (const reason of result.confidence.reasons) {
    console.log(`  ${DIM}−${reason.points.toFixed(1)}${R} ${reason.message}`);
    if (reason.remedy) console.log(`         ${DIM}↳ ${reason.remedy}${R}`);
  }

  console.log(
    `\n${DIM}motor ${result.engine_version} · pesos ${result.weights_version} · dataset ${result.dataset_version}${R}`,
  );
  console.log(`${DIM}upsell Top 3 disponível: ${result.top3_offer_available ? 'sim' : 'não'}${R}\n`);
}

if (personaId) runDetail(personaId);
else runMatrix();
