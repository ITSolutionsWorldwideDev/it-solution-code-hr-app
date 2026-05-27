from typing import Optional

from app.models.enums import UserRole
from app.schemas.common import BaseSchema


class UserBase(BaseSchema):
    full_name: str
    email: str
    role: UserRole
    department_id: Optional[int] = None


class UserCreate(UserBase):
    pass


class UserUpdate(BaseSchema):
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[UserRole] = None
    department_id: Optional[int] = None


class UserRead(UserBase):
    id: int
