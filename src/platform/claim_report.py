"""Downloadable claim report as a PDF (SRS xliv), built with fpdf2 from the same data
the claim page shows."""
from pathlib import Path

from fpdf import FPDF


def _text(value) -> str:
    """The built-in PDF fonts only cover Latin-1, so replace the few characters outside it."""
    text = "" if value is None else str(value)
    for a, b in (("—", "-"), ("–", "-"), ("−", "-"), ("’", "'"), ("“", '"'), ("”", '"'), ("…", "...")):
        text = text.replace(a, b)
    return text.encode("latin-1", "replace").decode("latin-1")


class ClaimPdf(FPDF):
    def header(self):
        self.set_font("Helvetica", "B", 14)
        self.cell(0, 8, "AssureX Claim Engine - Claim Report", new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(180, 180, 180)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(3)

    def footer(self):
        self.set_y(-12)
        self.set_font("Helvetica", "", 8)
        self.cell(0, 6, f"Page {self.page_no()}", align="C")

    def section(self, title: str):
        self.ln(2)
        self.set_font("Helvetica", "B", 11)
        self.set_fill_color(230, 238, 234)
        self.cell(0, 7, _text(title), fill=True, new_x="LMARGIN", new_y="NEXT")
        self.set_font("Helvetica", "", 9)

    def row(self, label: str, value):
        self.set_font("Helvetica", "B", 9)
        self.cell(52, 5.5, _text(label))
        self.set_font("Helvetica", "", 9)
        self.multi_cell(0, 5.5, _text(value), new_x="LMARGIN", new_y="NEXT")

    def bullets(self, items: list[str], empty: str = "None"):
        for item in items or [empty]:
            self.multi_cell(0, 5, _text(f"- {item}"), new_x="LMARGIN", new_y="NEXT")


def build_claim_pdf(claim: dict, card_path: str = "") -> bytes:
    pdf = ClaimPdf()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    p, w, d, a = claim["product"], claim["warranty"], claim["decision"], claim["analysis"]

    pdf.section("Claim details")
    pdf.row("Claim ID", claim["id"])
    pdf.row("Status", claim["stage"])
    pdf.row("Claimant", f"{claim['claimant']} ({claim['userId']})")
    pdf.row("Product", f"{p['name']} ({p['id']}), {p['brand']} {p['model']}")
    pdf.row("Serial number", f"product {p['serialNumber']}, claim {claim['serialNumber'] or '-'}")
    pdf.row("Fault", f"{claim['faultType']} on {claim['incidentDate']} - {claim['damageLabel']}")
    pdf.row("Description", claim["description"])
    pdf.row("Previous repairs", f"{claim['repairCount']} ({claim['unauthorizedRepairs']} unauthorised)")
    pdf.row("Submitted", claim["submittedAt"] or "not yet")

    pdf.section("Warranty status")
    pdf.row("Provider", w["provider"])
    pdf.row("Period", f"{w['start']} to {w['expiry']}")
    pdf.row("Status", f"{w['status']} ({w['daysLeft']} days {'left' if w['daysLeft'] >= 0 else 'past expiry'})")
    if w.get("extended"):
        pdf.row("Extended warranty", f"{w['extended']['provider']} to {w['extended']['expiry']}")

    pdf.section("Uploaded evidence")
    pdf.bullets([f"{doc['typeLabel']}: {doc['name']}" + (f" (same file as on {doc['duplicateOf']})" if doc["duplicateOf"] else "")
                 for doc in claim["documents"]], "No documents uploaded")

    pdf.section("Model results")
    if a:
        for label, m in (("Python model", a["modelOne"]), ("Teachable Machine", a["modelTwo"])):
            c = m["confidence"]
            pdf.row(f"{label} ({m['version']})",
                    f"{m['prediction']} - Valid {c['valid']:.1%}, Invalid {c['invalid']:.1%}, Manual Review {c['review']:.1%}")
        pdf.row("Classes match", "Yes" if a["classesMatch"] else "No")
        pdf.row("Confidence difference", f"{a['confidenceDifference']:.1%}")
        pdf.row("Model consistency", a["consistency"])
    else:
        pdf.multi_cell(0, 5, "Not evaluated yet.", new_x="LMARGIN", new_y="NEXT")

    pdf.section("Warranty rule validation")
    pdf.bullets([f"{'PASS' if r['passed'] else 'FAIL'} - {r['message']}" for r in d["rules"]], "Not evaluated yet")
    pdf.section("Contradictions")
    pdf.bullets(d["contradictions"])
    if d.get("duplicateWarning"):
        pdf.section("Duplicate indicators")
        pdf.bullets([d["duplicateWarning"]["reason"]])

    pdf.section("Final recommendation")
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 7, _text(d["result"] or "Not evaluated yet"), new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 9)
    pdf.multi_cell(0, 5, _text(d["explanation"]), new_x="LMARGIN", new_y="NEXT")
    if claim.get("summary"):
        pdf.ln(1)
        pdf.multi_cell(0, 5, _text("Summary: " + claim["summary"]), new_x="LMARGIN", new_y="NEXT")

    pdf.section("Reviewer comments")
    pdf.bullets([f"{r['timestamp'][:16].replace('T', ' ')} {r['reviewer']} ({r['action']}): {r['comment'] or 'no comment'}"
                 for r in claim["reviews"]], "No reviewer actions yet")

    if card_path and Path(card_path).exists():
        pdf.add_page()
        pdf.section("Claim Summary Card (input to the Teachable Machine model)")
        pdf.image(card_path, w=110)
    return bytes(pdf.output())
