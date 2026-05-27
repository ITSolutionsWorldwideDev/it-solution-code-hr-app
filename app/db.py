from sqlmodel import Session, SQLModel, create_engine, select

from app.config import settings
import app.models  # noqa: F401
from app.models.department import Department


engine = create_engine(settings.database_url, echo=False)
DEFAULT_DEPARTMENTS = (
    ("Engineering", "Software engineering and platform delivery."),
    ("Product", "Product strategy, delivery, and design."),
    ("Data", "Analytics, reporting, and data science."),
    ("Operations", "Business operations and internal support."),
)


def get_session():
    with Session(engine) as session:
        yield session


def init_db() -> None:
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        existing_departments = session.exec(select(Department)).all()
        if existing_departments:
            return

        for name, description in DEFAULT_DEPARTMENTS:
            session.add(Department(name=name, description=description))

        session.commit()
