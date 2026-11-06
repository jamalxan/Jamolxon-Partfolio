"""RFC 9457 Problem Details. Internal error text is never shown to the user (TZ 4)."""

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("app.errors")

TITLES: dict[str, str] = {
    "validation_error": "Ma'lumot noto'g'ri",
    "not_found": "Topilmadi",
    "unauthorized": "Avtorizatsiya kerak",
    "forbidden": "Ruxsat yo'q",
    "csrf_failed": "CSRF tekshiruvi o'tmadi",
    "conflict": "Bu yozuv o'zgargan, yangilang",
    "rate_limited": "Juda ko'p so'rov, birozdan keyin urinib ko'ring",
    "locked": "Kirish vaqtincha bloklangan",
    "payload_too_large": "Fayl juda katta",
    "unsupported_media": "Bu turdagi fayl qabul qilinmaydi",
    "bad_request": "Noto'g'ri so'rov",
    "internal_error": "Ichki xato",
}
STATUS_TYPES = {400: "bad_request", 401: "unauthorized", 403: "forbidden", 404: "not_found", 405: "bad_request",
                409: "conflict", 413: "payload_too_large", 415: "unsupported_media", 422: "validation_error",
                423: "locked", 429: "rate_limited"}


class Problem(Exception):
    def __init__(self, status: int, type_: str, title: str | None = None, *,
                 errors: list[dict[str, str]] | None = None, headers: dict[str, str] | None = None,
                 detail: str | None = None) -> None:
        self.status = status
        self.type = type_
        self.title = title or TITLES.get(type_, type_)
        self.errors = errors
        self.headers = headers
        self.detail = detail


def not_found() -> Problem:
    return Problem(404, "not_found")


def forbidden() -> Problem:
    return Problem(403, "forbidden")


def field_error(field: str, msg: str) -> Problem:
    return Problem(422, "validation_error", errors=[{"field": field, "msg": msg}])


def _body(request: Request, status: int, type_: str, title: str, errors: list[dict[str, str]] | None = None,
          detail: str | None = None) -> dict[str, Any]:
    body: dict[str, Any] = {"type": type_, "title": title, "status": status,
                            "request_id": getattr(request.state, "request_id", None)}
    if errors:
        body["errors"] = errors
    if detail:
        body["detail"] = detail
    return body


def problem_response(request: Request, p: Problem) -> JSONResponse:
    return JSONResponse(_body(request, p.status, p.type, p.title, p.errors, p.detail), status_code=p.status,
                        headers=p.headers, media_type="application/problem+json")


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(Problem)
    async def _problem(request: Request, exc: Problem) -> JSONResponse:
        return problem_response(request, exc)

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError) -> JSONResponse:
        errors = []
        for e in exc.errors():
            loc = [str(x) for x in e.get("loc", ()) if x not in ("body", "query", "path")]
            errors.append({"field": ".".join(loc) or "body", "msg": str(e.get("msg", "")).removeprefix("Value error, ")})
        return problem_response(request, Problem(422, "validation_error", errors=errors))

    @app.exception_handler(StarletteHTTPException)
    async def _http(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        type_ = STATUS_TYPES.get(exc.status_code, "bad_request")
        return problem_response(request, Problem(exc.status_code, type_, headers=getattr(exc, "headers", None)))

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        log.exception("unhandled error", extra={"path": request.url.path})
        return problem_response(request, Problem(500, "internal_error"))
