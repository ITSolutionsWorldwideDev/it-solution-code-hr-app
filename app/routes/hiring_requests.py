from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlmodel import select
from sqlmodel import Session

from app.db import get_session
from app.models.enums import UserRole
from app.models.hiring_request import HiringRequest
from app.models.user import User
from app.schemas.ai import JobDescriptionGenerateRequest, JobDescriptionGenerateResponse
from app.schemas.hiring_request import (
    HiringRequestCreate,
    HiringRequestDecision,
    HiringRequestRead,
    HiringRequestUpdate,
)
from app.services import crud
from app.services.hiring_request_service import approve_hiring_request, reject_hiring_request
from app.services.openai_service import generate_job_description_with_openai


router = APIRouter(prefix="/hiring-requests", tags=["Hiring Requests"])


@router.get("/", response_model=list[HiringRequestRead], summary="List hiring requests", description="Return all hiring requests.")
def list_hiring_requests(session: Session = Depends(get_session)):
    return crud.get_all(session, HiringRequest)


@router.get("/{request_id}", response_model=HiringRequestRead, summary="Get hiring request", description="Return a hiring request by ID.")
def get_hiring_request(request_id: int, session: Session = Depends(get_session)):
    return crud.get_or_404(session, HiringRequest, request_id)


@router.post(
    "/generate-job-description",
    response_model=JobDescriptionGenerateResponse,
    summary="Generate job description",
    description="Use Vertex AI / Gemini to generate an editable job description draft and extracted required skills for a hiring request.",
)
def generate_job_description(payload: JobDescriptionGenerateRequest):
    if not payload.is_internship and not payload.budget and not (payload.country and payload.country.strip()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="What country do I need to base the salary on?",
        )

    result = generate_job_description_with_openai(
        job_title=payload.job_title,
        department=payload.department,
        budget=payload.budget,
        is_internship=payload.is_internship,
        engagement_type=payload.engagement_type,
        requirements=payload.requirements,
        start_date=payload.start_date,
        employment_type=payload.employment_type,
        work_hours=payload.work_hours,
        work_model=payload.work_model,
        city=payload.city,
        country=payload.country,
        years_experience=payload.years_experience,
        perks=payload.perks,
        tone=payload.tone,
        seniority=payload.seniority,
    )
    return JobDescriptionGenerateResponse(**result.model_dump())


@router.post("/", response_model=HiringRequestRead, status_code=status.HTTP_201_CREATED, summary="Create hiring request", description="Create a new hiring request.")
def create_hiring_request(payload: HiringRequestCreate, session: Session = Depends(get_session)):
    data = payload.model_dump()
    if data.get("created_by_id") is None:
        default_user = session.exec(select(User).order_by(User.id)).first()
        if default_user is None:
            default_user = User(
                full_name="Default HR Recruiter",
                email="hr-recruiter@itsolutionsworldwide.local",
                role=UserRole.HR,
                department_id=data.get("department_id"),
            )
            session.add(default_user)
            session.commit()
            session.refresh(default_user)
        data["created_by_id"] = default_user.id
    return crud.create(session, HiringRequest, data)


@router.put("/{request_id}", response_model=HiringRequestRead, summary="Update hiring request", description="Update an existing hiring request.")
def update_hiring_request(request_id: int, payload: HiringRequestUpdate, session: Session = Depends(get_session)):
    hiring_request = crud.get_or_404(session, HiringRequest, request_id)
    return crud.update(session, hiring_request, payload.model_dump(exclude_unset=True))


@router.post("/{request_id}/approve", response_model=HiringRequestRead, summary="Approve hiring request", description="Approve a pending hiring request and automatically create a vacancy.")
def approve_request(
    request_id: int,
    payload: HiringRequestDecision,
    request: Request,
    session: Session = Depends(get_session),
):
    return approve_hiring_request(
        session,
        request_id,
        payload,
        public_base_url=str(request.base_url).rstrip("/"),
    )


@router.post("/{request_id}/reject", response_model=HiringRequestRead, summary="Reject hiring request", description="Reject a pending hiring request.")
def reject_request(request_id: int, payload: HiringRequestDecision, session: Session = Depends(get_session)):
    return reject_hiring_request(session, request_id, payload)


@router.delete("/{request_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete hiring request", description="Delete a hiring request by ID.")
def delete_hiring_request(request_id: int, session: Session = Depends(get_session)):
    hiring_request = crud.get_or_404(session, HiringRequest, request_id)
    crud.delete(session, hiring_request)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
