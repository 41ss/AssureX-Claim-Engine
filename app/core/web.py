from fastapi.templating import Jinja2Templates

from app.core.config import ROOT

templates = Jinja2Templates(directory=ROOT / "frontend" / "templates")
