// TZ 9 JS budget: first-load JS (gzip) < 170 KB, three.js chunk < 130 KB. Usage: node tests/budget.mjs dist
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const dist = path.resolve(process.argv[2] || 'dist');
const manifest = JSON.parse(fs.readFileSync(path.join(dist, '.vite/manifest.json'), 'utf8'));
const gz = f => zlib.gzipSync(fs.readFileSync(path.join(dist, f)), { level: 9 }).length / 1024;

const first = new Set();
const walk = key => {
  const e = manifest[key];
  if (!e || first.has(e.file)) return;
  first.add(e.file);
  (e.imports || []).forEach(walk); // static imports only; dynamicImports are lazy
};
Object.keys(manifest).filter(k => manifest[k].isEntry && manifest[k].file.endsWith('.js')).forEach(walk);
const firstKb = [...first].reduce((s, f) => s + gz(f), 0);
const threeFile = Object.values(manifest).map(e => e.file).find(f => /three/i.test(f));
const threeKb = threeFile ? gz(threeFile) : 0;

console.log(`first-load JS: ${firstKb.toFixed(1)} KB gzip (budget 170)`);
console.log(`three chunk:   ${threeKb.toFixed(1)} KB gzip (budget 130) ${threeFile || ''}`);
if (firstKb >= 170 || threeKb >= 130) { console.error('JS budget exceeded'); process.exit(1); }
