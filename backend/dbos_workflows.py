import os
import json
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional
from dbos import DBOS
from sqlmodel import Session, select
from models import Note, Folder
from database import engine
from storage import read_note_file, write_note_file, move_note_file, get_relative_path, VAULT_DIR
from pydantic_agent import autolink_text

DBOS_DB_PATH = Path(__file__).resolve().parent / "dbos_system.db"

# Configure DBOS
DBOS(config={
    "name": "qnotes-durable-service",
    "system_database_url": f"sqlite:///{DBOS_DB_PATH}"
})

# Durable Steps
@DBOS.step()
def fetch_inbox_notes_step() -> List[Dict[str, Any]]:
    with Session(engine) as session:
        inbox = session.exec(select(Folder).where(Folder.name.ilike("Inbox"))).first()
        if not inbox:
            return []
        notes = session.exec(select(Note).where(Note.folder_id == inbox.id)).all()
        return [{"id": n.id, "title": n.title, "file_path": n.file_path, "tags": n.tags} for n in notes]

@DBOS.step()
def fetch_available_folders_step() -> List[Dict[str, Any]]:
    with Session(engine) as session:
        folders = session.exec(select(Folder).where(Folder.name.not_ilike("Inbox"))).all()
        return [{"id": f.id, "name": f.name} for f in folders]

@DBOS.step()
def decide_triage_destination_step(note_dict: Dict[str, Any], folders: List[Dict[str, Any]]) -> Dict[str, Any]:
    content = read_note_file(note_dict["file_path"])
    haystack = (note_dict["title"] + " " + content).lower()
    
    # Heuristic/semantic folder matching
    best_folder = folders[0] if folders else {"id": None, "name": "Projects"}
    reason = "General reference note"
    
    for f in folders:
        fn = f["name"].lower()
        if fn in haystack or any(w in haystack for w in fn.split() if len(w) > 3):
            best_folder = f
            reason = f"Matched folder theme '{f['name']}'"
            break

    suggested_tags = ["triaged"]
    if "todo" in haystack or "task" in haystack:
        suggested_tags.append("active")
    if "guide" in haystack or "docs" in haystack:
        suggested_tags.append("documentation")

    return {
        "note_id": note_dict["id"],
        "note_title": note_dict["title"],
        "target_folder_id": best_folder["id"],
        "target_folder_name": best_folder["name"],
        "reason": reason,
        "suggested_tags": suggested_tags
    }

@DBOS.step()
def apply_note_move_step(note_id: int, target_folder_id: int, target_folder_name: str, suggested_tags: List[str]) -> Dict[str, Any]:
    with Session(engine) as session:
        note = session.get(Note, note_id)
        if not note:
            return {"success": False, "error": "Note not found"}
        
        old_path = note.file_path
        new_path = get_relative_path(target_folder_name, note.title)

        conflict = session.exec(
            select(Note).where(
                Note.file_path == new_path,
                Note.id != note.id,
            )
        ).first()
        if conflict:
            return {
                "success": False,
                "error": f"A note already exists at {new_path}",
            }
        
        # Physically move on disk
        try:
            move_note_file(old_path, new_path)
        except FileExistsError as exc:
            return {"success": False, "error": str(exc)}
        
        # Update database metadata
        note.file_path = new_path
        note.folder_id = target_folder_id
        current_tags = [t.strip() for t in note.tags.split(",") if t.strip()]
        merged_tags = list(dict.fromkeys(current_tags + suggested_tags))
        note.tags = ", ".join(merged_tags)
        note.updated_at = datetime.utcnow()
        
        session.add(note)
        session.commit()
        return {
            "success": True,
            "note_id": note.id,
            "title": note.title,
            "new_path": new_path,
            "folder": target_folder_name
        }

# Durable Workflows
@DBOS.workflow()
def durable_inbox_triage_workflow(apply: bool = False) -> Dict[str, Any]:
    notes = fetch_inbox_notes_step()
    if not notes:
        return {"message": "Inbox is empty. No notes to triage!", "triaged": []}
    
    folders = fetch_available_folders_step()
    decisions = []
    
    for n in notes:
        decision = decide_triage_destination_step(n, folders)
        if apply and decision["target_folder_id"]:
            move_res = apply_note_move_step(
                n["id"],
                decision["target_folder_id"],
                decision["target_folder_name"],
                decision["suggested_tags"]
            )
            decision["moved"] = move_res
        decisions.append(decision)
        
    return {
        "message": f"Processed {len(decisions)} notes in durable workflow" + (" (applied)" if apply else " (preview)"),
        "timestamp": datetime.utcnow().isoformat(),
        "decisions": decisions
    }

@DBOS.step()
def autolink_note_step(note_id: int) -> Dict[str, Any]:
    with Session(engine) as session:
        note = session.get(Note, note_id)
        if not note:
            return {"links_added": [], "updated_content": ""}
        
        content = read_note_file(note.file_path)
        all_notes = session.exec(select(Note)).all()
        all_titles = [n.title for n in all_notes]
        
        result = autolink_text(content, all_titles, current_title=note.title)
        if result["links_added"]:
            write_note_file(note.file_path, result["updated_content"])
            note.updated_at = datetime.utcnow()
            session.add(note)
            session.commit()
            
        return {
            "note_id": note.id,
            "title": note.title,
            "links_added": result["links_added"],
            "updated_content": result["updated_content"]
        }

@DBOS.workflow()
def durable_autolink_workflow(note_id: int) -> Dict[str, Any]:
    return autolink_note_step(note_id)
