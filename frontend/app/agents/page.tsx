"use client"

import React, { useEffect, useRef, useState } from "react"
import {
  Activity,
  Ban,
  CheckCircle2,
  Clock,
  Cpu,
  Loader2,
  Play,
  RefreshCw,
  Send,
  Server,
  Terminal,
  XCircle,
} from "lucide-react"

import { fleetApi } from "@/lib/api"
import type { AgentJob, JobLog, Machine, TestDefinition } from "@/types/agent"

type DispatchMode = "test" | "command"

const STATUS_STYLES: Record<string, string> = {
  online: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  busy: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  offline: "bg-muted text-muted-foreground border-border",
}

const JOB_STYLES: Record<string, string> = {
  queued: "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/30",
  running: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
  passed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  failed: "bg-destructive/10 text-destructive border-destructive/30",
  cancelled: "bg-muted text-muted-foreground border-border",
  timeout: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
}

function timeAgo(iso: string | null): string {
  if (!iso) return "never"
  const then = new Date(iso.endsWith("Z") ? iso : `${iso}Z`).getTime()
  if (Number.isNaN(then)) return "—"
  const seconds = Math.floor((Date.now() - then) / 1000)
  if (seconds < 5) return "just now"
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  return `${Math.floor(seconds / 3600)}h ago`
}

function StatusBadge({ status, map }: { status: string; map: Record<string, string> }) {
  const style = map[status] || map.offline || "bg-muted text-muted-foreground border-border"
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${style}`}>
      {status}
    </span>
  )
}

export default function AgentsPage() {
  const [machines, setMachines] = useState<Machine[]>([])
  const [jobs, setJobs] = useState<AgentJob[]>([])
  const [tests, setTests] = useState<TestDefinition[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const [selectedJobId, setSelectedJobId] = useState<number | null>(null)
  const [selectedJob, setSelectedJob] = useState<AgentJob | null>(null)
  const [logs, setLogs] = useState<JobLog[]>([])

  const [mode, setMode] = useState<DispatchMode>("test")
  const [machineId, setMachineId] = useState<string>("any")
  const [testId, setTestId] = useState<string>("hello_world")
  const [command, setCommand] = useState<string>("python --version")
  const [paramsText, setParamsText] = useState<string>('{"name": "World"}')
  const [dispatching, setDispatching] = useState(false)

  const selectedJobIdRef = useRef<number | null>(null)
  const lastSeqRef = useRef(0)
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    selectedJobIdRef.current = selectedJobId
  }, [selectedJobId])

  const refresh = async () => {
    try {
      const [m, j] = await Promise.all([
        fleetApi.getMachines(),
        fleetApi.getJobs({ limit: 50 }),
      ])
      setMachines(m)
      setJobs(j)
      setError(null)
      const currentId = selectedJobIdRef.current
      if (currentId) {
        const found = j.find((job) => job.id === currentId)
        if (found) setSelectedJob(found)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reach orchestrator")
    } finally {
      setLoaded(true)
    }
  }

  useEffect(() => {
    let cancelled = false
    const load = () => {
      Promise.all([fleetApi.getMachines(), fleetApi.getJobs({ limit: 50 })])
        .then(([m, j]) => {
          if (cancelled) return
          setMachines(m)
          setJobs(j)
          setError(null)
          const currentId = selectedJobIdRef.current
          if (currentId) {
            const found = j.find((job) => job.id === currentId)
            if (found) setSelectedJob(found)
          }
        })
        .catch((err: unknown) => {
          if (!cancelled) setError(err instanceof Error ? err.message : "Failed to reach orchestrator")
        })
        .finally(() => {
          if (!cancelled) setLoaded(true)
        })
    }
    fleetApi.getTests().then((t) => !cancelled && setTests(t)).catch(() => {})
    load()
    const timer = setInterval(load, 3000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (!selectedJobId) return
    let active = true
    const pull = () => {
      fleetApi.getJobLogs(selectedJobId, lastSeqRef.current)
        .then((fresh) => {
          if (!active || fresh.length === 0) return
          lastSeqRef.current = fresh[fresh.length - 1].seq
          setLogs((prev) => [...prev, ...fresh])
        })
        .catch(() => {
          /* keep polling */
        })
    }
    pull()
    const timer = setInterval(pull, 1200)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [selectedJobId])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [logs])

  const selectJob = (id: number) => {
    setSelectedJobId(id)
    setLogs([])
    lastSeqRef.current = 0
  }

  const handleDispatch = async () => {
    setDispatching(true)
    try {
      let params: Record<string, unknown> | undefined
      if (mode === "test" && paramsText.trim()) {
        try {
          params = JSON.parse(paramsText)
        } catch {
          throw new Error("Params must be valid JSON")
        }
      }
      const job = await fleetApi.dispatchJob({
        machine_id: machineId === "any" ? null : Number(machineId),
        test_id: mode === "test" ? testId : "",
        command: mode === "command" ? command : "",
        params,
        timeout_s: 120,
      })
      selectJob(job.id)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to dispatch job")
    } finally {
      setDispatching(false)
    }
  }

  const handleCancel = async (id: number) => {
    try {
      await fleetApi.cancelJob(id)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel job")
    }
  }

  const resultSummary = (() => {
    if (!selectedJob?.result) return null
    try {
      return JSON.parse(selectedJob.result) as Record<string, unknown>
    } catch {
      return null
    }
  })()

  return (
    <div className="flex-1 h-screen overflow-hidden flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="h-14 border-b border-border px-5 flex items-center justify-between shrink-0 bg-card/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
            <Server className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Fleet Console</h2>
            <p className="text-[11px] text-muted-foreground">
              Master orchestrator · remote test execution
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 border border-destructive/30 px-2.5 py-1 text-[10px] font-medium text-destructive">
              {error}
            </span>
          )}
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-muted/40 hover:bg-muted text-foreground rounded-lg border border-border transition-all"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Fleet + dispatch */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Machines */}
          <section className="lg:col-span-2 rounded-2xl border border-border bg-card shadow-2xs">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <Activity className="h-3.5 w-3.5 text-primary" />
                Machines
                <span className="text-muted-foreground font-normal">({machines.length})</span>
              </div>
              <span className="text-[10px] text-muted-foreground">auto-refresh 3s</span>
            </div>

            {machines.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                {loaded ? (
                  <>
                    No machines registered yet. Start a worker:
                    <pre className="mt-3 inline-block text-left bg-muted/50 rounded-lg px-3 py-2 font-mono text-[10px]">
                      python -m worker.agent --name devbox
                    </pre>
                  </>
                ) : (
                  "Loading fleet..."
                )}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {machines.map((machine) => (
                  <div key={machine.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-muted/50 border border-border flex items-center justify-center shrink-0">
                        <Cpu className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold truncate">{machine.name}</span>
                          <StatusBadge status={machine.status} map={STATUS_STYLES} />
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {machine.hostname || machine.os || "unknown host"}
                          {machine.gpu ? ` · ${machine.gpu}` : ""}
                          {machine.capabilities ? ` · ${machine.capabilities}` : ""}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end">
                        <Clock className="h-2.5 w-2.5" />
                        {timeAgo(machine.last_heartbeat)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Dispatch */}
          <section className="rounded-2xl border border-border bg-card shadow-2xs">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2 text-xs font-semibold">
              <Play className="h-3.5 w-3.5 text-primary" />
              Dispatch Job
            </div>
            <div className="p-4 space-y-3 text-xs">
              {/* Mode toggle */}
              <div className="flex items-center rounded-lg border border-border bg-muted/30 p-0.5 text-[11px] font-medium">
                <button
                  onClick={() => setMode("test")}
                  className={`flex-1 px-2 py-1 rounded-md transition-all ${mode === "test" ? "bg-background shadow-xs font-semibold" : "text-muted-foreground"}`}
                >
                  Test
                </button>
                <button
                  onClick={() => setMode("command")}
                  className={`flex-1 px-2 py-1 rounded-md transition-all ${mode === "command" ? "bg-background shadow-xs font-semibold" : "text-muted-foreground"}`}
                >
                  Command
                </button>
              </div>

              <div>
                <label className="block font-semibold mb-1">Target machine</label>
                <select
                  value={machineId}
                  onChange={(e) => setMachineId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-2.5 py-2 outline-hidden focus:ring-2 focus:ring-primary/30"
                >
                  <option value="any">Any available machine</option>
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.status})
                    </option>
                  ))}
                </select>
              </div>

              {mode === "test" ? (
                <>
                  <div>
                    <label className="block font-semibold mb-1">Test</label>
                    <select
                      value={testId}
                      onChange={(e) => setTestId(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-2.5 py-2 outline-hidden focus:ring-2 focus:ring-primary/30"
                    >
                      {(tests.length ? tests : [{ test_id: "hello_world", description: "Hello-world smoke test", timeout_s: 60 }]).map((t) => (
                        <option key={t.test_id} value={t.test_id}>
                          {t.test_id} — {t.description}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Params (JSON)</label>
                    <input
                      value={paramsText}
                      onChange={(e) => setParamsText(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-2.5 py-2 font-mono text-[11px] outline-hidden focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block font-semibold mb-1">Shell command</label>
                  <input
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-2.5 py-2 font-mono text-[11px] outline-hidden focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              )}

              <button
                onClick={handleDispatch}
                disabled={dispatching}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 px-3 py-2 text-xs font-semibold transition-all shadow-xs"
              >
                {dispatching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                <span>Run hello world on machine</span>
              </button>
            </div>
          </section>
        </div>

        {/* Jobs + logs */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Job board */}
          <section className="lg:col-span-2 rounded-2xl border border-border bg-card shadow-2xs overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2 text-xs font-semibold">
              <Activity className="h-3.5 w-3.5 text-primary" />
              Job Board
              <span className="text-muted-foreground font-normal">({jobs.length})</span>
            </div>
            {jobs.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">No jobs dispatched yet.</div>
            ) : (
              <div className="divide-y divide-border max-h-[520px] overflow-y-auto">
                {jobs.map((job) => (
                  <button
                    key={job.id}
                    onClick={() => selectJob(job.id)}
                    className={`w-full text-left px-4 py-3 transition-all hover:bg-accent/40 ${selectedJobId === job.id ? "bg-accent/60" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] font-mono text-muted-foreground">#{job.id}</span>
                        <span className="text-xs font-semibold truncate">{job.description}</span>
                      </div>
                      <StatusBadge status={job.status} map={JOB_STYLES} />
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground flex items-center gap-2">
                      <span>{timeAgo(job.created_at)}</span>
                      {job.exit_code !== null && <span>· exit {job.exit_code}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Log viewer */}
          <section className="lg:col-span-3 rounded-2xl border border-border bg-card shadow-2xs overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <Terminal className="h-3.5 w-3.5 text-primary" />
                {selectedJob ? `Logs · Job #${selectedJob.id}` : "Logs"}
                {selectedJob && <StatusBadge status={selectedJob.status} map={JOB_STYLES} />}
              </div>
              {selectedJob && (selectedJob.status === "queued" || selectedJob.status === "running") && (
                <button
                  onClick={() => handleCancel(selectedJob.id)}
                  className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium text-destructive hover:bg-destructive/10 rounded-lg border border-destructive/30 transition-all"
                >
                  <Ban className="h-3 w-3" />
                  Cancel
                </button>
              )}
            </div>

            {/* Result summary */}
            {resultSummary && (
              <div className="px-4 py-2 border-b border-border/60 bg-muted/20 flex flex-wrap items-center gap-3 text-[10px]">
                {typeof resultSummary.duration_s === "number" && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-2.5 w-2.5" />
                    {resultSummary.duration_s}s
                  </span>
                )}
                {selectedJob?.status === "passed" && (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-2.5 w-2.5" /> passed
                  </span>
                )}
                {selectedJob?.status === "failed" && (
                  <span className="flex items-center gap-1 text-destructive">
                    <XCircle className="h-2.5 w-2.5" /> failed
                  </span>
                )}
                {typeof resultSummary.script === "string" && (
                  <span className="font-mono text-muted-foreground">{resultSummary.script}</span>
                )}
              </div>
            )}

            <div className="flex-1 min-h-[360px] max-h-[520px] overflow-y-auto bg-[#0b0e14] text-[#cdd6f4] font-mono text-[11px] leading-relaxed p-4">
              {!selectedJob ? (
                <div className="h-full flex items-center justify-center text-muted-foreground/70">
                  Select a job to view its live output.
                </div>
              ) : logs.length === 0 ? (
                <div className="text-muted-foreground/70">Waiting for output...</div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className={
                      log.stream === "system"
                        ? "text-[#f9e2af]"
                        : log.stream === "stderr"
                        ? "text-[#f38ba8]"
                        : ""
                    }
                  >
                    {log.line}
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
