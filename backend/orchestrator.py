"""Machine registry and test-job orchestration API.

This is the deterministic control-plane surface the master agent (and the UI)
builds on. It is transport-agnostic: today workers poll over HTTP
(``/api/worker/jobs/claim``); a Redis/NATS transport can be slotted in later
without changing the job model or these routes.
"""

import json
import secrets
from datetime import datetime, timedelta
from typing import Any, List, Optional, cast

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlmodel import Session, select

from database import engine, get_session
from models import (
    Job,
    JobCreate,
    JobLog,
    JobLogRead,
    JobRead,
    Machine,
    MachineHeartbeat,
    MachineRead,
    MachineRegister,
    WorkerClaimRequest,
    WorkerCompleteRequest,
    WorkerLogRequest,
)

router = APIRouter()

HEARTBEAT_STALE_AFTER = timedelta(seconds=30)


def _effective_status(machine: Machine) -> str:
    if machine.last_heartbeat is None:
        return "offline"
    if datetime.utcnow() - machine.last_heartbeat > HEARTBEAT_STALE_AFTER:
        return "offline"
    return machine.status or "online"


def _to_machine_read(machine: Machine) -> MachineRead:
    return MachineRead(
        id=cast(int, machine.id),
        name=machine.name,
        hostname=machine.hostname,
        os=machine.os,
        gpu=machine.gpu,
        capabilities=machine.capabilities,
        status=_effective_status(machine),
        last_heartbeat=machine.last_heartbeat,
        created_at=machine.created_at,
        updated_at=machine.updated_at,
    )


def _to_job_read(job: Job) -> JobRead:
    return JobRead(
        id=cast(int, job.id),
        machine_id=job.machine_id,
        test_id=job.test_id,
        command=job.command,
        description=job.description,
        params=job.params,
        status=job.status,
        exit_code=job.exit_code,
        result=job.result,
        timeout_s=job.timeout_s,
        created_at=job.created_at,
        started_at=job.started_at,
        finished_at=job.finished_at,
    )


def _authorize_machine(session: Session, machine_id: int, token: str) -> Machine:
    machine = session.get(Machine, machine_id)
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not registered")
    if machine.token and token != machine.token:
        raise HTTPException(status_code=401, detail="Invalid machine token")
    return machine


# ================= Machines =================

@router.post("/machines/register", response_model=dict)
def register_machine(payload: MachineRegister):
    """Register (or re-register) a worker machine and return its auth token."""
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Machine name is required")

    with Session(engine) as session:
        machine = session.exec(select(Machine).where(Machine.name == name)).first()
        if not machine:
            machine = Machine(name=name, token=secrets.token_hex(16))
            session.add(machine)

        machine.hostname = payload.hostname
        machine.os = payload.os
        machine.gpu = payload.gpu
        machine.capabilities = payload.capabilities
        machine.status = "online"
        machine.last_heartbeat = datetime.utcnow()
        machine.updated_at = datetime.utcnow()
        session.add(machine)
        session.commit()
        session.refresh(machine)

        return {"id": machine.id, "name": machine.name, "token": machine.token}


@router.post("/machines/{machine_id}/heartbeat", response_model=dict)
def machine_heartbeat(machine_id: int, payload: MachineHeartbeat):
    with Session(engine) as session:
        machine = _authorize_machine(session, machine_id, payload.token)
        machine.last_heartbeat = datetime.utcnow()
        machine.updated_at = datetime.utcnow()
        if payload.status:
            machine.status = payload.status
        if payload.capabilities is not None:
            machine.capabilities = payload.capabilities
        if payload.gpu is not None:
            machine.gpu = payload.gpu
        session.add(machine)
        session.commit()
        return {"ok": True, "status": machine.status}


@router.get("/machines", response_model=List[MachineRead])
def list_machines():
    with Session(engine) as session:
        machines = session.exec(select(Machine).order_by(Machine.name)).all()
        return [_to_machine_read(m) for m in machines]


@router.delete("/machines/{machine_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_machine(machine_id: int):
    with Session(engine) as session:
        machine = session.get(Machine, machine_id)
        if not machine:
            raise HTTPException(status_code=404, detail="Machine not found")
        session.delete(machine)
        session.commit()
        return None


# ================= Tests =================

@router.get("/tests")
def list_tests():
    """Advertised test catalog (currently sourced from the bundled worker)."""
    try:
        from worker.runner import list_tests as worker_tests

        return worker_tests()
    except Exception:
        return [{"test_id": "hello_world", "description": "Hello-world smoke test", "timeout_s": 60}]


# ================= Jobs =================

@router.post("/jobs", response_model=JobRead, status_code=status.HTTP_201_CREATED)
def create_job(payload: JobCreate):
    test_id = (payload.test_id or "").strip()
    command = (payload.command or "").strip()
    if not test_id and not command:
        raise HTTPException(status_code=400, detail="Provide a test_id or a command")

    with Session(engine) as session:
        machine_name = "any machine"
        if payload.machine_id is not None:
            machine = session.get(Machine, payload.machine_id)
            if not machine:
                raise HTTPException(status_code=404, detail="Machine not found")
            machine_name = machine.name

        description = payload.description or (
            f"run {test_id or command} on {machine_name}"
        )
        job = Job(
            machine_id=payload.machine_id,
            test_id=test_id,
            command=command,
            description=description,
            params=json.dumps(payload.params or {}),
            timeout_s=payload.timeout_s or 300,
            status="queued",
        )
        session.add(job)
        session.commit()
        session.refresh(job)
        return _to_job_read(job)


@router.get("/jobs", response_model=List[JobRead])
def list_jobs(
    machine_id: Optional[int] = None,
    job_status: Optional[str] = Query(default=None, alias="status"),
    limit: int = 50,
):
    with Session(engine) as session:
        stmt = select(Job)
        if machine_id is not None:
            stmt = stmt.where(Job.machine_id == machine_id)
        if job_status:
            stmt = stmt.where(Job.status == job_status)
        stmt = stmt.order_by(cast(Any, Job.created_at).desc()).limit(max(1, min(limit, 200)))
        jobs = session.exec(stmt).all()
        return [_to_job_read(j) for j in jobs]


@router.get("/jobs/{job_id}", response_model=JobRead)
def get_job(job_id: int):
    with Session(engine) as session:
        job = session.get(Job, job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        return _to_job_read(job)


@router.get("/jobs/{job_id}/logs", response_model=List[JobLogRead])
def get_job_logs(job_id: int, after_seq: int = 0, limit: int = 1000):
    with Session(engine) as session:
        if not session.get(Job, job_id):
            raise HTTPException(status_code=404, detail="Job not found")
        stmt = (
            select(JobLog)
            .where(JobLog.job_id == job_id, JobLog.seq > after_seq)
            .order_by(cast(Any, JobLog.seq))
            .limit(max(1, min(limit, 5000)))
        )
        return session.exec(stmt).all()


@router.post("/jobs/{job_id}/cancel", response_model=JobRead)
def cancel_job(job_id: int):
    with Session(engine) as session:
        job = session.get(Job, job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        if job.status in ("queued", "running"):
            job.status = "cancelled"
            job.finished_at = datetime.utcnow()
            session.add(job)
            session.commit()
            session.refresh(job)
        return _to_job_read(job)


# ================= Worker-facing endpoints (HTTP pull transport) =================

@router.post("/worker/jobs/claim")
def worker_claim_job(payload: WorkerClaimRequest):
    with Session(engine) as session:
        _authorize_machine(session, payload.machine_id, payload.token)

        job = session.exec(
            select(Job)
            .where(
                Job.status == "queued",
                (Job.machine_id == payload.machine_id) | (Job.machine_id == None),  # noqa: E711
            )
            .order_by(cast(Any, Job.created_at))
        ).first()

        if not job:
            return Response(status_code=204)

        job.machine_id = payload.machine_id
        job.status = "running"
        job.started_at = datetime.utcnow()
        session.add(job)

        machine = session.get(Machine, payload.machine_id)
        if machine:
            machine.status = "busy"
            machine.updated_at = datetime.utcnow()
            session.add(machine)

        session.commit()
        session.refresh(job)
        return json.loads(_to_job_read(job).model_dump_json())


def _authorize_job(session: Session, job: Job, token: str) -> None:
    if job.machine_id is None:
        return
    machine = session.get(Machine, job.machine_id)
    if machine and machine.token and token != machine.token:
        raise HTTPException(status_code=401, detail="Invalid machine token")


@router.post("/worker/jobs/{job_id}/logs", response_model=dict)
def worker_job_logs(job_id: int, payload: WorkerLogRequest):
    with Session(engine) as session:
        job = session.get(Job, job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        _authorize_job(session, job, payload.token)

        last = session.exec(
            select(JobLog).where(JobLog.job_id == job_id).order_by(cast(Any, JobLog.seq).desc())
        ).first()
        seq = (last.seq if last else 0)

        for entry in payload.logs:
            seq += 1
            session.add(
                JobLog(job_id=job_id, seq=seq, stream=entry.stream, line=entry.line)
            )

        session.commit()
        return {"ok": True, "stored": len(payload.logs)}


@router.post("/worker/jobs/{job_id}/complete", response_model=dict)
def worker_job_complete(job_id: int, payload: WorkerCompleteRequest):
    with Session(engine) as session:
        job = session.get(Job, job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        _authorize_job(session, job, payload.token)

        # Respect a cancel that arrived while the worker was still running.
        if job.status != "cancelled":
            job.status = payload.status or "failed"
            job.exit_code = payload.exit_code
            job.result = json.dumps(payload.result or {})
            job.finished_at = datetime.utcnow()
            session.add(job)

        if job.machine_id is not None:
            machine = session.get(Machine, job.machine_id)
            if machine:
                machine.status = "online"
                machine.updated_at = datetime.utcnow()
                session.add(machine)

        session.commit()
        return {"ok": True, "status": job.status}

