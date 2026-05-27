from sqlmodel import Session

from app.models.application import Application
from app.models.candidate import Candidate
from app.models.vacancy import Vacancy
from app.schemas.application import ApplicationCreate
from app.services.crud import get_or_404


def create_application(session: Session, payload: ApplicationCreate) -> Application:
    get_or_404(session, Candidate, payload.candidate_id)
    get_or_404(session, Vacancy, payload.vacancy_id)

    application = Application(**payload.model_dump())
    session.add(application)
    session.commit()
    session.refresh(application)
    return application
