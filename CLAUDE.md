# jamolxon.uz

TZ: docs/TZ.md. Har qanday qaror shu TZ'ga mos bo'lsin. TZ'ning 0-bo'limi (qabul qilingan chetlanishlar) ustun turadi.

## Stek
FastAPI + SQLAlchemy 2 async + Alembic + PostgreSQL 16 + Redis 7 + ARQ.
Admin: React 18 + TS + Vite + TanStack Query + shadcn/ui. Sayt: vanilla JS + Vite, HTML Jinja2 bilan oldindan render qilinadi.

## Tuzilma
- `frontend/` — sayt manbasi (assets/, Vite). Dizayn shu yerda.
- `backend/app/render/` — Jinja2 shablonlar va statik generator (`render_site`).
- `backend/` — API va ARQ worker. `backend/seed/content.json` — data.js'dan eksport (`node scripts/export_datajs.mjs`).
- `admin/` — React admin panel.
- `infra/` — compose, nginx, deploy va backup skriptlari, INCIDENT.md, RESTORE.md.
- `docs/API.md` — API kontrakti (admin panel shunga tayanadi).

## Qoidalar
- Sayt dizayni, animatsiyalar va beyjikni (frontend/assets/js/lanyard.js) o'zgartirma.
- Har bir yangi endpoint: Pydantic sxema + rol tekshiruvi + test.
- Maxfiy kalitlarni kodga yozma; faqat .env orqali, .env.example yangila.
- Migratsiyalar faqat Alembic orqali, orqaga mos.
- Commit oldidan: ruff, mypy, pytest yashil bo'lsin.
- Foydalanuvchiga ko'rinadigan matnlar o'zbek tilida (lotin).
- Server umumiy (socialauto, vocably, ainews ham bor): faqat `jamolxon*` compose loyihalari va `/opt/jamolxon*`, `/srv/jamolxon*` ga tegiladi.

## Buyruqlar
make dev | make test | make lint | make migrate | make seed | make build
Windows: make yo'q bo'lsa `winget install ezwinports.make`, keyin Git Bash'da ishlating.
