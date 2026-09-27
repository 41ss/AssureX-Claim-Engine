"""Pages and forms for accounts, products, warranties, documents and claims. Owner: Adan."""
from fastapi import APIRouter, Request

from src.core.web import templates

router = APIRouter()


@router.get("/")
def home(request: Request):
    return templates.TemplateResponse(request, "index.html")
