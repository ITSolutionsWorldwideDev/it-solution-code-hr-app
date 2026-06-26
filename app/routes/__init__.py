from fastapi import APIRouter

from app.routes import applications, auth, candidates, dashboard, departments, employees, hiring_requests, integrations, interviews, settings, users, vacancies, webhooks, website_integrations, website_public


router = APIRouter()


@router.get(
    "",
    tags=["Root"],
    summary="API root endpoint",
    description="Returns a simple message confirming that the mounted /api router is available.",
)
def api_root() -> dict[str, str]:
    return {"message": "AI Recruitment API /api is running"}


router.include_router(users.router)
router.include_router(auth.router)
router.include_router(settings.router)
router.include_router(departments.router)
router.include_router(employees.router)
router.include_router(hiring_requests.router)
router.include_router(vacancies.router)
router.include_router(candidates.router)
router.include_router(applications.router)
router.include_router(interviews.router)
router.include_router(integrations.router)
router.include_router(website_integrations.router)
router.include_router(website_public.router)
router.include_router(webhooks.router)
router.include_router(dashboard.router)
