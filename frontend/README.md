# frontend — jamolxon.uz sayti

Sahifalar HTML'i serverda (Jinja2, `backend/app/render/`) oldindan tayyorlanadi. Bu papkada faqat
dizayn (CSS, shriftlar, rasmlar) va JS bor: JS tayyor HTML ustiga animatsiya, beyjik (Three.js),
SPA o'tishlar va taklif formasini ulaydi. `data.js` endi faqat seed manbasi (`scripts/export_datajs.mjs`),
brauzerda yuklanmaydi.

## Tuzilma

- `assets/js/main.js` — JS kirish nuqtasi → `app.js` (nav, animatsiyalar, SPA o'tish, forma).
- `assets/js/lanyard.js` + `three-lite.js` — beyjik; alohida chunk, hero ko'ringanda `requestIdleCallback` bilan yuklanadi.
  `prefers-reduced-motion` yoki `saveData` yoqilgan bo'lsa 3D yuklanmaydi, statik beyjik qoladi.
- `assets/css/index.css` — CSS kirish nuqtasi: `fonts.css` (o'z serverimizdagi Unbounded va Inter, lotin + kirill)
  + `styles.css` (dizayn, o'zgarmaydi) + `site.css` (yangi elementlar uchun qo'shimchalar).
- `public/assets/img/` — portret va favicon (hash'siz nusxalanadi).
- `tests/visual/` — eski sayt bilan solishtirish skriptlari.

## Buyruqlar

```bash
npm install                 # bir marta
npm run render              # dev HTML: seed kontentdan frontend/.render/ ga (backend/app/render)
npm run dev                 # http://localhost:5173 — toza URL'lar, HMR; /api → 127.0.0.1:8000
npm run build               # dist/ : hash'li JS/CSS/shriftlar + dist/.vite/manifest.json
npm run render:dist         # prod sayt: dist/ + HTML → frontend/.site/
```

Kontent o'zgarsa `npm run render` ni qayta ishga tushiring (dev serverni qayta yoqish shart emas).

Prod'da sayt Python'dan yig'iladi (worker shuni chaqiradi):

```python
from pathlib import Path
from app.render import render_site
render_site(content, Path("/srv/jamolxon-portfolio"), assets_dir=Path("frontend/dist"))
```

## Tekshirish

```bash
node tests/visual/dom_parity.mjs .site    # eski templates.js chiqishi bilan yangi HTML'ni solishtiradi (29 sahifa)
npm run visual                            # Playwright skrinshotlar 1440/768/390 px, eski (git) va yangi; natija tests/visual/out/
cd ../backend && uv run pytest tests/render -q
```

`npm run visual` dan oldin `npm run build && npm run render:dist` qiling. Eski sayt sifatida `git` dagi
`bbe7a3e` versiyasi olinadi (`--rev`), yoki `--old-url https://jamolxon.uz`.

## Budjet (TZ 9)

Birinchi yuklashdagi JS (gzip) < 170 KB, Three.js chunk < 130 KB. `npm run build` chiqishida ko'rinadi.
