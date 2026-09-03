import { chromium } from 'playwright';
const OUT = '/tmp/claude-0/-home-user-tennis-engineer/815d893b-edec-5b30-873e-413abeda5574/scratchpad';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 860, height: 1000 } });
for (const id of ['05','07']) {
  await p.goto(`http://127.0.0.1:3100/resultado/sim2-${id}`, { waitUntil: 'networkidle' });
  await p.emulateMedia({ media: 'print' });
  const el = p.locator('article').filter({ hasText: 'MATCH' }).first();
  await el.scrollIntoViewIfNeeded();
  await p.waitForTimeout(250);
  const box = await el.boundingBox();
  await p.screenshot({ path: `${OUT}/pod-${id}.png`,
    clip: { x: 0, y: Math.max(0, box.y - 30), width: 860, height: Math.min(700, 1000 - Math.max(0, box.y - 30)) } });
  console.log(`pod-${id}.png`);
}
await b.close();
