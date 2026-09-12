export interface Folder {
  id: number
  name: string
  parent_id: number | null
  created_at: string
  updated_at: string
}

export interface Note {
  id: number
  title: string
  content: string
  folder_id: number | null
  file_path: string
  tags: string
  created_at: string
  updated_at: string
}

export interface TreeFolder {
  id: number
  name: string
  parent_id: number | null
  folders: TreeFolder[]
  notes: {
    id: number
    title: string
    folder_id: number | null
    file_path: string
    tags: string[]
    updated_at: string
  }[]
}

export interface TreeData {
  folders: TreeFolder[]
  root_notes: {
    id: number
    title: string
    folder_id: number | null
    file_path: string
    tags: string[]
    updated_at: string
  }[]
}

export interface GraphNode {
  id: string
  title: string
  type: string
  note_id: number | null
  folder_id: number | null
  folder_name: string | null
  tags: string[]
  val: number
  x?: number
  y?: number
  vx?: number
  vy?: number
}

export interface GraphLink {
  source: string | GraphNode
  target: string | GraphNode
  type: string
}

export interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

export interface MentionItem {
  id: number
  title: string
  folder_name: string
  snippet: string
  updated_at: string
}

export interface BacklinksData {
  linked_mentions: MentionItem[]
  unlinked_mentions: MentionItem[]
}

export interface TagItem {
  tag: string
  count: number
}

export interface TriageDecision {
  note_id: number
  note_title: string
  target_folder_id: number | null
  target_folder_name: string
  reason: string
  suggested_tags: string[]
  moved?: {
    success: boolean
    new_path?: string
  }
}

export interface TriageResult {
  message: string
  timestamp: string
  decisions: TriageDecision[]
}
