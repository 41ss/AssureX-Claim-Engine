"""
preview_app.py — a minimal Flask server for previewing the frontend
templates on their own, before the real application routes exist in
src/core/web.py.

This is a FRONTEND-DEVELOPMENT CONVENIENCE ONLY. It renders each
template with no backend logic behind it — every page still runs in
the browser against mock data via static/js/services/api.js.

When the platform/core teammate wires up the real src/core/web.py,
these same template names and routes should move there (see the
"Suggested Flask routes" table in README.md) and this file can be
deleted.

Run:
    pip install flask
    python preview_app.py
Then open http://127.0.0.1:5000/
"""
from flask import Flask, render_template

app = Flask(__name__)

# One clean route per template — mirrors the multi-page structure
# described in README.md. Each template only renders HTML; all data
# comes from static/js/mock/*.js in the browser.
PAGES = {
    "/": "index.html",
    "/login": "login.html",
    "/dashboard": "dashboard.html",
    "/claims": "claims.html",
    "/new-claim": "new-claim.html",
    "/claim-details": "claim-details.html",
    "/products": "products.html",
    "/reports": "reports.html",
    "/admin-dashboard": "admin-dashboard.html",
    "/admin-review": "admin-review.html",
    "/settings": "settings.html",
}


def make_view(template_name):
    def view():
        return render_template(template_name)
    view.__name__ = f"view_{template_name.replace('.', '_').replace('-', '_')}"
    return view


for route, template in PAGES.items():
    app.add_url_rule(route, view_func=make_view(template))


if __name__ == "__main__":
    app.run(debug=True)
