from fastapi import APIRouter, Depends, Response, status
from sqlmodel import Session

from app.db import get_session
from app.models.department import Department
from app.models.employee import Employee
from app.schemas.employee import (
    EmployeeConvertRequest,
    EmployeeCreate,
    EmployeeHierarchyNode,
    EmployeeRead,
    EmployeeUpdate,
)
from app.services import crud
from app.services.employee_service import build_employee_hierarchy, convert_candidate_to_employee


router = APIRouter(prefix="/employees", tags=["Employees"])


@router.get("/", response_model=list[EmployeeRead], summary="List employees", description="Return all employees.")
def list_employees(session: Session = Depends(get_session)):
    return crud.get_all(session, Employee)


@router.get(
    "/hierarchy/tree",
    response_model=list[EmployeeHierarchyNode],
    summary="Get employee hierarchy",
    description="Return a simple employee hierarchy tree for the organogram view.",
)
def get_employee_hierarchy(session: Session = Depends(get_session)):
    return build_employee_hierarchy(session)


@router.get("/{employee_id}", response_model=EmployeeRead, summary="Get employee", description="Return an employee by ID.")
def get_employee(employee_id: int, session: Session = Depends(get_session)):
    return crud.get_or_404(session, Employee, employee_id)


@router.post("/", response_model=EmployeeRead, status_code=status.HTTP_201_CREATED, summary="Create employee", description="Create a new employee manually.")
def create_employee(payload: EmployeeCreate, session: Session = Depends(get_session)):
    if payload.department_id is not None:
        crud.get_or_404(session, Department, payload.department_id)
    if payload.manager_id is not None:
        crud.get_or_404(session, Employee, payload.manager_id)
    return crud.create(session, Employee, payload.model_dump())


@router.post(
    "/convert-candidate/{candidate_id}",
    response_model=EmployeeRead,
    status_code=status.HTTP_201_CREATED,
    summary="Convert hired candidate to employee",
    description="Create an employee record from an already hired candidate and initialize onboarding fields.",
)
def convert_hired_candidate(candidate_id: int, payload: EmployeeConvertRequest, session: Session = Depends(get_session)):
    return convert_candidate_to_employee(session, candidate_id, payload)


@router.put("/{employee_id}", response_model=EmployeeRead, summary="Update employee", description="Update onboarding or organizational employee fields.")
def update_employee(employee_id: int, payload: EmployeeUpdate, session: Session = Depends(get_session)):
    employee = crud.get_or_404(session, Employee, employee_id)
    updates = payload.model_dump(exclude_unset=True)
    if updates.get("department_id") is not None:
        crud.get_or_404(session, Department, updates["department_id"])
    if updates.get("manager_id") is not None:
        crud.get_or_404(session, Employee, updates["manager_id"])
    return crud.update(session, employee, updates)


@router.delete("/{employee_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete employee", description="Delete an employee by ID.")
def delete_employee(employee_id: int, session: Session = Depends(get_session)):
    employee = crud.get_or_404(session, Employee, employee_id)
    crud.delete(session, employee)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
