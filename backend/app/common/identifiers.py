import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import DocumentSequence


async def next_document_number(
    session: AsyncSession,
    *,
    hospital_id: uuid.UUID,
    key: str,
    prefix: str,
    width: int = 5,
) -> str:
    """Allocate under a row lock; callers commit in the owning business transaction."""
    sequence = await session.scalar(
        select(DocumentSequence)
        .where(DocumentSequence.hospital_id == hospital_id, DocumentSequence.key == key)
        .with_for_update()
    )
    if sequence is None:
        sequence = DocumentSequence(hospital_id=hospital_id, key=key, value=0)
        session.add(sequence)
        await session.flush()
    sequence.value += 1
    await session.flush()
    return f"{prefix}-{datetime.now(UTC).year}-{sequence.value:0{width}d}"
