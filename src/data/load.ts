/**
 * Carga e validação do catálogo semente.
 *
 * Toda entrada passa por Zod na carga, e o schema só admite os campos que as quatro marcas
 * PUBLICAM: cabeça, comprimento, peso sem cordas, balanço, perfil da viga, padrão e faixa de
 * tensão. Medições de laboratório (swingweight, RA, twistweight, peso encordoado) não existem no
 * schema da v2 — não é preciso "forçar a null" o que não tem onde ser escrito.
 *
 * Isso torna estruturalmente impossível colar no seed um swingweight lembrado de algum lugar.
 */

import { z } from 'zod';
import type { ProvenanceMap } from '@/domain/sourced';
import type { RacketBrand, RacketVariant } from '@/domain/racket';
import type { StringBrand, StringModel, StringShape, StringVariant } from '@/domain/string';
import { computeStringBaseAttributes } from '@/recommendation/normalize/string-attributes';

import headJson from './rackets/head.json';
import wilsonJson from './rackets/wilson.json';
import babolatJson from './rackets/babolat.json';
import yonexJson from './rackets/yonex.json';
import stringsJson from './strings/catalog.json';

export const DATASET_VERSION = '2026.08.0';

const provenanceSchema = z.object({
  source: z.enum([
    'manufacturer',
    'official_distributor',
    'lab',
    'major_retailer',
    'br_retailer',
    'technical_review',
    'unverified',
  ]),
  source_url: z.string().url().nullable(),
  verified_at: z.string().nullable(),
  confidence: z.enum(['high', 'medium', 'low']),
  notes: z.string().optional(),
});

/** Faixas físicas — espelham os CHECK do banco. Impedem persistir um valor absurdo. */
const racketSpecsSchema = z.object({
  head_size_sq_in: z.number().min(80).max(140),
  length_in: z.number().min(26).max(30),
  unstrung_weight_g: z.number().min(200).max(400),
  balance_mm: z.number().min(280).max(390),
  string_pattern_mains: z.number().int().min(12).max(20),
  string_pattern_crosses: z.number().int().min(14).max(24),
  beam_width_mm: z.string().nullable().optional(),
  recommended_tension_min_lbs: z.number().min(30).max(75).nullable().optional(),
  recommended_tension_max_lbs: z.number().min(30).max(75).nullable().optional(),
  grip_sizes_available: z.array(z.number().int().min(0).max(5)),
});

const racketEntrySchema = z.object({
  family: z.string().min(1),
  model: z.string().min(1),
  variant: z.string().min(1),
  generation: z.string().min(1),
  year: z.number().int().nullable(),
  product_name: z.string().min(1),
  status: z.enum(['current', 'previous_generation', 'discontinued']),
  specs: racketSpecsSchema,
});

const racketFileSchema = z.object({
  brand: z.enum(['HEAD', 'Wilson', 'Babolat', 'Yonex']),
  data_version: z.string(),
  default_provenance: provenanceSchema,
  methodology_note: z.string(),
  rackets: z.array(racketEntrySchema).min(1),
});

const stringVariantSchema = z.object({
  gauge_mm: z.number().min(0.95).max(1.45),
  gauge_us: z.string().nullable().optional(),
  brazil_availability_status: z.enum([
    'widely_available',
    'available',
    'limited',
    'not_found',
    'unknown',
  ]),
  commercial_availability_note: z.string().nullable().optional(),
});

const stringEntrySchema = z.object({
  brand: z.enum(['Luxilon', 'Solinco', 'Babolat', 'HEAD', 'Yonex', 'Wilson', 'Tecnifibre']),
  model: z.string().min(1),
  string_type: z.enum([
    'polyester',
    'co_polyester',
    'multifilament',
    'synthetic_gut',
    'natural_gut',
    'hybrid',
  ]),
  material: z.string().nullable(),
  shape: z.enum(['round', 'pentagonal', 'hexagonal', 'textured', 'square']).nullable(),
  firmness: z.enum(['soft', 'medium', 'firm']),
  durability: z.enum(['low', 'medium', 'high']),
  tension_maintenance: z.enum(['low', 'medium', 'high']),
  recommended_player_type: z.array(z.string()),
  variants: z.array(stringVariantSchema).min(1),
});

const stringFileSchema = z.object({
  data_version: z.string(),
  default_provenance: provenanceSchema,
  integrity_note: z.string(),
  scores_note: z.string(),
  strings: z.array(stringEntrySchema).min(1),
});

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Campos de catálogo do fabricante presentes no seed. */
const MANUFACTURER_FIELDS = [
  'head_size_sq_in',
  'length_in',
  'unstrung_weight_g',
  'balance_mm',
  'string_pattern_mains',
  'string_pattern_crosses',
  'beam_width_mm',
  'grip_sizes_available',
] as const;

const TENSION_FIELDS = ['recommended_tension_min_lbs', 'recommended_tension_max_lbs'] as const;

function buildProvenance(
  base: z.infer<typeof provenanceSchema>,
  hasTension: boolean,
): ProvenanceMap {
  const map: Record<string, z.infer<typeof provenanceSchema>> = {};
  for (const field of MANUFACTURER_FIELDS) map[field] = base;
  if (hasTension) {
    // A faixa de tensão é publicada, mas divergências entre mercados são comuns — confiança menor.
    for (const field of TENSION_FIELDS) {
      map[field] = {
        ...base,
        confidence: 'low',
        notes:
          'Faixa de tensão do catálogo do fabricante. Divergências entre mercados são comuns; ' +
          'confirmar na ficha oficial do produto para o mercado brasileiro.',
      };
    }
  }
  return map;
}

function loadRacketFile(raw: unknown): RacketVariant[] {
  const file = racketFileSchema.parse(raw);

  return file.rackets.map((entry): RacketVariant => {
    const hasTension =
      entry.specs.recommended_tension_min_lbs != null &&
      entry.specs.recommended_tension_max_lbs != null;

    return {
      id: slugify(`${file.brand}-${entry.model}-${entry.generation}`),
      brand: file.brand as RacketBrand,
      family: entry.family,
      model: entry.model,
      variant: entry.variant,
      generation: entry.generation,
      year: entry.year,
      product_name: entry.product_name,
      slug: slugify(entry.product_name),
      status: entry.status,
      specs: {
        head_size_sq_in: entry.specs.head_size_sq_in,
        length_in: entry.specs.length_in,
        unstrung_weight_g: entry.specs.unstrung_weight_g,
        balance_mm: entry.specs.balance_mm,
        beam_width_mm: entry.specs.beam_width_mm ?? null,
        string_pattern_mains: entry.specs.string_pattern_mains,
        string_pattern_crosses: entry.specs.string_pattern_crosses,
        recommended_tension_min_lbs: entry.specs.recommended_tension_min_lbs ?? null,
        recommended_tension_max_lbs: entry.specs.recommended_tension_max_lbs ?? null,
        grip_sizes_available: entry.specs.grip_sizes_available,
      },
      provenance: buildProvenance(file.default_provenance, hasTension),
      // Estado honesto do seed: dados de catálogo carregados, verificação humana pendente.
      verification_state: 'pending_verification',
      global_availability: 'unknown',
      brazil_availability_status: 'unknown',
      data_version: file.data_version,
      last_verified_at: null,
      image_url: null,
      image_verified: false,
    };
  });
}

let racketCache: RacketVariant[] | null = null;

export function loadRacketCatalog(): RacketVariant[] {
  if (racketCache) return racketCache;
  racketCache = [
    ...loadRacketFile(headJson),
    ...loadRacketFile(wilsonJson),
    ...loadRacketFile(babolatJson),
    ...loadRacketFile(yonexJson),
  ];
  return racketCache;
}

export type LoadedStringCatalog = {
  models: StringModel[];
  variants: StringVariant[];
};

let stringCache: LoadedStringCatalog | null = null;

export function loadStringCatalog(): LoadedStringCatalog {
  if (stringCache) return stringCache;

  const file = stringFileSchema.parse(stringsJson);
  const models: StringModel[] = [];
  const variants: StringVariant[] = [];

  for (const entry of file.strings) {
    const id = slugify(`${entry.brand}-${entry.model}`);

    models.push({
      id,
      brand: entry.brand as StringBrand,
      model: entry.model,
      slug: id,
      string_type: entry.string_type,
      material: entry.material,
      shape: entry.shape as StringShape | null,
      // Scores DERIVADOS dos descritores, nunca digitados (§6).
      base_attributes: computeStringBaseAttributes({
        string_type: entry.string_type,
        shape: entry.shape as StringShape | null,
        firmness: entry.firmness,
        durability: entry.durability,
        tension_maintenance: entry.tension_maintenance,
      }),
      recommended_player_type: entry.recommended_player_type,
      provenance: { descriptors: file.default_provenance },
    });

    for (const v of entry.variants) {
      variants.push({
        id: `${id}-${v.gauge_mm.toFixed(2).replace('.', '')}`,
        string_id: id,
        gauge_mm: v.gauge_mm,
        gauge_us: v.gauge_us ?? null,
        status: 'current',
        market: 'BR',
        global_availability: 'unknown',
        brazil_availability_status: v.brazil_availability_status,
        commercial_availability_note: v.commercial_availability_note ?? null,
        verification_state: 'pending_verification',
        source_tier: file.default_provenance.source,
        source_url: file.default_provenance.source_url,
        last_verified_at: null,
        data_version: file.data_version,
      });
    }
  }

  stringCache = { models, variants };
  return stringCache;
}

/** Diagnóstico usado pela trava de release e pelo painel do admin. */
export function catalogStats(): {
  rackets: number;
  racketsVerified: number;
  stringModels: number;
  stringVariants: number;
  stringVariantsVerified: number;
  productionReady: boolean;
} {
  const rackets = loadRacketCatalog();
  const strings = loadStringCatalog();
  const racketsVerified = rackets.filter((r) => r.verification_state === 'verified').length;
  const stringVariantsVerified = strings.variants.filter(
    (v) => v.verification_state === 'verified',
  ).length;

  return {
    rackets: rackets.length,
    racketsVerified,
    stringModels: strings.models.length,
    stringVariants: strings.variants.length,
    stringVariantsVerified,
    productionReady: racketsVerified === rackets.length && stringVariantsVerified === strings.variants.length,
  };
}
