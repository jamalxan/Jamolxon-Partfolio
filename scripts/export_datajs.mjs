// Exports the legacy frontend/assets/js/data.js globals to JSON (seed source).
// Usage: node scripts/export_datajs.mjs [out.json]
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'frontend/assets/js/data.js'), 'utf8');
const names = ['CATS', 'PROJECTS', 'SERVICES', 'POSTS', 'OFFERS', 'STEPS', 'CONTACT'];
const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${src}\n;globalThis.__out = {${names.join(',')}};`, ctx);
const out = process.argv[2] || path.join(root, 'backend/seed/content.json');
fs.writeFileSync(out, JSON.stringify(ctx.__out, null, 2) + '\n');
console.log(`wrote ${out}:`, names.map(n => `${n}=${Array.isArray(ctx.__out[n]) ? ctx.__out[n].length : Object.keys(ctx.__out[n]).length}`).join(' '));
