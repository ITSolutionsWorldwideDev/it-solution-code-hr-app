from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import init_db
from app.routes import router as api_router


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
