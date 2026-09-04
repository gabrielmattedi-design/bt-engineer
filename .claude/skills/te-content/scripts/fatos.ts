/**
 * Fatos publicáveis, DERIVADOS do catálogo no momento de gerar.
 *
 * ═══ POR QUE ISTO EXISTE ═════════════════════════════════════════════════════════════════════
 *
 * O projeto já aprendeu esta lição uma vez. A home dizia "Milhares de combinações possíveis" —
 * número redondo escrito à mão — e `src/data/combinations.ts` nasceu para consertar, com a nota:
 * "número redondo escrito à mão é a forma mais fácil de uma página institucional começar a mentir:
 * o catálogo cresce, o texto fica parado, e ninguém percebe porque nada quebra".
 *
 * Conteúdo de Instagram tem o mesmo risco, agravado: um post publicado não se corrige. Se a skill
 * guardasse "47 raquetes" num arquivo de referência, o dia em que entrasse a 48ª ela começaria a
 * publicar mentira sem nada quebrar.
 *
 * Então nenhum número técnico é digitado. Tudo aqui é lido do catálogo que está no ar.
 *
 * Uso:  npx tsx .claude/skills/te-content/scripts/fatos.ts
 */

import { loadRacketCatalog, loadStringCatalog } from '@/data/load';
import { countSetupCombinations } from '@/data/combinations';

const rackets = loadRacketCatalog();
const strings = loadStringCatalog();

function faixa(valores: readonly (number | null | undefined)[]): [number, number] | null {
  const n = valores.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (n.length === 0) return null;
  return [Math.min(...n), Math.max(...n)];
}

function contar<T>(itens: readonly T[], chave: (x: T) => string | null): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of itens) {
    const k = chave(item);
    if (k === null) continue;
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

/**
 * ═══ A GUARDA DE PROVENIÊNCIA ════════════════════════════════════════════════════════════════
 *
 * Devolve `true` só quando aquele campo daquela raquete tem URL de fonte registrada.
 *
 * Hoje devolve `false` para TODOS os 470 campos: o catálogo inteiro está com `source_url: null` e a
 * nota "AGUARDANDO verificação humana contra a página oficial". Ver `references/limites.md` §2.
 *
 * A função existe assim, e não como uma constante `PODE_PUBLICAR_SPECS = false`, porque a restrição
 * precisa se destravar sozinha: no dia em que a curadoria preencher as fontes, a comparação por
 * número passa a ser permitida sem ninguém editar a skill. Uma constante escrita à mão teria o
 * mesmo defeito que este arquivo inteiro existe para evitar.
 */
export function temFonte(variantId: string, campo: string): boolean {
  const r = rackets.find((x) => x.id === variantId);
  const p = (r as unknown as { provenance?: Record<string, { source_url?: string | null }> })
    ?.provenance?.[campo];
  return typeof p?.source_url === 'string' && p.source_url.length > 0;
}

export function fatos() {
  const specs = rackets.map((r) => r.specs);
  const peso = faixa(specs.map((s) => s.unstrung_weight_g));
  const area = faixa(specs.map((s) => s.head_size_sq_in));
  const gauges = [...new Set(strings.variants.map((v) => v.gauge_mm))].sort((a, b) => a - b);

  const padroes = contar(specs, (s) =>
    s.string_pattern_mains && s.string_pattern_crosses
      ? `${s.string_pattern_mains}x${s.string_pattern_crosses}`
      : null,
  );

  const comFonte = rackets.filter((r) => temFonte(r.id, 'unstrung_weight_g')).length;

  return {
    raquetes: rackets.length,
    marcas: [...new Set(rackets.map((r) => r.brand))].sort(),
    cordas_modelos: strings.models.length,
    cordas_variantes: strings.variants.length,
    setups: countSetupCombinations(rackets, strings),
    faixa_peso_g: peso,
    faixa_area_pol2: area,
    espessuras_mm: gauges,
    padroes,
    tipos_de_corda: contar(strings.models, (m) => m.string_type),
    /** Quantas raquetes já podem ter especificação numérica publicada. Ver `temFonte`. */
    raquetes_com_fonte: comFonte,
    pode_publicar_spec_de_modelo: comFonte > 0,
  };
}

if (require.main === module) {
  const f = fatos();
  console.log(JSON.stringify(f, null, 2));
  if (!f.pode_publicar_spec_de_modelo) {
    console.log(
      '\n⚠️  Nenhuma raquete tem `source_url` para o peso. Especificação numérica de modelo\n' +
        '   NOMEADO não pode ser publicada — ver references/limites.md §2.\n' +
        '   Comparação entre modelos fica em caráter e tipo de jogador, sem número.',
    );
  }
}
