from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from pydantic import Field

from app.models.enums import OnboardingStatus
from app.schemas.common import BaseSchema


class EmployeeBase(BaseSchema):
    full_name: str = Field(description="Employee full name.")
    email: str = Field(description="Employee email address.")
    role: str = Field(description="Employee job role or title.")
    documents_status: str = Field(default="pending", description="Status of onboarding documents.")
    signed_offer: bool = Field(default=False, description="Whether the employee signed the offer.")
    start_date: Optional[date] = Field(default=None, description="Employee start date.")
    onboarding_status: OnboardingStatus = Field(
        default=OnboardingStatus.NOT_STARTED,
        description="Employee onboarding progress status.",
    )
    department_id: Optional[int] = Field(default=None, description="Department ID linked to the employee.")
    manager_id: Optional[int] = Field(default=None, description="Manager employee ID.")
    candidate_id: Optional[int] = Field(default=None, description="Source candidate ID if converted from hiring.")


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeConvertRequest(BaseSchema):
    role: str = Field(description="Role assigned to the new employee.")
    department_id: Optional[int] = Field(default=None, description="Department ID for the employee.")
    manager_id: Optional[int] = Field(default=None, description="Manager employee ID.")
    documents_status: str = Field(default="pending", description="Initial document collection status.")
    signed_offer: bool = Field(default=True, description="Whether the offer is already signed.")
    start_date: Optional[date] = Field(default=None, description="Planned employee start date.")
    onboarding_status: OnboardingStatus = Field(
        default=OnboardingStatus.IN_PROGRESS,
        description="Initial onboarding status after conversion.",
    )


class EmployeeUpdate(BaseSchema):
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    documents_status: Optional[str] = None
    signed_offer: Optional[bool] = None
    start_date: Optional[date] = None
    onboarding_status: Optional[OnboardingStatus] = None
    department_id: Optional[int] = None
    manager_id: Optional[int] = None


class EmployeeRead(EmployeeBase):
    id: int
    created_at: datetime


class EmployeeHierarchyNode(BaseSchema):
    id: int
    full_name: str
    email: str
    role: str
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    manager_id: Optional[int] = None
    onboarding_status: OnboardingStatus
    children: list["EmployeeHierarchyNode"] = Field(default_factory=list)


EmployeeHierarchyNode.model_rebuild()
