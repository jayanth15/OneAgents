export interface Machine {
  id: number
  name: string
  hostname: string
  os: string
  gpu: string
  capabilities: string
  status: string
  last_heartbeat: string | null
  created_at: string
  updated_at: string
}

export interface AgentJob {
  id: number
  machine_id: number | null
  test_id: string
  command: string
  description: string
  params: string
  status: string
  exit_code: number | null
  result: string
  timeout_s: number
  created_at: string
  started_at: string | null
  finished_at: string | null
}

export interface JobLog {
  id: number
  job_id: number
  seq: number
  stream: string
  line: string
  created_at: string
}

export interface TestDefinition {
  test_id: string
  description: string
  timeout_s: number
}
