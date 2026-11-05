# API kontrakti (v1)

Manba: TZ 4-bo'lim. Backend shu hujjatga mos ishlaydi; admin panel faqat shu hujjatga tayanadi.
Barcha yo'llar `/api/v1` ostida, JSON, UTF-8. Har bir javobda `X-Request-ID` header bor.

## Umumiy formatlar

- **ID'lar:** UUID v7, satr ko'rinishida.
- **Vaqt:** ISO 8601, UTC (`2026-11-06T10:00:00Z`).
- **Ro'yxat:** `{"items": [...], "total": 42, "page": 1, "limit": 12}`. Query: `page` (1 dan), `limit` (1–50, default 12).
- **Xato** (RFC 9457, `Content-Type: application/problem+json`):
  ```json
  {"type": "validation_error", "title": "Ma'lumot noto'g'ri", "status": 422,
   "errors": [{"field": "contact_value", "msg": "..."}], "request_id": "..."}
  ```
  `type` qiymatlari: `validation_error` (422), `not_found` (404), `unauthorized` (401), `forbidden` (403), `csrf_failed` (403), `conflict` (409, optimistik qulf), `rate_limited` (429, `Retry-After` header bilan), `locked` (423, login bloki), `payload_too_large` (413), `unsupported_media` (415), `internal_error` (500).
- **Kontent statusi:** `draft` | `published` | `archived`.

## Ommaviy endpointlar (autentifikatsiyasiz)

Hammasi faqat `published` va o'chirilmagan yozuvlarni qaytaradi. Javobda `ETag` va `Cache-Control: public, max-age=60, stale-while-revalidate=600` bor.

| Metod | Yo'l | Javob |
| --- | --- | --- |
| GET | `/health` | `{"status":"ok"}` |
| GET | `/ready` | `{"status":"ok","checks":{"db":"ok","redis":"ok"}}` yoki 503 |
| GET | `/projects?category=&featured=&page=&limit=` | Ro'yxat, `ProjectCard` |
| GET | `/projects/{slug}` | `ProjectPublic` |
| GET | `/services` | `{"items": [ServicePublic]}` |
| GET | `/services/{slug}` | `ServicePublic` |
| GET | `/posts?tag=&q=&page=&limit=` | Ro'yxat, `PostCard` |
| GET | `/posts/{slug}` | `PostPublic` |
| GET | `/site` | `SitePublic` |
| POST | `/leads` | 201 `{"id": "...", "message": "Rahmat, 2 soat ichida bog'lanaman"}` |

`POST /leads` JSON qabul qiladi. JS'siz forma uchun `application/x-www-form-urlencoded` ham qabul qilinadi: muvaffaqiyatda `303 → /taklif?yuborildi=1`, xatoda `303 → /taklif?xato=1`.

**LeadCreate:**
```json
{"name": "Aziz", "contact_type": "telegram", "contact_value": "@aziz_k",
 "service": "crm-erp", "budget_range": "1000-3000", "deadline": "1_oy",
 "message": "...", "consent": true, "source_page": "/xizmatlar/crm-erp",
 "utm": {"utm_source": "instagram"}, "website": "", "elapsed_ms": 12000,
 "turnstile_token": "..."}
```
- `contact_type`: `email` | `telegram` | `phone`.
- `service`: xizmat slug'i yoki `boshqa`.
- `budget_range`: `<500` | `500-1000` | `1000-3000` | `3000-10000` | `10000+` | `aniq_emas`.
- `deadline`: `shoshilinch` | `1_oy` | `3_oy` | `aniq_emas`.
- `website`: honeypot, bo'sh bo'lishi kerak.
- `elapsed_ms`: forma ochilgandan beri o'tgan vaqt.

## Admin endpointlar (`/api/v1/admin`)

### Sessiya va CSRF

- Login muvaffaqiyatli bo'lgach server quyidagi cookie'larni qo'yadi:
  - `jx_access`: HttpOnly, 15 daqiqa, Path=/api/v1/admin.
  - `jx_refresh`: HttpOnly, 7 kun, Path=/api/v1/admin/auth.
  - `jx_csrf`: JS o'qiy oladi, Path=/.
- Barcha o'zgartiruvchi so'rovlarda (POST/PUT/PATCH/DELETE) `X-CSRF-Token: <jx_csrf qiymati>` header bo'lishi shart. `/auth/login` va `/auth/2fa/verify` bundan mustasno: ular `jx_pre` cookie bilan ishlaydi.
- 401 kelsa, admin bir marta `POST /auth/refresh` chaqiradi va so'rovni takrorlaydi. Refresh ham 401 bersa, login sahifasiga o'tadi.
- Barcha cookie'lar `Secure; SameSite=Strict`. Lokal ishlashda `COOKIE_SECURE=false`.

### Auth

| Metod | Yo'l | Body | Javob |
| --- | --- | --- | --- |
| POST | `/auth/login` | `{"email","password"}` | `{"status":"2fa_required"}` yoki `{"status":"2fa_setup_required"}`; `jx_pre` cookie (5 daqiqa) qo'yiladi |
| POST | `/auth/2fa/setup` | — (`jx_pre` kerak, faqat 2FA hali yoqilmagan bo'lsa) | `{"secret":"BASE32","otpauth_url":"otpauth://..."}` |
| POST | `/auth/2fa/verify` | `{"code":"123456"}` yoki `{"backup_code":"xxxx-xxxx"}` | `{"user": User, "backup_codes": [..] \| null}`. `backup_codes` faqat 2FA birinchi marta yoqilganda (10 ta) qaytadi. Sessiya cookie'lari qo'yiladi |
| POST | `/auth/refresh` | — | `{"user": User}`, cookie'lar yangilanadi (rotation) |
| POST | `/auth/logout` | — | 204 |
| GET | `/auth/me` | — | `User` |
| POST | `/auth/password` | `{"current_password","new_password"}` | 204 |

`User`: `{"id","email","name","role":"owner"|"editor","is_active","last_login_at","totp_enabled"}`

### Kontent CRUD

Resurslar: `projects`, `services`, `posts`, `categories`, `tags`, `offers`, `steps`.

| Metod | Yo'l | Izoh |
| --- | --- | --- |
| GET | `/{res}?q=&status=&page=&limit=` | Ro'yxat (o'chirilganlarsiz), `sort_order` bo'yicha |
| POST | `/{res}` | Yaratish → 201, `status: draft` |
| GET | `/{res}/{id}` | To'liq yozuv |
| PATCH | `/{res}/{id}` | Qisman yangilash. Body'da `updated_at` majburiy; u bazadagidan farq qilsa 409 `conflict` qaytadi |
| DELETE | `/{res}/{id}` | Soft delete → 204 |
| POST | `/{res}/{id}/publish` | `{"status":"published"\|"draft"\|"archived","published_at":null\|iso}` |
| POST | `/{res}/reorder` | `{"ids":[...]}` → 204 |
| POST | `/{res}/{id}/preview` | `{"url":"https://jamolxon.uz/preview/<token>"}`, token 1 soat amal qiladi |

`categories`, `tags`, `offers`, `steps` da `publish` va `preview` yo'q. Ular uchun `status` maydoni ham yo'q.

**Project:**
```json
{"id","slug","title","subtitle","category":"prod|pm|own|sale","url","year","role",
 "stack":["FastAPI"],"summary","sections":[{"h":"Muammo","p":["..."]}],
 "results":["..."],"links":[{"label","url"}],"illo":"dashboard","image":null|"url",
 "cover_id":null,"gallery":[{"media_id","caption"}],"seo_title","seo_description",
 "is_featured":false,"status","published_at","sort_order","created_at","updated_at"}
```

**Service:**
```json
{"id","slug","title","icon","illo","short","who":["..."],"includes":["..."],
 "process":["..."],"examples":["project-slug"],"stack":["..."],"timeline",
 "faq":[["savol","javob"]],"price_from":null|"string","duration":null|"string",
 "seo_title","seo_description","status","published_at","sort_order","created_at","updated_at"}
```

**Post:**
```json
{"id","slug","title","excerpt","body_md","body_html","tags":["AI"],"cover_id",
 "reading_min","seo_title","seo_description","status","published_at","sort_order",
 "created_at","updated_at"}
```
`body_html` faqat o'qish uchun: server `body_md` dan generatsiya qiladi. `reading_min` avtomatik hisoblanadi. Kelajakdagi `published_at` bilan nashr qilingan post worker tomonidan o'sha vaqtda chiqariladi.

**Qolgan resurslar:**
- **Category:** `{"id","slug","title","short","badge","dot","description","color","sort_order"}`
- **Tag:** `{"id","slug","title"}`
- **Offer:** `{"id","key","title","icon","problem","solution","examples":[["SocialAuto","socialauto"]],"sort_order"}`
- **Step:** `{"id","title","text","get","sort_order"}`

### Media

| Metod | Yo'l | Izoh |
| --- | --- | --- |
| POST | `/media` | multipart, `file` va `alt` (majburiy), 10 MB gacha. JPEG/PNG/WebP/AVIF/PDF |
| GET | `/media?q=&page=&limit=` | Ro'yxat |
| PATCH | `/media/{id}` | `{"alt"}` |
| DELETE | `/media/{id}` | Ishlatilayotgan bo'lsa 409 |

**Media:** `{"id","url","original_name","mime","size_bytes","width","height","variants":{"webp":{"960":"url"}},"alt","blurhash":null,"used_in":[{"entity","id","title"}],"created_at"}`

### Leadlar

| Metod | Yo'l | Izoh |
| --- | --- | --- |
| GET | `/leads?status=&q=&from=&to=&page=&limit=` | Ro'yxat |
| GET | `/leads/{id}` | Lead + `events` |
| PATCH | `/leads/{id}` | `{"status","assigned_to"}`. Faqat owner |
| POST | `/leads/{id}/events` | `{"kind":"note"\|"call","payload":{"text"}}`. Owner va editor |
| GET | `/leads/export.csv` | CSV. Faqat owner |

Lead statuslari: `new` (Yangi) | `contacted` (Aloqada) | `proposal_sent` (Taklif yuborildi) | `won` (Kelishildi) | `lost` (Rad etildi) | `spam`.

**Lead:** `{"id","number","name","contact_type","contact_value","service","budget_range","deadline","message","status","source_page","utm","spam_score","assigned_to","created_at","updated_at","events":[{"id","kind","actor":{"id","email"}|null,"payload","created_at"}]}`

### Tizim

| Metod | Yo'l | Kim | Javob |
| --- | --- | --- | --- |
| GET | `/dashboard` | owner, editor | `{"leads":{"today","week","month"},"new_leads":[Lead],"recent_publications":[{"entity","id","title","published_at"}],"system":{"last_backup_at","errors_24h","worker_ok"}}` |
| GET / PUT | `/settings` | owner | `{"contact":{...CONTACT},"social":{},"seo":{"title","description","og_image"},"telegram":{"chat_id"}}` |
| GET / POST / PATCH | `/users`, `/users/{id}` | owner | `User`. POST: `{"email","name","role","password"}`. PATCH: `{"role","is_active","revoke_sessions":true}` |
| GET | `/audit-logs?entity=&actor_id=&page=` | owner | `{"id","actor","action","entity","entity_id","diff","ip","created_at"}` |
| GET / POST / DELETE | `/redirects` | owner | `{"id","from_path","to_path","code"}` |
| POST | `/site/rebuild` | owner | 202 `{"job_id"}` |

Editor sozlama, foydalanuvchi, audit, redirect va rebuild endpointlariga kirsa 403 oladi.
