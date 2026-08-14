import { DATASET_VERSION, loadRacketCatalog, loadStringCatalog } from '@/data/load';
import { scoreRackets } from '@/recommendation/normalize/racket-attributes';
import type { ScoredRacket } from '@/domain/racket';
import type { StringCatalog } from '@/recommendation/strings/select-string';

let cached: ScoredRacket[] | null = null;

export function testRackets(): ScoredRacket[] {
  if (!cached) cached = scoreRackets(loadRacketCatalog());
  return cached;
}

export function testStrings(): StringCatalog {
  return loadStringCatalog();
}

export const TEST_DATASET_VERSION = DATASET_VERSION;

/**
 * Os testes rodam em modo permissivo porque o catálogo semente está em `pending_verification`
 * (docs/00_RISKS_AND_DECISIONS.md#r-01). O modo `strict` é exercitado separadamente em
 * tests/integrity/dataset-gate.test.ts.
 */
export const TEST_MODE = 'permissive' as const;
