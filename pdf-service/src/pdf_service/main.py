from fastapi import FastAPI

from pdf_service.api.routes import router

app = FastAPI(title="Finly PDF service", version="0.1.0")
app.include_router(router)


@app.get("/")
async def root():
    return {"message": "Finly PDF service"}
