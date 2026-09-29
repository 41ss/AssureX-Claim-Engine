"""AssureX Claim Engine web application. Run: uvicorn src.main:app"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from src.core.config import SECRET_KEY, STATIC_DIR, UPLOAD_DIR
from src.core.db import init_db
from src.ml import predict as python_model
from src.platform import admin, auth, claims, dashboard, pages, products
from src.teachable import predict as teachable_model

log = logging.getLogger("assurex")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    UPLOAD_DIR.mkdir(exist_ok=True)
    # Load both models once at startup, so a claim is not slowed by loading TensorFlow (SRS 1.7: 5 seconds).
    try:
        python_model.get_model()
        teachable_model.get_model()
    except Exception:
        log.exception("A model failed to load; claims will show a friendly error until it is fixed.")
    yield


app = FastAPI(title="AssureX Claim Engine", lifespan=lifespan)
# Signed cookie holding the logged-in user's id; httponly by default, so page scripts can't read it.
app.add_middleware(SessionMiddleware, secret_key=SECRET_KEY, same_site="lax", max_age=8 * 3600)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

for module in (auth, products, claims, admin, dashboard):
    app.include_router(module.router, prefix="/api")
app.include_router(pages.router)


@app.exception_handler(RequestValidationError)
async def invalid_request(request: Request, exc: RequestValidationError):
    """A missing or wrongly typed field: say which one, without technical detail (SRS xlix)."""
    fields = ", ".join(str(err["loc"][-1]) for err in exc.errors())
    return JSONResponse(status_code=400, content={"detail": f"Please check these fields: {fields}."})


@app.exception_handler(Exception)
async def unexpected_error(request: Request, exc: Exception):
    """Anything unexpected is logged on the server; the user gets a plain message (SRS xlix)."""
    log.exception("Unhandled error on %s", request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Something went wrong on our side. Please try again."})
