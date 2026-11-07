// Functional smoke test of the built site (frontend/.site): SPA navigation, legacy hash
// redirects, lazy 3D badge, lead form (API mocked). Usage: node tests/visual/smoke.mjs [.site]
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(here, '../..', process.argv[2] || '.site');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const srv = await new Promise(res => {
  const s = http.createServer((req, rsp) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
    let f = path.join(dir, p), code = 200;
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { f = path.join(dir, '404.html'); code = 404; }
    rsp.writeHead(code, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(rsp);
  }).listen(0, '127.0.0.1', () => res(s));
});
const BASE = `http://127.0.0.1:${srv.address().port}`;
const browser = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' }));
let fails = 0;
const check = (ok, msg) => { console.log(ok ? 'PASS' : 'FAIL', msg); if (!ok) fails++; };
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [], requests = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('status of 422')) errors.push(m.text()); }); // 422 is the mocked validation response
  page.on('request', r => requests.push(r.url()));

  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  check(requests.some(u => /\/assets\/three\.[^/]+\.js$/.test(u)), 'three chunk loaded lazily on home');
  check(!requests.some(u => /fonts\.(googleapis|gstatic)\.com/.test(u)), 'no Google Fonts requests');
  check(await page.$eval('.hero__badgeph', e => getComputedStyle(e).display === 'none'), 'static badge hidden on 3D path (no jump)');
  check(await page.$eval('#badge', c => c.classList.contains('is-in')), 'badge faded in after first frame');
  check(await page.$eval('#badge', c => c.width > 300), 'WebGL canvas sized');
  check(await page.$eval('.foot [href^="mailto:"]', a => a.textContent.includes('@')), 'footer email wired');

  await page.click('.nav ul a[href="/loyihalar/"]');
  await page.waitForFunction(() => document.getElementById('app').dataset.view === 'projects');
  check(new URL(page.url()).pathname === '/loyihalar/', 'SPA nav -> /loyihalar/');
  check((await page.title()) === 'Loyihalar — Jamolxon', 'title swapped');
  check(await page.$eval('link[rel=canonical]', l => l.href) === 'https://jamolxon.uz/loyihalar/', 'canonical swapped');
  check(await page.$eval('.nav ul a[href="/loyihalar/"]', a => a.classList.contains('active')), 'nav active');

  await page.click('.pcard[href="/loyihalar/socialauto/"]');
  await page.waitForFunction(() => document.getElementById('app').dataset.view === 'project');
  check((await page.textContent('h1')).trim() === 'SocialAuto', 'project page via SPA');
  await page.goBack();
  await page.waitForFunction(() => document.getElementById('app').dataset.view === 'projects');
  check(true, 'popstate back -> catalog');
  await page.goBack();
  await page.waitForFunction(() => document.getElementById('app').dataset.view === 'home');
  check(await page.$eval('#badge', c => c.classList.contains('is-in')) && await page.$eval('.hero__badgeph', e => getComputedStyle(e).display === 'none'), 'back to home: badge reused & visible');

  for (const [hash, want] of [['#loyiha-vocably', '/loyihalar/vocably/'], ['#xizmat-crm-erp', '/xizmatlar/crm-erp/'], ['#blog', '/blog/'], ['#blog-comment-to-dm', '/blog/comment-to-dm/'], ['#loyihalar', '/loyihalar/'], ['#taklif', '/taklif/'], ['#s-yechimlar', '/#yechimlar']]) {
    const p2 = await ctx.newPage();
    await p2.goto(BASE + '/' + hash, { waitUntil: 'networkidle' });
    await p2.waitForTimeout(400);
    const u = new URL(p2.url());
    check(u.pathname + u.hash === want, `legacy ${hash} -> ${want} (got ${u.pathname + u.hash})`);
    await p2.close();
  }

  // lead form (API mocked)
  let sent = null;
  await page.route('**/api/v1/leads', async route => {
    sent = JSON.parse(route.request().postData());
    if (sent.name === 'Xato') return route.fulfill({ status: 422, contentType: 'application/problem+json', body: JSON.stringify({ type: 'validation_error', status: 422, errors: [{ field: 'contact_value', msg: "Telegram username noto'g'ri" }] }) });
    route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: '1', message: "Rahmat, 2 soat ichida bog'lanaman" }) });
  });
  await page.addInitScript(() => { window.__goals = []; window.gtag = (...a) => window.__goals.push(a); });
  await page.goto(BASE + '/xizmatlar/crm-erp/', { waitUntil: 'networkidle' });
  await page.click('.pd__links a[data-offer="svc:crm-erp"]');
  await page.waitForFunction(() => document.getElementById('app').dataset.view === 'taklif');
  check(await page.$eval('select[name=service]', s => s.value) === 'crm-erp', 'service preselected from offer link');
  await page.fill('input[name=name]', 'Xato');
  await page.fill('textarea[name=message]', "O'quv markazimiz uchun CRM kerak");
  await page.fill('input[name=contact_value]', '@ab');
  await page.check('input[name=consent]');
  await page.click('#takform button[type=submit]');
  await page.waitForFunction(() => document.getElementById('takerr').textContent.length > 0);
  check(await page.$eval('input[name=contact_value]', i => i.getAttribute('aria-invalid') === 'true'), '422: field error marked');
  await page.fill('input[name=name]', 'Aziz');
  await page.fill('input[name=contact_value]', '@aziz_k');
  await page.click('#takform button[type=submit]');
  await page.waitForSelector('#takout.show');
  check((await page.textContent('#takout')).includes("Rahmat, 2 soat ichida bog'lanaman"), '201: success message');
  check(sent && sent.service === 'crm-erp' && sent.contact_type === 'telegram' && sent.consent === true && sent.source_page === '/xizmatlar/crm-erp/' && typeof sent.elapsed_ms === 'number', 'payload matches LeadCreate');
  check((await page.evaluate(() => window.__goals)).some(a => a[1] === 'lead_submit'), 'gtag lead_submit fired');

  await page.goto(BASE + '/taklif/?yuborildi=1', { waitUntil: 'networkidle' });
  check(await page.$eval('#takout', o => o.classList.contains('show')), '?yuborildi=1 banner');

  // reduced motion: no 3D
  const rctx = await browser.newContext({ reducedMotion: 'reduce' });
  const rp = await rctx.newPage(); const rreq = [];
  rp.on('request', r => rreq.push(r.url()));
  await rp.goto(BASE + '/', { waitUntil: 'networkidle' }); await rp.waitForTimeout(1500);
  check(!rreq.some(u => /three\./.test(u)), 'reduced motion: three not loaded, static badge stays');
  await rctx.close();

  // no JS: content present
  const nctx = await browser.newContext({ javaScriptEnabled: false });
  const np = await nctx.newPage();
  await np.goto(BASE + '/loyihalar/socialauto/');
  check((await np.textContent('h1')).trim() === 'SocialAuto', 'no-JS: content rendered');
  await nctx.close();

  check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
} finally {
  await browser.close(); srv.close();
}
console.log(fails ? `${fails} failed` : 'all passed');
process.exit(fails ? 1 : 0);
