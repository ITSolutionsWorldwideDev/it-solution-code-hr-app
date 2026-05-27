from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlmodel import Session


def get_all(session: Session, model: type[Any]) -> list[Any]:
    return list(session.exec(select(model)).scalars().all())


def get_or_404(session: Session, model: type[Any], entity_id: int) -> Any:
    entity = session.get(model, entity_id)
    if entity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{model.__name__} with id {entity_id} was not found.",
        )
    return entity


def create(session: Session, model: type[Any], data: dict[str, Any]) -> Any:
    entity = model(**data)
    session.add(entity)
    session.commit()
    session.refresh(entity)
    return entity


def update(session: Session, entity: Any, data: dict[str, Any]) -> Any:
    for field, value in data.items():
        setattr(entity, field, value)
    session.add(entity)
    session.commit()
    session.refresh(entity)
    return entity


def delete(session: Session, entity: Any) -> None:
    session.delete(entity)
    session.commit()
