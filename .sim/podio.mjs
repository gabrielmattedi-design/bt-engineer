import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } });
let falhas = 0;
for (const id of ['01','02','03','04','05','06','07','08','09','10']) {
  await page.goto(`http://127.0.0.1:3100/resultado/sim2-${id}`, { waitUntil: 'networkidle' });
  // Mede em modo IMPRESSÃO, que é onde o corte apareceu.
  await page.emulateMedia({ media: 'print' });
  const c = await page.evaluate(() => {
    const arts = [...document.querySelectorAll('article')].filter((a) => /MATCH/i.test(a.textContent ?? ''));
    return arts.slice(0, 3).map((a) => {
      const r = a.getBoundingClientRect();
      return {
        top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height),
        // corte = conteúdo maior que a caixa
        corta: a.scrollHeight - a.clientHeight > 1,
      };
    });
  });
  if (c.length < 3) { console.log(`${id}: só ${c.length} card(s)`); continue; }
  const bases = c.map((x) => x.bottom);
  const basesOK = Math.max(...bases) - Math.min(...bases) <= 1;
  const degrauOK = c[0].top < c[1].top && c[1].top < c[2].top;
  const semCorte = !c.some((x) => x.corta);
  if (!basesOK || !degrauOK || !semCorte) falhas++;
  console.log(`${id}: alturas ${c.map((x)=>x.h).join('/')} · topos ${c.map((x)=>x.top).join('/')} · ${basesOK?'BASES ok':'BASES ✗'} · ${degrauOK?'DEGRAU ok':'DEGRAU ✗'} · ${semCorte?'SEM CORTE':'CORTA ✗'}`);
}
console.log(falhas === 0 ? '\n✓ os 10 passam' : `\n✗ ${falhas} com problema`);
await browser.close();
