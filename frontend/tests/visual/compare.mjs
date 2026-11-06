// Visual parity: old hash-routed site (git rev, default bbe7a3e) vs new pre-rendered build.
// Playwright full-page screenshots at 1440 / 768 / 390 px + pixelmatch diff.
//
//   npm run build && npm run render:dist      # new site -> frontend/.site
//   node tests/visual/compare.mjs [--rev bbe7a3e] [--new .site] [--old-url https://jamolxon.uz]
//
// Output: tests/visual/out/<page>-<width>-{old,new,diff}.png and report.json
// Non-deterministic layers are frozen in BOTH sites before shooting: CSS animations,
// the custom cursor, the typed footer line, footer letter waves and the WebGL badge
// canvas (physics + random breeze). Hero badge is shot separately (hero-*.png).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const here = path.dirname(fileURLToPath(import.meta.url));
const front = path.resolve(here, '../..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const rev = arg('--rev', 'bbe7a3e');
const newDir = path.resolve(front, arg('--new', '.site'));
const oldUrl = arg('--old-url', null);
const out = path.join(here, 'out');
fs.mkdirSync(out, { recursive: true });

// ---- old site from git
let oldDir = null;
if (!oldUrl) {
  oldDir = path.join(out, 'old-site');
  fs.rmSync(oldDir, { recursive: true, force: true });
  fs.mkdirSync(oldDir, { recursive: true });
  const repo = path.resolve(front, '..');
  const files = execFileSync('git', ['ls-tree', '-r', '--name-only', rev, 'frontend'], { cwd: repo, encoding: 'utf8' }).split('\n').filter(Boolean);
  for (const f of files) {
    const dst = path.join(oldDir, f);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.writeFileSync(dst, execFileSync('git', ['show', `${rev}:${f}`], { cwd: repo, maxBuffer: 1 << 28 }));
  }
  oldDir = path.join(oldDir, 'frontend');
}

// ---- tiny static server (clean URLs: /x/ -> /x/index.html, 404 -> /404.html)
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain' };
function serve(dir) {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      let f = path.join(dir, p), code = 200;
      if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { f = path.join(dir, '404.html'); code = 404; }
      if (!fs.existsSync(f)) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(code, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(rsp);
    }).listen(0, '127.0.0.1', () => res(srv));
  });
}

const PAGES = [
  ['home', '/', '/'],
  ['project', '/#loyiha-socialauto', '/loyihalar/socialauto/'],
  ['service', '/#xizmat-crm-erp', '/xizmatlar/crm-erp/'],
  ['blog', '/#blog', '/blog/'],
  ['post', '/#blog-ai-avval-backend', '/blog/ai-avval-backend/'],
];
const WIDTHS = [[1440, 900], [768, 1024], [390, 844]];
const FREEZE = `
  *,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}
  .cursor,#typed,.caret{visibility:hidden!important}
  .hero canvas,.hero__badgeph{visibility:hidden!important}
  .foot .giant span{transform:none!important;color:var(--yellow)!important;opacity:1!important}
  .nav{transform:translateX(-50%)!important}
  .progress i{transform:scaleX(0)!important}
  #app .rv:not(.hero .rv){opacity:1!important;transform:none!important}`;

async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const h = () => document.documentElement.scrollHeight;
    for (let y = 0; y < h(); y += Math.round(innerHeight * 0.6)) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); }
    window.scrollTo(0, h()); await new Promise(r => setTimeout(r, 1500));
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0); await new Promise(r => setTimeout(r, 1800));
  });
}

async function shoot(browser, url, file, [w, h], { full = true, freezeBadge = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await settle(page);
  await page.addStyleTag({ content: freezeBadge ? FREEZE : FREEZE.replace('.hero canvas,.hero__badgeph{visibility:hidden!important}', '') });
  await page.waitForTimeout(300);
  await page.screenshot({ path: file, fullPage: full });
  await ctx.close();
}

function diff(a, b, outFile) {
  const A = PNG.sync.read(fs.readFileSync(a)), B = PNG.sync.read(fs.readFileSync(b));
  const w = Math.min(A.width, B.width), h = Math.min(A.height, B.height);
  const crop = (img) => { const o = new PNG({ width: w, height: h }); PNG.bitblt(img, o, 0, 0, w, h, 0, 0); return o; };
  const ca = crop(A), cb = crop(B), d = new PNG({ width: w, height: h });
  const px = pixelmatch(ca.data, cb.data, d.data, w, h, { threshold: 0.1 });
  fs.writeFileSync(outFile, PNG.sync.write(d));
  return { oldH: A.height, newH: B.height, diffPx: px, diffPct: +(100 * px / (w * h)).toFixed(3) };
}

const oldSrv = oldDir ? await serve(oldDir) : null;
const newSrv = await serve(newDir);
const OLD = oldUrl || `http://127.0.0.1:${oldSrv.address().port}`;
const NEW = `http://127.0.0.1:${newSrv.address().port}`;
const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}).catch(() => chromium.launch({ channel: 'chrome' }));
const report = [];
try {
  for (const [name, oldPath, newPath] of PAGES) {
    for (const vp of WIDTHS) {
      const base = path.join(out, `${name}-${vp[0]}`);
      await shoot(browser, OLD + oldPath, `${base}-old.png`, vp);
      await shoot(browser, NEW + newPath, `${base}-new.png`, vp);
      const r = { page: name, width: vp[0], ...diff(`${base}-old.png`, `${base}-new.png`, `${base}-diff.png`) };
      report.push(r);
      console.log(`${name.padEnd(8)} ${String(vp[0]).padStart(4)}px  height old/new ${r.oldH}/${r.newH}  diff ${r.diffPct}%`);
    }
  }
  // hero with the live 3D badge (physics differ slightly between runs — compare by eye)
  for (const vp of WIDTHS) {
    await shoot(browser, OLD + '/', path.join(out, `hero-${vp[0]}-old.png`), vp, { full: false, freezeBadge: false });
    await shoot(browser, NEW + '/', path.join(out, `hero-${vp[0]}-new.png`), vp, { full: false, freezeBadge: false });
  }
} finally {
  await browser.close();
  oldSrv && oldSrv.close();
  newSrv.close();
}
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
