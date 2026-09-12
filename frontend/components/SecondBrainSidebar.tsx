"use client"

import React, { useState } from "react"
import {
  Folder as FolderIcon,
  FolderOpen,
  FileText,
  Search,
  Share2,
  Inbox,
  Tag,
  ChevronRight,
  ChevronDown
} from "lucide-react"
import type { TreeData, TreeFolder, TagItem } from "../types/note"

interface SecondBrainSidebarProps {
  tree: TreeData | null
  activeNoteId: number | null
  onSelectNote: (id: number) => void
  tags: TagItem[]
  onSelectTag: (tag: string) => void
  selectedTag: string | null
  searchQuery: string
  onSearchChange: (q: string) => void
  activeView: "reader" | "graph"
  onChangeView: (view: "reader" | "graph") => void
}

export function SecondBrainSidebar({
  tree,
  activeNoteId,
  onSelectNote,
  tags,
  onSelectTag,
  selectedTag,
  searchQuery,
  onSearchChange,
  activeView,
  onChangeView
}: SecondBrainSidebarProps) {
  const [collapsedFolders, setCollapsedFolders] = useState<Record<number, boolean>>({})

  const toggleFolder = (folderId: number) => {
    setCollapsedFolders((prev) => ({ ...prev, [folderId]: !prev[folderId] }))
  }

  const renderFolder = (folder: TreeFolder) => {
    const isCollapsed = collapsedFolders[folder.id]
    const isInbox = folder.name.toLowerCase() === "inbox"

    return (
      <div key={folder.id} className="mb-1">
        <div
          onClick={() => toggleFolder(folder.id)}
          className="group flex items-center justify-between rounded-md px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent/60 hover:text-foreground cursor-pointer select-none"
        >
          <div className="flex flex-1 items-center gap-1.5 truncate">
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            {isInbox ? (
              <Inbox size={15} className="text-amber-500" />
            ) : isCollapsed ? (
              <FolderIcon size={15} className="text-primary/70" />
            ) : (
              <FolderOpen size={15} className="text-primary" />
            )}
            <span className="truncate">{folder.name}</span>
          </div>
          <span className="text-[10px] text-muted-foreground/60 px-1">
            {folder.notes.length}
          </span>
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
                  className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs cursor-pointer select-none transition-colors ${
                    activeNoteId === note.id
                      ? "bg-primary text-primary-foreground font-medium shadow-xs"
                      : "text-foreground/80 hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <FileText
                    size={13}
                    className={activeNoteId === note.id ? "text-primary-foreground" : "text-muted-foreground"}
                  />
                  <span className="truncate">{note.title}</span>
                </div>
              ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <aside className="w-64 h-screen border-l border-border bg-sidebar/50 flex flex-col select-none shrink-0">
      {/* Header & View Switcher */}
      <div className="p-3 border-b border-border space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-xs tracking-wider text-muted-foreground uppercase">
            Vault Explorer
          </span>
        </div>

        {/* View Switcher: Markdown Reader vs Graph */}
        <div className="grid grid-cols-2 gap-1 bg-muted/40 p-1 rounded-lg text-xs font-medium">
          <button
            onClick={() => onChangeView("reader")}
            className={`flex items-center justify-center gap-1.5 py-1 rounded-md transition-colors ${
              activeView === "reader"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText size={14} /> Notes
          </button>
          <button
            onClick={() => onChangeView("graph")}
            className={`flex items-center justify-center gap-1.5 py-1 rounded-md transition-colors ${
              activeView === "graph"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Share2 size={14} /> Graph
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Filter vault..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-muted/40 border border-border/60 rounded-md focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/70"
          />
        </div>
      </div>

      {/* Vault Tree */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
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
                  className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs cursor-pointer select-none transition-colors ${
                    activeNoteId === note.id
                      ? "bg-primary text-primary-foreground font-medium shadow-xs"
                      : "text-foreground/80 hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <FileText
                    size={13}
                    className={activeNoteId === note.id ? "text-primary-foreground" : "text-muted-foreground"}
                  />
                  <span className="truncate">{note.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tags Filter */}
      {tags && tags.length > 0 && (
        <div className="border-t border-border p-2.5 max-h-36 overflow-y-auto">
          <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground px-1 mb-1.5">
            <span>TAGS</span>
            {selectedTag && (
              <button
                onClick={() => onSelectTag("")}
                className="text-[10px] text-primary hover:underline font-normal"
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
