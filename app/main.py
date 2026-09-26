from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.core.config import ROOT
from app.core.db import init_db
from app.platform.routes import router as platform_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="AssureX Claim Engine", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=ROOT / "frontend" / "static"), name="static")
app.include_router(platform_router)
