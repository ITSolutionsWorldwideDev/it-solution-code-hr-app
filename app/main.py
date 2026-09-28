import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.db import init_db
from app.routes import router as api_router

logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI Recruitment Backend",
    version="0.1.0",
    description=(
        "A modular FastAPI backend for an AI-driven recruitment platform. "
        "It includes users, departments, hiring requests, vacancies, candidates, "
        "applications, and prototype CV parsing and matching."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled exception on {request.method} {request.url.path}: {exc}")
    origin = request.headers.get("origin")
    headers = {}
    if origin:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
        headers["Access-Control-Allow-Methods"] = "*"
        headers["Access-Control-Allow-Headers"] = "*"
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"},
        headers=headers,
    )

settings.website_pdf_output_dir.mkdir(parents=True, exist_ok=True)
app.mount(
    "/website-assets/job-pdfs",
    StaticFiles(directory=settings.website_pdf_output_dir),
    name="website-job-pdfs",
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get(
    "/health",
    tags=["Health"],
    summary="Health check",
    description="Returns a simple status payload to confirm that the API is running.",
)
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get(
    "/",
    tags=["Root"],
    summary="Root endpoint",
    description="Returns a simple English message confirming that the API is available.",
)
def root() -> dict[str, str]:
    return {"message": "AI Recruitment API is running"}


app.include_router(api_router, prefix="/api")
