"""HTML pages. Each page is a Jinja template whose JavaScript loads its data from /api."""
from fastapi import APIRouter, Request

from src.core.web import templates

router = APIRouter()

PAGES = {
    "/": "index.html",
    "/login": "login.html",
    "/dashboard": "dashboard.html",
    "/claims": "claims.html",
    "/new-claim": "new-claim.html",
    "/claim-details": "claim-details.html",
    "/products": "products.html",
    "/reports": "reports.html",
    "/settings": "settings.html",
    "/admin-dashboard": "admin-dashboard.html",
    "/admin-review": "admin-review.html",
}


def make_page(template_name: str):
    def page(request: Request):
        return templates.TemplateResponse(request, template_name)
    page.__name__ = "page_" + template_name.replace(".html", "").replace("-", "_")
    return page


for path, template in PAGES.items():
    router.add_api_route(path, make_page(template), methods=["GET"], include_in_schema=False)
