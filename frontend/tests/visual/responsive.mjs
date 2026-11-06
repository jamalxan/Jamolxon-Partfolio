// Responsive audit of the built site across phones and tablets (portrait + landscape).
// Checks: horizontal overflow, elements past the right edge, tap targets < 44px, text < 12px,
// overlapping fixed nav. Usage: node tests/visual/responsive.mjs [.site] [--shots DIR]
// Exits 1 when a page overflows horizontally or a primary control is unreachable.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const dir = path.resolve(here, '../..', args.find(a => !a.startsWith('--')) || '.site');
const shotsIdx = args.indexOf('--shots');
const shots = shotsIdx >= 0 ? path.resolve(args[shotsIdx + 1]) : null;
if (shots) fs.mkdirSync(shots, { recursive: true });

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const srv = await new Promise(res => {
  const s = http.createServer((req, rsp) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
    let f = path.join(dir, p), code = 200;
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { f = path.join(dir, '404.html'); code = 404; }
    rsp.writeHead(code, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(rsp);
  }).listen(0, '127.0.0.1', () => res(s));
});
const BASE = `http://127.0.0.1:${srv.address().port}`;

const DEVICES = [
  ['phone-320', 320, 568, true], ['phone-360', 360, 740, true], ['phone-375', 375, 667, true],
  ['phone-390', 390, 844, true], ['phone-430', 430, 932, true],
  ['phone-land-568', 568, 320, true], ['phone-land-844', 844, 390, true], ['phone-land-932', 932, 430, true],
  ['tab-600', 600, 960, true], ['tab-768', 768, 1024, true], ['tab-820', 820, 1180, true],
  ['tab-land-1024', 1024, 768, true], ['tab-1024x1366', 1024, 1366, true], ['tab-land-1180', 1180, 820, true],
  ['tab-land-1366', 1366, 1024, true],
];
const PAGES = ['/', '/loyihalar/', '/loyihalar/socialauto/', '/xizmatlar/crm-erp/', '/blog/', '/blog/ai-avval-backend/', '/taklif/', '/404.html'];

const launchArgs = { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] };
const browser = await chromium.launch(launchArgs).catch(() => chromium.launch({ ...launchArgs, channel: 'chrome' }));
const issues = [];
let hard = 0;
for (const [name, w, h, touch] of DEVICES) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: touch && w < 1024, hasTouch: touch, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  for (const url of PAGES) {
    await page.goto(BASE + url, { waitUntil: 'networkidle' });
    await page.evaluate(async () => { await Promise.all([...document.fonts].map(f => f.load().catch(() => {}))); await document.fonts.ready; });
    await page.waitForTimeout(2000);
    const r = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const out = { scrollW: document.documentElement.scrollWidth, vw, wide: [], cut: [], taps: [], tiny: [], navOverlap: false };
      const vis = el => { const s = getComputedStyle(el); const b = el.getBoundingClientRect(); return s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05 && b.width > 0 && b.height > 0; };
      const sel = el => el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.classList.length ? '.' + [...el.classList].slice(0, 2).join('.') : '');
      for (const el of document.body.querySelectorAll('*')) {
        if (!vis(el)) continue;
        const b = el.getBoundingClientRect();
        // ignore elements inside a horizontally scrollable / clipped container
        let p = el.parentElement, clipped = false;
        while (p && p !== document.body) { const o = getComputedStyle(p).overflowX; if (o !== 'visible') { clipped = true; break; } p = p.parentElement; }
        if (!clipped && b.right > vw + 1 && getComputedStyle(el).position !== 'fixed') out.wide.push(`${sel(el)} right=${Math.round(b.right)}`);
        // content cut off by an overflow:hidden ancestor (text or controls only, not decorative layers)
        if (clipped && b.right > vw + 1 && (el.matches('a,button,input,h1,h2,h3,p,li,span,b,small,em,label') && el.textContent.trim()) && getComputedStyle(el).position !== 'absolute') {
          const cb = p.getBoundingClientRect();
          if (cb.right > vw - 1 && !['auto', 'scroll'].includes(getComputedStyle(p).overflowX) && !p.closest('.mq,.mqwrap,.marquee')) out.cut.push(`${sel(el)} right=${Math.round(b.right)} in ${sel(p)}`);
        }
      }
      for (const el of document.querySelectorAll('a[href],button,input,select,textarea,summary,[role=button]')) {
        if (!vis(el)) continue;
        const b = el.getBoundingClientRect();
        const inline = getComputedStyle(el).display === 'inline' && el.closest('p,li');
        if (!inline && (b.width < 44 || b.height < 44) && !(b.width >= 24 && b.height >= 24 && el.closest('p'))) out.taps.push(`${sel(el)} ${Math.round(b.width)}x${Math.round(b.height)} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24)}"`);
      }
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const seen = new Set();
      while (walker.nextNode()) {
        const t = walker.currentNode; const el = t.parentElement;
        if (!t.textContent.trim() || !el || seen.has(el) || !vis(el)) continue; seen.add(el);
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs < 12) out.tiny.push(`${sel(el)} ${fs}px "${t.textContent.trim().slice(0, 20)}"`);
      }
      const nav = document.querySelector('.nav');
      if (nav) { const nb = nav.getBoundingClientRect(); const h1 = document.querySelector('h1'); if (h1) { const hb = h1.getBoundingClientRect(); out.navOverlap = hb.top < nb.bottom - 2 && hb.bottom > nb.top && getComputedStyle(nav).position === 'fixed'; } }
      return out;
    });
    const overflow = r.scrollW > r.vw + 1;
    if (overflow || r.cut.length) hard++;
    const uniq = a => [...new Set(a)];
    issues.push({ device: name, url, overflow: overflow ? `${r.scrollW}>${r.vw}` : '', wide: uniq(r.wide).slice(0, 6), cut: uniq(r.cut).slice(0, 8), taps: uniq(r.taps).slice(0, 12), tiny: uniq(r.tiny).slice(0, 8), navOverlap: r.navOverlap });
    if (shots && ['phone-320', 'phone-375', 'phone-land-844', 'tab-768', 'tab-land-1024'].includes(name)) {
      const file = path.join(shots, `${name}${url.replace(/[/.]+/g, '_') || '_home'}.png`);
      await page.screenshot({ path: file, fullPage: true }).catch(() => page.screenshot({ path: file }).catch(() => {}));
    }
  }
  await ctx.close();
}
await browser.close(); srv.close();

for (const i of issues) {
  const bad = i.overflow || i.cut.length || i.wide.length || i.taps.length || i.tiny.length || i.navOverlap;
  if (!bad) continue;
  console.log(`\n## ${i.device} ${i.url}${i.overflow ? '  OVERFLOW ' + i.overflow : ''}${i.navOverlap ? '  NAV-OVERLAPS-H1' : ''}`);
  if (i.cut.length) console.log('  CUT OFF:', i.cut.join(' | '));
  if (i.wide.length) console.log('  past right edge:', i.wide.join(' | '));
  if (i.taps.length) console.log('  small taps:', i.taps.join(' | '));
  if (i.tiny.length) console.log('  tiny text:', i.tiny.join(' | '));
}
console.log(`\n${issues.length} page/device combos, ${hard} with horizontal overflow`);
process.exit(hard ? 1 : 0);
