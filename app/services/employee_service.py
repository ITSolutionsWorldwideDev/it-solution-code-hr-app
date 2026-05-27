from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlmodel import Session

from app.models.candidate import Candidate
from app.models.department import Department
from app.models.employee import Employee
from app.schemas.employee import EmployeeConvertRequest


def convert_candidate_to_employee(
    session: Session,
    candidate_id: int,
    payload: EmployeeConvertRequest,
) -> Employee:
    candidate = session.get(Candidate, candidate_id)
    if candidate is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Candidate with id {candidate_id} was not found.",
        )

    if candidate.employee is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Candidate has already been converted to an employee.",
        )

    if payload.department_id is not None and session.get(Department, payload.department_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Department with id {payload.department_id} was not found.",
        )

    if payload.manager_id is not None and session.get(Employee, payload.manager_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Manager employee with id {payload.manager_id} was not found.",
        )

    employee = Employee(
        full_name=candidate.name,
        email=candidate.email,
        role=payload.role,
        documents_status=payload.documents_status,
        signed_offer=payload.signed_offer,
        start_date=payload.start_date,
        onboarding_status=payload.onboarding_status,
        department_id=payload.department_id,
        manager_id=payload.manager_id,
        candidate_id=candidate.id,
    )
    session.add(employee)
    session.commit()
    session.refresh(employee)
    return employee


def build_employee_hierarchy(session: Session) -> list[dict]:
    employees = list(session.exec(select(Employee)).all())
    node_map: dict[int, dict] = {}

    for employee in employees:
        node_map[employee.id] = {
            "id": employee.id,
            "full_name": employee.full_name,
            "email": employee.email,
            "role": employee.role,
            "department_id": employee.department_id,
            "department_name": employee.department.name if employee.department else None,
            "manager_id": employee.manager_id,
            "onboarding_status": employee.onboarding_status,
            "children": [],
        }

    roots: list[dict] = []
    for employee in employees:
        node = node_map[employee.id]
        if employee.manager_id and employee.manager_id in node_map:
            node_map[employee.manager_id]["children"].append(node)
        else:
            roots.append(node)

    return roots
