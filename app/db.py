from sqlmodel import Session, SQLModel, create_engine, select

from app.config import settings
import app.models  # noqa: F401
from app.models.department import Department


engine = create_engine(settings.database_url, echo=False)
DEFAULT_DEPARTMENTS = (
    ("Human Resources (HR)", "Recruitment, people operations, talent management, and employee support."),
    ("Information Technology (IT) & Software Development", "Software engineering, systems administration, ERP, BI, SAP, web, and platform delivery."),
    ("Engineering", "Technical engineering disciplines, design, production, and infrastructure delivery."),
    ("Supply Chain & Procurement", "Procurement, sourcing, logistics, inventory, and supply chain analysis."),
    ("Marketing & Digital Marketing", "Brand, content, SEO, PPC, social media, design, and digital growth initiatives."),
    ("Sales & Business Development", "Revenue generation, account growth, partnerships, and commercial development."),
    ("Finance & Accounting", "Financial planning, controlling, bookkeeping, reporting, and accounting operations."),
    ("Administration & Operations", "Office administration, internal operations, coordination, and business support."),
    ("Project Management", "Project planning, delivery governance, stakeholder management, and execution oversight."),
    ("Customer Support", "Client support, service operations, onboarding, and issue resolution."),
)


def get_session():
    with Session(engine) as session:
        yield session


def ensure_default_departments(session: Session) -> None:
    existing_departments = session.exec(select(Department)).all()
    existing_by_name = {department.name.strip().lower(): department for department in existing_departments if department.name}
    changed = False

    for name, description in DEFAULT_DEPARTMENTS:
        normalized_name = name.strip().lower()
        department = existing_by_name.get(normalized_name)
        if department is None:
            session.add(Department(name=name, description=description))
            changed = True
            continue
        if not department.description and description:
            department.description = description
            session.add(department)
            changed = True

    if changed:
        session.commit()


def init_db() -> None:
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        ensure_default_departments(session)
