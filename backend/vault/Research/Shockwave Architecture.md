# Shockwave Architecture 🧠

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
