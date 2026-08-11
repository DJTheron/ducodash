/*
  Render the built dashboard and capture it.

  Chromium is preinstalled in this environment, so nothing is downloaded. Runs
  against the demo fixtures, which means it works with no network and produces a
  stable image to review the design against.

  Usage: npm run build && npm run shots
*/
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { globSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;
const OUT = new URL('../shots/', import.meta.url).pathname;
const DOCS = new URL('../docs/', import.meta.url).pathname;
const BASE = '/ducodash/';
const PORT = 4317;

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};

const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent((req.url ?? '/').split('?')[0]);
    if (path.startsWith(BASE)) path = path.slice(BASE.length - 1);
    if (path === '/' || path === '') path = '/index.html';
    // Normalise away any traversal before touching the filesystem.
    const file = join(DIST, normalize(path).replace(/^(\.\.[/\\])+/, ''));
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});

await new Promise((resolve) => server.listen(PORT, resolve));
await mkdir(OUT, { recursive: true });
await mkdir(DOCS, { recursive: true });

// The preinstalled build is versioned, and may not match what this playwright
// release would download; point at it explicitly rather than fetching a second copy.
const [preinstalled] = globSync('/opt/pw-browsers/chromium-*/chrome-linux/chrome');
const browser = await chromium.launch(preinstalled ? { executablePath: preinstalled } : {});

const shots = [
  // Full pages at 1x: at 2x the whole document is tens of megapixels and the
  // capture times out before it finishes encoding.
  { name: 'desktop', width: 1440, height: 1000, full: true, scale: 1 },
  { name: 'mobile', width: 414, height: 900, full: true, scale: 1 },
  // Viewport-only crops at 2x, for judging type and the fine detail in the marks.
  { name: 'hero', width: 1440, height: 940, full: false, scale: 2 },
  { name: 'rigs', width: 1440, height: 900, full: false, scale: 2, scrollTo: 'Rigs' },
  { name: 'stats', width: 1440, height: 900, full: false, scale: 2, scrollTo: 'Where it came from' },
  { name: 'charts', width: 1440, height: 700, full: false, scale: 2, scrollTo: 'Over time' },
  { name: 'mobile-hero', width: 414, height: 820, full: false, scale: 2 },
  // Committed for the README, so kept at 1x to stay a sensible size in git.
  { name: 'preview', width: 1280, height: 760, full: false, scale: 1, dir: DOCS },
];

for (const shot of shots) {
  /*
    reducedMotion stops the hashrate waves' requestAnimationFrame loop and the
    bloom's SMIL animation. Without it a full-page capture never sees a stable
    frame and times out — and the images wouldn't be reproducible anyway.
  */
  const page = await browser.newPage({
    viewport: { width: shot.width, height: shot.height },
    deviceScaleFactor: shot.scale,
    reducedMotion: 'reduce',
  });
  await page.goto(`http://localhost:${PORT}${BASE}?u=demo`, { waitUntil: 'networkidle' });
  // Let webfonts settle and the odometer finish its opening roll.
  await page.waitForTimeout(2500);

  if (shot.scrollTo) {
    // Pin the section to the top of the viewport. scrollIntoViewIfNeeded leaves it
    // wherever it already is when it happens to be on screen, which isn't a crop.
    // .first(): "Where it came from" is both a section heading and a bar caption.
    await page
      .getByRole('heading', { name: shot.scrollTo, exact: true })
      .first()
      .evaluate((el) => {
        const top = el.getBoundingClientRect().top + window.scrollY - 72;
        window.scrollTo({ top, behavior: 'instant' });
      });
    await page.waitForTimeout(400);
  }
  const dir = shot.dir ?? OUT;
  await page.screenshot({
    path: join(dir, `${shot.name}.png`),
    fullPage: shot.full,
    animations: 'disabled',
    timeout: 60_000,
  });
  console.log(`${dir === DOCS ? 'docs' : 'shots'}/${shot.name}.png`);
  await page.close();
}

await browser.close();
server.close();
