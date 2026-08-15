/**
 * Normaliza os SVGs de marca em `public/marcas/`, recortando o `viewBox` ao conteúdo real.
 *
 * ─── POR QUE ISTO É NECESSÁRIO ───────────────────────────────────────────────────────────────
 *
 * Arquivos oficiais vêm com sobras muito diferentes: o da Luxilon tinha `viewBox` QUADRADO
 * (652×652) para um logotipo horizontal, ou seja, mais de metade da altura era espaço vazio. Como
 * o mural encaixa cada arquivo por `contain`, essa sobra vira redução: a marca aparecia minúscula
 * ao lado de outras que preenchiam a caixa inteira.
 *
 * O resultado prático é o oposto do pedido "mesmo destaque, cor e tamanho" — e a causa não é o
 * mural, é a margem embutida no arquivo.
 *
 * Recortar o `viewBox` NÃO altera o logotipo: as proporções e o desenho continuam idênticos, só
 * some o vazio em volta. É a mesma operação que um "trim" de imagem.
 *
 * A medição é feita pelo navegador (`getBBox()`), porque calcular a caixa real de um `path` com
 * curvas exige um motor de renderização — estimar levaria a cortes errados.
 *
 * Uso:  npx tsx scripts/normalize-brand-logos.ts
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const DIR = join(process.cwd(), 'public', 'marcas');
/** Respiro em volta do conteúdo, em % da maior dimensão. Sem ele, o traço encosta na borda. */
const PADDING_RATIO = 0.02;

async function main(): Promise<void> {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.svg'));
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? undefined,
  });
  const page = await browser.newPage();

  for (const file of files) {
    const path = join(DIR, file);
    const source = readFileSync(path, 'utf8');

    await page.setContent(`<body style="margin:0">${source}</body>`);
    const box = await page.evaluate(() => {
      const svg = document.querySelector('svg');
      if (!svg) return null;
      const b = (svg as unknown as SVGGraphicsElement).getBBox();
      return { x: b.x, y: b.y, width: b.width, height: b.height };
    });

    if (!box || box.width <= 0 || box.height <= 0) {
      console.log(`  ${file}: não foi possível medir — mantido como está`);
      continue;
    }

    const pad = Math.max(box.width, box.height) * PADDING_RATIO;
    const viewBox = [
      (box.x - pad).toFixed(2),
      (box.y - pad).toFixed(2),
      (box.width + pad * 2).toFixed(2),
      (box.height + pad * 2).toFixed(2),
    ].join(' ');

    // `width`/`height` fixos brigam com o `contain` do mural: removidos junto.
    let out = source.replace(/\sviewBox="[^"]*"/, ` viewBox="${viewBox}"`);
    if (!/viewBox=/.test(out)) out = out.replace(/<svg\b/, `<svg viewBox="${viewBox}"`);
    out = out.replace(/<svg([^>]*?)\swidth="[^"]*"/, '<svg$1').replace(/<svg([^>]*?)\sheight="[^"]*"/, '<svg$1');

    writeFileSync(path, out, 'utf8');
    console.log(`  ${file}: viewBox → ${viewBox}  (proporção ${(box.width / box.height).toFixed(2)}:1)`);
  }

  await browser.close();
}

void main();
