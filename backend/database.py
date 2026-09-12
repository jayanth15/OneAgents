import os
from pathlib import Path
from sqlmodel import SQLModel, create_engine, Session, select
from models import Folder, Note
from storage import write_note_file, get_relative_path

DB_PATH = Path(__file__).resolve().parent / "qnotes.db"
sqlite_url = f"sqlite:///{DB_PATH}"

engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
    seed_initial_data_if_empty()
    removed = enforce_unique_note_paths()
    if removed:
        print(f"Removed {removed} duplicate note database record(s).")


def enforce_unique_note_paths(target_engine=engine) -> int:
    """Consolidate duplicate note rows and enforce one row per vault file."""
    removed = 0
    with target_engine.begin() as connection:
        duplicate_paths = connection.exec_driver_sql(
            """
            SELECT file_path
            FROM note
            GROUP BY file_path
            HAVING COUNT(*) > 1
            """
        ).fetchall()

        for (file_path,) in duplicate_paths:
            rows = connection.exec_driver_sql(
                """
                SELECT id, tags, updated_at
                FROM note
                WHERE file_path = ?
                ORDER BY id
                """,
                (file_path,),
            ).fetchall()
            keeper_id = rows[0][0]
            merged_tags = []
            for _, tags, _ in rows:
                for tag in (tags or "").split(","):
                    clean_tag = tag.strip()
                    if clean_tag and clean_tag not in merged_tags:
                        merged_tags.append(clean_tag)
            latest_update = max(row[2] for row in rows if row[2] is not None)

            result = connection.exec_driver_sql(
                "DELETE FROM note WHERE file_path = ? AND id != ?",
                (file_path, keeper_id),
            )
            removed += result.rowcount
            connection.exec_driver_sql(
                "UPDATE note SET tags = ?, updated_at = ? WHERE id = ?",
                (", ".join(merged_tags), latest_update, keeper_id),
            )

        has_unique_file_path_index = False
        for index_row in connection.exec_driver_sql("PRAGMA index_list('note')"):
            index_name = index_row[1]
            is_unique = bool(index_row[2])
            if not is_unique:
                continue
            columns = [
                row[2]
                for row in connection.exec_driver_sql(
                    f"PRAGMA index_info('{index_name}')"
                )
            ]
            if columns == ["file_path"]:
                has_unique_file_path_index = True
                break

        if not has_unique_file_path_index:
            connection.exec_driver_sql(
                "CREATE UNIQUE INDEX uq_note_file_path ON note(file_path)"
            )

    return removed

def get_session():
    with Session(engine) as session:
        yield session

def seed_initial_data_if_empty():
    with Session(engine) as session:
        existing_notes = session.exec(select(Note)).first()
        if existing_notes is not None:
            return

        # Starter folders
        inbox = Folder(name="Inbox", parent_id=None)
        projects = Folder(name="Projects", parent_id=None)
        research = Folder(name="Research", parent_id=None)
        guides = Folder(name="Guides", parent_id=None)
        session.add(inbox)
        session.add(projects)
        session.add(research)
        session.add(guides)
        session.commit()
        session.refresh(inbox)
        session.refresh(projects)
        session.refresh(research)
        session.refresh(guides)

        starter_notes = [
            {
                "title": "Welcome to QNote",
                "folder_id": guides.id,
                "folder_name": "Guides",
                "tags": "welcome, overview, guide",
                "content": """# Welcome to QNote 🚀

**QNote** is a modern, file-and-folder-based knowledge base and graph application inspired by **Shockwave**. 

Notes in this system are **saved as plain markdown files on disk** inside your backend vault folder and rendered dynamically upon viewing.

---

### ✨ Core Capabilities

- 📁 **File-Based Markdown Vault**: Plain `.md` files stored on disk for maximum data ownership.
- 🕸️ **Interactive Knowledge Graph**: 2D force physics visualizing bidirectional `[[wikilinks]]`.
- 🤖 **Pydantic AI Agent**: Intelligent reasoning, tool selection, and assistant workflows.
- ⚡ **DBOS Workflows**: Durable, fault-tolerant background executions for inbox triage and graph weaving.
- 💬 **CopilotKit**: Interactive copilot connected to your UI and backend agent.

---

### 🔗 Connected Notes to Explore

- [[Shockwave Architecture]] — Local-first file architecture and agent integration.
- [[Knowledge Graph Features]] — How bidirectional graph linking connects concepts.
- [[Quick Start Guide]] — Markdown cheatsheet and tips.
- [[Projects & Tasks]] — Active project board and milestones.
"""
            },
            {
                "title": "Shockwave Architecture",
                "folder_id": research.id,
                "folder_name": "Research",
                "tags": "shockwave, architecture, design",
                "content": """# Shockwave Architecture 🧠

An architecture study inspired by [Shockwave](https://github.com/stephengpope/shockwave) — a local, file-based note application designed for knowledge retention and intelligent agent integration.

## Architectural Tenets

1. **Local-First File Storage**:
   - Canonical notes live on the local file system as plain Markdown.
   - Database handles indexing, graph topology, and search caches without locking data into a proprietary format.

2. **Bidirectional Knowledge Graph**:
   - Every note can reference another note via `[[Note Title]]`.
   - See [[Knowledge Graph Features]] for details on graph clustering.

3. **Durable Agent Harness**:
   - Pydantic AI drives agent reasoning and tool calls.
   - DBOS guarantees durable execution of long-running workflows like inbox triage.

Related notes: [[Welcome to QNote]], [[Projects & Tasks]]
"""
            },
            {
                "title": "Knowledge Graph Features",
                "folder_id": guides.id,
                "folder_name": "Guides",
                "tags": "graph, visualization, wikilinks",
                "content": """# Knowledge Graph Features 🕸️

Knowledge graphs transform linear notes into an interconnected web of thoughts.

## How it works in QNote:
- **Node Physics**: Notes act as particles with charge repulsion and link tension forces.
- **Wikilinks**: Writing `[[Note Title]]` automatically forms a directed link in the graph.
- **Visual Weight**: Notes with more connections (like [[Welcome to QNote]] or [[Shockwave Architecture]]) appear larger.
- **Interactive Navigation**: Click any node on the graph to immediately open and edit that note.

Related notes:
- [[Welcome to QNote]]
- [[Shockwave Architecture]]
- [[Quick Start Guide]]
"""
            },
            {
                "title": "Quick Start Guide",
                "folder_id": guides.id,
                "folder_name": "Guides",
                "tags": "guide, tutorial, shortcuts",
                "content": """# Quick Start Guide ⚡

Get started with **QNote** in 3 simple steps:

### 1. Creating Notes & Folders
Use the sidebar on the left:
- Click the **+ Note** button to add a note in the current folder.
- Click the **+ Folder** button to create a new folder.

### 2. Linking Notes with Wikilinks
Type `[[` followed by the note title, for example `[[Shockwave Architecture]]` or `[[Knowledge Graph Features]]`.

### 3. Exploring the Knowledge Graph
Click the **Graph** tab in the top header or sidebar to see the visual relationship between all your notes!

---

### Markdown Formatting Cheatsheet

| Element | Markdown Syntax |
| :--- | :--- |
| **Bold** | `**Bold text**` |
| *Italic* | `*Italic text*` |
| `Code` | `` `Inline code` `` |
| Quote | `> Blockquote text` |
| Link | `[[Note Title]]` or `[Text](url)` |
"""
            },
            {
                "title": "Projects & Tasks",
                "folder_id": projects.id,
                "folder_name": "Projects",
                "tags": "projects, tasks, todo",
                "content": """# Projects & Tasks 📋

Manage active projects and research topics.

## Active Projects

### 1. QNote Reborn
- [x] File-based markdown storage in backend folder
- [x] Pydantic AI agent integration with tools
- [x] DBOS durable background workflows
- [x] CopilotKit UI and backend actions
- [x] Interactive Knowledge Graph

### 2. Research & Documentation
- [x] Study [[Shockwave Architecture]]
- [x] Document [[Knowledge Graph Features]]
- [ ] Connect with [[Daily Log]]
"""
            },
            {
                "title": "Daily Log",
                "folder_id": projects.id,
                "folder_name": "Projects",
                "tags": "journal, daily, log",
                "content": """# Daily Log 📅

### Today's Focus
- Initialized new harness combining Next.js, CopilotKit, FastAPI, Pydantic AI, and DBOS.
- Implemented file-based markdown saving and dynamic disk reading.
- Tested wikilink connections to [[Welcome to QNote]] and [[Projects & Tasks]].

### Notes & Insights
- Storing notes directly as files on disk allows external editing and seamless backups.
- DBOS ensures our triage workflows will survive restarts or interruptions.
"""
            }
        ]

        for item in starter_notes:
            rel_path = get_relative_path(item["folder_name"], item["title"])
            write_note_file(rel_path, item["content"])

            note = Note(
                title=item["title"],
                folder_id=item["folder_id"],
                file_path=rel_path,
                tags=item["tags"]
            )
            session.add(note)

        session.commit()
