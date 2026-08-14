/**
 * Validador anti-alucinação — docs/00_RISKS_AND_DECISIONS.md#r-03.
 *
 * §4: "A IA jamais poderá inventar peso, swingweight, rigidez, padrão de cordas, tensão
 * recomendada pelo fabricante, características de um produto."
 *
 * Instrução de prompt não é garantia. Esta função é a garantia: extrai TODOS os numerais do texto
 * gerado e verifica se cada um aparece no `FactSheet` autorizado. Um único número não autorizado
 * rejeita a explicação inteira, e o sistema cai para o gerador determinístico.
 *
 * No pior caso o usuário lê uma prosa menos fluida. Ele nunca lê um número inventado.
 */

import type { FactSheet } from '@/recommendation/explain/fact-sheet';

export type GuardResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly violations: readonly string[] };

/**
 * Números que não precisam de autorização por não serem especificações técnicas:
 * ordinais e quantidades pequenas usadas na prosa ("as duas primeiras", "3 pontos").
 * O limite de 20 é deliberado: nenhuma spec relevante do domínio (peso, RA, swingweight, cabeça,
 * tensão) cai abaixo dele, então a isenção não abre brecha.
 */
const PROSE_NUMBER_CEILING = 20;

/** Captura numerais com decimal opcional (vírgula ou ponto), incluindo o sinal de porcentagem. */
const NUMBER_PATTERN = /\d+(?:[.,]\d+)?/g;

function normalizeNumber(raw: string): string {
  return raw.replace(',', '.');
}

/** Todos os numerais que aparecem nos fatos autorizados, normalizados. */
function authorizedNumbers(sheet: FactSheet): Set<string> {
  const allowed = new Set<string>();

  const collect = (text: string): void => {
    for (const match of text.matchAll(NUMBER_PATTERN)) {
      const normalized = normalizeNumber(match[0]);
      allowed.add(normalized);
      // "300" autoriza "300.0"; "22.7" autoriza "22,7" (já normalizado acima).
      const asNumber = Number.parseFloat(normalized);
      if (Number.isFinite(asNumber)) {
        allowed.add(String(asNumber));
        allowed.add(asNumber.toFixed(1));
        allowed.add(String(Math.round(asNumber)));
      }
    }
  };

  for (const fact of sheet.facts) {
    collect(fact.value);
    collect(fact.label);
  }
  for (const note of sheet.profile_notes) collect(note);
  for (const point of sheet.attention_points) collect(point);

  return allowed;
}

/**
 * Verifica se o texto gerado cita apenas números autorizados.
 *
 * @returns `{ok: true}` quando seguro; `{ok: false, violations}` com os números não autorizados.
 */
export function guardFactualClaims(text: string, sheet: FactSheet): GuardResult {
  const allowed = authorizedNumbers(sheet);
  const violations: string[] = [];

  for (const match of text.matchAll(NUMBER_PATTERN)) {
    const raw = match[0];
    const normalized = normalizeNumber(raw);
    const asNumber = Number.parseFloat(normalized);

    if (allowed.has(normalized) || allowed.has(String(asNumber))) continue;

    // Números pequenos de prosa são tolerados; especificações técnicas nunca caem aqui.
    if (Number.isFinite(asNumber) && asNumber <= PROSE_NUMBER_CEILING && Number.isInteger(asNumber)) {
      continue;
    }

    violations.push(raw);
  }

  return violations.length === 0 ? { ok: true } : { ok: false, violations };
}

/**
 * Termos que a IA não pode usar por transmitirem certeza que o produto não tem (§55, §62).
 * Complementa a checagem numérica: uma explicação pode não ter número algum e ainda assim
 * prometer o que não deve.
 */
const FORBIDDEN_PHRASES = [
  'única raquete',
  'definitivamente a melhor',
  'com certeza absoluta',
  'garantimos',
  'perfeita para você',
  'cientificamente comprovado',
  'a melhor raquete do mundo',
];

export function guardTone(text: string): GuardResult {
  const lower = text.toLowerCase();
  const violations = FORBIDDEN_PHRASES.filter((phrase) => lower.includes(phrase));
  return violations.length === 0 ? { ok: true } : { ok: false, violations };
}

/** Executa as duas checagens. Uma explicação só é aceita se passar em ambas. */
export function guardExplanation(text: string, sheet: FactSheet): GuardResult {
  const factual = guardFactualClaims(text, sheet);
  if (!factual.ok) return factual;
  return guardTone(text);
}
