from fastapi import APIRouter, Depends, Response, status
from sqlmodel import Session

from app.db import get_session
from app.models.user import User
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.services import crud


router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/", response_model=list[UserRead], summary="List users", description="Return all users in the recruitment system.")
def list_users(session: Session = Depends(get_session)):
    return crud.get_all(session, User)


@router.get("/{user_id}", response_model=UserRead, summary="Get user", description="Return a single user by ID.")
def get_user(user_id: int, session: Session = Depends(get_session)):
    return crud.get_or_404(session, User, user_id)


@router.post("/", response_model=UserRead, status_code=status.HTTP_201_CREATED, summary="Create user", description="Create a new user with an HR, Technical, Manager, or Admin role.")
def create_user(payload: UserCreate, session: Session = Depends(get_session)):
    return crud.create(session, User, payload.model_dump())


@router.put("/{user_id}", response_model=UserRead, summary="Update user", description="Update an existing user by ID.")
def update_user(user_id: int, payload: UserUpdate, session: Session = Depends(get_session)):
    user = crud.get_or_404(session, User, user_id)
    return crud.update(session, user, payload.model_dump(exclude_unset=True))


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete user", description="Delete a user by ID.")
def delete_user(user_id: int, session: Session = Depends(get_session)):
    user = crud.get_or_404(session, User, user_id)
    crud.delete(session, user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
