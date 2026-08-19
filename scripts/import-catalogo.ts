/**
 * Reescreve o catálogo a partir das planilhas de curadoria.
 *
 *   npx tsx scripts/import-catalogo.ts <raquetes.csv> <cordas.csv>
 *
 * ═══ O QUE A PLANILHA NÃO TRAZ ═══════════════════════════════════════════════════════════════
 *
 * O CSV de conferência foi desenhado para CONFERIR especificações, não para reconstruir o catálogo.
 * Alguns campos do JSON não aparecem nele porque não são conferíveis contra a ficha do fabricante:
 *
 *   raquetes → `family`, `model`, `variant`   (classificação interna)
 *   cordas   → `feel`, `launch`, `bite`, `price_tier`, `recommended_player_type`
 *
 * Para as linhas que já existiam, esses campos são HERDADOS do catálogo atual — a planilha
 * corrigiu medidas, não reclassificou produtos. Para as linhas novas, eles estão escritos à mão
 * neste arquivo, um a um, com o raciocínio ao lado. Nenhum é inventado em silêncio.
 *
 * ═══ POR QUE NÃO DERIVAR TUDO DA PLANILHA ════════════════════════════════════════════════════
 *
 * Porque `feel`, `launch` e `bite` ALIMENTAM OS SCORES. Preencher com um palpite mudaria
 * recomendação de gente de verdade sem nada no sistema indicando que foi palpite. Onde a planilha
 * não diz e o catálogo não sabe, este script FALHA e nomeia o que falta.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DATA = join(process.cwd(), 'src', 'data');
const NOVA_VERSAO = '2026.08.6';

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Leitura
// ─────────────────────────────────────────────────────────────────────────────────────────────

type Linha = Record<string, string>;

function parseCsv(path: string): Linha[] {
  const linhas = readFileSync(path, 'utf8').replace(/^﻿/, '').split('\n').filter((l) => l.trim());
  const cabecalho = linhas[0]!.split(',').map((c) => c.trim());

  return linhas.slice(1).map((linha) => {
    const campos: string[] = [];
    let atual = '';
    let dentroDeAspas = false;
    for (const ch of linha) {
      if (ch === '"') dentroDeAspas = !dentroDeAspas;
      else if (ch === ',' && !dentroDeAspas) { campos.push(atual); atual = ''; }
      else atual += ch;
    }
    campos.push(atual);
    return Object.fromEntries(cabecalho.map((c, i) => [c, (campos[i] ?? '').trim()]));
  });
}

/** Mesma regra de `load.ts` — o id precisa bater com o que o motor calcula. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function num(v: string): number | null {
  if (v === '' || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Classificação das raquetes novas
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * `family` agrupa a linha comercial e é usada pelo pódio para não recomendar três irmãs da mesma
 * família (`rank-rackets.ts`). `model` só serve para compor o id. `variant` rotula a versão.
 *
 * Escrito à mão porque nenhum dos três é dedutível com segurança do nome comercial: "Clash 100 Pro
 * v3" e "Clash 100L v3" pertencem à mesma família e a heurística que acertasse uma erraria a outra.
 */
type Classe = {
  family: string;
  model: string;
  variant: string;
  /**
   * Só quando a coluna `geracao` da planilha não fecha com o `id` que ela mesma traz.
   *
   * O id é DERIVADO de marca+modelo+geração, então os dois têm de concordar. Em três linhas não
   * concordam — "Clash 108 v3" veio com geração `v3` e id terminando em `-2025`, e a RF 01 veio com
   * a própria linha no lugar da geração. Nos dois casos o id é o dado mais confiável: é por ele que
   * a curadoria foi feita, e é ele que os irmãos de linha já usam. A geração escrita aqui é a que
   * reconstrói o id e mantém o padrão da família.
   */
  generation?: string;
};

const CLASSIFICACAO: Readonly<Record<string, Classe>> = {
  'babolat-pure-strike-100-16x19-gen-4-2024': { family: 'Pure Strike', model: 'Pure Strike 100 16x19', variant: '100 16x19' },
  'head-speed-tour-2026': { family: 'Speed', model: 'Speed Tour', variant: 'Tour' },
  'head-extreme-pro-2026': { family: 'Extreme', model: 'Extreme Pro', variant: 'Pro' },
  'head-radical-team-2025': { family: 'Radical', model: 'Radical Team', variant: 'Team' },
  'head-gravity-pro-2025': { family: 'Gravity', model: 'Gravity Pro', variant: 'Pro' },

  // Na Wilson a versão vive na GERAÇÃO ("v10 (2026)"), não no nome do modelo.
  'wilson-blade-100l-v10-2026': { family: 'Blade', model: 'Blade 100L', variant: '100L' },
  'wilson-clash-100-v3-2025': { family: 'Clash', model: 'Clash 100', variant: '100' },
  'wilson-clash-100-pro-v3-2025': { family: 'Clash', model: 'Clash 100 Pro', variant: '100 Pro' },
  'wilson-clash-100l-v3-2025': { family: 'Clash', model: 'Clash 100L', variant: '100L' },
  'wilson-clash-108-v3-2025': { family: 'Clash', model: 'Clash 108', variant: '108', generation: 'v3 (2025)' },
  'wilson-rf-01-2024': { family: 'RF', model: 'RF 01', variant: '01', generation: '2024' },
  'wilson-shift-99-v1-2024': { family: 'Shift', model: 'Shift 99', variant: '99', generation: 'v1 (2024)' },
};

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Descritores das cordas novas
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Normalização de taxonomia — nomes diferentes para a mesma categoria.
 *
 * `polyamide_monofilament` é poliamida, isto é, NÁILON, e náilon é exatamente o que a taxonomia
 * chama de `synthetic_gut`. Não é categoria nova: é o mesmo material com outro nome, e o detalhe
 * ("poliamida monofilamento") sobrevive intacto no campo `material`.
 *
 * ⚠️ Mas atenção ao efeito: a Babolat RPM Soft estava como `co_polyester` e a curadoria a trouxe
 * como poliamida. Sair de co-poliéster para náilon muda MUITO os scores — potência, conforto e
 * rigidez são categorias distintas. A troca é honrada porque foi uma decisão de curadoria, e é
 * anunciada no fim da importação porque merece uma segunda olhada.
 */
const TAXONOMIA_TIPO: Readonly<Record<string, string>> = {
  polyamide_monofilament: 'synthetic_gut',
};

/**
 * Estes NÃO são produtos novos — são correções do NOME de produtos que já estavam no catálogo.
 * Os descritores vêm inteiros do registro antigo, sem nenhuma alteração.
 */
const RENOMEADAS: Readonly<Record<string, string>> = {
  // O "+" de AddiXion+ desaparece no slug, então a chave é `babolat-addixion`, não `-plus`.
  'babolat-addixion': 'babolat-addiction', // "Addiction" era grafia errada de AddiXion
  'babolat-touch-vs': 'babolat-vs-touch', // ordem das palavras invertida
};

/**
 * Os três genuinamente inéditos.
 *
 * `feel`, `launch` e `bite` não são medidos em laboratório e o catálogo já registra isso: vêm de
 * resenhas técnicas e do posicionamento do fabricante. Aqui saem do MESMO processo, ancorados no
 * irmão de linha que já está no catálogo — e o raciocínio está escrito para poder ser contestado.
 *
 * ⚠️ Estes três merecem conferência humana antes da venda.
 */
const INEDITAS: Readonly<Record<string, Record<string, unknown>>> = {
  /*
    Irmã macia da Hyper-G. O par Tour Bite → Tour Bite Soft, que já está no catálogo, mostra como a
    Solinco desloca uma linha ao amaciá-la: mantém o perfil quadrado e a mordida, e sobe o
    lançamento um degrau. Aplicado à Hyper-G (square, muted, launch medium, bite high).
  */
  'solinco-hyper-g-soft': {
    shape: 'square', feel: 'muted', launch: 'high', bite: 'high',
    price_tier: 'mid', recommended_player_type: ['spin', 'controle', 'conforto'],
  },
  /*
    Versão texturizada da RPM Blast — mesmo molde hexagonal, superfície áspera. O CSV a traz mais
    rígida que a Blast (firm vs medium), e mais rígida significa lançamento mais baixo.
  */
  'babolat-rpm-rough': {
    shape: 'hexagonal', feel: 'muted', launch: 'low', bite: 'high',
    price_tier: 'premium', recommended_player_type: ['spin', 'controle', 'competitivo'],
  },
  /*
    A Lynx "pura" é a versão REDONDA da linha; a Lynx Tour é a pentagonal. Perfil redondo morde
    menos, e é a única diferença que o formato sustenta afirmar. Sem a alegação de manutenção de
    tensão que a Tour carrega.
  */
  'head-lynx': {
    shape: 'round', feel: 'crisp', launch: 'medium', bite: 'low',
    price_tier: 'mid', recommended_player_type: ['controle', 'spin'],
  },
};

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Raquetes
// ─────────────────────────────────────────────────────────────────────────────────────────────

function importRackets(csvPath: string): { total: number; porMarca: Record<string, number> } {
  const linhas = parseCsv(csvPath);
  const erros: string[] = [];

  // Índice do catálogo atual, para herdar a classificação de quem já existia.
  const atual = new Map<string, { family: string; model: string; variant: string }>();
  for (const arquivo of ['babolat.json', 'head.json', 'wilson.json', 'yonex.json']) {
    const parsed = JSON.parse(readFileSync(join(DATA, 'rackets', arquivo), 'utf8'));
    for (const r of parsed.rackets) {
      atual.set(slugify(`${parsed.brand}-${r.model}-${r.generation}`), {
        family: r.family, model: r.model, variant: r.variant,
      });
    }
  }

  const porMarca = new Map<string, unknown[]>();

  for (const l of linhas) {
    const id = l.id!;
    const marca = l.marca!;
    const classe: Classe | undefined = atual.get(id) ?? CLASSIFICACAO[id];

    if (!classe) {
      erros.push(`${id}: raquete nova sem classificação — acrescente em CLASSIFICACAO`);
      continue;
    }

    /*
      A tabela escrita à mão VENCE do que foi herdado.

      `atual` guarda só family/model/variant, então uma geração corrigida aqui se perderia ao
      reimportar sobre um catálogo já reescrito — e o id deixaria de fechar na segunda rodada, com
      a primeira tendo passado. Erro que só aparece quando alguém roda o script duas vezes.
    */
    const geracao = CLASSIFICACAO[id]?.generation ?? l.geracao!;

    // A prova de que a classificação está certa: o id precisa se reconstruir a partir dela.
    const recalculado = slugify(`${marca}-${classe.model}-${geracao}`);
    if (recalculado !== id) {
      erros.push(`${id}: id não confere — a classificação produz "${recalculado}"`);
      continue;
    }

    const [mains, crosses] = l.padrao_cordas!.split('x').map((n) => Number(n));

    if (!porMarca.has(marca)) porMarca.set(marca, []);
    porMarca.get(marca)!.push({
      family: classe.family,
      model: classe.model,
      variant: classe.variant,
      generation: geracao,
      year: num(l.ano!),
      product_name: l.produto,
      status: l.status || 'current',
      specs: {
        head_size_sq_in: num(l.cabeca_sq_in!),
        length_in: num(l.comprimento_in!),
        unstrung_weight_g: num(l.peso_g_sem_corda!),
        balance_mm: num(l.balanco_mm!),
        string_pattern_mains: mains,
        string_pattern_crosses: crosses,
        beam_width_mm: l.viga_mm || null,
        recommended_tension_min_lbs: num(l.tensao_min_lbs!),
        recommended_tension_max_lbs: num(l.tensao_max_lbs!),
        grip_sizes_available: (l.empunhaduras ?? '').split('/').map((g) => Number(g.trim())).filter(Number.isFinite),
      },
      verification: {
        /*
          O estado continua `pending_verification` mesmo vindo de uma planilha conferida. Verificar
          é ato registrado no `/admin/verificacao`, com quem verificou, quando e com qual fonte —
          um CSV editado fora do sistema não carrega essa cadeia, e marcar "verified" a partir dele
          transformaria procedência em declaração de boa vontade.
        */
        state: 'pending_verification',
        verified_at: null,
        verified_by: null,
        source_url: l['URL DA FONTE OFICIAL'] || null,
        brazil_availability_status: l.disponibilidade_brasil || 'unknown',
        notes: l.OBSERVACOES || 'Especificações revisadas na curadoria de ago/2026. Aguardando registro da verificação no painel.',
      },
    });
  }

  if (erros.length > 0) {
    console.error('\n❌ RAQUETES — não foi possível importar:\n');
    erros.forEach((e) => console.error(`   ${e}`));
    process.exit(1);
  }

  const contagem: Record<string, number> = {};
  for (const [marca, rackets] of porMarca) {
    const arquivo = `${marca.toLowerCase()}.json`;
    const antigo = JSON.parse(readFileSync(join(DATA, 'rackets', arquivo), 'utf8'));
    writeFileSync(
      join(DATA, 'rackets', arquivo),
      JSON.stringify({ ...antigo, data_version: NOVA_VERSAO, rackets }, null, 2) + '\n',
      'utf8',
    );
    contagem[marca] = rackets.length;
  }

  return { total: linhas.length, porMarca: contagem };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Cordas
// ─────────────────────────────────────────────────────────────────────────────────────────────

function importStrings(csvPath: string): { modelos: number; variantes: number; inferidas: string[]; retipadas: string[] } {
  const linhas = parseCsv(csvPath);
  const antigo = JSON.parse(readFileSync(join(DATA, 'strings', 'catalog.json'), 'utf8'));
  const atual = new Map<string, Record<string, unknown>>(
    antigo.strings.map((s: Record<string, unknown>) => [slugify(`${s.brand}-${s.model}`), s]),
  );

  const erros: string[] = [];
  const inferidas: string[] = [];
  const retipadas: string[] = [];
  const modelos = new Map<string, Record<string, unknown>>();

  for (const l of linhas) {
    const modeloId = slugify(`${l.marca}-${l.modelo}`);

    if (!modelos.has(modeloId)) {
      const herdado = atual.get(modeloId) ?? atual.get(RENOMEADAS[modeloId] ?? '');
      const inedita = INEDITAS[modeloId];

      if (!herdado && !inedita) {
        erros.push(`${modeloId}: corda nova sem descritores — acrescente em INEDITAS`);
        continue;
      }
      if (!herdado) inferidas.push(`${l.marca} ${l.modelo}`);

      const tipo = TAXONOMIA_TIPO[l.tipo!] ?? l.tipo!;
      if (tipo !== l.tipo) retipadas.push(`${l.marca} ${l.modelo}: ${l.tipo} → ${tipo}`);

      const base = herdado ?? {};
      modelos.set(modeloId, {
        brand: l.marca,
        model: l.modelo,
        string_type: tipo,
        material: l.material,
        // Formato, rigidez, durabilidade e manutenção vêm da PLANILHA: são conferíveis na ficha.
        shape: l.formato || (inedita?.shape ?? base.shape),
        firmness: l.rigidez,
        durability: l.durabilidade,
        tension_maintenance: l.manutencao_tensao,
        // Estes não são conferíveis — herdados ou escritos à mão em INEDITAS.
        feel: inedita?.feel ?? base.feel,
        launch: inedita?.launch ?? base.launch,
        bite: inedita?.bite ?? base.bite,
        price_tier: inedita?.price_tier ?? base.price_tier,
        recommended_player_type: inedita?.recommended_player_type ?? base.recommended_player_type,
        variants: [],
      });
    }

    (modelos.get(modeloId)!.variants as unknown[]).push({
      gauge_mm: num(l.espessura_mm!),
      gauge_us: l.espessura_us || null,
      brazil_availability_status: l.disponibilidade_brasil || 'unknown',
    });
  }

  if (erros.length > 0) {
    console.error('\n❌ CORDAS — não foi possível importar:\n');
    erros.forEach((e) => console.error(`   ${e}`));
    process.exit(1);
  }

  const lista = [...modelos.values()];
  writeFileSync(
    join(DATA, 'strings', 'catalog.json'),
    JSON.stringify({ ...antigo, data_version: NOVA_VERSAO, strings: lista }, null, 2) + '\n',
    'utf8',
  );

  return {
    modelos: lista.length,
    variantes: lista.reduce((n, m) => n + (m.variants as unknown[]).length, 0),
    inferidas,
    retipadas,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────

function main(): void {
  const [raquetes, cordas] = process.argv.slice(2);
  if (!raquetes || !cordas) {
    console.error('uso: npx tsx scripts/import-catalogo.ts <raquetes.csv> <cordas.csv>');
    process.exit(1);
  }

  const r = importRackets(raquetes);
  const c = importStrings(cordas);

  console.log(`\n✅ catálogo reescrito · versão ${NOVA_VERSAO}\n`);
  console.log(`   raquetes: ${r.total}  (${Object.entries(r.porMarca).map(([m, n]) => `${m} ${n}`).join(' · ')})`);
  console.log(`   cordas:   ${c.modelos} modelos · ${c.variantes} variantes`);

  if (c.inferidas.length > 0) {
    console.log(`\n⚠️  ${c.inferidas.length} corda(s) com descritores de caráter INFERIDOS do irmão de linha.`);
    console.log('   Não são medições; merecem conferência humana antes da venda:');
    c.inferidas.forEach((n) => console.log(`     · ${n}`));
  }

  if (c.retipadas.length > 0) {
    console.log(`\n⚠️  ${c.retipadas.length} corda(s) tiveram o TIPO normalizado — muda os scores:`);
    c.retipadas.forEach((n) => console.log(`     · ${n}`));
  }
  console.log();
}

main();
