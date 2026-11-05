# jamolxon.uz — portfolio sayt

Jamolxonning shaxsiy portfolio sayti: interaktiv 3D beyjik, xizmatlar, AI yechimlar, loyihalar katalogi, blog va taklif formasi.
Freymvorksiz, build bosqichisiz — oddiy statik fayllar. Istalgan hostingda ishlaydi.

## Tuzilma

```
jamolxon-portfolio/
├── index.html                 sahifa qobig'i: nav, footer, skriptlar
├── assets/
│   ├── css/
│   │   └── styles.css         butun dizayn: ranglar, bo'limlar, moslashuvchanlik
│   ├── js/
│   │   ├── config.js          sozlamalar (beyjik rasmi)
│   │   ├── data.js            KONTENT: loyihalar, xizmatlar, blog, statistika, kontaktlar
│   │   ├── illustrations.js   loyiha kartalaridagi SVG illyustratsiyalar
│   │   ├── templates.js       sahifa shablonlari (bosh sahifa, loyiha, xizmat, blog, taklif)
│   │   ├── lanyard.js         3D beyjik: Three.js + Verlet fizika
│   │   └── app.js             router, animatsiyalar, nav, taklif formasi
│   ├── img/
│   │   ├── portrait.jpg       beyjikdagi portret
│   │   └── favicon.svg
│   └── vendor/                kutubxonalar (lokal nusxa — CDN'siz ishlaydi)
│       ├── three.min.js       Three.js r128
│       ├── gsap.min.js        GSAP 3.12.5
│       └── ScrollTrigger.min.js
└── README.md
```

## Ishga tushirish (lokal)

Sayt **serverdan** ochilishi kerak — `index.html` ni ikki marta bosib (file://) ochsangiz, brauzer xavfsizlik sababli beyjikdagi rasmni chizmaydi.

```bash
cd jamolxon-portfolio
python3 -m http.server 8000      # yoki: npx serve .
```

So'ng brauzerda: http://localhost:8000

## Kontentni o'zgartirish

Deyarli hamma narsa **`assets/js/data.js`** da:

| Nima | Qayerda |
| --- | --- |
| Loyihalar (nom, tavsif, stek, natija, havola) | `PROJECTS` |
| Loyiha toifalari (Live / PM / Shaxsiy / Sotuvda) | `CATS` |
| Xizmatlar va ularning sahifalari | `SERVICES` |
| Soha bo'yicha AI yechimlar | `OFFERS` |
| Ish jarayoni bosqichlari | `STEPS` |
| Blog maqolalari | `POSTS` |
| Hero ostidagi statistika | `FACTS` (loyihalar sonidan avtomatik sanaladi) |
| Telegram, GitHub, email, telefon | `CONTACT` |

- **Loyihaga real skrinshot qo'shish:** rasmni `assets/img/` ga qo'ying va loyihadagi `image:null` ni `image:'assets/img/fayl.jpg'` qiling — SVG illyustratsiya o'rniga chiqadi.
- **Beyjik rasmi:** `assets/img/portrait.jpg` ni almashtiring (eni ≈ 1.44 marta bo'yidan katta, yuz markazda, tepada joy qolsin).
- **Beyjikdagi matn** (ism, bosh harflar, bio, tasma yozuvi): `assets/js/lanyard.js` boshidagi `CONFIG`.
- **Ranglar:** `assets/css/styles.css` boshidagi `:root` — `--maroon`, `--red`, `--yellow`, `--cream`.

## Sahifalar (hash-router)

| Manzil | Sahifa |
| --- | --- |
| `#` | Bosh sahifa |
| `#s-xizmatlar`, `#s-yechimlar` … | bosh sahifadagi bo'limga o'tish |
| `#loyihalar` | loyihalar katalogi |
| `#loyiha-socialauto` | loyiha sahifasi (`slug` bo'yicha) |
| `#xizmat-crm-erp` | xizmat sahifasi |
| `#blog`, `#blog-<slug>` | blog va maqola |
| `#taklif` | taklif formasi |

## Taklif formasi

Hozir forma xabarni tayyorlab, buferga nusxalaydi va Telegram / Email orqali yuborishni taklif qiladi.
Xabarlar to'g'ridan-to'g'ri sizga kelishi uchun `assets/js/app.js` dagi `SUBMIT_ENDPOINT` ga JSON qabul qiluvchi manzilni yozing
(masalan, portfolio botingizdagi FastAPI endpoint). Forma maydonlari: `name, company, industry, sphere, about, budget, deadline, tg, email, phone, pref, ts`.

## Deploy

**AWS Lightsail / Nginx**

```nginx
server {
    listen 80;
    server_name jamolxon.uz www.jamolxon.uz;
    root /var/www/jamolxon-portfolio;
    index index.html;

    location /assets/ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    gzip on;
    gzip_types text/css application/javascript image/svg+xml;
}
```

Papkani serverga ko'chiring (`scp -r jamolxon-portfolio user@server:/var/www/`), so'ng SSL uchun `sudo certbot --nginx -d jamolxon.uz -d www.jamolxon.uz`.

**Vercel / Netlify / Cloudflare Pages** — papkani tashlang yoki Git'ga ulang. Build buyrug'i kerak emas, chiqish papkasi: `.` (root).

## Texnik eslatmalar

- `prefers-reduced-motion` yoqilgan foydalanuvchilarda animatsiyalar o'chadi.
- Beyjik ko'rinmaganda (skrolldan keyin) render to'xtaydi — batareya tejaladi.
- Beyjik matnlari 2048 px teksturada chiziladi — yaqinlashtirganda ham tiniq.
- Brauzerlar: Chrome, Safari, Firefox, Edge (oxirgi 2 versiya); WebGL kerak.
