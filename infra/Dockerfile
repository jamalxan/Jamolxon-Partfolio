# syntax=docker/dockerfile:1.7
# One build, three targets:
#   app  — FastAPI api + ARQ worker (python:3.12-slim, non-root), contains the built frontend assets
#   web  — nginx serving the generated site volume + the admin SPA
# Build: docker build -f infra/Dockerfile --target app -t jamolxon-app:<sha> .

# ---------- frontend (site) ----------
FROM node:22-alpine AS frontend
WORKDIR /src/frontend
COPY frontend/package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else echo "no package.json"; fi
COPY frontend/ ./
RUN if [ -f package.json ]; then npm run build; else mkdir -p dist; fi

# ---------- admin SPA ----------
FROM node:22-alpine AS admin
WORKDIR /src/admin
COPY admin/package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else echo "no admin yet"; fi
COPY admin/ ./
RUN if [ -f package.json ]; then npm run build; else mkdir -p dist && echo '<!doctype html><title>admin</title>' > dist/index.html; fi

# ---------- python deps ----------
FROM python:3.12-slim AS pydeps
COPY --from=ghcr.io/astral-sh/uv:0.9 /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PROJECT_ENVIRONMENT=/opt/venv
WORKDIR /app
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# ---------- app (api + worker) ----------
FROM python:3.12-slim AS app
RUN apt-get update && apt-get install -y --no-install-recommends libjpeg62-turbo libwebp7 libavif16 postgresql-client \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 10001 app && useradd --system --uid 10001 --gid app --home /app app
ENV PATH=/opt/venv/bin:$PATH PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 \
    FRONTEND_DIST=/app/frontend_dist SITE_OUT_DIR=/srv/site MEDIA_DIR=/srv/media
WORKDIR /app
COPY --from=pydeps /opt/venv /opt/venv
COPY backend/ ./
COPY --from=frontend /src/frontend/dist /app/frontend_dist
RUN mkdir -p /srv/site /srv/media && chown -R app:app /srv
USER app
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --retries=5 \
  CMD python -c "import urllib.request,sys;sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health',timeout=4).status==200 else 1)"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2", "--proxy-headers", "--forwarded-allow-ips", "*", "--no-server-header"]

# ---------- web (nginx) ----------
FROM nginx:1.27-alpine AS web
RUN rm /etc/nginx/conf.d/default.conf
COPY infra/nginx/nginx.conf /etc/nginx/nginx.conf
COPY infra/nginx/conf.d/ /etc/nginx/conf.d/
COPY --from=admin /src/admin/dist /usr/share/nginx/admin
HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD wget -q --spider http://127.0.0.1/nginx-health || exit 1
