import type { Note, Folder, TreeData, GraphData, BacklinksData, TagItem, TriageResult } from "../types/note"
import type { Machine, AgentJob, JobLog, TestDefinition } from "../types/agent"

const API_BASE_URL = typeof window !== "undefined"
  ? (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000")
  : "http://localhost:8000"

export const api = {
  async getTree(): Promise<TreeData> {
    const res = await fetch(`${API_BASE_URL}/api/tree`, { cache: "no-store" })
    if (!res.ok) throw new Error("Failed to fetch tree structure")
    return res.json()
  },

  async getNote(id: number): Promise<Note> {
    const res = await fetch(`${API_BASE_URL}/api/notes/${id}`, { cache: "no-store" })
    if (!res.ok) throw new Error(`Failed to fetch note ${id}`)
    return res.json()
  },

  async createNote(data: { title: string; content?: string; folder_id?: number | null; tags?: string }): Promise<Note> {
    const res = await fetch(`${API_BASE_URL}/api/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error("Failed to create note")
    return res.json()
  },

  async updateNote(id: number, data: Partial<{ title: string; content: string; folder_id: number | null; tags: string }>): Promise<Note> {
    const res = await fetch(`${API_BASE_URL}/api/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(`Failed to update note ${id}`)
    return res.json()
  },

  async deleteNote(id: number): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/notes/${id}`, {
      method: "DELETE",
    })
    if (!res.ok) throw new Error(`Failed to delete note ${id}`)
  },

  async createFolder(data: { name: string; parent_id?: number | null }): Promise<Folder> {
    const res = await fetch(`${API_BASE_URL}/api/folders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error("Failed to create folder")
    return res.json()
  },

  async deleteFolder(id: number): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/folders/${id}`, {
      method: "DELETE",
    })
    if (!res.ok) throw new Error(`Failed to delete folder ${id}`)
  },

  async getGraph(): Promise<GraphData> {
    const res = await fetch(`${API_BASE_URL}/api/graph`, { cache: "no-store" })
    if (!res.ok) throw new Error("Failed to fetch graph data")
    return res.json()
  },

  async getBacklinks(noteId: number): Promise<BacklinksData> {
    const res = await fetch(`${API_BASE_URL}/api/notes/${noteId}/backlinks`, { cache: "no-store" })
    if (!res.ok) throw new Error("Failed to fetch backlinks")
    return res.json()
  },

  async getTags(): Promise<TagItem[]> {
    const res = await fetch(`${API_BASE_URL}/api/tags`, { cache: "no-store" })
    if (!res.ok) throw new Error("Failed to fetch tags")
    return res.json()
  },

  async triggerTriage(apply = false): Promise<TriageResult> {
    const res = await fetch(`${API_BASE_URL}/api/workflows/triage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apply_changes: apply }),
    })
    if (!res.ok) throw new Error("Failed to execute DBOS triage workflow")
    return res.json()
  },

  async triggerAutolink(noteId: number): Promise<{ note_id: number; title: string; links_added: string[]; updated_content: string }> {
    const res = await fetch(`${API_BASE_URL}/api/workflows/autolink/${noteId}`, {
      method: "POST",
    })
    if (!res.ok) throw new Error("Failed to execute DBOS autolink workflow")
    return res.json()
  },

  async agentChat(message: string, activeNoteId?: number | null): Promise<{ reply: string }> {
    const res = await fetch(`${API_BASE_URL}/api/agent/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, active_note_id: activeNoteId }),
    })
    if (!res.ok) throw new Error("Failed to chat with agent")
    return res.json()
  },

  async agentTransform(text: string, action: string): Promise<{ transformed_text: string }> {
    const res = await fetch(`${API_BASE_URL}/api/agent/transform`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, action }),
    })
    if (!res.ok) throw new Error("Failed to transform text")
    return res.json()
  }
}

export const fleetApi = {
  async getMachines(): Promise<Machine[]> {
    const res = await fetch(`${API_BASE_URL}/api/machines`, { cache: "no-store" })
    if (!res.ok) throw new Error("Failed to fetch machines")
    return res.json()
  },

  async deleteMachine(id: number): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/machines/${id}`, { method: "DELETE" })
    if (!res.ok) throw new Error(`Failed to delete machine ${id}`)
  },

  async getTests(): Promise<TestDefinition[]> {
    const res = await fetch(`${API_BASE_URL}/api/tests`, { cache: "no-store" })
    if (!res.ok) throw new Error("Failed to fetch test catalog")
    return res.json()
  },

  async dispatchJob(data: {
    machine_id?: number | null
    test_id?: string
    command?: string
    params?: Record<string, unknown>
    timeout_s?: number
    description?: string
  }): Promise<AgentJob> {
    const res = await fetch(`${API_BASE_URL}/api/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error("Failed to dispatch job")
    return res.json()
  },

  async getJobs(params?: { machine_id?: number; status?: string; limit?: number }): Promise<AgentJob[]> {
    const query = new URLSearchParams()
    if (params?.machine_id) query.set("machine_id", String(params.machine_id))
    if (params?.status) query.set("status", params.status)
    if (params?.limit) query.set("limit", String(params.limit))
    const suffix = query.toString() ? `?${query.toString()}` : ""
    const res = await fetch(`${API_BASE_URL}/api/jobs${suffix}`, { cache: "no-store" })
    if (!res.ok) throw new Error("Failed to fetch jobs")
    return res.json()
  },

  async getJob(id: number): Promise<AgentJob> {
    const res = await fetch(`${API_BASE_URL}/api/jobs/${id}`, { cache: "no-store" })
    if (!res.ok) throw new Error(`Failed to fetch job ${id}`)
    return res.json()
  },

  async getJobLogs(id: number, afterSeq = 0): Promise<JobLog[]> {
    const res = await fetch(`${API_BASE_URL}/api/jobs/${id}/logs?after_seq=${afterSeq}`, { cache: "no-store" })
    if (!res.ok) throw new Error(`Failed to fetch logs for job ${id}`)
    return res.json()
  },

  async cancelJob(id: number): Promise<AgentJob> {
    const res = await fetch(`${API_BASE_URL}/api/jobs/${id}/cancel`, { method: "POST" })
    if (!res.ok) throw new Error(`Failed to cancel job ${id}`)
    return res.json()
  },
}
