import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = path.dirname(fileURLToPath(import.meta.url));
// `npm run render` shu papkaga dev HTML yozadi (backend/app/render, assets_dir=None)
const RENDER_DIR = path.join(root, '.render');

/* Dev: toza URL'lar uchun oldindan render qilingan HTML'ni beradi (/loyihalar/x/ → .render/loyihalar/x/index.html). */
function prerenderedHtml() {
  return {
    name: 'jamolxon-prerendered-html',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== 'GET' || !(req.headers.accept || '').includes('text/html')) return next();
        const url = decodeURIComponent((req.url || '/').split('?')[0]);
        if (url.startsWith('/@') || url.startsWith('/api/') || path.extname(url) && !url.endsWith('.html')) return next();
        let file = path.join(RENDER_DIR, url.endsWith('.html') ? url : path.join(url, 'index.html'));
        let status = 200;
        if (!file.startsWith(RENDER_DIR) || !fs.existsSync(file)) { file = path.join(RENDER_DIR, '404.html'); status = 404; }
        if (!fs.existsSync(file)) return next();
        const html = await server.transformIndexHtml(url, fs.readFileSync(file, 'utf8'));
        res.statusCode = status;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(html);
      });
    },
  };
}

export default defineConfig({
  root,
  base: '/',
  publicDir: 'public',
  appType: 'custom',
  plugins: [prerenderedHtml()],
  server: {
    port: 5173,
    // backend API (FastAPI) lokal ishlayotgan bo'lsa
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    manifest: true,
    target: 'es2019',
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        app: path.join(root, 'assets/js/main.js'),
        style: path.join(root, 'assets/css/index.css'),
      },
      output: {
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash][extname]',
        manualChunks(id) {
          if (id.includes('node_modules/gsap')) return 'vendor';
          if (id.includes('node_modules/three')) return 'three';
        },
      },
    },
  },
});
