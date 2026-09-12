"use client"

import React, { useState } from "react"
import {
  Folder as FolderIcon,
  FolderOpen,
  FileText,
  Plus,
  Trash2,
  Search,
  Share2,
  Inbox,
  Tag,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Bot
} from "lucide-react"
import type { TreeData, TreeFolder, TagItem } from "../types/note"

interface SidebarProps {
  tree: TreeData | null
  activeNoteId: number | null
  onSelectNote: (id: number) => void
  onCreateNote: (folderId: number | null) => void
  onCreateFolder: () => void
  onDeleteNote: (id: number, e: React.MouseEvent) => void
  onDeleteFolder: (id: number, e: React.MouseEvent) => void
  tags: TagItem[]
  onSelectTag: (tag: string) => void
  selectedTag: string | null
  searchQuery: string
  onSearchChange: (q: string) => void
  activeView: "editor" | "graph"
  onChangeView: (view: "editor" | "graph") => void
  onOpenTriage: () => void
  onToggleCopilot: () => void
  isCopilotOpen: boolean
}

export function Sidebar({
  tree,
  activeNoteId,
  onSelectNote,
  onCreateNote,
  onCreateFolder,
  onDeleteNote,
  onDeleteFolder,
  tags,
  onSelectTag,
  selectedTag,
  searchQuery,
  onSearchChange,
  activeView,
  onChangeView,
  onOpenTriage,
  onToggleCopilot,
  isCopilotOpen
}: SidebarProps) {
  const [collapsedFolders, setCollapsedFolders] = useState<Record<number, boolean>>({})

  const toggleFolder = (folderId: number) => {
    setCollapsedFolders((prev) => ({ ...prev, [folderId]: !prev[folderId] }))
  }

  // Count notes in Inbox
  const inboxFolder = tree?.folders.find((f) => f.name.toLowerCase() === "inbox")
  const inboxCount = inboxFolder ? inboxFolder.notes.length : 0

  const renderFolder = (folder: TreeFolder) => {
    const isCollapsed = collapsedFolders[folder.id]
    const isInbox = folder.name.toLowerCase() === "inbox"

    return (
      <div key={folder.id} className="mb-1">
        <div className="group flex items-center justify-between rounded-md px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent/60 hover:text-foreground">
          <div
            className="flex flex-1 items-center gap-1.5 cursor-pointer select-none"
            onClick={() => toggleFolder(folder.id)}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            {isInbox ? (
              <Inbox size={15} className="text-amber-500" />
            ) : isCollapsed ? (
              <FolderIcon size={15} className="text-primary/70" />
            ) : (
              <FolderOpen size={15} className="text-primary" />
            )}
            <span className="truncate">{folder.name}</span>
            {isInbox && inboxCount > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500/20 px-1.5 py-0.2 text-[10px] font-bold text-amber-500">
                {inboxCount}
              </span>
            )}
          </div>
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
            <button
              title="Add note to folder"
              onClick={() => onCreateNote(folder.id)}
              className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              <Plus size={13} />
            </button>
            {!isInbox && (
              <button
                title="Delete folder"
                onClick={(e) => onDeleteFolder(folder.id, e)}
                className="rounded p-1 hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>

        {!isCollapsed && (
          <div className="ml-3.5 border-l border-border/50 pl-2 space-y-0.5 mt-0.5">
            {folder.folders?.map((sub) => renderFolder(sub))}
            {folder.notes
              .filter((n) => {
                if (selectedTag && !n.tags.includes(selectedTag)) return false
                if (searchQuery) {
                  const q = searchQuery.toLowerCase()
                  return n.title.toLowerCase().includes(q) || n.tags.some((t) => t.toLowerCase().includes(q))
                }
                return true
              })
              .map((note) => (
                <div
                  key={note.id}
                  onClick={() => onSelectNote(note.id)}
                  className={`group flex items-center justify-between rounded-md px-2 py-1 text-xs cursor-pointer select-none transition-colors ${
                    activeNoteId === note.id
                      ? "bg-primary text-primary-foreground font-medium shadow-xs"
                      : "text-foreground/80 hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <FileText size={13} className={activeNoteId === note.id ? "text-primary-foreground" : "text-muted-foreground"} />
                    <span className="truncate">{note.title}</span>
                  </div>
                  <button
                    title="Delete note"
                    onClick={(e) => onDeleteNote(note.id, e)}
                    className={`opacity-0 group-hover:opacity-100 rounded p-0.5 ${
                      activeNoteId === note.id ? "hover:bg-primary-foreground/20 text-primary-foreground" : "hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                    }`}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <aside className="w-64 h-screen border-r border-border bg-sidebar/60 flex flex-col select-none">
      {/* Brand Header */}
      <div className="p-3.5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
            Q
          </div>
          <div>
            <h1 className="font-semibold text-sm leading-none">QNote</h1>
            <span className="text-[10px] text-muted-foreground">Pydantic AI & DBOS</span>
          </div>
        </div>
        <button
          onClick={onToggleCopilot}
          title="Toggle Copilot Agent"
          className={`rounded-md p-1.5 transition-colors ${
            isCopilotOpen ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          <Bot size={16} />
        </button>
      </div>

      {/* Navigation & View switcher */}
      <div className="p-2 space-y-1">
        <div className="grid grid-cols-2 gap-1 bg-muted/40 p-1 rounded-lg text-xs font-medium">
          <button
            onClick={() => onChangeView("editor")}
            className={`flex items-center justify-center gap-1.5 py-1 rounded-md transition-colors ${
              activeView === "editor" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText size={14} /> Notes
          </button>
          <button
            onClick={() => onChangeView("graph")}
            className={`flex items-center justify-center gap-1.5 py-1 rounded-md transition-colors ${
              activeView === "graph" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Share2 size={14} /> Graph
          </button>
        </div>

        {/* Quick Triage Trigger */}
        <button
          onClick={onOpenTriage}
          className="w-full mt-1 flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 text-xs font-medium transition-colors"
        >
          <div className="flex items-center gap-1.5">
            <Sparkles size={14} className="text-amber-500" />
            <span>Durable Triage</span>
          </div>
          <span className="text-[10px] bg-amber-500/20 px-1.5 py-0.5 rounded-full font-bold">
            {inboxCount} in Inbox
          </span>
        </button>
      </div>

      {/* Search Input */}
      <div className="px-2 pb-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search vault..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-muted/40 border border-border/60 rounded-md focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/70"
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-2 pb-2 flex items-center gap-1">
        <button
          onClick={() => onCreateNote(null)}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <Plus size={14} /> Note
        </button>
        <button
          onClick={onCreateFolder}
          className="flex items-center justify-center gap-1 px-2 py-1 text-xs font-medium rounded-md border border-border bg-background hover:bg-accent text-foreground transition-colors"
        >
          <FolderIcon size={14} /> Folder
        </button>
      </div>

      {/* Vault Tree */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
        {tree?.folders.map((f) => renderFolder(f))}

        {/* Root Notes */}
        {tree?.root_notes && tree.root_notes.length > 0 && (
          <div className="pt-2">
            <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Root Notes
            </div>
            <div className="space-y-0.5">
              {tree.root_notes.map((note) => (
                <div
                  key={note.id}
                  onClick={() => onSelectNote(note.id)}
                  className={`group flex items-center justify-between rounded-md px-2 py-1 text-xs cursor-pointer select-none transition-colors ${
                    activeNoteId === note.id
                      ? "bg-primary text-primary-foreground font-medium shadow-xs"
                      : "text-foreground/80 hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <FileText size={13} className={activeNoteId === note.id ? "text-primary-foreground" : "text-muted-foreground"} />
                    <span className="truncate">{note.title}</span>
                  </div>
                  <button
                    title="Delete note"
                    onClick={(e) => onDeleteNote(note.id, e)}
                    className="opacity-0 group-hover:opacity-100 rounded p-0.5 hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tags section */}
      {tags && tags.length > 0 && (
        <div className="border-t border-border p-2 max-h-36 overflow-y-auto">
          <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground px-1 mb-1">
            <span>TAGS</span>
            {selectedTag && (
              <button
                onClick={() => onSelectTag("")}
                className="text-[10px] text-primary hover:underline"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {tags.map((t) => (
              <button
                key={t.tag}
                onClick={() => onSelectTag(selectedTag === t.tag ? "" : t.tag)}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  selectedTag === t.tag
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-accent text-foreground/80"
                }`}
              >
                <Tag size={10} />
                <span>#{t.tag}</span>
                <span className="text-[10px] opacity-70">({t.count})</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}
