import re
import os
import json
import uuid
import asyncio
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlmodel import Session, select

from models import (
    Folder, FolderCreate, FolderUpdate, FolderRead,
    Note, NoteCreate, NoteUpdate, NoteRead,
    GraphNode, GraphLink, GraphData
)
from database import engine, create_db_and_tables, get_session
from storage import (
    write_note_file, read_note_file, delete_note_file,
    move_note_file, get_relative_path, list_all_vault_files
)
from pydantic_agent import (
    pydantic_agent, AgentDeps, autolink_text, extract_tasks_from_markdown,
    get_weather, get_weather_data, llm_manager
)
from note_service import create_note_once
from second_brain import (
    build_grounded_prompt,
    format_retrieval_fallback,
    search_second_brain,
)
from dbos_workflows import (
    DBOS, durable_inbox_triage_workflow, durable_autolink_workflow
)
from copilotkit import CopilotKitRemoteEndpoint, Action
from copilotkit.integrations.fastapi import add_fastapi_endpoint

from orchestrator import router as orchestrator_router

app = FastAPI(title="QNote Harness API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(orchestrator_router, prefix="/api", tags=["orchestrator"])

@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    try:
        DBOS.launch()
        print("DBOS launched successfully.")
    except Exception as e:
        print(f"DBOS launch note: {e}")

@app.on_event("shutdown")
def on_shutdown():
    try:
        DBOS.destroy()
    except Exception:
        pass

# ================= CopilotKit Integration =================

from ag_ui.core import (
    EventType, RunStartedEvent, RunFinishedEvent,
    TextMessageStartEvent, TextMessageContentEvent, TextMessageEndEvent,
    ToolCallStartEvent, ToolCallArgsEvent, ToolCallEndEvent, ToolCallResultEvent
)
from ag_ui.encoder import EventEncoder
from copilotkit import CopilotKitRemoteEndpoint, Action, Agent

class PydanticAICopilotAgent(Agent):
    def __init__(self, name: str = "default", description: str = "QNote Pydantic AI Agent"):
        super().__init__(name=name, description=description)
        self.encoder = EventEncoder()

    async def get_state(self, *, thread_id: str):
        return {
            "threadId": thread_id or "",
            "threadExists": False,
            "state": {},
            "messages": [],
        }

    async def execute(self, *, state, config=None, messages, thread_id, actions=None, meta_events=None, **kwargs):
        run_id = str(uuid.uuid4())
        msg_id = str(uuid.uuid4())
        
        last_msg = ""
        if messages:
            for m in reversed(messages):
                c = ""
                r = ""
                if isinstance(m, dict):
                    c = m.get("content", "") or m.get("text", "")
                    r = m.get("role", "")
                elif hasattr(m, "content"):
                    c = getattr(m, "content", "")
                    r = getattr(m, "role", "")
                if r == "user" and c:
                    last_msg = str(c).strip()
                    break
            if not last_msg and messages:
                last = messages[-1]
                last_msg = last.get("content", "") if isinstance(last, dict) else getattr(last, "content", "")
        if not last_msg:
            last_msg = "Hello"

        yield self.encoder.encode(RunStartedEvent(type=EventType.RUN_STARTED, thread_id=thread_id, run_id=run_id))
        
        lower_msg = str(last_msg).lower()
        weather_keywords = ["weather", "temperature", "forecast", "climate", "rain", "sunny", "temp in", "weather in", "weather for"]
        is_weather = any(k in lower_msg for k in weather_keywords)

        if is_weather:
            # Extract location
            loc = "Tokyo"
            m = re.search(r'\b(?:in|for|at|of)\s+([A-Za-z\s]+?)(?:\?|\.|\!|$|\s+and|\s+today|\s+now)', str(last_msg), re.I)
            if m:
                loc = m.group(1).strip()
            else:
                m2 = re.search(r'([A-Za-z\s]+?)\s+weather', str(last_msg), re.I)
                if m2 and m2.group(1).strip().lower() not in ["the", "what", "whats", "what's", "check", "get", "how", "hows", "how's"]:
                    loc = m2.group(1).strip()
                    
            tc_id = f"call_{uuid.uuid4().hex[:8]}"
            # 1. Emit tool call start
            yield self.encoder.encode(ToolCallStartEvent(type=EventType.TOOL_CALL_START, toolCallId=tc_id, toolCallName="get_weather"))
            # 2. Emit tool call args
            yield self.encoder.encode(ToolCallArgsEvent(type=EventType.TOOL_CALL_ARGS, toolCallId=tc_id, delta=json.dumps({"location": loc})))
            # 3. Emit tool call end
            yield self.encoder.encode(ToolCallEndEvent(type=EventType.TOOL_CALL_END, toolCallId=tc_id))
            await asyncio.sleep(0.04)

            # 4. Execute Pydantic AI weather tool
            weather_data = get_weather_data(loc)

            # 5. Emit tool call result for CopilotKit rendering
            yield self.encoder.encode(ToolCallResultEvent(
                type=EventType.TOOL_CALL_RESULT,
                messageId=str(uuid.uuid4()),
                toolCallId=tc_id,
                content=json.dumps(weather_data),
                role="tool"
            ))
            await asyncio.sleep(0.04)

            # 6. Stream conversational assistant response
            yield self.encoder.encode(TextMessageStartEvent(type=EventType.TEXT_MESSAGE_START, message_id=msg_id, role="assistant"))
            
            explanation = (
                f"I checked the current conditions for **{weather_data['location']}** using the Pydantic AI weather tool:\n\n"
                f"- **Condition**: {weather_data['condition']}\n"
                f"- **Temperature**: {weather_data['temperature_c']}°C / {weather_data['temperature_f']}°F (feels like {weather_data['feels_like_c']}°C)\n"
                f"- **Humidity**: {weather_data['humidity']}%\n"
                f"- **Wind**: {weather_data['wind_speed']}\n"
                f"- **UV Index**: {weather_data['uv_index']}/10\n\n"
                f"_{weather_data['forecast']}_"
            )
            
            tokens = re.split(r'(\s+)', explanation)
            for tok in tokens:
                if tok:
                    yield self.encoder.encode(TextMessageContentEvent(type=EventType.TEXT_MESSAGE_CONTENT, message_id=msg_id, delta=tok))
                    await asyncio.sleep(0.012)

            yield self.encoder.encode(TextMessageEndEvent(type=EventType.TEXT_MESSAGE_END, message_id=msg_id))
        else:
            yield self.encoder.encode(TextMessageStartEvent(type=EventType.TEXT_MESSAGE_START, message_id=msg_id, role="assistant"))
            
            reply_text = ""
            info = llm_manager.get_info()
            with Session(engine) as session:
                grounded_prompt, matches = build_grounded_prompt(
                    session,
                    str(last_msg),
                )
            if info["is_real_api"] and info["has_api_key"]:
                try:
                    res = await pydantic_agent.run(grounded_prompt)
                    reply_text = str(getattr(res, "output", getattr(res, "data", "")))
                except Exception as e:
                    reply_text = f"⚠️ Real LLM Error ({info['provider']}): {e}\n\nPlease verify your API key in API Settings."

            if not reply_text:
                if matches:
                    reply_text = format_retrieval_fallback(matches)
                elif "note" in lower_msg or "vault" in lower_msg or "list" in lower_msg:
                    with Session(engine) as session:
                        notes = session.exec(select(Note)).all()
                        note_list = "\n".join([f"- **{n.title}** (Path: `{n.file_path}`)" for n in notes[:6]])
                        reply_text = f"Here are notes currently indexed in your backend disk vault:\n\n{note_list}\n\n*All notes are stored as physical `.md` files in `backend/vault/`.*"
                elif "triage" in lower_msg:
                    reply_text = "You can trigger the **DBOS Durable Inbox Triage** workflow anytime to automatically organize notes from `/Inbox` into `/Projects` or `/Research`."
                elif "hello" in lower_msg or "hi" in lower_msg or "who" in lower_msg:
                    reply_text = "👋 Hello! I am your **QNote Assistant**, built with the **Pydantic AI Harness**, **FastAPI**, and **CopilotKit**.\n\n- 🌤️ **Real Live Weather**: Open-Meteo is active! Try asking *\"What's the weather in Tokyo?\"* or *\"Paris weather\"*.\n- 🤖 **Real LLM**: Click **API Settings** to plug in your Gemini, OpenAI, Anthropic, or Ollama API key!"
                else:
                    reply_text = f"Received: \"{last_msg}\". Connected to Pydantic AI harness with real Open-Meteo weather API. Configure your LLM API in API Settings for complete reasoning!"

            tokens = re.split(r'(\s+)', reply_text)
            for tok in tokens:
                if tok:
                    yield self.encoder.encode(TextMessageContentEvent(type=EventType.TEXT_MESSAGE_CONTENT, message_id=msg_id, delta=tok))
                    await asyncio.sleep(0.012)

            yield self.encoder.encode(TextMessageEndEvent(type=EventType.TEXT_MESSAGE_END, message_id=msg_id))

        yield self.encoder.encode(RunFinishedEvent(type=EventType.RUN_FINISHED, thread_id=thread_id, run_id=run_id))

def copilot_create_note(title: str, content: str = "", folder: str = "Inbox") -> str:
    with Session(engine) as session:
        f = session.exec(select(Folder).where(Folder.name.ilike(folder.strip()))).first()
        f_id = f.id if f else None
        result = create_note_once(
            session,
            title=title,
            content=content,
            folder_id=f_id,
            folder_name=f.name if f else None,
        )
        if not result.created:
            return f"Note '{result.note.title}' already exists at {result.note.file_path}."
        return f"Created note '{result.note.title}' at {result.note.file_path}"

def copilot_read_note(title: str) -> str:
    with Session(engine) as session:
        n = session.exec(select(Note).where(Note.title.ilike(title.strip()))).first()
        if not n:
            return f"Note '{title}' not found."
        content = read_note_file(n.file_path)
        return content or "Note is empty."


def copilot_search_second_brain(query: str) -> List[Dict[str, str]]:
    with Session(engine) as session:
        matches = search_second_brain(session, query)
    return [
        {
            "title": match["title"],
            "folder": match["folder"],
            "file_path": match["file_path"],
            "snippet": match["content"][:500],
        }
        for match in matches
    ]

def copilot_run_triage(apply: bool = False) -> str:
    res = durable_inbox_triage_workflow(apply=apply)
    return f"Triage complete: {res.get('message')}"

def copilot_get_weather(location: str) -> Dict[str, Any]:
    return get_weather_data(location)

copilot_sdk = CopilotKitRemoteEndpoint(
    actions=[
        Action(
            name="get_weather",
            description="Get current weather conditions and forecast for a given location or city",
            parameters=[
                {"name": "location", "type": "string", "description": "City or location name (e.g. Tokyo, Paris, London, New York)", "required": True},
            ],
            handler=copilot_get_weather
        ),
        Action(
            name="create_note",
            description="Create a new note stored on disk in the backend vault folder",
            parameters=[
                {"name": "title", "type": "string", "description": "The title of the note", "required": True},
                {"name": "content", "type": "string", "description": "Markdown content of the note", "required": False},
                {"name": "folder", "type": "string", "description": "Target folder (e.g. Inbox, Projects, Guides)", "required": False},
            ],
            handler=copilot_create_note
        ),
        Action(
            name="search_second_brain",
            description="Search QNote's Second Brain wiki by title, tags, and Markdown content",
            parameters=[
                {"name": "query", "type": "string", "description": "Question or keywords to search for", "required": True},
            ],
            handler=copilot_search_second_brain
        ),
        Action(
            name="read_note",
            description="Read the markdown content of a note directly from disk",
            parameters=[
                {"name": "title", "type": "string", "description": "Note title to read", "required": True},
            ],
            handler=copilot_read_note
        ),
        Action(
            name="run_inbox_triage",
            description="Trigger the DBOS durable workflow to triage notes in Inbox",
            parameters=[
                {"name": "apply", "type": "boolean", "description": "Whether to apply the moves or just preview", "required": False},
            ],
            handler=copilot_run_triage
        )
    ],
    agents=[
        PydanticAICopilotAgent(name="default", description="QNote Pydantic AI Agent")
    ]
)
add_fastapi_endpoint(app, copilot_sdk, "/copilotkit")

# ================= DTOs =================

class AgentChatRequest(BaseModel):
    message: str
    active_note_id: Optional[int] = None
    history: List[Dict[str, str]] = []

class AutoLinkRequest(BaseModel):
    note_id: int
    content: Optional[str] = None

class TransformRequest(BaseModel):
    text: str
    action: str  # "summarize" | "expand" | "extract_tasks" | "fix_grammar" | "generate_outline"

class TriageRequest(BaseModel):
    apply_changes: bool = False

class LLMConfigRequest(BaseModel):
    provider: str  # "openrouter" | "gemini" | "openai" | "anthropic" | "ollama" | "test"
    apiKey: Optional[str] = ""
    model: Optional[str] = ""
    baseUrl: Optional[str] = ""

# ================= LLM Configuration Endpoints =================

@app.get("/api/config/llm")
def get_llm_config():
    """Returns currently configured LLM provider, model, and connectivity status."""
    return llm_manager.get_info()

@app.post("/api/config/llm")
async def update_llm_config(req: LLMConfigRequest):
    """Updates and activates a real LLM provider, including OpenRouter."""
    info = llm_manager.set_config(
        provider=req.provider,
        api_key=req.apiKey or "",
        model_name=req.model or "",
        base_url=req.baseUrl or ""
    )
    # Test connection if real credentials provided
    if info["is_real_api"] and info["has_api_key"]:
        try:
            res = await pydantic_agent.run("Respond with 'OK' if you can read this message.")
            info["status"] = "connected"
            info["test_response"] = str(getattr(res, "output", getattr(res, "data", "OK")))
        except Exception as e:
            info["status"] = "error"
            info["error"] = str(e)
    else:
        info["status"] = "ready"

    return info

# ================= Folders API =================

@app.get("/api/folders", response_model=List[FolderRead])
def get_folders(session: Session = Depends(get_session)):
    return session.exec(select(Folder).order_by(Folder.name)).all()

@app.post("/api/folders", response_model=FolderRead, status_code=status.HTTP_201_CREATED)
def create_folder(folder_in: FolderCreate, session: Session = Depends(get_session)):
    folder = Folder(name=folder_in.name.strip(), parent_id=folder_in.parent_id)
    session.add(folder)
    session.commit()
    session.refresh(folder)
    return folder

@app.patch("/api/folders/{folder_id}", response_model=FolderRead)
def update_folder(folder_id: int, folder_in: FolderUpdate, session: Session = Depends(get_session)):
    folder = session.get(Folder, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    if folder_in.name is not None:
        folder.name = folder_in.name.strip()
    if folder_in.parent_id is not None:
        folder.parent_id = folder_in.parent_id
    folder.updated_at = datetime.utcnow()
    session.add(folder)
    session.commit()
    session.refresh(folder)
    return folder

@app.delete("/api/folders/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_folder(folder_id: int, session: Session = Depends(get_session)):
    folder = session.get(Folder, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    
    notes = session.exec(select(Note).where(Note.folder_id == folder_id)).all()
    for note in notes:
        delete_note_file(note.file_path)
        session.delete(note)
        
    session.delete(folder)
    session.commit()
    return None

# ================= Notes API (File-Based Storage + SQLite Index) =================

@app.get("/api/notes", response_model=List[NoteRead])
def get_notes(folder_id: Optional[int] = None, session: Session = Depends(get_session)):
    stmt = select(Note)
    if folder_id is not None:
        stmt = stmt.where(Note.folder_id == folder_id)
    stmt = stmt.order_by(Note.updated_at.desc())
    notes = session.exec(stmt).all()
    
    # Read file content from disk for each note
    results = []
    for n in notes:
        content = read_note_file(n.file_path)
        results.append(NoteRead(
            id=n.id,
            title=n.title,
            content=content,
            folder_id=n.folder_id,
            file_path=n.file_path,
            tags=n.tags,
            created_at=n.created_at,
            updated_at=n.updated_at
        ))
    return results

@app.get("/api/notes/{note_id}", response_model=NoteRead)
def get_note(note_id: int, session: Session = Depends(get_session)):
    note = session.get(Note, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    # Render/read content directly from backend file
    content = read_note_file(note.file_path)
    return NoteRead(
        id=note.id,
        title=note.title,
        content=content,
        folder_id=note.folder_id,
        file_path=note.file_path,
        tags=note.tags,
        created_at=note.created_at,
        updated_at=note.updated_at
    )

@app.post("/api/notes", response_model=NoteRead, status_code=status.HTTP_201_CREATED)
def create_note(note_in: NoteCreate, session: Session = Depends(get_session)):
    folder_name = "Root"
    if note_in.folder_id:
        f = session.get(Folder, note_in.folder_id)
        if f:
            folder_name = f.name

    # Auto detect tags from content
    tags_str = note_in.tags or ""
    auto_tags = re.findall(r'(?<!\S)#([a-zA-Z0-9_\-]+)', note_in.content or "")
    if auto_tags:
        existing = [t.strip() for t in tags_str.split(",") if t.strip()]
        tags_str = ", ".join(list(dict.fromkeys(existing + auto_tags)))

    result = create_note_once(
        session,
        title=note_in.title,
        content=note_in.content or "",
        folder_id=note_in.folder_id,
        tags=tags_str,
        folder_name=folder_name,
    )
    note = result.note
    content = read_note_file(note.file_path)

    return NoteRead(
        id=note.id,
        title=note.title,
        content=content,
        folder_id=note.folder_id,
        file_path=note.file_path,
        tags=note.tags,
        created_at=note.created_at,
        updated_at=note.updated_at
    )

@app.patch("/api/notes/{note_id}", response_model=NoteRead)
def update_note(note_id: int, note_in: NoteUpdate, session: Session = Depends(get_session)):
    note = session.get(Note, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    content = read_note_file(note.file_path)
    if note_in.content is not None:
        content = note_in.content

    # Check if folder or title changed -> move file on disk
    new_title = note_in.title.strip() if note_in.title else note.title
    new_folder_id = note_in.folder_id if note_in.folder_id is not None else note.folder_id
    
    folder_name = "Root"
    if new_folder_id:
        f = session.get(Folder, new_folder_id)
        if f:
            folder_name = f.name
            
    expected_rel_path = get_relative_path(folder_name, new_title)
    if expected_rel_path != note.file_path:
        conflict = session.exec(
            select(Note).where(
                Note.file_path == expected_rel_path,
                Note.id != note.id,
            )
        ).first()
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A note already exists at {expected_rel_path}",
            )
        try:
            move_note_file(note.file_path, expected_rel_path)
        except FileExistsError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=str(exc),
            ) from exc
        note.file_path = expected_rel_path

    # Write updated content to disk file
    write_note_file(note.file_path, content)

    # Update metadata
    if note_in.title:
        note.title = new_title
    if note_in.folder_id is not None:
        note.folder_id = new_folder_id if new_folder_id > 0 else None
    if note_in.tags is not None:
        note.tags = note_in.tags
    else:
        auto_tags = re.findall(r'(?<!\S)#([a-zA-Z0-9_\-]+)', content)
        if auto_tags:
            existing = [t.strip() for t in note.tags.split(",") if t.strip()]
            note.tags = ", ".join(list(dict.fromkeys(existing + auto_tags)))

    note.updated_at = datetime.utcnow()
    session.add(note)
    session.commit()
    session.refresh(note)

    return NoteRead(
        id=note.id,
        title=note.title,
        content=content,
        folder_id=note.folder_id,
        file_path=note.file_path,
        tags=note.tags,
        created_at=note.created_at,
        updated_at=note.updated_at
    )

@app.delete("/api/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(note_id: int, session: Session = Depends(get_session)):
    note = session.get(Note, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    delete_note_file(note.file_path)
    session.delete(note)
    session.commit()
    return None

# ================= Tree, Graph & Backlinks =================

@app.get("/api/tree")
def get_tree(session: Session = Depends(get_session)):
    folders = session.exec(select(Folder).order_by(Folder.name)).all()
    notes = session.exec(select(Note).order_by(Note.title)).all()

    folder_map = {}
    for f in folders:
        folder_map[f.id] = {
            "id": f.id,
            "name": f.name,
            "parent_id": f.parent_id,
            "folders": [],
            "notes": []
        }

    root_folders = []
    for f in folders:
        if f.parent_id and f.parent_id in folder_map:
            folder_map[f.parent_id]["folders"].append(folder_map[f.id])
        else:
            root_folders.append(folder_map[f.id])

    root_notes = []
    for n in notes:
        item = {
            "id": n.id,
            "title": n.title,
            "folder_id": n.folder_id,
            "file_path": n.file_path,
            "tags": [t.strip() for t in n.tags.split(",") if t.strip()],
            "updated_at": n.updated_at.isoformat()
        }
        if n.folder_id and n.folder_id in folder_map:
            folder_map[n.folder_id]["notes"].append(item)
        else:
            root_notes.append(item)

    return {"folders": root_folders, "root_notes": root_notes}

@app.get("/api/graph", response_model=GraphData)
def get_graph(session: Session = Depends(get_session)):
    notes = session.exec(select(Note)).all()
    folders = session.exec(select(Folder)).all()
    f_map = {f.id: f.name for f in folders}

    title_to_note = {n.title.strip().lower(): n for n in notes}
    nodes: List[GraphNode] = []
    links: List[GraphLink] = []
    counts: Dict[str, int] = {}

    for n in notes:
        nid = f"note-{n.id}"
        tag_list = [t.strip() for t in n.tags.split(",") if t.strip()]
        folder_name = f_map.get(n.folder_id, "Root")
        nodes.append(GraphNode(
            id=nid,
            title=n.title,
            type="note",
            note_id=n.id,
            folder_id=n.folder_id,
            folder_name=folder_name,
            tags=tag_list,
            val=1
        ))
        counts[nid] = 0

    wikilink_regex = re.compile(r'\[\[(.*?)\]\]')
    seen = set()

    for n in notes:
        src = f"note-{n.id}"
        content = read_note_file(n.file_path)
        matches = wikilink_regex.findall(content)
        for m in matches:
            target_title = m.split("|")[0].strip().lower()
            if target_title in title_to_note:
                target_note = title_to_note[target_title]
                if target_note.id != n.id:
                    tgt = f"note-{target_note.id}"
                    key = f"{src}->{tgt}"
                    if key not in seen:
                        seen.add(key)
                        links.append(GraphLink(source=src, target=tgt, type="links_to"))
                        counts[src] = counts.get(src, 0) + 1
                        counts[tgt] = counts.get(tgt, 0) + 1

    for node in nodes:
        node.val = max(1, counts.get(node.id, 0) + 1)

    return GraphData(nodes=nodes, links=links)

@app.get("/api/notes/{note_id}/backlinks")
def get_backlinks(note_id: int, session: Session = Depends(get_session)):
    current_note = session.get(Note, note_id)
    if not current_note:
        raise HTTPException(status_code=404, detail="Note not found")

    all_notes = session.exec(select(Note).where(Note.id != note_id)).all()
    folders = session.exec(select(Folder)).all()
    f_map = {f.id: f.name for f in folders}

    escaped = re.escape(current_note.title.strip())
    wiki_re = re.compile(rf'\[\[{escaped}(\|.*?)?\]\]', re.IGNORECASE)
    unlinked_re = re.compile(rf'(?<!\[\[)\b({escaped})\b(?!\]\])', re.IGNORECASE)

    linked = []
    unlinked = []

    for other in all_notes:
        content = read_note_file(other.file_path)
        f_name = f_map.get(other.folder_id, "Root")

        if wiki_re.search(content):
            snippet = content[:120].replace("\n", " ") + "..."
            linked.append({
                "id": other.id,
                "title": other.title,
                "folder_name": f_name,
                "snippet": snippet,
                "updated_at": other.updated_at.isoformat()
            })
        elif unlinked_re.search(content):
            snippet = content[:120].replace("\n", " ") + "..."
            unlinked.append({
                "id": other.id,
                "title": other.title,
                "folder_name": f_name,
                "snippet": snippet,
                "updated_at": other.updated_at.isoformat()
            })

    return {"linked_mentions": linked, "unlinked_mentions": unlinked}

@app.get("/api/tags")
def get_tags(session: Session = Depends(get_session)):
    notes = session.exec(select(Note)).all()
    counts = {}
    for n in notes:
        tags = [t.strip() for t in n.tags.split(",") if t.strip()]
        for t in tags:
            counts[t] = counts.get(t, 0) + 1
    return sorted([{"tag": k, "count": v} for k, v in counts.items()], key=lambda x: x["count"], reverse=True)

# ================= Durable DBOS Workflow Endpoints =================

@app.post("/api/workflows/triage")
def trigger_durable_triage(req: TriageRequest):
    """Executes the durable DBOS workflow for inbox note triage."""
    res = durable_inbox_triage_workflow(apply=req.apply_changes)
    return res

@app.post("/api/workflows/autolink/{note_id}")
def trigger_durable_autolink(note_id: int):
    """Executes the durable DBOS workflow for smart graph weaving and autolinking."""
    res = durable_autolink_workflow(note_id)
    return res

# ================= Pydantic AI Agent Endpoint =================

@app.post("/api/agent/chat")
async def agent_chat(req: AgentChatRequest, session: Session = Depends(get_session)):
    prompt = req.message
    grounded_prompt, matches = build_grounded_prompt(
        session,
        prompt,
        active_note_id=req.active_note_id,
    )
    deps = AgentDeps(active_note_id=req.active_note_id, session=session)
    
    try:
        result = await pydantic_agent.run(grounded_prompt, deps=deps)
        return {"reply": str(getattr(result, "output", getattr(result, "data", "")))}
    except Exception as e:
        active_title = ""
        active_content = ""
        if req.active_note_id:
            active = session.get(Note, req.active_note_id)
            if active:
                active_title = active.title
                active_content = read_note_file(active.file_path)

        lower = prompt.lower()
        if matches:
            reply = format_retrieval_fallback(matches)
        elif "summarize" in lower:
            reply = f"### 📌 Summary of '{active_title or 'Vault'}'\n\n- **Primary Focus**: Notes are saved directly to disk files in `backend/vault/`.\n- **Graph Connections**: Linked via `[[wikilinks]]`.\n- **Durable Workflows**: DBOS manages background triage and autolinking."
        elif "tasks" in lower or "action" in lower:
            tasks = extract_tasks_from_markdown(active_content)
            task_md = "\n".join([f"- [ ] {t}" for t in tasks]) if tasks else "- [ ] Review knowledge graph nodes\n- [ ] Run durable inbox triage\n- [ ] Weave new wikilinks"
            reply = f"### ✅ Action Items\n\n{task_md}"
        else:
            reply = f"I am your **QNote Agent** powered by Pydantic AI, DBOS, and CopilotKit.\n\nI operate directly over your markdown files in `backend/vault/`. Ask me to summarize notes, extract tasks, or triage your inbox."
        
        return {"reply": reply}

@app.post("/api/agent/transform")
def transform_text(req: TransformRequest):
    action = req.action
    text = req.text
    if action == "summarize":
        res = f"### 📌 Key Takeaways\n\n- " + "\n- ".join([l.strip() for l in text.split("\n") if l.strip()][:3])
    elif action == "extract_tasks":
        tasks = extract_tasks_from_markdown(text)
        res = "\n".join([f"- [ ] {t}" for t in tasks]) if tasks else "- [ ] Review requirements\n- [ ] Update documentation"
    elif action == "generate_outline":
        res = f"# Outline\n\n## Section 1: Overview\n- Key concepts\n\n## Section 2: Implementation\n- Architecture details\n\n## Section 3: Next Steps\n- Follow-ups"
    else:
        res = text.strip()
    return {"transformed_text": res}

@app.post("/api/agent/stream")
async def agent_stream(req: AgentChatRequest, session: Session = Depends(get_session)):
    """Streaming SSE endpoint supporting real-time token emission and Pydantic AI weather tool calls."""
    async def event_generator():
        prompt = req.message
        lower = prompt.lower()
        weather_keywords = ["weather", "temperature", "forecast", "climate", "rain", "sunny", "temp"]
        is_weather = any(k in lower for k in weather_keywords)

        if is_weather:
            loc = "Tokyo"
            m = re.search(r'\b(?:in|for|at|of)\s+([A-Za-z\s]+?)(?:\?|\.|\!|$|\s+and|\s+today|\s+now)', prompt, re.I)
            if m:
                loc = m.group(1).strip()
            else:
                m2 = re.search(r'([A-Za-z\s]+?)\s+weather', prompt, re.I)
                if m2 and m2.group(1).strip().lower() not in ["the", "what", "whats", "what's", "check", "get", "how", "hows", "how's"]:
                    loc = m2.group(1).strip()

            yield f"event: tool_start\ndata: {json.dumps({'name': 'get_weather', 'args': {'location': loc}})}\n\n"
            await asyncio.sleep(0.05)
            
            w_data = get_weather_data(loc)
            yield f"event: tool_result\ndata: {json.dumps({'name': 'get_weather', 'result': w_data})}\n\n"
            await asyncio.sleep(0.05)

            explanation = (
                f"Current meteorological data for **{w_data['location']}**:\n\n"
                f"- **Condition**: {w_data['condition']}\n"
                f"- **Temperature**: {w_data['temperature_c']}°C / {w_data['temperature_f']}°F\n"
                f"- **Humidity**: {w_data['humidity']}%\n"
                f"- **Wind**: {w_data['wind_speed']}\n"
                f"- **UV Index**: {w_data['uv_index']}/10\n\n"
                f"*{w_data['forecast']}*"
            )

            for tok in re.split(r'(\s+)', explanation):
                if tok:
                    yield f"event: delta\ndata: {json.dumps({'delta': tok})}\n\n"
                    await asyncio.sleep(0.015)
        else:
            reply = ""
            info = llm_manager.get_info()
            grounded_prompt, matches = build_grounded_prompt(
                session,
                prompt,
                active_note_id=req.active_note_id,
            )
            if info["is_real_api"] and info["has_api_key"]:
                try:
                    res = await pydantic_agent.run(grounded_prompt, deps=AgentDeps(active_note_id=req.active_note_id, session=session))
                    reply = str(getattr(res, "output", getattr(res, "data", "")))
                except Exception as e:
                    reply = f"⚠️ Real LLM Error ({info['provider']}): {e}\n\nPlease check your credentials in the API Settings modal."

            if not reply:
                if matches:
                    reply = format_retrieval_fallback(matches)
                elif req.active_note_id:
                    active = session.get(Note, req.active_note_id)
                    if active and "summarize" in lower:
                        reply = f"### 📌 Summary of '{active.title}'\n\n- Note stored on disk in `{active.file_path}`.\n- Ready for linking and exploration."
                if not reply:
                    if "note" in lower or "vault" in lower:
                        notes = session.exec(select(Note)).all()
                        note_list = "\n".join([f"- **{n.title}** (`{n.file_path}`)" for n in notes[:5]])
                        reply = f"Here are notes currently indexed in your backend disk vault:\n\n{note_list}"
                    else:
                        reply = (
                            f"👋 Hello! I am your **QNote Agent** running on the Pydantic AI harness with CopilotKit.\n\n"
                            f"- 🌤️ **Live Weather API**: Connected to real-time Open-Meteo API! Try *\"What's the weather in Tokyo?\"*\n"
                            f"- 🤖 **Real LLM API**: Click **API Settings** in the top bar to connect Google Gemini, OpenAI, Anthropic, or Ollama."
                        )

            for tok in re.split(r'(\s+)', reply):
                if tok:
                    yield f"event: delta\ndata: {json.dumps({'delta': tok})}\n\n"
                    await asyncio.sleep(0.015)

        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
