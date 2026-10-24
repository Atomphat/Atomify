// Render the short looping reel: a fast scroll top to bottom, then a rewind to the top,
// so the last frame meets the first and the clip plays as a seamless loop.
// usage: node tools/record-loop.mjs <puppeteer-core entry .js> <frames_dir> [seconds=15]
// Writes numbered JPEGs plus meta.json (scroll speed per frame, for motion blur in loop-reel.swift).
const [,, pptr, out, secs = '15'] = process.argv;
const { default: puppeteer } = await import(pptr);
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const FPS = 30, W = 1600, H = 900, TOTAL = +secs;
// hold at each stop (seconds); the first and last holds sit at the top so the loop meets itself
const HOLDS = [.5, .35, .55, .15, .45, .6, .45, .7];
const REWIND = 1.5, END_HOLD = .5;
fs.mkdirSync(out, { recursive: true });
const page_url = url.pathToFileURL(path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../index.html')).href + '?reel&loop';

const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', timeout: 120000,
  args: ['--hide-scrollbars'] });
const pg = await b.newPage();
await pg.setViewport({ width: W, height: H });
await pg.goto(page_url, { waitUntil: 'networkidle0' });
await pg.evaluate(() => document.fonts.ready);
await pg.evaluate(() => window.__reelTick(0));
const stops = (await pg.evaluate(() => window.__reelStops())).map((s, i) => ({ y: s.y, hold: HOLDS[i] ?? .4 }));

// the down pass gets whatever time is left after holds and the rewind, split by distance
const holdSum = stops.reduce((a, s) => a + s.hold, 0) + REWIND + END_HOLD;
const dists = stops.slice(1).map((s, i) => Math.abs(s.y - stops[i].y));
const distSum = dists.reduce((a, d) => a + d, 0);
const moveTime = TOTAL - holdSum;
const segs = [];
let t = 0;
stops.forEach((s, i) => {
  segs.push({ t0: t, t1: t + s.hold, y0: s.y, y1: s.y }); t += s.hold;
  if (i < dists.length) {
    // sqrt keeps short hops from flashing by while long ones still feel fast
    const w = Math.sqrt(dists[i]) / dists.reduce((a, d) => a + Math.sqrt(d), 0);
    const d = moveTime * w;
    segs.push({ t0: t, t1: t + d, y0: s.y, y1: stops[i + 1].y }); t += d;
  }
});
const bottom = stops[stops.length - 1].y;
segs.push({ t0: t, t1: t + REWIND, y0: bottom, y1: 0, rewind: true }); t += REWIND;
segs.push({ t0: t, t1: t + END_HOLD, y0: 0, y1: 0 }); t += END_HOLD;

const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
const scrollAt = s => {
  const g = segs.find(g => s < g.t1) || segs[segs.length - 1];
  const k = Math.min(1, Math.max(0, (s - g.t0) / (g.t1 - g.t0 || 1)));
  return Math.round(g.y0 + (g.y1 - g.y0) * ease(k));
};
const frames = Math.round(t * FPS);
console.log(`frames ${frames} (${t.toFixed(1)}s), page travel ${distSum}px`);
// CSS loops (bobbing stickers, marquees) run on a clock that turns around halfway,
// so they are back where they started on the final frame
const half = frames / FPS * 500;
const speeds = [];
for (let i = 0; i < frames; i++) {
  const ms = i / FPS * 1000, css = ms < half ? ms : 2 * half - ms;
  const y = scrollAt(i / FPS);
  speeds.push(scrollAt((i + 1) / FPS) - y);
  await pg.evaluate((y, ms, css) => {
    scrollTo(0, y);
    window.__reelTick(ms);
    const born = window.__born || (window.__born = new WeakMap());
    for (const a of document.getAnimations()) {
      if (a instanceof CSSAnimation) { a.pause(); a.currentTime = css; continue; }
      if (!born.has(a)) born.set(a, ms);
      a.pause(); a.currentTime = ms - born.get(a);
    }
  }, y, ms, css);
  const file = `${out}/${String(i).padStart(5, '0')}.jpg`;
  if (!fs.existsSync(file)) await pg.screenshot({ path: file, type: 'jpeg', quality: 90 });
  if (i % 90 === 0) console.log(`frame ${i}/${frames}`);
}
fs.writeFileSync(`${out}/meta.json`, JSON.stringify({ fps: FPS, speeds }));
await b.close();
console.log('done');
