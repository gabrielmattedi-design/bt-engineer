/**
 * Exporta o catálogo para conferência externa.
 *
 * ═══ PARA QUE SERVE ══════════════════════════════════════════════════════════════════════════
 *
 * As 46 raquetes e as 56 variantes de corda estão em `pending_verification`, e isso bloqueia a
 * venda (§69: não se cobra por recomendação construída sobre dado não conferido). Conferir dentro
 * do `/admin/verificacao` é o caminho certo para gravar o resultado — mas é um item por vez, e a
 * parte mais lenta (achar a ficha oficial e comparar sete números) não precisa acontecer ali.
 *
 * Este script tira o catálogo para fora em CSV: uma linha por item, as especificações de um lado e
 * colunas VAZIAS do outro para quem confere preencher. O arquivo abre em qualquer planilha e cabe
 * inteiro no contexto de um assistente.
 *
 *   npm run export:verificacao
 *
 * ─── O QUE ELE DELIBERADAMENTE NÃO FAZ ───────────────────────────────────────────────────────
 *
 * Não importa nada de volta. A conferência entra no sistema pelo `/admin/verificacao`, que grava
 * quem verificou, quando e com qual fonte — a procedência é o produto aqui, e um CSV editado à mão
 * não carrega essa cadeia. O arquivo é insumo de trabalho, não fonte de verdade.
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { DATASET_VERSION } from '../src/data/load';

const OUT = join(process.cwd(), 'conferencia');
const DATA = join(process.cwd(), 'src', 'data');

/**
 * ─── POR QUE LER O JSON DE ORIGEM, E NÃO O CATÁLOGO CARREGADO ────────────────────────────────
 *
 * `loadStringCatalog()` não devolve `firmness`, `durability` nem `tension_maintenance`: esses
 * descritores são consumidos na derivação dos scores e não sobrevivem como campo. Exportar dali
 * produziria colunas vazias justamente para o que precisa ser conferido.
 *
 * E o motivo é mais fundo que a conveniência: o que se confere é o DADO DE ORIGEM, não o modelo
 * derivado dele. Se um descritor estiver errado no JSON, todo score calculado a partir dele está
 * errado — e conferir o score não encontraria a causa.
 */
function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

/** Mesma regra de `load.ts`, para que o id do CSV case com o do `/admin/verificacao`. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Escapa um campo de CSV.
 *
 * Aspas duplicadas e envolvidas sempre que houver vírgula, aspa ou quebra de linha. As notas de
 * verificação têm vírgula com frequência, e um único campo mal escapado desloca todas as colunas
 * seguintes daquela linha — o tipo de erro que passa despercebido até alguém conferir a raquete
 * errada.
 */
function csv(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(headers: readonly string[], rows: readonly (readonly unknown[])[]): string {
  // BOM na frente: sem ele o Excel em português abre UTF-8 como Latin-1 e "Balanço" vira "BalanÃ§o".
  return '﻿' + [headers, ...rows].map((r) => r.map(csv).join(',')).join('\n') + '\n';
}

/** Colunas em branco, iguais nos dois arquivos, para quem confere preencher. */
const CAMPOS_CONFERENCIA = [
  'CONFERE? (S/N)',
  'O QUE ESTA ERRADO',
  'VALOR CORRETO',
  'URL DA FONTE OFICIAL',
  'AINDA E LINHA ATUAL? (S/N)',
  'OBSERVACOES',
] as const;

const VAZIOS = CAMPOS_CONFERENCIA.map(() => '');

type Raqueta = {
  model: string;
  generation: string;
  product_name: string;
  year: number;
  status: string;
  specs: Record<string, unknown>;
  verification?: Record<string, unknown>;
};

function exportRackets(): number {
  const dir = join(DATA, 'rackets');
  const rows: unknown[][] = [];

  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    const parsed = readJson(join(dir, file));
    const brand = String(parsed.brand);

    for (const r of parsed.rackets as Raqueta[]) {
      const s = r.specs;
      const v = r.verification ?? {};
      rows.push([
        slugify(`${brand}-${r.model}-${r.generation}`),
        brand,
        r.product_name,
        r.generation,
        r.year,
        r.status,
        s.head_size_sq_in,
        s.length_in,
        s.unstrung_weight_g,
        s.balance_mm,
        `${s.string_pattern_mains}x${s.string_pattern_crosses}`,
        s.beam_width_mm,
        s.recommended_tension_min_lbs,
        s.recommended_tension_max_lbs,
        (s.grip_sizes_available as number[] | undefined)?.join(' / '),
        v.state,
        v.brazil_availability_status,
        ...VAZIOS,
      ]);
    }
  }

  const headers = [
    'id',
    'marca',
    'produto',
    'geracao',
    'ano',
    'status',
    'cabeca_sq_in',
    'comprimento_in',
    'peso_g_sem_corda',
    'balanco_mm',
    'padrao_cordas',
    'viga_mm',
    'tensao_min_lbs',
    'tensao_max_lbs',
    'empunhaduras',
    'estado_atual',
    'disponibilidade_brasil',
    ...CAMPOS_CONFERENCIA,
  ];

  writeFileSync(join(OUT, 'raquetes.csv'), toCsv(headers, rows), 'utf8');
  return rows.length;
}

type Corda = {
  brand: string;
  model: string;
  string_type: string;
  material: string;
  shape: string | null;
  firmness: string;
  durability: string;
  tension_maintenance: string;
  variants: { gauge_mm: number; gauge_us?: string; brazil_availability_status?: string }[];
};

function exportStrings(): number {
  const parsed = readJson(join(DATA, 'strings', 'catalog.json'));
  const rows: unknown[][] = [];

  for (const m of parsed.strings as Corda[]) {
    const id = slugify(`${m.brand}-${m.model}`);

    for (const v of m.variants) {
      rows.push([
        `${id}-${v.gauge_mm.toFixed(2).replace('.', '')}`,
        m.brand,
        m.model,
        v.gauge_mm.toFixed(2),
        v.gauge_us,
        m.string_type,
        m.material,
        m.shape,
        m.firmness,
        m.durability,
        m.tension_maintenance,
        v.brazil_availability_status,
        ...VAZIOS,
      ]);
    }
  }

  const headers = [
    'id',
    'marca',
    'modelo',
    'espessura_mm',
    'espessura_us',
    'tipo',
    'material',
    'formato',
    'rigidez',
    'durabilidade',
    'manutencao_tensao',
    'disponibilidade_brasil',
    ...CAMPOS_CONFERENCIA,
  ];

  writeFileSync(join(OUT, 'cordas.csv'), toCsv(headers, rows), 'utf8');
  return rows.length;
}

function writeInstructions(rackets: number, strings: number): void {
  const hoje = new Date().toISOString().slice(0, 10);

  const text = `# Conferência do catálogo — Tennis Engineer

Gerado em ${hoje} · catálogo \`${DATASET_VERSION}\` · ${rackets} raquetes · ${strings} variantes de corda

---

## Para quem for conferir (pessoa ou assistente)

Cada linha dos arquivos \`raquetes.csv\` e \`cordas.csv\` é um produto. As primeiras colunas trazem o
que temos hoje; as últimas seis estão em branco para você preencher.

### O que fazer

1. Encontre a **ficha oficial do fabricante** do produto — HEAD, Wilson, Babolat ou Yonex
2. Compare cada especificação com a linha
3. Preencha as colunas de conferência

### Colunas a preencher

| Coluna | Como preencher |
|---|---|
| \`CONFERE? (S/N)\` | \`S\` se **todas** as especificações batem; \`N\` se qualquer uma diverge |
| \`O QUE ESTA ERRADO\` | Nome da coluna divergente (ex.: \`balanco_mm\`). Várias, separe por \`;\` |
| \`VALOR CORRETO\` | O valor da ficha oficial, na mesma ordem |
| \`URL DA FONTE OFICIAL\` | Link direto da página do fabricante. **Obrigatório**, inclusive quando confere |
| \`AINDA E LINHA ATUAL? (S/N)\` | \`N\` se o fabricante já lançou geração mais nova |
| \`OBSERVACOES\` | Qualquer coisa relevante |

### Regras que não podem ser quebradas

**Não invente número.** Se não achou a especificação na fonte oficial, escreva \`NAO ENCONTRADO\` em
\`OBSERVACOES\` e deixe \`VALOR CORRETO\` vazio. Um campo vazio faz o sistema baixar a confiança do
relatório, que é o comportamento correto. Um número plausível e errado atravessa o sistema inteiro
sem ser notado e chega ao cliente como fato.

**Só fonte oficial do fabricante.** Não vale loja, blog, marketplace ou fórum — varejistas copiam
especificação errada com frequência, e um erro copiado por cinco lojas continua sendo um erro.

**Peso é SEM corda** (\`unstrung\`). Muitas lojas publicam o peso encordoado, que é ~15–17 g maior.
Se a fonte não disser qual é, registre em \`OBSERVACOES\`.

**Não preencha disponibilidade no Brasil, foto nem preço.** Essa parte é conferida por quem
administra o catálogo, direto no painel.

---

## O que NÃO está nestes arquivos, e por quê

Swingweight, rigidez RA e twistweight **não fazem parte do modelo** e por isso não aparecem aqui.
São medições de laboratório que nenhum fabricante publica; incluí-las exigiria copiar números de
terceiros sem procedência. O motor usa apenas o que o fabricante publica e qualquer varejista
especializado reproduz.

---

## Depois de preenchido

O CSV é insumo de trabalho, **não entra de volta no sistema por importação**. O resultado é lançado
em \`/admin/verificacao\`, que grava quem verificou, quando e com qual fonte. Essa cadeia de
procedência é parte do produto — é o que sustenta a promessa de que nenhuma recomendação vendida
foi construída sobre dado não conferido.
`;

  writeFileSync(join(OUT, 'INSTRUCOES.md'), text, 'utf8');
}

function main(): void {
  mkdirSync(OUT, { recursive: true });
  const rackets = exportRackets();
  const strings = exportStrings();
  writeInstructions(rackets, strings);

  console.log(`\nconferencia/raquetes.csv    ${rackets} raquetes`);
  console.log(`conferencia/cordas.csv      ${strings} variantes`);
  console.log(`conferencia/INSTRUCOES.md   instruções para quem confere\n`);
}

main();
