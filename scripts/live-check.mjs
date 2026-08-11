/*
  End-to-end check against the live API in a real browser.

  Loads the built site for a real Duino-Coin account and reports what actually
  rendered — balance, rig count, and crucially whether the exchange panel reached
  "Realisable" (depth modelled on-chain) rather than degrading to a quote. That last
  point is the one thing unit tests can't cover: it proves DexScreener, the BNB Chain
  RPC and TronGrid all allow browser CORS from a static origin.

  Usage:
    npm run build && node scripts/live-check.mjs [username]        # local dist
    node scripts/live-check.mjs [username] https://…/ducodash/     # deployed site
*/
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { globSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const USER = process.argv[2] ?? 'MMorcego';
/** Optional deployed URL. Without it the local `dist/` is served instead. */
const REMOTE = process.argv[3]?.startsWith('http') ? process.argv[3].replace(/\/$/, '') : null;
const DIST = new URL('../dist/', import.meta.url).pathname;
const OUT = new URL('../shots/', import.meta.url).pathname;
const BASE = '/ducodash/';
const PORT = 4318;

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent((req.url ?? '/').split('?')[0]);
    if (path.startsWith(BASE)) path = path.slice(BASE.length - 1);
    if (path === '/' || path === '') path = '/index.html';
    const file = join(DIST, normalize(path).replace(/^(\.\.[/\\])+/, ''));
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
if (!REMOTE) await new Promise((resolve) => server.listen(PORT, resolve));
await mkdir(OUT, { recursive: true });

const [exe] = globSync('/opt/pw-browsers/chromium-*/chrome-linux/chrome');
// Outbound traffic in this sandbox goes through an inspecting proxy, so the browser
// needs both the proxy and its CA. Harmless when neither is set.
const proxy = process.env.HTTPS_PROXY ?? process.env.https_proxy;
const browser = await chromium.launch({
  ...(exe ? { executablePath: exe } : {}),
  // bypass: the local static server is plain HTTP, and the relay only tunnels HTTPS.
  ...(proxy ? { proxy: { server: proxy, bypass: 'localhost,127.0.0.1' } } : {}),
  // Only relevant behind an inspecting proxy, whose CA the browser doesn't carry.
  args: proxy ? ['--ignore-certificate-errors'] : [],
});

const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  ignoreHTTPSErrors: true,
  reducedMotion: 'reduce',
});

const failures = [];
page.on('requestfailed', (r) => failures.push(`${r.url().slice(0, 90)} — ${r.failure()?.errorText}`));
page.on('pageerror', (e) => failures.push(`pageerror: ${String(e).slice(0, 200)}`));

const target = REMOTE ?? `http://localhost:${PORT}${BASE}`;
console.log(`loading ${target}`);
await page.goto(`${target}/?u=${encodeURIComponent(USER)}`.replace(/([^:])\/\//g, '$1/'), {
  waitUntil: 'load',
});

// Depth modelling fans out to three third-party hosts; give it room.
await page.waitForTimeout(15_000);

const text = await page.innerText('body');
const grab = (re) => text.match(re)?.[0] ?? '(not found)';

console.log(`\nuser              ${USER}`);
console.log(`balance heading   ${(await page.innerText('h1').catch(() => '—')).replace(/\s+/g, ' ').trim().slice(0, 60)}`);
console.log(`rigs              ${grab(/\d+ rigs · [^\n]*/)}`);
console.log(`provenance        ${grab(/REALISABLE|QUOTED ONLY|Realisable|Quoted only/i)}`);
console.log(`best route        ${grab(/(SunSwap|PancakeSwap|Bitstorage|UbeSwap|Nano)[^\n]*/)}`);
console.log(`headline compare  ${grab(/The headline price says[^\n]*/)}`);
console.log(`venues            ${grab(/Compare all \d+ venues/)}`);

const warnings = text.match(/depth unavailable[^\n]*/g) ?? [];
if (warnings.length) console.log(`warnings          ${warnings.join(' | ')}`);
if (failures.length) console.log(`\nrequest failures:\n  ${failures.slice(0, 8).join('\n  ')}`);

await page.screenshot({ path: join(OUT, 'live.png'), animations: 'disabled', timeout: 60_000 });
console.log(`\nshots/live.png`);

await browser.close();
if (!REMOTE) server.close();
