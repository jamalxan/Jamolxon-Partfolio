"""JSON logs with request_id; secrets, emails and phone numbers are masked (TZ 11)."""

import json
import logging
import re
import sys
import time
import uuid
from contextvars import ContextVar
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)
user_id_var: ContextVar[str | None] = ContextVar("user_id", default=None)

_EMAIL = re.compile(r"([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})")
_PHONE = re.compile(r"\+?\d[\d\s-]{7,}(\d{2})")
_SECRET = re.compile(r"(?i)(password|token|secret|authorization|cookie)(\"?\s*[:=]\s*\"?)[^\s\",]+")


def mask(text: str) -> str:
    text = _SECRET.sub(r"\1\2***", text)
    text = _EMAIL.sub(r"\1***@\2", text)
    return _PHONE.sub(r"***\1", text)


class JsonFormatter(logging.Formatter):
    RESERVED = set(vars(logging.makeLogRecord({})).keys()) | {"message", "asctime"}

    def format(self, record: logging.LogRecord) -> str:
        data: dict[str, Any] = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(record.created)) + "Z",
            "level": record.levelname.lower(),
            "logger": record.name,
            "message": mask(record.getMessage()),
            "request_id": request_id_var.get(),
            "user_id": user_id_var.get(),
        }
        for k, v in vars(record).items():
            if k not in self.RESERVED and not k.startswith("_"):
                data[k] = mask(v) if isinstance(v, str) else v
        if record.exc_info:
            data["exc"] = mask(self.formatException(record.exc_info))
        return json.dumps(data, ensure_ascii=False, default=str)


def setup_logging(level: str = "INFO") -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(level)
    logging.getLogger("uvicorn.access").disabled = True


_RID = re.compile(r"^[A-Za-z0-9-]{8,64}$")


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        incoming = request.headers.get("x-request-id", "")
        rid = incoming if _RID.match(incoming) else uuid.uuid4().hex
        request.state.request_id = rid
        token = request_id_var.set(rid)
        start = time.perf_counter()
        status = 500
        try:
            response = await call_next(request)
            status = response.status_code
            response.headers["X-Request-ID"] = rid
            return response
        finally:
            logging.getLogger("app.access").info(
                "request", extra={"path": request.url.path, "method": request.method, "status": status,
                                  "duration_ms": round((time.perf_counter() - start) * 1000, 1)})
            request_id_var.reset(token)
            user_id_var.set(None)
