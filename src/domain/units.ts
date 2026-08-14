/**
 * Conversões de unidade. Um único lugar, para que lbs↔kg nunca divirja entre motor, UI e relatório.
 */

export const LBS_TO_KG = 0.45359237;

export function lbsToKg(lbs: number): number {
  return Math.round(lbs * LBS_TO_KG * 10) / 10;
}

export function kgToLbs(kg: number): number {
  return Math.round((kg / LBS_TO_KG) * 10) / 10;
}

/**
 * Balanço em pontos a partir do balanço em mm.
 *
 * Positivo = head-light (HL), negativo = head-heavy (HH), na convenção usada por fabricantes e
 * laboratórios. 1 ponto = 1/8 de polegada = 3,175 mm, medido a partir do centro geométrico da raquete.
 */
export function balanceMmToPoints(balanceMm: number, lengthIn: number): number {
  const centerMm = (lengthIn * 25.4) / 2;
  return Math.round(((centerMm - balanceMm) / 3.175) * 10) / 10;
}

export function inchesToCm(inches: number): number {
  return Math.round(inches * 2.54 * 10) / 10;
}

/** Formata gauge para exibição: 1.25 → "1.25 mm". Nunca arredonda para menos de 2 casas. */
export function formatGauge(gaugeMm: number): string {
  return `${gaugeMm.toFixed(2)} mm`;
}

export function formatTension(lbs: number): string {
  return `${Math.round(lbs)} lbs (${lbsToKg(lbs).toFixed(1).replace('.', ',')} kg)`;
}
