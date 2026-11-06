# jamolxon.uz

Jamolxonning portfolio sayti va uni boshqaradigan tizim: oldindan render qilingan statik sayt, FastAPI backend, React admin panel, lidlar oqimi (Telegram + email), avtomatik deploy va zaxira.

Texnik topshiriq: [docs/TZ.md](docs/TZ.md) · API: [docs/API.md](docs/API.md) · DNS: [docs/CLOUDFLARE.md](docs/CLOUDFLARE.md)

## Tuzilma
```
frontend/   sayt manbasi (Vite, vanilla JS, 3D beyjik). Dizayn shu yerda.
backend/    FastAPI API, ARQ worker, Alembic migratsiyalar, Jinja2 render (app/render)
admin/      React 18 + TS admin panel (admin.jamolxon.uz)
infra/      Dockerfile, compose, nginx, deploy/backup/restore skriptlari, INCIDENT.md, RESTORE.md
docs/       TZ, API kontrakti, Cloudflare qo'llanmasi
```

## Ishga tushirish (lokal)
Talab: Docker, Python 3.12 + [uv](https://docs.astral.sh/uv/), Node 22.
```bash
cp .env.example backend/.env        # maxfiy qiymatlarni to'ldiring
make up migrate seed                # postgres + redis, sxema, data.js kontenti
make owner EMAIL=siz@jamolxon.uz    # owner hisobi (parol so'raladi)
make dev                            # api :8000, worker, sayt :5173, admin :5174
```
Windows: `winget install ezwinports.make`, buyruqlarni Git Bash'da ishlating. Admin'ni backendsiz ko'rish: `cd admin && npm run dev:mock`.

## Tekshiruvlar
`make lint` (ruff, mypy --strict, eslint, tsc) · `make test` (pytest ≥80% qamrov, render, JS budjet, Playwright smoke, vitest).

## Deploy
- `main` ga push → CI → **staging** (staging.jamolxon.uz) avtomatik.
- `v*` teg → CI → `production` environment tasdig'i → **jamolxon.uz**.
- Serverda: backup → build → migratsiya → yangi konteynerlar → health/smoke → xato bo'lsa avtomatik orqaga qaytish, Telegram xabari.
- Server umumiy: faqat `jamolxon` / `jamolxon-staging` compose loyihalari va `/opt/jamolxon` ishlatiladi.

Hodisalar: [infra/INCIDENT.md](infra/INCIDENT.md) · Tiklash: [infra/RESTORE.md](infra/RESTORE.md)
