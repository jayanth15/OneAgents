import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, SQLModel, create_engine, select


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from database import enforce_unique_note_paths
from models import Folder, Note
from note_service import create_note_once
from second_brain import build_grounded_prompt, search_second_brain


class NoteCreationTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = TemporaryDirectory()
        db_path = Path(self.temp_dir.name) / "test.db"
        self.engine = create_engine(f"sqlite:///{db_path}")
        SQLModel.metadata.create_all(self.engine)

    def tearDown(self):
        self.engine.dispose()
        self.temp_dir.cleanup()

    @patch("note_service.write_note_file")
    def test_repeated_creation_returns_same_database_note(self, write_file):
        with Session(self.engine) as session:
            first = create_note_once(
                session,
                title="Retry Safe",
                content="original",
                folder_id=None,
                folder_name="Inbox",
            )
            second = create_note_once(
                session,
                title="Retry Safe",
                content="should not overwrite",
                folder_id=None,
                folder_name="Inbox",
            )
            notes = session.exec(select(Note)).all()

        self.assertTrue(first.created)
        self.assertFalse(second.created)
        self.assertEqual(first.note.id, second.note.id)
        self.assertEqual(len(notes), 1)
        write_file.assert_called_once_with("Inbox/Retry Safe.md", "original")


class MigrationTests(unittest.TestCase):
    def test_duplicate_rows_are_consolidated_before_unique_index(self):
        engine = create_engine("sqlite://")
        with engine.begin() as connection:
            connection.exec_driver_sql(
                """
                CREATE TABLE note (
                    id INTEGER PRIMARY KEY,
                    file_path TEXT NOT NULL,
                    tags TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            connection.exec_driver_sql(
                "INSERT INTO note VALUES (1, 'Inbox/a.md', 'one', '2026-01-01')"
            )
            connection.exec_driver_sql(
                "INSERT INTO note VALUES (2, 'Inbox/a.md', 'two', '2026-01-02')"
            )

        removed = enforce_unique_note_paths(engine)

        with engine.connect() as connection:
            rows = connection.exec_driver_sql(
                "SELECT id, file_path, tags, updated_at FROM note"
            ).fetchall()
            unique_indexes = [
                row for row in connection.exec_driver_sql("PRAGMA index_list('note')")
                if row[2]
            ]

        self.assertEqual(removed, 1)
        self.assertEqual(rows, [(1, "Inbox/a.md", "one, two", "2026-01-02")])
        self.assertTrue(unique_indexes)

        with self.assertRaises(IntegrityError):
            with engine.begin() as connection:
                connection.exec_driver_sql(
                    "INSERT INTO note VALUES (2, 'Inbox/a.md', '', '2026-01-03')"
                )
        engine.dispose()


class SecondBrainRetrievalTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = TemporaryDirectory()
        db_path = Path(self.temp_dir.name) / "retrieval.db"
        self.engine = create_engine(f"sqlite:///{db_path}")
        SQLModel.metadata.create_all(self.engine)
        with Session(self.engine) as session:
            research = Folder(name="Research")
            session.add(research)
            session.commit()
            session.refresh(research)
            session.add(Note(
                title="Shockwave Architecture",
                folder_id=research.id,
                file_path="Research/Shockwave Architecture.md",
                tags="architecture, local-first",
            ))
            session.add(Note(
                title="Grocery List",
                folder_id=None,
                file_path="Inbox/Grocery List.md",
                tags="personal",
            ))
            session.commit()

    def tearDown(self):
        self.engine.dispose()
        self.temp_dir.cleanup()

    @patch("second_brain.read_note_file")
    def test_query_ranks_relevant_wiki_note_and_builds_cited_context(self, read_file):
        read_file.side_effect = lambda path: {
            "Research/Shockwave Architecture.md": "Local-first Markdown architecture.",
            "Inbox/Grocery List.md": "Milk and bread.",
        }[path]

        with Session(self.engine) as session:
            matches = search_second_brain(session, "Explain the local-first architecture")
            prompt, prompt_matches = build_grounded_prompt(
                session,
                "Explain the local-first architecture",
            )

        self.assertEqual(matches[0]["title"], "Shockwave Architecture")
        self.assertEqual(prompt_matches[0]["title"], "Shockwave Architecture")
        self.assertIn("[[Shockwave Architecture]]", prompt)
        self.assertIn("Local-first Markdown architecture.", prompt)
        self.assertNotIn("Milk and bread.", prompt)


if __name__ == "__main__":
    unittest.main()
