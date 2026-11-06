from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import APIRouter, Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.api.deps import csrf_protect
from app.api.v1.admin import auth, leads, media, system
from app.api.v1.admin.content import routers as content_routers
from app.api.v1.public.routes import router as public_router
from app.core.config import get_settings
from app.core.db import dispose_engine
from app.core.errors import install_error_handlers
from app.core.logging import RequestContextMiddleware, setup_logging
from app.core.queue import close_pool
from app.core.redis import close_redis


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("X-Frame-Options", "DENY")
        if request.url.path.startswith("/api/v1/admin"):
            response.headers["Cache-Control"] = "no-store"
            response.headers["X-Robots-Tag"] = "noindex, nofollow"
        return response


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    yield
    await close_pool()
    await close_redis()
    await dispose_engine()


def create_app() -> FastAPI:
    s = get_settings()
    setup_logging()
    if s.sentry_dsn:
        import sentry_sdk

        sentry_sdk.init(dsn=s.sentry_dsn, traces_sample_rate=0.1, environment=s.env, send_default_pii=False)

    app = FastAPI(
        title="jamolxon.uz API",
        version="1.0.0",
        lifespan=lifespan,
        openapi_url="/api/v1/openapi.json" if s.openapi_enabled else None,
        docs_url="/api/v1/docs" if s.openapi_enabled else None,
        redoc_url=None,
    )
    install_error_handlers(app)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=s.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Content-Type", "X-CSRF-Token", "X-Request-ID"],
        expose_headers=["X-Request-ID", "Retry-After"],
        max_age=600,
    )
    app.add_middleware(RequestContextMiddleware)

    api = APIRouter(prefix="/api/v1")
    api.include_router(public_router)

    admin = APIRouter(prefix="/admin")
    admin.include_router(auth.router)  # login/2fa/refresh/logout work without CSRF (pre-session)
    protected = APIRouter(dependencies=[Depends(csrf_protect)])
    for r in content_routers:
        protected.include_router(r)
    protected.include_router(leads.router)
    protected.include_router(media.router)
    protected.include_router(system.router)
    admin.include_router(protected)
    api.include_router(admin)
    app.include_router(api)
    return app


app = create_app()
