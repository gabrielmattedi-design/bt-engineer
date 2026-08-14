/**
 * Escrita do bloco de verificação de volta no JSON semente.
 *
 * Roda apenas no servidor, apenas no painel do admin. É a única função do sistema que modifica o
 * catálogo, e ela é deliberadamente estúpida: recebe um bloco já validado, encontra a entrada pelo
 * `product_name` e grava. Nenhuma regra de negócio mora aqui — as regras estão em `canMarkVerified`,
 * que a Server Action é obrigada a chamar antes.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RacketBrand } from '@/domain/racket';
import type { RacketVerification } from '@/data/load';

const BRAND_FILE: Record<RacketBrand, string> = {
  HEAD: 'head.json',
  Wilson: 'wilson.json',
  Babolat: 'babolat.json',
  Yonex: 'yonex.json',
};

/**
 * A barreira que sustenta a política do DATA_SOURCING (§3, ADMIN_SPEC §2): é IMPOSSÍVEL marcar uma
 * variante como verificada sem a URL da fonte conferida e sem a disponibilidade no Brasil resolvida.
 *
 * Isto não é validação de formulário — é invariante de domínio. A UI desabilita o botão, mas a
 * Server Action chama isto de novo, porque um formulário desabilitado não é uma garantia.
 */
export function canMarkVerified(v: RacketVerification): { ok: true } | { ok: false; reason: string } {
  if (v.state !== 'verified') return { ok: true };

  if (!v.source_url) {
    return {
      ok: false,
      reason:
        'Uma variante não pode ser marcada como verificada sem a URL da ficha oficial que foi ' +
        'conferida. Sem fonte, "verificado" significa apenas "alguém clicou num botão".',
    };
  }
  if (v.brazil_availability_status === 'unknown') {
    return {
      ok: false,
      reason:
        'Defina a disponibilidade no Brasil. Um setup tecnicamente perfeito, mas inexistente no ' +
        'mercado, é uma recomendação errada (§69).',
    };
  }
  if (!v.verified_at) {
    return { ok: false, reason: 'Faltou a data da verificação.' };
  }
  return { ok: true };
}

const CATALOG_DIR = join(process.cwd(), 'src', 'data', 'rackets');

/**
 * Lê os blocos de verificação direto do disco, por `product_name`.
 *
 * `loadRacketCatalog()` usa `import ... from './rackets/head.json'`, que o bundler CONGELA em build
 * time. Isso é o comportamento certo para produção — o catálogo é dado de build, e é por isso que a
 * trava de release consegue enxergá-lo — mas significa que o painel não veria a própria gravação até
 * o próximo build.
 *
 * Daí esta leitura fresca, usada SOMENTE pelo admin. O fluxo real é: curar em desenvolvimento →
 * commitar o JSON → deployar. A curadoria é uma mudança de código, revisável em PR, não uma escrita
 * silenciosa em runtime.
 */
export function readVerificationsFromDisk(): Map<string, RacketVerification> {
  const out = new Map<string, RacketVerification>();
  for (const file of Object.values(BRAND_FILE)) {
    const parsed = JSON.parse(readFileSync(join(CATALOG_DIR, file), 'utf8')) as {
      rackets: Array<{ product_name: string; verification?: RacketVerification }>;
    };
    for (const entry of parsed.rackets) {
      if (entry.verification) out.set(entry.product_name, entry.verification);
    }
  }
  return out;
}

export function writeRacketVerification(
  brand: RacketBrand,
  productName: string,
  verification: RacketVerification,
): void {
  const gate = canMarkVerified(verification);
  if (!gate.ok) throw new Error(gate.reason);

  const path = join(CATALOG_DIR, BRAND_FILE[brand]);
  const file = JSON.parse(readFileSync(path, 'utf8')) as {
    rackets: Array<{ product_name: string; verification?: RacketVerification }>;
  };

  const entry = file.rackets.find((r) => r.product_name === productName);
  if (!entry) throw new Error(`Variante não encontrada no catálogo: ${productName}`);

  entry.verification = verification;
  writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`, 'utf8');
}
