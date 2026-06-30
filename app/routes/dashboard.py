from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlmodel import Session, select

from app.db import get_session
from app.models.application import Application
from app.models.application_stage_event import ApplicationStageEvent
from app.models.candidate import Candidate
from app.models.enums import ApplicationStage, ShortlistBucket, VacancyStatus
from app.models.vacancy import Vacancy
from app.schemas.dashboard import (
    DashboardActivityRead,
    DashboardKpiRead,
    HRDashboardActivityResponseRead,
    HRDashboardSummaryRead,
)
from app.schemas.workspace import HRWorkspaceResponseRead
from app.services.workspace_service import (
    list_workspace_applications,
    list_workspace_candidates,
    list_workspace_vacancies,
)


router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


TECHNICAL_AND_BEYOND_STAGES = (
    ApplicationStage.TECHNICAL_INTERVIEW_SCHEDULED,
    ApplicationStage.TECHNICAL_IN_PROGRESS,
    ApplicationStage.TECHNICAL_PASSED,
    ApplicationStage.TECHNICAL_REJECTED,
    ApplicationStage.MANAGEMENT_INTERVIEW_SCHEDULED,
    ApplicationStage.MANAGEMENT_IN_PROGRESS,
    ApplicationStage.MANAGEMENT_REJECTED,
    ApplicationStage.SELECTED,
    ApplicationStage.OFFER_SENT,
    ApplicationStage.OFFER_ACCEPTED,
    ApplicationStage.OFFER_DECLINED,
    ApplicationStage.HIRED,
)

PIPELINE_STAGES = (
    ApplicationStage.HR_INVITE_SENT,
    ApplicationStage.HR_INTERVIEW_SCHEDULED,
    ApplicationStage.HR_IN_PROGRESS,
    ApplicationStage.HR_PASSED,
    ApplicationStage.HR_REJECTED,
    *TECHNICAL_AND_BEYOND_STAGES,
)


@router.get(
    "/hr-summary",
    response_model=HRDashboardSummaryRead,
    summary="Get HR dashboard summary",
    description="Return live KPI counts for the HR dashboard.",
)
def get_hr_dashboard_summary(session: Session = Depends(get_session)):
    now = datetime.utcnow()
    start_of_week = now - timedelta(days=now.weekday())
    start_of_week = start_of_week.replace(hour=0, minute=0, second=0, microsecond=0)

    active_vacancies = _count(
        session,
        select(func.count()).select_from(Vacancy).where(Vacancy.status == VacancyStatus.OPEN),
    )
    opened_this_week = _count(
        session,
        select(func.count()).select_from(Vacancy).where(
            Vacancy.status == VacancyStatus.OPEN,
            Vacancy.created_at >= start_of_week,
        ),
    )

    top_ranked = _count(
        session,
        select(func.count()).select_from(Application).where(Application.stage == ApplicationStage.RANKED),
    )

    shortlisted = _count(
        session,
        select(func.count()).select_from(Application).where(
            Application.shortlist_bucket.in_((ShortlistBucket.PRIMARY, ShortlistBucket.RESERVE))
        ),
    )
    primary_shortlist = _count(
        session,
        select(func.count()).select_from(Application).where(Application.shortlist_bucket == ShortlistBucket.PRIMARY),
    )
    reserve_shortlist = _count(
        session,
        select(func.count()).select_from(Application).where(Application.shortlist_bucket == ShortlistBucket.RESERVE),
    )

    sent_to_pipeline = _count(
        session,
        select(func.count()).select_from(Application).where(Application.stage.in_(PIPELINE_STAGES)),
    )
    moved_to_pipeline_this_week = _count(
        session,
        select(func.count()).select_from(ApplicationStageEvent).where(
            ApplicationStageEvent.to_stage.in_(PIPELINE_STAGES),
            ApplicationStageEvent.created_at >= start_of_week,
        ),
    )

    return HRDashboardSummaryRead(
        title="HR Hiring Workspace",
        description=(
            "Track intake, vacancy readiness, shortlist quality, and the next HR decisions "
            "across the recruitment flow."
        ),
        kpis=[
            DashboardKpiRead(
                label="Top Ranked",
                value=str(top_ranked),
                delta="Candidates in ranking queue",
            ),
            DashboardKpiRead(
                label="Active Vacancies",
                value=str(active_vacancies),
                delta=f"+{opened_this_week} open this week",
            ),
            DashboardKpiRead(
                label="Shortlisted",
                value=str(shortlisted),
                delta=f"{primary_shortlist} primary, {reserve_shortlist} reserve",
            ),
            DashboardKpiRead(
                label="Candidates Sent To Pipeline",
                value=str(sent_to_pipeline),
                delta=f"+{moved_to_pipeline_this_week} moved this week",
            ),
        ],
    )


@router.get(
    "/hr-activity",
    response_model=HRDashboardActivityResponseRead,
    summary="Get HR dashboard activity feed",
    description="Return recent live activity items for the HR dashboard.",
)
def get_hr_dashboard_activity(
    limit: int = 8,
    session: Session = Depends(get_session),
):
    safe_limit = max(1, min(limit, 20))
    activity_items: list[tuple[datetime, DashboardActivityRead]] = []

    stage_events = session.exec(
        select(ApplicationStageEvent, Application, Candidate, Vacancy)
        .join(Application, Application.id == ApplicationStageEvent.application_id)
        .join(Candidate, Candidate.id == Application.candidate_id)
        .join(Vacancy, Vacancy.id == Application.vacancy_id)
        .order_by(ApplicationStageEvent.created_at.desc())
        .limit(safe_limit)
    ).all()

    for event, application, candidate, vacancy in stage_events:
        candidate_name = _clean_candidate_name(candidate.name)
        activity_items.append(
            (
                event.created_at,
                DashboardActivityRead(
                    id=f"stage-event-{event.id}",
                    title=_build_stage_event_title(event.to_stage, vacancy.title, candidate_name),
                    status=_format_stage_label(event.to_stage),
                    timestamp=_format_relative_time(event.created_at),
                    candidate_name=candidate_name,
                    candidate_role=vacancy.title,
                    candidate_initials=_initials(candidate_name),
                ),
            )
        )

    recent_applications = session.exec(
        select(Application, Candidate, Vacancy)
        .join(Candidate, Candidate.id == Application.candidate_id)
        .join(Vacancy, Vacancy.id == Application.vacancy_id)
        .order_by(Application.created_at.desc())
        .limit(safe_limit)
    ).all()

    for application, candidate, vacancy in recent_applications:
        candidate_name = _clean_candidate_name(candidate.name)
        activity_items.append(
            (
                application.created_at,
                DashboardActivityRead(
                    id=f"application-{application.id}",
                    title=f"New applicant linked to {vacancy.title}",
                    status="Applied",
                    timestamp=_format_relative_time(application.created_at),
                    candidate_name=candidate_name,
                    candidate_role=vacancy.title,
                    candidate_initials=_initials(candidate_name),
                ),
            )
        )

    recent_vacancies = session.exec(
        select(Vacancy).order_by(Vacancy.created_at.desc()).limit(safe_limit)
    ).all()

    for vacancy in recent_vacancies:
        activity_items.append(
            (
                vacancy.created_at,
                DashboardActivityRead(
                    id=f"vacancy-{vacancy.id}",
                    title=f"Vacancy created for {vacancy.title}",
                    status="Vacancy",
                    timestamp=_format_relative_time(vacancy.created_at),
                    candidate_name="Recruitment",
                    candidate_role=vacancy.title,
                    candidate_initials="RC",
                ),
            )
        )

    sorted_items = [
        item
        for _, item in sorted(activity_items, key=lambda entry: entry[0], reverse=True)[:safe_limit]
    ]

    return HRDashboardActivityResponseRead(items=sorted_items)


@router.get(
    "/hr-workspace",
    response_model=HRWorkspaceResponseRead,
    summary="Get compact HR dashboard workspace payload",
    description="Return dashboard summary, activity, and lightweight workspace records in one response.",
)
def get_hr_dashboard_workspace(session: Session = Depends(get_session)):
    summary = get_hr_dashboard_summary(session=session)
    activity = get_hr_dashboard_activity(session=session).items
    return HRWorkspaceResponseRead(
        summary=summary,
        activity=activity,
        applications=list_workspace_applications(session),
        candidates=list_workspace_candidates(session),
        vacancies=list_workspace_vacancies(session),
    )


def _count(session: Session, statement) -> int:
    return int(session.exec(statement).one() or 0)


def _build_stage_event_title(stage: ApplicationStage, vacancy_title: str, candidate_name: str) -> str:
    if stage == ApplicationStage.RANKED:
        return f"CV parsing and ranking completed for {vacancy_title}"
    if stage == ApplicationStage.PRIMARY_SHORTLIST:
        return f"{candidate_name} added to primary shortlist for {vacancy_title}"
    if stage == ApplicationStage.RESERVE_SHORTLIST:
        return f"{candidate_name} added to reserve shortlist for {vacancy_title}"
    if stage == ApplicationStage.HR_INVITE_SENT:
        return f"{candidate_name} sent to pipeline for {vacancy_title}"
    if stage == ApplicationStage.HR_PASSED:
        return f"{candidate_name} sent to pipeline for {vacancy_title}"
    if stage in TECHNICAL_AND_BEYOND_STAGES:
        return f"{candidate_name} moved forward in {vacancy_title}"
    if stage == ApplicationStage.HR_REJECTED:
        return f"{candidate_name} rejected during HR review for {vacancy_title}"
    if stage == ApplicationStage.TECHNICAL_REJECTED:
        return f"{candidate_name} rejected during technical review for {vacancy_title}"
    if stage == ApplicationStage.MANAGEMENT_REJECTED:
        return f"{candidate_name} rejected during management review for {vacancy_title}"
    if stage == ApplicationStage.OFFER_SENT:
        return f"Offer sent to {candidate_name} for {vacancy_title}"
    if stage == ApplicationStage.OFFER_ACCEPTED:
        return f"{candidate_name} accepted the offer for {vacancy_title}"
    if stage == ApplicationStage.HIRED:
        return f"{candidate_name} marked as hired for {vacancy_title}"
    return f"{candidate_name} updated in {vacancy_title}"


def _format_stage_label(stage: ApplicationStage) -> str:
    return stage.value.replace("_", " ").title()


def _format_relative_time(timestamp: datetime) -> str:
    now = datetime.utcnow()
    delta = now - timestamp
    total_seconds = max(int(delta.total_seconds()), 0)

    if total_seconds < 60:
        return "just now"

    minutes = total_seconds // 60
    if minutes < 60:
        return f"{minutes} minute{'s' if minutes != 1 else ''} ago"

    hours = minutes // 60
    if hours < 24:
        return f"{hours} hour{'s' if hours != 1 else ''} ago"

    days = hours // 24
    if days < 7:
        return f"{days} day{'s' if days != 1 else ''} ago"

    weeks = days // 7
    if weeks < 5:
        return f"{weeks} week{'s' if weeks != 1 else ''} ago"

    return timestamp.strftime("%Y-%m-%d")


def _initials(name: str) -> str:
    parts = [part for part in name.strip().split() if part]
    if not parts:
        return "NA"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return f"{parts[0][0]}{parts[-1][0]}".upper()


def _clean_candidate_name(name: str) -> str:
    cleaned = name.strip()
    for prefix in ("Name:", "Candidate:", "Naam:"):
        if cleaned.lower().startswith(prefix.lower()):
            cleaned = cleaned[len(prefix):].strip()
            break
    return cleaned or "Unknown Candidate"
