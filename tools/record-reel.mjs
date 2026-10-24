// Render the page frame by frame at 1920x1080 for the Fastwork show reel.
// usage: node tools/record-reel.mjs <puppeteer-core path> <frames_dir>
// The page (?reel) exposes __reelStops() (scroll positions + hold seconds) and
// __reelTick(ms) (steps gsap to an exact time), so every frame is deterministic.
const [,, pptr, out] = process.argv;
const { default: puppeteer } = await import(pptr);
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const FPS = 30, W = 1920, H = 1080, SCREENS_PER_SEC = 0.55, MIN_MOVE = 1.1;
fs.mkdirSync(out, { recursive: true });
const page_url = url.pathToFileURL(path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../index.html')).href + '?reel';

const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', timeout: 120000,
  args: ['--hide-scrollbars'] });
const pg = await b.newPage();
await pg.setViewport({ width: W, height: H });
await pg.goto(page_url, { waitUntil: 'networkidle0' });
await pg.evaluate(() => document.fonts.ready);
await pg.evaluate(() => window.__reelTick(0));
const stops = await pg.evaluate(() => window.__reelStops());

// timeline: hold at each stop, then glide to the next with smoothstep easing
const segs = [];
let t = 0;
stops.forEach((s, i) => {
  segs.push({ t0: t, t1: t + s.hold, y0: s.y, y1: s.y }); t += s.hold;
  const n = stops[i + 1];
  if (n) { const d = Math.max(MIN_MOVE, Math.abs(n.y - s.y) / H / SCREENS_PER_SEC); segs.push({ t0: t, t1: t + d, y0: s.y, y1: n.y }); t += d; }
});
const scrollAt = s => {
  const g = segs.find(g => s < g.t1) || segs[segs.length - 1];
  const k = Math.min(1, Math.max(0, (s - g.t0) / (g.t1 - g.t0 || 1))), e = k * k * (3 - 2 * k);
  return Math.round(g.y0 + (g.y1 - g.y0) * e);
};
const frames = Math.round(t * FPS);
console.log(`frames ${frames} (${t.toFixed(1)}s)`);
for (let i = 0; i < frames; i++) {
  const ms = i / FPS * 1000;
  await pg.evaluate((y, ms) => {
    scrollTo(0, y);
    window.__reelTick(ms);
    // CSS animations/transitions run on the same clock, measured from when each first appeared
    const born = window.__born || (window.__born = new WeakMap());
    for (const a of document.getAnimations()) {
      if (!born.has(a)) born.set(a, ms);
      a.pause(); a.currentTime = ms - born.get(a);
    }
  }, scrollAt(i / FPS), ms);
  // frames already on disk are stepped through but not re-shot, so a cut-off run can resume
  const file = `${out}/${String(i).padStart(5, '0')}.jpg`;
  if (!fs.existsSync(file)) await pg.screenshot({ path: file, type: 'jpeg', quality: 88 });
  if (i % 150 === 0) console.log(`frame ${i}/${frames}`);
}
await b.close();
console.log('done');
