from fastapi import APIRouter, Depends, Response, status
from sqlmodel import Session

from app.db import get_session
from app.models.department import Department
from app.schemas.department import DepartmentCreate, DepartmentRead, DepartmentUpdate
from app.services import crud


router = APIRouter(prefix="/departments", tags=["Departments"])


@router.get("/", response_model=list[DepartmentRead], summary="List departments", description="Return all departments.")
def list_departments(session: Session = Depends(get_session)):
    return crud.get_all(session, Department)


@router.get("/{department_id}", response_model=DepartmentRead, summary="Get department", description="Return a department by ID.")
def get_department(department_id: int, session: Session = Depends(get_session)):
    return crud.get_or_404(session, Department, department_id)


@router.post("/", response_model=DepartmentRead, status_code=status.HTTP_201_CREATED, summary="Create department", description="Create a new department.")
def create_department(payload: DepartmentCreate, session: Session = Depends(get_session)):
    return crud.create(session, Department, payload.model_dump())


@router.put("/{department_id}", response_model=DepartmentRead, summary="Update department", description="Update an existing department.")
def update_department(department_id: int, payload: DepartmentUpdate, session: Session = Depends(get_session)):
    department = crud.get_or_404(session, Department, department_id)
    return crud.update(session, department, payload.model_dump(exclude_unset=True))


@router.delete("/{department_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete department", description="Delete a department by ID.")
def delete_department(department_id: int, session: Session = Depends(get_session)):
    department = crud.get_or_404(session, Department, department_id)
    crud.delete(session, department)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
