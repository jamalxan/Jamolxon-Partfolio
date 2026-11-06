// DOM parity: renders every page with the OLD client-side templates (templates.js +
// illustrations.js + data.js from git) and compares it with <main> of the NEW
// pre-rendered HTML (Jinja2), after mapping hash links to clean URLs.
//
// Usage: node tests/visual/dom_parity.mjs [renderedDir=.render] [gitRev=bbe7a3e]
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const front = path.resolve(here, '../..');
const outDir = path.resolve(front, process.argv[2] || '.render');
const rev = process.argv[3] || 'bbe7a3e';
const git = f => execSync(`git show ${rev}:frontend/assets/js/${f}`, { cwd: front, encoding: 'utf8', maxBuffer: 1 << 26 });

const ctx = { console };
vm.createContext(ctx);
vm.runInContext(['data.js', 'illustrations.js', 'templates.js'].map(git).join('\n;\n') +
  '\n;globalThis.T={tplHome,tplProjects,tplProject,tplService,tplBlog,tplPost,tplTaklif,tplNotFound,PROJECTS,SERVICES,POSTS};', ctx);
const T = ctx.T;

function legacy(h) {
  if (h === '' || h === 'top') return '/';
  if (h === 'loyihalar') return '/loyihalar/';
  if (h.startsWith('loyiha-')) return `/loyihalar/${h.slice(7)}/`;
  if (h.startsWith('xizmat-')) return `/xizmatlar/${h.slice(7)}/`;
  if (h === 'blog') return '/blog/';
  if (h.startsWith('blog-')) return `/blog/${h.slice(5)}/`;
  if (h === 'taklif') return '/taklif/';
  if (h.startsWith('s-')) return `/#${h.slice(2)}`;
  return null;
}
function norm(html, { h1toh2 = false } = {}) {
  let s = html;
  s = s.replace(/href="#([^"]*)"(?! data-(mail|tel))/g, (m, h) => { const n = legacy(h); return n ? `href="${n}"` : m; });
  s = s.replace(/href="\/taklif\/\?[^"]*"/g, 'href="/taklif/"');
  s = s.replace(/<circle cx="\d+\.\d" cy="\d+\.\d" r="[\d.]+" fill="[^"]+" opacity="[\d.]+"\/>/g, '');
  s = s.replace(/<img class="hero__badgeph"[^>]*>/g, '');
  s = s.replace(/&#39;/g, "'").replace(/&#34;/g, '&quot;');
  s = s.replace(/class="([^"]*)"/g, (m, c) => `class="${c.trim().replace(/\s+/g, ' ')}"`);
  s = s.replace(/ data-offer="[^"]*"/g, '');
  if (h1toh2) s = s.replace(/<(\/?)h1>/g, '<$1h2>').replace(/class="wrap nf"/g, 'class="wrap"');
  s = s.replace(/<form[\s\S]*<\/form>/, '<form/>');
  // whitespace runs collapse to one space but are kept: inline gaps (chips, links) matter visually
  return s.replace(/\s+/g, ' ').trim();
}
function readMain(rel) {
  const f = path.join(outDir, rel);
  const html = fs.readFileSync(f, 'utf8');
  const m = html.match(/<main id="app"[^>]*>([\s\S]*)<\/main>/);
  return m[1];
}
const cases = [
  ['home', 'index.html', T.tplHome()],
  ['projects', 'loyihalar/index.html', T.tplProjects(), true],
  ['blog', 'blog/index.html', T.tplBlog(), true],
  ['taklif', 'taklif/index.html', T.tplTaklif()],
  ['404', '404.html', T.tplNotFound(), true],
  ...T.PROJECTS.map(p => [`project:${p.slug}`, `loyihalar/${p.slug}/index.html`, T.tplProject(p.slug)]),
  ...T.SERVICES.map(p => [`service:${p.slug}`, `xizmatlar/${p.slug}/index.html`, T.tplService(p.slug)]),
  ...T.POSTS.map(p => [`post:${p.slug}`, `blog/${p.slug}/index.html`, T.tplPost(p.slug)]),
];
let bad = 0;
for (const [name, rel, oldHtml, h1] of cases) {
  // old 404 uses <h2>; old catalog/blog have no <h1> — new pages promote the section heading to <h1>
  const a = norm(oldHtml), b = norm(readMain(rel), { h1toh2: !!h1 });
  if (a === b) { console.log('OK  ', name); continue; }
  bad++;
  let i = 0; while (i < a.length && a[i] === b[i]) i++;
  console.log('DIFF', name, '@', i, '\n  old:', a.slice(Math.max(0, i - 120), i + 120), '\n  new:', b.slice(Math.max(0, i - 120), i + 120));
}
console.log(bad ? `${bad} page(s) differ` : `all ${cases.length} pages match`);
process.exit(bad ? 1 : 0);
