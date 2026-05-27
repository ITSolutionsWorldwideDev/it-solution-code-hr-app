from fastapi import APIRouter

from app.routes import applications, candidates, dashboard, departments, employees, hiring_requests, integrations, interviews, users, vacancies, webhooks


router = APIRouter()
router.include_router(users.router)
router.include_router(departments.router)
router.include_router(employees.router)
router.include_router(hiring_requests.router)
router.include_router(vacancies.router)
router.include_router(candidates.router)
router.include_router(applications.router)
router.include_router(interviews.router)
router.include_router(integrations.router)
router.include_router(webhooks.router)
router.include_router(dashboard.router)
