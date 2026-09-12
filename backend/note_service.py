from dataclasses import dataclass
from datetime import datetime
from threading import RLock
from typing import Optional

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from models import Note
from storage import get_relative_path, write_note_file


_create_lock = RLock()


@dataclass(frozen=True)
class NoteCreationResult:
    note: Note
    created: bool


def create_note_once(
    session: Session,
    *,
    title: str,
    content: str,
    folder_id: Optional[int],
    folder_name: Optional[str],
    tags: str = "",
) -> NoteCreationResult:
    """Create one database record per Markdown path; retries return the record."""
    clean_title = title.strip()
    relative_path = get_relative_path(folder_name, clean_title)

    with _create_lock:
        existing = session.exec(
            select(Note).where(Note.file_path == relative_path)
        ).first()
        if existing:
            return NoteCreationResult(note=existing, created=False)

        write_note_file(relative_path, content)
        now = datetime.utcnow()
        note = Note(
            title=clean_title,
            folder_id=folder_id,
            file_path=relative_path,
            tags=tags.strip(),
            created_at=now,
            updated_at=now,
        )
        session.add(note)
        try:
            session.commit()
        except IntegrityError:
            # A unique index also protects deployments with multiple workers.
            session.rollback()
            existing = session.exec(
                select(Note).where(Note.file_path == relative_path)
            ).first()
            if existing:
                return NoteCreationResult(note=existing, created=False)
            raise

        session.refresh(note)
        return NoteCreationResult(note=note, created=True)
