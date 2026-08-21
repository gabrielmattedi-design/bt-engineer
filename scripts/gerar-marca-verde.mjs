import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const OUT = '/home/user/tennis-engineer/marca';
const VERDE = '#0E3D2E'; // colors.court — o mesmo verde institucional do herói do site.

/**
 * Monograma completo sobre o verde, em quadrado — a aplicação do print.
 *
 * O `viewBox` nativo é 0 0 120 120 e já embute a margem certa: as marcas de registro vão de 7 a
 * 113, ou seja ~6% de respiro em cada lado. Desenhar a marca em 100% do quadrado reproduz o
 * enquadramento do print sem inventar padding — o brand book proíbe alterar proporções, e qualquer
 * escala diferente de 1 mudaria a relação entre a bola e as marcas de registro.
 */
function svg(lado) {
  const vert = [24, 30, 36, 42, 48, 54]
    .map((x) => `<line x1="${x}" y1="30" x2="${x}" y2="98"/>`)
    .join('');
  const horiz = [38, 44, 50, 56, 62, 68, 74, 80, 86, 92]
    .map((y) => `<line x1="16" y1="${y}" x2="58" y2="${y}"/>`)
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="${lado}" height="${lado}" fill="none" role="img" aria-label="Tennis Engineer">
  <defs>
    <clipPath id="te-ball"><circle cx="60" cy="60" r="41"/></clipPath>
    <clipPath id="te-face"><ellipse cx="41" cy="64" rx="21" ry="29" transform="rotate(-8 41 64)"/></clipPath>
  </defs>
  <rect x="0" y="0" width="120" height="120" fill="${VERDE}"/>
  <g stroke="#FFFFFF" stroke-width="1.2" stroke-dasharray="5 3 1.5 3">
    <line x1="60" y1="7" x2="60" y2="26"/>
    <line x1="60" y1="94" x2="60" y2="113"/>
    <line x1="7" y1="60" x2="26" y2="60"/>
    <line x1="94" y1="60" x2="113" y2="60"/>
  </g>
  <g clip-path="url(#te-face)" stroke="#FFFFFF" stroke-width="0.7" opacity="0.65">
    <g transform="skewX(-6) translate(5 0)">${vert}${horiz}</g>
  </g>
  <g clip-path="url(#te-ball)" fill="none" stroke="#FFFFFF">
    <path d="M 36 25 Q 20 62 44 95" stroke-width="1.1"/>
    <path d="M 87 34 Q 95 60 88 90" stroke-width="1.6"/>
  </g>
  <circle cx="60" cy="60" r="41" stroke="#FFFFFF" stroke-width="2.6"/>
  <path d="M 40 36 H 84 V 44 H 66 V 58.5 H 81.5 V 66.5 H 66 V 83 H 85 V 91 H 54 V 44 H 40 Z" fill="#FFFFFF"/>
</svg>`;
}

writeFileSync(`${OUT}/tennis-engineer-marca-verde.svg`, svg(1080));

const navegador = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
for (const px of [4096, 2048, 1080, 1024]) {
  // Densidade no rasterizador, não resize depois: o leito de cordas tem traço 0.7 no viewBox de
  // 120 e some no antialiasing se o PNG for reduzido já pronto.
  const pagina = await navegador.newPage({
    viewport: { width: 512, height: 512 },
    deviceScaleFactor: px / 512,
  });
  await pagina.setContent(
    `<style>html,body{margin:0}svg{display:block;width:512px;height:512px}</style>${svg(512)}`,
  );
  await pagina.locator('svg').screenshot({ path: `${OUT}/tennis-engineer-marca-verde-${px}.png` });
  await pagina.close();
}
await navegador.close();
console.log('ok');
