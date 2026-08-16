"""PDF extraction endpoints for Finly.

The service is deliberately format-agnostic: it pulls a candidate table (headers
+ rows) out of the PDF and lets the NestJS import pipeline run its own column
detection, duplicate checks, and category/account resolution on top. Scanned or
image-only PDFs yield no text and return a "no tabular data" error.
"""

from __future__ import annotations

import io
from typing import Any

import pdfplumber
from fastapi import APIRouter, File, HTTPException, UploadFile

router = APIRouter()

MAX_BYTES = 20 * 1024 * 1024
MAX_ROWS = 100_000

COLUMN_GAP_PT = 16.0
ROW_TOLERANCE_PT = 5.0

HEADER_KEYWORDS = (
    "date",
    "description",
    "merchant",
    "amount",
    "debit",
    "credit",
    "balance",
    "particulars",
    "reference",
    "details",
    "transaction",
    "value date",
)


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def _page_rows(page: pdfplumber.page.Page) -> list[list[str]]:
    """Extract rows from a single page, preferring ruled-line tables.

    Ruled-line tables use ``pdfplumber``'s table detection. For text-based
    statements without ruling lines (the common case), columns are recovered
    from the horizontal coordinates of extracted words: large gaps between
    words mark column boundaries, small gaps keep a cell's words together.
    """
    try:
        table = page.extract_table()
    except Exception:
        table = None
    if table:
        rows: list[list[str]] = []
        for row in table:
            if row is None:
                continue
            cells = [cell.strip() if cell else "" for cell in row]
            if any(cells):
                rows.append(cells)
        if rows:
            return rows

    words = page.extract_words(use_text_flow=False, keep_blank_chars=False)
    if not words:
        return []

    lines: list[list[dict[str, Any]]] = []
    for word in sorted(words, key=lambda w: (w["top"], w["x0"])):
        if lines and word["top"] - lines[-1][0]["top"] <= ROW_TOLERANCE_PT:
            lines[-1].append(word)
        else:
            lines.append([word])

    separators = _column_separators(words)
    rows = []
    for line in lines:
        cells: list[str] = [""] * (len(separators) + 1)
        for word in sorted(line, key=lambda w: w["x0"]):
            center = (word["x0"] + word["x1"]) / 2
            index = sum(1 for separator in separators if center > separator)
            cells[index] = f"{cells[index]} {word['text']}".strip()
        if any(cells):
            rows.append(cells)
    return rows


def _column_separators(words: list[dict[str, Any]]) -> list[float]:
    spans = sorted((word["x0"], word["x1"]) for word in words)
    separators: list[float] = []
    for (_, previous_end), (next_start, _) in zip(spans, spans[1:]):
        if next_start - previous_end > COLUMN_GAP_PT:
            separators.append((previous_end + next_start) / 2)
    return separators


def _looks_like_header(cells: list[str]) -> bool:
    text = " ".join(cells).lower()
    return sum(1 for keyword in HEADER_KEYWORDS if keyword in text) >= 2


def extract_rows(pdf_bytes: bytes) -> dict[str, Any]:
    if len(pdf_bytes) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File is larger than 20 MB.")
    if len(pdf_bytes) == 0:
        raise HTTPException(status_code=422, detail="Empty file.")

    rows: list[list[str]] = []
    page_count = 0
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            page_count = len(pdf.pages)
            for page in pdf.pages:
                rows.extend(_page_rows(page))
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Could not parse the PDF: {exc}",
        ) from exc

    rows = [row for row in rows if any(cell for cell in row)]
    if not rows:
        raise HTTPException(
            status_code=422,
            detail=(
                "No tabular data found. Only text-based (selectable) PDFs are "
                "supported; scanned or image-only statements need OCR."
            ),
        )
    if len(rows) > MAX_ROWS:
        raise HTTPException(
            status_code=413,
            detail=f"The PDF has too many rows (max {MAX_ROWS}).",
        )

    header_index: int | None = None
    for index, row in enumerate(rows[:15]):
        if _looks_like_header(row):
            header_index = index
            break

    if header_index is not None:
        headers = rows[header_index]
        data = [row for row in rows[header_index + 1 :] if row != headers]
        has_header = True
    else:
        headers = []
        data = rows
        has_header = False

    return {
        "headers": headers,
        "rows": data,
        "hasHeader": has_header,
        "pageCount": page_count,
    }


@router.post("/extract")
async def extract(file: UploadFile = File(...)) -> dict[str, Any]:
    if file.filename is None or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=422, detail="Not a PDF file.")
    data = await file.read()
    try:
        result = extract_rows(data)
    except HTTPException:
        raise
    result["filename"] = file.filename
    return result
