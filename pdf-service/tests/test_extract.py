import io

import pdfplumber
from fastapi.testclient import TestClient
from reportlab.pdfgen import canvas

from pdf_service.api.routes import extract_rows
from pdf_service.main import app

client = TestClient(app)


def make_pdf(rows: list[tuple[str, str, str]]) -> bytes:
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=(612, 792))
    pdf.setFont("Helvetica", 10)
    y = 750
    for date, description, amount in rows:
        pdf.drawString(72, y, date)
        pdf.drawString(180, y, description)
        pdf.drawString(360, y, amount)
        y -= 14
    pdf.showPage()
    pdf.save()
    return buffer.getvalue()


STATEMENT_ROWS = [
    ("Date", "Description", "Amount"),
    ("01/05/2024", "Coffee Shop", "-5.50"),
    ("01/06/2024", "Paycheck", "+3000.00"),
]


def test_extract_returns_headers_and_rows():
    result = extract_rows(make_pdf(STATEMENT_ROWS))
    assert result["hasHeader"] is True
    assert result["pageCount"] == 1
    assert "date" in " ".join(result["headers"]).lower()
    assert result["rows"] == [
        ["01/05/2024", "Coffee Shop", "-5.50"],
        ["01/06/2024", "Paycheck", "+3000.00"],
    ]


def test_extract_keeps_multiword_cells_in_one_column():
    result = extract_rows(
        make_pdf([("01/05/2024", "AMAZON.COM MKTPLACE", "-24.99")])
    )
    assert result["rows"] == [["01/05/2024", "AMAZON.COM MKTPLACE", "-24.99"]]


def test_extract_without_header_treats_rows_as_data():
    result = extract_rows(make_pdf([("01/05/2024", "Coffee", "-5.50")]))
    assert result["hasHeader"] is False
    assert result["rows"][0][0] == "01/05/2024"


def test_extract_rejects_non_pdf_uploads():
    response = client.post(
        "/extract",
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )
    assert response.status_code == 422


def test_extract_reports_no_tabular_data_for_empty_pdf():
    response = client.post(
        "/extract",
        files={"file": ("blank.pdf", make_pdf([]), "application/pdf")},
    )
    assert response.status_code == 422
    assert "No tabular data" in response.json()["detail"]


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_extracted_pdf_parses_back_via_pdfplumber():
    content = make_pdf(STATEMENT_ROWS)
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        text = pdf.pages[0].extract_text() or ""
    assert "Coffee Shop" in text
