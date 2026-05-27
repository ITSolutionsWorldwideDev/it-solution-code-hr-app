from app.schemas.common import BaseSchema


class DashboardKpiRead(BaseSchema):
    label: str
    value: str
    delta: str


class DashboardActivityRead(BaseSchema):
    id: str
    title: str
    status: str
    timestamp: str
    candidate_name: str
    candidate_role: str
    candidate_initials: str


class HRDashboardSummaryRead(BaseSchema):
    title: str
    description: str
    kpis: list[DashboardKpiRead]


class HRDashboardActivityResponseRead(BaseSchema):
    items: list[DashboardActivityRead]
