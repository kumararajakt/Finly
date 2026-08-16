from .main import app


def main() -> None:
    import uvicorn

    uvicorn.run("pdf_service.main:app", host="0.0.0.0", port=8000)
