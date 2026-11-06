# jamolxon.uz — admin panel

`admin.jamolxon.uz` da ishlaydigan React ilova (TZ 6-bo'lim). Faqat `docs/API.md` kontraktiga tayanadi.

**Stek:** React 18 + TypeScript (strict) + Vite, TanStack Query, React Router, React Hook Form + Zod,
shadcn/ui (Tailwind, komponentlar `src/components/ui` da), lucide, @dnd-kit, marked + DOMPurify,
vitest + Testing Library + MSW.

## Buyruqlar

```bash
cd admin
npm ci                 # bog'liqliklar
npm run dev            # http://localhost:5174, /api -> VITE_PROXY_TARGET (default http://localhost:8000)
npm run dev:mock       # backendsiz: MSW soxta API bilan (brauzerda)
npm run lint           # ESLint (typescript-eslint), ogohlantirishlar ham xato
npm run typecheck      # tsc --noEmit
npm test -- --run      # vitest (bir marta); `npm test` — watch rejimi
npm run build          # admin/dist/ (base `/`)
npm run preview        # dist'ni lokal ko'rish
```

### Soxta API bilan kirish (`npm run dev:mock`)

| Email | Rol | Izoh |
| --- | --- | --- |
| `owner@jamolxon.uz` | owner | 2FA yoqilgan |
| `editor@jamolxon.uz` | editor | 2FA yoqilgan |
| `yangi@jamolxon.uz` | owner | 2FA hali yoqilmagan → QR + zaxira kodlar oqimi |
| `locked@jamolxon.uz` | — | 423 (blok) xabarini ko'rish |
| `ratelimit@jamolxon.uz` | — | 429 (Retry-After) xabarini ko'rish |

Parol: `parol-namuna-123`, 2FA kodi: `123456`, zaxira kod: `abcd-1234`.
Ma'lumotlar xotirada saqlanadi, sahifa yangilansa tiklanadi.

## Sozlash (`.env`)

| O'zgaruvchi | Default | Vazifasi |
| --- | --- | --- |
| `VITE_API_BASE` | `/api/v1/admin` | Admin API bazasi |
| `VITE_SITE_URL` | `https://jamolxon.uz` | Google preview va havolalar |
| `VITE_PROXY_TARGET` | `http://localhost:8000` | Faqat `npm run dev` uchun proksi |
| `VITE_USE_MOCKS` | — | `.env.mock` da `true` (faqat dev) |

## Tuzilma

```
src/
  lib/api.ts            fetch klient: credentials include, X-CSRF-Token (jx_csrf), 401 → bitta refresh → retry, RFC 9457
  lib/schemas.ts        Zod sxemalar (backend Pydantic qoidalari bilan bir xil)
  lib/form-errors.ts    422 errors[].field → forma maydonlari
  lib/resources.ts      TanStack Query CRUD hooklari (list/detail/save/publish/reorder/preview)
  auth/                 AuthProvider (/auth/me), RequireAuth, RequireOwner
  components/ui/        shadcn uslubidagi komponentlar
  components/editor/    useEntityEditor (avtosaqlash, 409, Ctrl+S, nashr), toolbar, SEO + Google preview
  components/form/      ro'yxat, bo'lim, juftlik, teg muharrirlari, Markdown muharriri
  components/layout/    sidebar (yig'iladigan / mobil drawer), Ctrl+K qidiruv
  pages/                Dashboard, Loyihalar, Xizmatlar, Blog, Kategoriyalar, Teglar, AI yechimlar,
                        Jarayon, Leadlar (Kanban + jadval), Media, Sozlamalar, Foydalanuvchilar, Audit, Profil
  mocks/                MSW handlerlari (docs/API.md bo'yicha) va seed ma'lumotlar
```

## Xavfsizlik eslatmalari

- Tokenlar faqat HttpOnly cookie'da; JS faqat `jx_csrf` ni o'qiydi. localStorage'da faqat forma qoralamalari
  (`jx-admin:draft:*`) va sidebar holati saqlanadi.
- Markdown preview DOMPurify bilan tozalanadi; sayt uchun HTML'ni server (nh3) generatsiya qiladi.
- CSP (TZ 8) bilan mos: inline script yo'q, shriftlar `@fontsource` orqali o'zimizda, rasm preview `data:` URL.
- Rol cheklovlari UI'da (menyu, marshrut, tugmalar) va API'da (403) — API asosiy himoya.
