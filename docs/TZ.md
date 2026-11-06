# Jamolxon portfolio — Texnik topshiriq

6-noyabr 2026 · muallif: Giyosiddin

> ## 0. Qabul qilingan qarorlar va TZ'dan chetlanishlar (2026-11-06)
>
> Bu bo'lim TZ'ning qolgan qismidan ustun turadi.
>
> 0. **Yangilanish (2026-11-06 kech): loyiha alohida serverga ko'chirildi — 20.219.147.37 (Azure, Ubuntu 24.04).** TLS: o'z Caddy'si (`infra/docker-compose.edge.yml`, tarmoq `jamolxon_edge`). CI `jxdeploy@20.219.147.37` ga deploy qiladi. Quyidagi 1- va 3-bandlar eski umumiy server haqida (tarixiy).
>
> 1. **Server: hozirgi umumiy server (185.237.97.126), alohida VPS emas.** Unda socialauto, vocably va ainews ham ishlaydi.
>    - Tashqi TLS va proksi: `socialauto-caddy-1` (Caddy). TZ'dagi nginx konteyneri Caddy ortida turadi va TLS qilmaydi.
>    - Loyihaning hamma konteynerlari alohida compose loyihasida (`jamolxon`), Postgres va Redis o'ziniki. Caddy bilan faqat `socialauto_default` tarmog'i orqali bog'lanadi.
>    - **Butun serverga tegishli bandlar qo'llanmaydi:** root SSH'ni o'chirish, UFW'da 80/443 ni faqat Cloudflare'ga ochish, Lightsail snapshot. Ular boshqa loyihalarni buzadi. Ularning o'rniga: Caddy'da jamolxon hostlari uchun Cloudflare IP allowlist, deploy uchun cheklangan `portfolio` foydalanuvchisi (rrsync), root paroli almashtiriladi.
>    - Server: Ubuntu 26.04, Docker 29.
> 2. **DNS Cloudflare'ga o'tkaziladi.** Pochta (MX → `mail.jamolxon.uz` → 185.196.212.52, SPF) ahost'da qoladi va Cloudflare'da "DNS only" (proksisiz) yoziladi.
> 3. **Hozirgi deploy:** GitHub Actions (`jamalxan/Jamolxon-Partfolio`) statik saytni `/srv/jamolxon-portfolio` ga rsync qiladi. U yerni `jamolxon-portfolio` nginx konteyneri beradi (`/opt/jamolxon-portfolio/docker-compose.yml`).

## 1. Umumiy ma'lumot

**Maqsad:** jamolxon.uz statik portfoliosini kontenti brauzerdan boshqariladigan, xavfsiz va tez ishlaydigan to'liq tizimga aylantirish. Dizayn, animatsiyalar va beyjik o'zgarmaydi; faqat ostidagi "dvigatel" almashadi.

**Joriy holat (v5.9):**
- Frontend: vanilla JS, GSAP + ScrollTrigger, Three.js (beyjik). Barcha kontent `assets/js/data.js` ichida qo'lda yozilgan.
- Marshrutlash hash orqali (`#loyiha-slug`, `#blog-slug`): Google bu sahifalarni alohida indekslamaydi.
- Taklif formasi hech qayerga yubormaydi (`SUBMIT_ENDPOINT = null`).
- Server, ma'lumotlar bazasi, admin panel, monitoring va backup yo'q.

**Loyiha doirasi:**
1. Backend API (FastAPI + PostgreSQL + Redis).
2. Admin panel: loyihalar, xizmatlar, blog, takliflar (leadlar), media, sozlamalar.
3. Taklif formasi: saqlash, Telegram va email bildirishnoma, spamdan himoya.
4. Frontendni API va toza URLlarga o'tkazish, SEO uchun oldindan render qilingan HTML.
5. Xavfsizlik, tezlik, deploy, monitoring, backup, testlar.

**Doiradan tashqarida:** ko'p tillilik (uz/ru/en) va to'lov tizimi. Arxitektura ularni keyin qo'shishga to'sqinlik qilmasligi kerak.

| Rol | Kim | Nima qiladi |
| --- | --- | --- |
| Mehmon | Potensial mijoz, ish beruvchi | Saytni ko'radi, taklif yuboradi |
| Owner | Jamolxon | Hamma narsani boshqaradi, foydalanuvchi qo'shadi |
| Editor | Yordamchi kontent menejer (ixtiyoriy) | Loyiha va blog yozadi, leadlarni ko'radi; sozlama va foydalanuvchilarga kira olmaydi |

## 2. Arxitektura va texnologiyalar steki

**Asosiy qaror:** ommaviy sahifalar oldindan tayyorlangan statik HTML sifatida nginx'dan beriladi. API faqat forma, admin va kontent yangilanishi uchun ishlaydi.

| Qatlam | Texnologiya | Nega |
| --- | --- | --- |
| Backend API | Python 3.12, FastAPI, Pydantic v2 | Asosiy stek, async, avtomatik OpenAPI |
| ORM va migratsiya | SQLAlchemy 2 (async), Alembic | Tipli modellar, versiyalangan sxema |
| Ma'lumotlar bazasi | PostgreSQL 16 | Ishonchli, JSONB, to'liq matnli qidiruv |
| Kesh, navbat, limit | Redis 7 | API kesh, rate limit, refresh tokenlar, fon vazifalar navbati |
| Fon vazifalar | ARQ | Telegram/email, rasm qayta ishlash, statik sahifa generatsiyasi |
| Statik generator | Jinja2 + mavjud templates.js dizayni | Har bir loyiha, xizmat, post uchun alohida HTML (SEO) |
| Admin panel | React 18 + TypeScript + Vite, TanStack Query, React Hook Form + Zod, shadcn/ui | Tez, tipli, forma validatsiyasi frontda ham |
| Frontend (sayt) | Mavjud vanilla JS, Vite bilan yig'iladi | Dizayn saqlanadi, bundle kichrayadi |
| Veb-server | nginx (Brotli, HTTP/2, HTTP/3) | Statik fayllar, /api proksi, xavfsizlik headerlari |
| CDN va himoya | Cloudflare (DNS, CDN, WAF, Turnstile) | DDoS himoyasi, kesh, bot tekshiruvi |
| Media saqlash | Cloudflare R2 (S3 mos) | Arzon, egress bepul |
| Konteynerlar | Docker + Docker Compose | Bir xil muhit: lokal, staging, prod |

Mehmon so'rovi Cloudflare keshidan yoki nginx'dagi tayyor HTML'dan qaytadi. FastAPI'ga faqat forma, admin va kontent nashri tegadi, og'ir ishlarni worker fonda bajaradi.

**Monorepo:**
```
jamolxon/
├── frontend/        # hozirgi sayt (assets/, index.html) + Vite config
├── backend/
│   ├── app/
│   │   ├── api/v1/      # public/ va admin/ routerlar
│   │   ├── core/        # config, security, logging
│   │   ├── models/      # SQLAlchemy modellar
│   │   ├── schemas/     # Pydantic sxemalar
│   │   ├── services/    # biznes logika
│   │   ├── workers/     # ARQ vazifalari
│   │   └── render/      # Jinja2 shablonlar, statik generator
│   ├── migrations/      # Alembic
│   └── tests/
├── admin/           # React admin panel
├── infra/           # docker-compose.*.yml, nginx/, scripts/backup.sh
├── .github/workflows/
└── CLAUDE.md
```

## 3. Ma'lumotlar modeli

`data.js` dagi har bir massiv (CATS, PROJECTS, SERVICES, POSTS, OFFERS, STEPS, CONTACT) bazadagi jadvalga aylanadi. FACTS saqlanmaydi, loyihalardan hisoblanadi.

Barcha jadvallarda `id` (UUID v7), `created_at`, `updated_at` bor. Kontent jadvallarida qo'shimcha `status` (draft / published / archived), `published_at`, `sort_order`, `deleted_at` (soft delete) bor.

| Jadval | Asosiy maydonlar | Indeks va cheklovlar |
| --- | --- | --- |
| users | email, password_hash (argon2id), role (owner/editor), totp_secret (shifrlangan), is_active, last_login_at, failed_logins, locked_until | email UNIQUE |
| categories | slug, title, color | slug UNIQUE |
| projects | slug, title, subtitle, category_id, type (prod/pm/own/sale), client, year, role, stack (text[]), summary, body_md, body_html, results (JSONB), links (JSONB), cover_id, seo_title, seo_description, is_featured | slug UNIQUE; (status, sort_order); GIN(stack) |
| project_images | project_id, media_id, caption, sort_order | FK, CASCADE |
| services | slug, title, short, body_md, body_html, features (JSONB), deliverables (JSONB), price_from, duration, faq (JSONB), illustration_key, seo_* | slug UNIQUE |
| posts | slug, title, excerpt, body_md, body_html, cover_id, reading_min, author_id, seo_*, search_vector (tsvector) | slug UNIQUE; GIN(search_vector); (status, published_at DESC) |
| tags, post_tags | slug, title; post_id + tag_id | PK (post_id, tag_id) |
| offers, process_steps | title, text, sort_order | — |
| leads | name, contact_type (email/telegram/phone), contact_value, service_id, budget_range, deadline, message, status, source_page, utm (JSONB), ip_hash, user_agent, spam_score, assigned_to | (status, created_at DESC); contact_value |
| lead_events | lead_id, actor_id, kind (status_change/note/call), payload (JSONB) | (lead_id, created_at) |
| media | storage_key, original_name, mime, size_bytes, width, height, variants (JSONB), alt, blurhash, uploaded_by | storage_key UNIQUE |
| settings | key, value (JSONB): kontaktlar, ijtimoiy tarmoqlar, SEO default, OG rasm, Telegram chat_id | key PK |
| redirects | from_path, to_path, code (301/302) | from_path UNIQUE |
| audit_logs | actor_id, action, entity, entity_id, diff (JSONB), ip, user_agent | (entity, entity_id); created_at |

**Qoidalar:**
- `body_md` ni faqat admin yozadi. `body_html` saqlashda serverda Markdown'dan generatsiya qilinadi va nh3 bilan tozalanadi. Frontend faqat `body_html` ni oladi.
- Slug o'zgarsa, eski URL avtomatik `redirects` ga 301 bilan yoziladi.
- IP xom holda saqlanmaydi, faqat tuzli SHA-256 hash ko'rinishida. 24 oy o'tgan leadlar avtomatik anonimlashtiriladi.
- `scripts/seed_from_datajs.py` `data.js` ni bazaga ko'chiradi: 14 loyiha, 6 xizmat, barcha postlar.

## 4. API spetsifikatsiyasi

Barcha endpointlar `/api/v1` ostida, JSON, UTF-8. OpenAPI (`/api/v1/openapi.json`) faqat staging'da ochiq, prod'da yopiq.

**Ommaviy (autentifikatsiyasiz, keshlanadi):**

| Metod | Yo'l | Vazifasi | Kesh |
| --- | --- | --- | --- |
| GET | /projects?category=&type=&featured=&page=&limit= | Loyihalar ro'yxati | Redis 5 daq + CDN |
| GET | /projects/{slug} | Loyiha to'liq | Redis 5 daq + CDN |
| GET | /services, /services/{slug} | Xizmatlar | Redis 5 daq + CDN |
| GET | /posts?tag=&q=&page=, /posts/{slug} | Blog, qidiruv bilan | Redis 5 daq + CDN |
| GET | /site | Kontaktlar, FACTS, bosh sahifa bloklari | Redis 5 daq + CDN |
| POST | /leads | Taklif formasi | Kesh yo'q; 5 ta/soat/IP |
| GET | /health, /ready | Liveness va readiness (DB, Redis) | Yo'q |

**Admin (`/api/v1/admin`, cookie sessiya + CSRF):**

| Guruh | Endpointlar |
| --- | --- |
| Auth | POST /auth/login, /auth/2fa/verify, /auth/refresh, /auth/logout, GET /auth/me, POST /auth/2fa/setup, /auth/password |
| Kontent CRUD | GET/POST /projects, GET/PATCH/DELETE /projects/{id}, POST /projects/{id}/publish, POST /projects/reorder; xuddi shunday services, posts, categories, tags, offers, steps |
| Media | POST /media (multipart, 10 MB gacha), GET /media?q=, PATCH /media/{id} (alt), DELETE /media/{id} (ishlatilmayotgan bo'lsa) |
| Leadlar | GET /leads?status=&q=&from=&to=, GET/PATCH /leads/{id}, POST /leads/{id}/events, GET /leads/export.csv |
| Tizim | GET /dashboard, GET/PUT /settings, GET/POST/PATCH /users (faqat owner), GET /audit-logs, POST /site/rebuild |

**Javob formatlari:**
- Ro'yxat: `{"items": [...], "total": 42, "page": 1, "limit": 12}`.
- Xato (RFC 9457): `{"type": "validation_error", "title": "...", "status": 422, "errors": [{"field": "contact_value", "msg": "..."}], "request_id": "..."}`. Ichki xato matni foydalanuvchiga hech qachon ko'rsatilmaydi.
- Har bir javobda `X-Request-ID` header bor.
- Ommaviy GET: `ETag` va `Cache-Control: public, max-age=60, stale-while-revalidate=600`.
- Sahifalash: `limit` maksimal 50.

## 5. Frontend integratsiyasi

Dizayn va animatsiyalar o'zgarmaydi. URLlar, kontent manbai va yig'ish jarayoni o'zgaradi.

| Hozir | Yangi | Eslatma |
| --- | --- | --- |
| # | / | Bosh sahifa |
| #loyihalar | /loyihalar | Filtr: /loyihalar?kategoriya=crm |
| #loyiha-&lt;slug&gt; | /loyihalar/&lt;slug&gt; | Har biri alohida HTML |
| #xizmat-&lt;slug&gt; | /xizmatlar/&lt;slug&gt; | 6 ta xizmat sahifasi |
| #blog, #blog-&lt;slug&gt; | /blog, /blog/&lt;slug&gt; | Sahifalash: /blog/sahifa/2 |
| #taklif | /taklif | Forma |
| #s-&lt;bo'lim&gt; | /#&lt;bo'lim&gt; | Bosh sahifadagi bo'limga scroll |

Eski hash havolalar ishlashda davom etadi: `app.js` hash'ni ko'rsa, `history.replaceState` bilan yangi yo'lga o'tkazadi.

**Render tartibi:**
1. Admin nashr qiladi, API ARQ'ga rebuild vazifasini qo'yadi.
2. Worker o'zgargan sahifalarni Jinja2 bilan to'liq HTML qilib yozadi (kontent, title, meta, OG, JSON-LD). Bosh sahifa, ro'yxatlar, sitemap.xml va RSS ham qayta yoziladi.
3. Fayllar atomik almashtiriladi (vaqtinchalik papka, keyin rename). Keyin Cloudflare keshidan faqat o'sha URLlar tozalanadi.
4. Brauzerda `app.js` tayyor HTML ustiga animatsiyalarni ulaydi (progressive enhancement). Sahifalar orasida o'tish SPA kabi silliq: keyingi sahifa HTML'i fetch qilinadi va kontent qismi almashtiriladi.

JS o'chirilgan bo'lsa ham kontent o'qiladi va forma ishlaydi (oddiy POST + redirect).

**Yig'ish (Vite):**
- `data.js` o'chiriladi. `templates.js` shablonlari Jinja2 ga ko'chiriladi. HTML har doim serverdan keladi, JS shablonlari faqat SPA o'tishlarida ishlatilmaydi.
- Three.js faqat kerakli qismlar bilan import qilinadi va alohida lanyard chunk sifatida dinamik yuklanadi.
- GSAP va ScrollTrigger npm orqali olinadi, umumiy vendor chunk'ga tushadi.
- Fayl nomlari hash'li bo'ladi (`app.3f9a1c.js`), shuning uchun ularni bir yilga keshlash mumkin.

**Forma:** `POST /api/v1/leads` Turnstile tokeni bilan yuboriladi. Muvaffaqiyatli bo'lsa, "Rahmat, 2 soat ichida bog'lanaman" xabari chiqadi va GA4/Yandex Metrika'ga `lead_submit` hodisasi yuboriladi.

## 6. Admin panel

Admin panel `admin.jamolxon.uz` da alohida React ilova sifatida ishlaydi: o'zbek tilida, sayt palitrasida (maroon fon, sariq aksent), desktop va telefonda. Har bir saqlash bir bosishda bo'ladi, nashr qilish uchun alohida tugma bor.

| Modul | Imkoniyatlar | Kim |
| --- | --- | --- |
| Dashboard | Bugun/hafta/oy leadlari, yangi leadlar, eng ko'p ko'rilgan loyihalar, oxirgi nashrlar, tizim holati (backup vaqti, xatolar soni) | Owner, Editor |
| Loyihalar | Ro'yxat (qidiruv, filtr, drag-and-drop tartiblash); forma: asosiy maydonlar, Markdown muharriri jonli preview bilan, galereya, natijalar, SEO bloki va Google preview, Draft / Nashr / Arxiv | Owner, Editor |
| Xizmatlar | Matn, imkoniyatlar, narx "...dan", muddat, FAQ, illyustratsiya tanlash | Owner, Editor |
| Blog | Postlar, teglar, rejalashtirilgan nashr, o'qish vaqti avtomatik | Owner, Editor |
| Leadlar | Kanban (Yangi → Aloqada → Taklif yuborildi → Kelishildi / Rad etildi / Spam) va jadval; tarix, izoh, "Telegram'da yozish", "Qo'ng'iroq"; CSV eksport | Owner, Editor (ko'rish va izoh) |
| Media | Drag-and-drop yuklash, alt matn majburiy, qayerda ishlatilgani, ishlatilmaganlarni o'chirish | Owner, Editor |
| Sozlamalar | Kontaktlar, ijtimoiy tarmoqlar, SEO default, OG rasm, Telegram chat ID, redirectlar, "Saytni qayta yig'ish" | Owner |
| Foydalanuvchilar va audit | Taklif qilish, rol berish, sessiyalarni bekor qilish; audit jurnali diff bilan | Owner |

**UX talablari:**
- Har 10 soniyada lokal avtosaqlash (localStorage). Saqlanmagan o'zgarish bilan chiqishda ogohlantirish.
- `updated_at` bo'yicha optimistik qulf: "Bu yozuv o'zgargan, yangilang".
- "Saytda ko'rish" draft'ni preview tokeni bilan ko'rsatadi (1 soat, noindex).
- Zod (front) va Pydantic (back) bir xil qoidalar bilan tekshiradi.
- Klaviatura: Ctrl+S saqlash, Ctrl+K tezkor qidiruv.

## 7. Taklif (lead) oqimi

Har bir haqiqiy taklif 10 soniya ichida Telegramga yetib boradi va hech biri yo'qolmaydi: avval bazaga yoziladi, keyin bildirishnoma yuboriladi.

| Maydon | Turi | Majburiy | Tekshiruv |
| --- | --- | --- | --- |
| Ism | matn | ha | 2–80 belgi |
| Aloqa usuli | Email / Telegram / Telefon | ha | — |
| Aloqa ma'lumoti | matn | ha | Email: RFC; Telegram: @ + 5–32 belgi; Telefon: E.164, +998 default |
| Xizmat | 6 xizmatdan biri yoki "Boshqa" | ha | bazadagi slug |
| Byudjet | diapazon | yo'q | ro'yxatdan |
| Muddat | shoshilinch / 1 oy / 3 oy / aniq emas | yo'q | ro'yxatdan |
| Xabar | matn | ha | 10–4000 belgi |
| Rozilik | checkbox | ha | ma'lumotlarni qayta ishlashga rozilik |
| Yashirin | honeypot + Turnstile token | — | honeypot to'lsa yoki token noto'g'ri bo'lsa, spam |

**Qayta ishlash:**
1. Turnstile tekshiruvi, rate limit: 5 ta/soat/IP, 20 ta/kun/aloqa ma'lumoti.
2. Pydantic validatsiya. `spam_score` havolalar soni, takror xabarlar va to'ldirish vaqti bo'yicha hisoblanadi (3 soniyadan tez = bot).
3. Lead bazaga yoziladi (spam bo'lsa `status = spam` bilan), foydalanuvchiga darhol 201 qaytadi.
4. ARQ vazifasi Telegram Bot API orqali yuboradi. Muvaffaqiyatsiz bo'lsa 5 marta qayta urinadi (eksponensial kutish), keyin email orqali zaxira xabar yuboriladi.
5. Mijoz email qoldirgan bo'lsa, unga "Taklifingiz qabul qilindi" xati ketadi (SPF, DKIM, DMARC sozlangan domen orqali).

**Telegram xabari namunasi:**
```
Yangi taklif #128 — CRM/ERP tizimlar
Ism: Aziz Karimov
Telegram: @aziz_k (tugma: Yozish)
Byudjet: $1000–3000 · Muddat: 1 oy
Xabar: O'quv markazimiz uchun CRM kerak...
Manba: /xizmatlar/crm-erp · utm_source=instagram
[Admin panelda ochish]
```

Inline tugmalar orqali statusni "Aloqada" yoki "Spam" ga o'zgartirish mumkin. Bot faqat ruxsat berilgan chat ID'dan buyruq qabul qiladi.

Statuslar: Yangi → Aloqada → Taklif yuborildi → Kelishildi yoki Rad etildi; alohida Spam. 24 soat ichida "Yangi" holatidan chiqmagan lead uchun eslatma keladi.

## 8. Xavfsizlik talablari

Maqsadli daraja: OWASP ASVS 4.0 Level 2. Launchdan oldin har bir band tekshirilgan bo'lishi shart; bitta bajarilmagan band launchni to'xtatadi.

**Autentifikatsiya va sessiya:**
- Parollar argon2id (time_cost=3, memory_cost=64 MB), minimal 12 belgi, HIBP k-anonymity bilan tekshiriladi.
- TOTP 2FA barcha adminlar uchun majburiy; 10 ta zaxira kod. TOTP sekreti AES-GCM bilan shifrlangan.
- Access token 15 daqiqa, refresh token 7 kun, har ishlatilganda almashadi (rotation). Qayta ishlatilgan eski refresh token barcha sessiyalarni bekor qiladi.
- Tokenlar faqat `HttpOnly; Secure; SameSite=Strict` cookie'da saqlanadi, localStorage'da hech qachon. Cookie yo'li `/api/v1/admin`.
- CSRF: double-submit token (`X-CSRF-Token`) barcha o'zgartiruvchi so'rovlarda.
- Login: 5 xato urinish / 15 daqiqa / IP+email bo'lsa, 15 daqiqa blok va Telegramga ogohlantirish. Xato xabari bir xil: "Email yoki parol noto'g'ri".
- Yangi qurilma yoki mamlakatdan kirish haqida Telegramga xabar keladi.

**Avtorizatsiya:** har bir admin endpoint rol tekshiruvi dekoratori bilan himoyalangan (default: rad etish). Editor sozlama, foydalanuvchi va audit endpointlariga kira olmaydi; buni testlar tasdiqlaydi.

**Kiruvchi ma'lumotlar:**
- Barcha kirish Pydantic sxemalar orqali, `extra = forbid`. SQL faqat ORM yoki parametrli so'rovlar orqali.
- Markdown HTML nh3 bilan oq ro'yxat asosida tozalanadi (script, iframe, `on*` yo'q).
- Fayl yuklash: 10 MB gacha, MIME turi tarkibdan aniqlanadi (python-magic). Faqat JPEG/PNG/WebP/AVIF/PDF. Rasmlar Pillow bilan qayta kodlanadi, EXIF (GPS) o'chiriladi. SVG qabul qilinmaydi. Fayl nomi UUID bilan almashtiriladi.

**HTTP headerlar:**
```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://media.jamolxon.uz; connect-src 'self'; frame-src https://challenges.cloudflare.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Cross-Origin-Opener-Policy: same-origin
```
CORS: faqat `https://jamolxon.uz` va `https://admin.jamolxon.uz`. Google Fonts o'z serverimizga ko'chiriladi.

**Server va infratuzilma** (0-bo'limdagi chetlanishlarga qarang):
- SSH faqat kalit bilan, parol va root kirish o'chirilgan. UFW: 22 (cheklangan IP), 80, 443. 80/443 ga faqat Cloudflare IP'lari.
- fail2ban, unattended-upgrades.
- PostgreSQL va Redis tashqariga port ochmaydi; Redis parol bilan.
- Konteynerlar root bo'lmagan foydalanuvchi bilan, `read_only` fayl tizimi bilan ishlaydi.
- Admin panel uchun Cloudflare Access (email OTP) yoki IP allowlist.

**Maxfiy kalitlar:** `.env` repoda yo'q (.gitignore + gitleaks pre-commit). Prod kalitlari GitHub Actions Secrets'da va serverda 600 huquqli faylda. SECRET_KEY, JWT kaliti, DB paroli, Telegram token kamida 32 bayt tasodifiy bo'lib, yiliga bir marta almashtiriladi.

**Bog'liqliklar:** Dependabot, pip-audit, npm audit har bir PR'da; bandit va ruff xavfsizlik qoidalari. Launchdan oldin OWASP ZAP baseline: yuqori va o'rta topilmalar 0 bo'lishi kerak.

**Audit:** barcha admin harakatlari `audit_logs` ga yoziladi (o'chirib bo'lmaydi, 1 yil saqlanadi). Hodisa tartibi `infra/INCIDENT.md` da yoziladi.

## 9. Tezlik va SEO

Asosiy to'siq: `three.min.js` 603 KB va birinchi ekranni bloklaydi.

| Ko'rsatkich | Maqsad | Qanday o'lchanadi |
| --- | --- | --- |
| LCP | < 2,0 s | Lighthouse CI, Search Console |
| INP | < 200 ms | web-vitals |
| CLS | < 0,05 | Lighthouse CI |
| TTFB (HTML) | < 200 ms (CDN) | Cloudflare analytics |
| Birinchi yuklashdagi JS (gzip) | < 170 KB, Three.js chunk < 130 KB | Vite hisobot, CI budjet |
| Lighthouse | Perf ≥ 90, A11y ≥ 95, BP 100, SEO 100 | Har bir PR'da Lighthouse CI |
| API p95 (ommaviy GET) | < 120 ms | Sentry |

**Frontend:**
- Three.js hero ko'ringanda `requestIdleCallback` orqali yuklanadi; ungacha statik WebP turadi.
- `prefers-reduced-motion` yoki `saveData` yoqilgan bo'lsa, 3D va og'ir animatsiyalar o'chadi.
- Shriftlar o'z serverimizda, WOFF2, lotin + kirill subset, preload, `font-display: swap`.
- Rasmlar: AVIF + WebP + JPEG, srcset (480/960/1440/2048), `loading="lazy"` (hero rasmi `fetchpriority="high"`), blurhash, aniq width/height.
- Kritik CSS inline, qolgani asinxron; preconnect faqat media domeni uchun.

| Resurs | Cache-Control |
| --- | --- |
| Hash'li JS/CSS/shriftlar | public, max-age=31536000, immutable |
| Media (R2) | public, max-age=31536000, immutable |
| HTML | public, max-age=0, s-maxage=3600, stale-while-revalidate=86400 |
| Ommaviy API | public, max-age=60, stale-while-revalidate=600 + Redis 5 daq |
| Admin API | no-store |

Server: nginx Brotli (11-daraja, oldindan siqilgan), HTTP/2 va HTTP/3. Uvicorn 2–4 worker, DB puli 10, N+1 yo'q (selectinload).

**SEO:**
- Har bir sahifada noyob title (≤ 60), description (≤ 155), canonical, OG va Twitter teglari.
- OG rasmlar avtomatik generatsiya qilinadi (1200×630).
- JSON-LD: bosh sahifada Person + ProfessionalService; loyihalarda CreativeWork; postlarda BlogPosting; xizmatlarda Service + FAQPage; ichki sahifalarda BreadcrumbList.
- sitemap.xml (lastmod bilan) va robots.txt avtomatik; admin, preview va API noindex.
- Search Console va Yandex Webmaster ulanadi; nashrdan keyin IndexNow orqali xabar beriladi.
- Semantik HTML: bitta h1, sarlavhalar ketma-ketligi, barcha rasmlarda alt, kontrast WCAG AA.

## 10. Infratuzilma va deploy

(Server bo'yicha 0-bo'limga qarang.) Domen va DNS Cloudflare'da, proksi yoqilgan.

| Servis | Obraz | Vazifasi | Healthcheck |
| --- | --- | --- | --- |
| nginx | nginx:1.27-alpine | Statik sayt, admin SPA, /api proksi (TLS: Caddy) | GET /nginx-health |
| api | python:3.12-slim, multi-stage | FastAPI, uvicorn | GET /api/v1/ready |
| worker | api obrazi | ARQ | ARQ health key |
| postgres | postgres:16-alpine | Asosiy baza | pg_isready |
| redis | redis:7-alpine | Kesh, navbat, limitlar; AOF | redis-cli ping |

| Muhit | Manzil | Ma'lumot | Deploy |
| --- | --- | --- | --- |
| Local | localhost | Seed | docker compose up |
| Staging | staging.jamolxon.uz (Cloudflare Access, noindex) | Prod nusxasi, shaxsiy ma'lumotlarsiz | main'ga har merge'da |
| Production | jamolxon.uz, admin.jamolxon.uz, media.jamolxon.uz | Haqiqiy | Git tag (v1.2.0), qo'lda tasdiqlash |

**CI/CD:**
1. Har bir PR: ruff, mypy --strict, pytest (coverage ≥ 80%), admin uchun eslint + tsc + vitest, pip-audit, npm audit, gitleaks, Lighthouse CI.
2. main'ga merge: obrazlar GHCR'ga, staging'ga deploy, Playwright e2e.
3. Tag: prod. Tartib: DB backup → `alembic upgrade head` → yangi api/worker, healthcheck o'tgach eskisi to'xtatiladi → saytni qayta yig'ish → smoke testlar.
4. Smoke test yiqilsa, oldingi obraz tegiga avtomatik qaytariladi va Telegramga xabar ketadi.

Migratsiyalar faqat orqaga mos (expand → migrate → contract).

## 11. Monitoring, loglar, backup

RPO ≤ 24 soat, RTO ≤ 2 soat.

| Nima | Vosita | Ogohlantirish | Qayerga |
| --- | --- | --- | --- |
| Sayt va API | Better Stack / UptimeRobot, har 1 daq: / va /api/v1/ready | 2 ketma-ket xato | Telegram + email |
| Xatolar | Sentry (10% sample) | Yangi xato turi yoki 10 daqiqada 20+ xato | Telegram |
| Resurslar | Netdata yoki node_exporter + Grafana Cloud | CPU > 85% 10 daq, disk > 80%, RAM > 90% | Telegram |
| TLS va domen | Uptime vositasi | 14 kun qolganda | Email |
| Backup | Heartbeat ping | 26 soatda ping kelmasa | Telegram |
| Core Web Vitals | Search Console + web-vitals | Haftalik | Email |

**Loglar:** JSON formatda (timestamp, level, request_id, path, status, duration_ms, user_id). Parollar, tokenlar, to'liq telefon va email maskalanadi. Docker json-file 10 MB × 5; muhim loglar 30 kun saqlanadi.

| Nima | Qachon | Qayerga | Saqlash |
| --- | --- | --- | --- |
| PostgreSQL (pg_dump -Fc) | Har kuni 03:00 (Toshkent) + har deploydan oldin | R2, alohida bucket, age bilan shifrlangan | 7 kunlik, 4 haftalik, 6 oylik |
| Media (R2) | R2 versiyalash + haftalik B2 nusxa | B2 | 3 oy |
| Konfiguratsiya va .env | Har o'zgarishda | Parol menejeri | Doimiy |

Shifrlash kaliti serverda emas, faqat parol menejerida saqlanadi. Har oyning birinchi dushanbasida tiklash mashqi o'tkaziladi va natija `infra/RESTORE_LOG.md` ga yoziladi; tartib `infra/RESTORE.md` da.

## 12. Testlash va qabul mezonlari

| Tur | Vosita | Qamrov |
| --- | --- | --- |
| Unit va integratsiya | pytest, pytest-asyncio, testcontainers | coverage ≥ 80%, auth va lead ≥ 95% |
| API kontrakt | schemathesis | Noto'g'ri kirishga 5xx yo'q |
| Admin frontend | vitest + Testing Library | Formalar, validatsiya, ruxsatlar |
| E2E | Playwright (Chrome, WebKit, mobil) | Asosiy ssenariylar |
| Yuklama | k6 | Sahifalar 200 so'rov/s, API 50 so'rov/s, 10 daq |
| Xavfsizlik | OWASP ZAP baseline + 8-bo'lim | Staging'da |
| Tezlik va a11y | Lighthouse CI, axe-core | Har bir sahifa turi |

**Qabul mezonlari:**
- [ ] Forma: lead bazada, Telegram 10 soniya ichida keldi, mijozga tasdiq xati ketdi.
- [ ] Telegram API ishlamasa, lead yo'qolmaydi; qayta urinish va email zaxirasi ishlaydi.
- [ ] Bot yuborgan forma Telegramga tushmaydi, spam statusida saqlanadi.
- [ ] Owner login + 2FA bilan kiradi; 6-xato urinishda blok ishlaydi va ogohlantirish keladi.
- [ ] Editor sozlamalar va foydalanuvchilarni ko'rmaydi, API 403 qaytaradi.
- [ ] Yangi loyiha 60 soniya ichida /loyihalar/&lt;slug&gt; da ochiladi, sitemap'da paydo bo'ladi, statistika o'zgaradi.
- [ ] Slug o'zgarsa, eski URL 301 bilan yo'naltiradi.
- [ ] data.js ma'lumoti bazada; ko'rinish v5.9 bilan bir xil (1440, 768, 390 px skrinshotlar).
- [ ] Eski hash havolalar yangi URLlarga o'tkazadi.
- [ ] Beyjik, animatsiyalar va tugmalar 17 ta ekran o'lchamida ishlaydi.
- [ ] 9-bo'limdagi tezlik maqsadlari mobilda bajarilgan.
- [ ] securityheaders.com A+, SSL Labs A+, ZAP yuqori/o'rta topilma 0.
- [ ] Bo'sh serverga tiklash mashqi 2 soatdan kam vaqtda o'tgan.
- [ ] Monitoring ogohlantirishlari sinab ko'rilgan.
- [ ] README, CLAUDE.md, INCIDENT.md, RESTORE.md yozilgan.

## 13. Bosqichlar (~8 hafta)

1. Tayyorgarlik: monorepo, `make dev` bilan lokal muhit ko'tariladi, CI yashil.
2. Backend yadrosi: data.js ma'lumoti bazada, ommaviy API, admin login + 2FA testlardan o'tgan.
3. Lead oqimi: staging'dan forma Telegramga keladi, spam filtri ishlaydi.
4. Admin panel: barcha modullar orqali kontent yaratish va nashr qilish mumkin.
5. Frontend: toza URLlar, statik generator, Lighthouse maqsadlari bajarilgan, vizual farq yo'q.
6. Xavfsizlik va deploy: 12-bo'lim ro'yxati to'liq belgilangan, prod'ga chiqarildi.

Har bosqich staging'da ko'rib chiqiladi. Shart bajarilgandagina keyingisiga o'tiladi.

## 14. Claude Code bilan ishlash tartibi

Har bosqich alohida branch'da bajariladi. Testlar yashil bo'lgandagina keyingisiga o'tiladi. Har bosqich oxirida: "Bu bosqichni TZ bilan solishtirib, bajarilmagan yoki TZ'dan chetga chiqqan joylarni ro'yxat qil."

Bosqich promptlari:
1. Monorepo tuzilmasi: frontend/, backend/ skeleti, infra/docker-compose.dev.yml, Makefile, .env.example, pre-commit (ruff, mypy, gitleaks). Avval reja.
2. 3-bo'lim: SQLAlchemy modellar, birinchi Alembic migratsiyasi, `scripts/seed_from_datajs.py`, testlar.
3. 4 va 8-bo'lim: ommaviy API va admin auth (argon2id, TOTP, cookie tokenlar, refresh rotation, CSRF, login rate limit); har bir xavfsizlik bandiga test.
4. 4-bo'lim: admin CRUD, media (R2, Pillow, EXIF), audit log.
5. 7-bo'lim: POST /leads, Turnstile, spam_score, ARQ orqali Telegram va email, inline tugmalar.
6. 6-bo'lim: admin/ React ilova: login va 2FA, Loyihalar, keyin qolgan modullar.
7. 5 va 9-bo'lim: Jinja2 generator, toza URLlar, hash redirect, Vite, Three.js tree-shaking, SEO va JSON-LD; Playwright skrinshotlari bilan solishtirish.
8. 10 va 11-bo'lim: prod compose, nginx, GitHub Actions, backup, monitoring.
9. 12-bo'lim: qabul mezonlarini birma-bir tekshirish va hisobot.
