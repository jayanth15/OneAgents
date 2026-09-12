"use client"

import React, { useState, useEffect, useRef } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
  Sparkles,
  FileCode,
  Eye,
  Columns,
  CheckCircle2,
  HardDrive,
  ListTodo,
  FileText,
  Trash2,
  Save,
  Link as LinkIcon
} from "lucide-react"
import type { Note, Folder } from "../types/note"

interface NoteWorkspaceProps {
  note: Note | null
  folders: Folder[]
  onUpdateNote: (data: Partial<{ title: string; content: string; folder_id: number | null; tags: string }>) => Promise<void>
  onAutoLink: () => Promise<void>
  onTransform: (action: string) => Promise<void>
  onNavigateToTitle: (title: string) => void
  isAutoLinking: boolean
  isTransforming: boolean
}

export function NoteWorkspace({
  note,
  folders,
  onUpdateNote,
  onAutoLink,
  onTransform,
  onNavigateToTitle,
  isAutoLinking,
  isTransforming
}: NoteWorkspaceProps) {
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [folderId, setFolderId] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<"split" | "edit" | "preview">("split")
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (note) {
      setTitle(note.title)
      setContent(note.content)
      setFolderId(note.folder_id)
      setLastSaved(new Date(note.updated_at))
    } else {
      setTitle("")
      setContent("")
      setFolderId(null)
    }
  }, [note?.id])

  const handleTitleChange = (val: string) => {
    setTitle(val)
    scheduleSave({ title: val })
  }

  const handleContentChange = (val: string) => {
    setContent(val)
    scheduleSave({ content: val })
  }

  const handleFolderChange = (val: number | null) => {
    setFolderId(val)
    onUpdateNote({ folder_id: val })
  }

  const scheduleSave = (patch: Partial<{ title: string; content: string }>) => {
    setIsSaving(true)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(async () => {
      try {
        await onUpdateNote(patch)
        setLastSaved(new Date())
      } finally {
        setIsSaving(false)
      }
    }, 600)
  }

  if (!note) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
        <FileText size={48} className="mb-4 opacity-30" />
        <h3 className="text-lg font-semibold text-foreground mb-1">No Note Selected</h3>
        <p className="text-sm">Select a note from the vault sidebar or create a new one to begin editing.</p>
      </div>
    )
  }

  // Pre-process wikilinks for rendering
  const renderMarkdownWithWikilinks = (text: string) => {
    // Replace [[Title]] or [[Title|Alias]] with custom markdown links
    const parsed = text.replace(/\[\[(.*?)(?:\|(.*?))?\]\]/g, (match, target, alias) => {
      const display = alias || target
      return `[${display}](#wikilink:${encodeURIComponent(target)})`
    })
    return parsed
  }

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-background">
      {/* Top Header Bar */}
      <header className="px-6 py-3 border-b border-border flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="w-full text-xl font-bold bg-transparent border-none focus:outline-none focus:ring-0 text-foreground"
            placeholder="Note Title..."
          />
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1 font-mono text-[11px] bg-muted/70 px-1.5 py-0.5 rounded">
              <HardDrive size={12} className="text-primary" />
              {note.file_path || "vault/Untitled.md"}
            </span>

            <select
              value={folderId ?? ""}
              onChange={(e) => handleFolderChange(e.target.value ? Number(e.target.value) : null)}
              className="bg-muted/50 border border-border/60 rounded px-1.5 py-0.5 text-xs focus:outline-none"
            >
              <option value="">Root Folder</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>

            <span className="text-[11px]">
              {isSaving ? (
                <span className="text-amber-500 animate-pulse">Saving to disk...</span>
              ) : lastSaved ? (
                <span className="text-muted-foreground/70">
                  Saved {lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              ) : null}
            </span>
          </div>
        </div>

        {/* Action Buttons & View Switches */}
        <div className="flex items-center gap-1.5">
          {/* Smart AutoLink Button */}
          <button
            onClick={onAutoLink}
            disabled={isAutoLinking}
            title="Weave [[wikilinks]] into this note using AI & DBOS"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors"
          >
            <Sparkles size={14} className={isAutoLinking ? "animate-spin" : ""} />
            <span>Weave Links</span>
          </button>

          {/* Extract Tasks Button */}
          <button
            onClick={() => onTransform("extract_tasks")}
            disabled={isTransforming}
            title="Extract actionable tasks checklist"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-muted hover:bg-accent text-foreground disabled:opacity-50 transition-colors"
          >
            <ListTodo size={14} />
            <span>Tasks</span>
          </button>

          {/* Summarize Button */}
          <button
            onClick={() => onTransform("summarize")}
            disabled={isTransforming}
            title="Summarize note"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-muted hover:bg-accent text-foreground disabled:opacity-50 transition-colors"
          >
            <FileText size={14} />
            <span>Summarize</span>
          </button>

          <div className="h-4 w-[1px] bg-border mx-1" />

          {/* Mode Switcher */}
          <div className="flex items-center border border-border rounded-md overflow-hidden bg-muted/40 p-0.5 text-xs">
            <button
              onClick={() => setViewMode("edit")}
              className={`p-1.5 rounded ${viewMode === "edit" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              title="Editor only"
            >
              <FileCode size={14} />
            </button>
            <button
              onClick={() => setViewMode("split")}
              className={`p-1.5 rounded ${viewMode === "split" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              title="Split view"
            >
              <Columns size={14} />
            </button>
            <button
              onClick={() => setViewMode("preview")}
              className={`p-1.5 rounded ${viewMode === "preview" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              title="Preview only"
            >
              <Eye size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Panels */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Panel */}
        {(viewMode === "edit" || viewMode === "split") && (
          <div className="flex-1 h-full border-r border-border/50 flex flex-col">
            <textarea
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder="Write your markdown note here... Use [[Note Title]] to link to other notes in the vault."
              className="w-full h-full p-6 bg-transparent resize-none focus:outline-none font-mono text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60"
            />
          </div>
        )}

        {/* Live Preview Panel */}
        {(viewMode === "preview" || viewMode === "split") && (
          <div className="flex-1 h-full overflow-y-auto p-6 prose dark:prose-invert max-w-none text-sm">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href, children, ...props }) => {
                  if (href?.startsWith("#wikilink:")) {
                    const targetTitle = decodeURIComponent(href.replace("#wikilink:", ""))
                    return (
                      <span
                        onClick={() => onNavigateToTitle(targetTitle)}
                        className="cursor-pointer inline-flex items-center gap-0.5 text-primary font-semibold underline underline-offset-2 hover:opacity-80"
                      >
                        <LinkIcon size={12} className="inline mr-0.5" />
                        {children}
                      </span>
                    )
                  }
                  return (
                    <a href={href} target="_blank" rel="noreferrer" className="text-primary underline" {...props}>
                      {children}
                    </a>
                  )
                }
              }}
            >
              {renderMarkdownWithWikilinks(content)}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}
