from typing import Optional

from app.schemas.common import BaseSchema


class DepartmentBase(BaseSchema):
    name: str
    description: Optional[str] = None


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentUpdate(BaseSchema):
    name: Optional[str] = None
    description: Optional[str] = None


class DepartmentRead(DepartmentBase):
    id: int
