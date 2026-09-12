from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy import UniqueConstraint
from sqlmodel import SQLModel, Field

class Folder(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    parent_id: Optional[int] = Field(default=None, foreign_key="folder.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class Note(SQLModel, table=True):
    __table_args__ = (
        UniqueConstraint("file_path", name="uq_note_file_path"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(index=True)
    folder_id: Optional[int] = Field(default=None, foreign_key="folder.id", index=True)
    file_path: str = Field(default="", index=True)  # Relative path to disk file in vault
    tags: str = Field(default="")  # Comma-separated tags
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

# DTO schemas
class FolderCreate(SQLModel):
    name: str
    parent_id: Optional[int] = None

class FolderUpdate(SQLModel):
    name: Optional[str] = None
    parent_id: Optional[int] = None

class FolderRead(SQLModel):
    id: int
    name: str
    parent_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

class NoteCreate(SQLModel):
    title: str
    content: Optional[str] = ""
    folder_id: Optional[int] = None
    tags: Optional[str] = ""

class NoteUpdate(SQLModel):
    title: Optional[str] = None
    content: Optional[str] = None
    folder_id: Optional[int] = None
    tags: Optional[str] = None

class NoteRead(SQLModel):
    id: int
    title: str
    content: str  # Read dynamically from disk file
    folder_id: Optional[int] = None
    file_path: str
    tags: str
    created_at: datetime
    updated_at: datetime

class GraphNode(SQLModel):
    id: str
    title: str
    type: str  # "note" | "folder" | "tag"
    note_id: Optional[int] = None
    folder_id: Optional[int] = None
    folder_name: Optional[str] = None
    tags: List[str] = []
    val: int = 1

class GraphLink(SQLModel):
    source: str
    target: str
    type: str = "links_to"

class GraphData(SQLModel):
    nodes: List[GraphNode]
    links: List[GraphLink]

# ================= Machine / Job models (multi-machine test orchestration) =================

class Machine(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    hostname: str = Field(default="")
    os: str = Field(default="")
    gpu: str = Field(default="")
    # Comma-separated capability tags (e.g. "gpu-a100,cuda-12,vllm")
    capabilities: str = Field(default="")
    # online | busy | offline
    status: str = Field(default="offline", index=True)
    token: str = Field(default="")
    last_heartbeat: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Job(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    machine_id: Optional[int] = Field(
        default=None, foreign_key="machine.id", index=True
    )
    # Logical test id from the worker catalog (e.g. "hello_world")
    test_id: str = Field(default="", index=True)
    # Ad-hoc shell command (used when test_id is not provided)
    command: str = Field(default="")
    # Display string for the UI
    description: str = Field(default="")
    # JSON string of parameters passed to the script
    params: str = Field(default="{}")
    # queued | running | passed | failed | cancelled | timeout
    status: str = Field(default="queued", index=True)
    exit_code: Optional[int] = Field(default=None)
    # JSON string with the structured result payload
    result: str = Field(default="")
    timeout_s: int = Field(default=300)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = Field(default=None)
    finished_at: Optional[datetime] = Field(default=None)


class JobLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    job_id: int = Field(foreign_key="job.id", index=True)
    seq: int = Field(default=0)
    stream: str = Field(default="stdout")  # stdout | stderr | system
    line: str = Field(default="")
    created_at: datetime = Field(default_factory=datetime.utcnow)


# DTO schemas
class MachineRegister(SQLModel):
    name: str
    hostname: str = ""
    os: str = ""
    gpu: str = ""
    capabilities: str = ""


class MachineHeartbeat(SQLModel):
    token: str = ""
    status: Optional[str] = None
    capabilities: Optional[str] = None
    gpu: Optional[str] = None


class MachineRead(SQLModel):
    id: int
    name: str
    hostname: str
    os: str
    gpu: str
    capabilities: str
    status: str
    last_heartbeat: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class JobCreate(SQLModel):
    machine_id: Optional[int] = None
    test_id: str = ""
    command: str = ""
    params: Optional[Dict[str, Any]] = None
    timeout_s: int = 300
    description: str = ""


class JobRead(SQLModel):
    id: int
    machine_id: Optional[int] = None
    test_id: str
    command: str
    description: str
    params: str
    status: str
    exit_code: Optional[int] = None
    result: str
    timeout_s: int
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None


class JobLogRead(SQLModel):
    id: int
    job_id: int
    seq: int
    stream: str
    line: str
    created_at: datetime


class WorkerClaimRequest(SQLModel):
    machine_id: int
    token: str = ""


class WorkerLogEntry(SQLModel):
    stream: str = "stdout"
    line: str = ""


class WorkerLogRequest(SQLModel):
    token: str = ""
    logs: List[WorkerLogEntry] = []


class WorkerCompleteRequest(SQLModel):
    token: str = ""
    status: str = "passed"
    exit_code: Optional[int] = None
    result: Optional[Dict[str, Any]] = None
