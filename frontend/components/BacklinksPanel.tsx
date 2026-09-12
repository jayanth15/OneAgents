"use client"

import React, { useState, useEffect } from "react"
import { Link2, Unlink, Plus, ExternalLink, Folder } from "lucide-react"
import { api } from "../lib/api"
import type { BacklinksData, Note } from "../types/note"

interface BacklinksPanelProps {
  note: Note | null
  onNavigateToNote: (id: number) => void
  onRefresh: () => void
}

export function BacklinksPanel({ note, onNavigateToNote, onRefresh }: BacklinksPanelProps) {
  const [data, setData] = useState<BacklinksData>({ linked_mentions: [], unlinked_mentions: [] })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!note) return
    loadBacklinks()
  }, [note?.id])

  const loadBacklinks = async () => {
    if (!note) return
    setLoading(true)
    try {
      const res = await api.getBacklinks(note.id)
      setData(res)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleLinkMention = async (sourceNoteId: number) => {
    if (!note) return
    try {
      const target = await api.getNote(sourceNoteId)
      // Regex replace unlinked mention with [[Note Title]]
      const regex = new RegExp(`(?<!\\[\\[)\\b(${note.title})\\b(?!\\]\\])`, "i")
      const updated = target.content.replace(regex, `[[${note.title}]]`)
      await api.updateNote(sourceNoteId, { content: updated })
      await loadBacklinks()
      onRefresh()
    } catch (err) {
      console.error("Failed to link mention:", err)
    }
  }

  if (!note) return null

  return (
    <div className="w-72 h-screen border-l border-border bg-sidebar/30 flex flex-col select-none text-xs">
      <div className="p-3.5 border-b border-border font-semibold flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Link2 size={15} className="text-primary" />
          <span>Backlinks & Mentions</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Linked Mentions */}
        <div>
          <div className="flex items-center justify-between text-muted-foreground font-semibold mb-2">
            <span>LINKED MENTIONS</span>
            <span className="rounded-full bg-primary/10 text-primary px-1.5 py-0.2 text-[10px]">
              {data.linked_mentions.length}
            </span>
          </div>

          {data.linked_mentions.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">No incoming wikilinks.</p>
          ) : (
            <div className="space-y-2">
              {data.linked_mentions.map((m) => (
                <div
                  key={m.id}
                  onClick={() => onNavigateToNote(m.id)}
                  className="p-2 rounded-md border border-border/60 bg-background/60 hover:bg-accent/70 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between font-medium text-foreground">
                    <span className="truncate">{m.title}</span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <Folder size={10} /> {m.folder_name}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{m.snippet}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Unlinked Mentions */}
        <div>
          <div className="flex items-center justify-between text-muted-foreground font-semibold mb-2">
            <span>UNLINKED MENTIONS</span>
            <span className="rounded-full bg-muted text-muted-foreground px-1.5 py-0.2 text-[10px]">
              {data.unlinked_mentions.length}
            </span>
          </div>

          {data.unlinked_mentions.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">No unlinked mentions found.</p>
          ) : (
            <div className="space-y-2">
              {data.unlinked_mentions.map((m) => (
                <div
                  key={m.id}
                  className="p-2 rounded-md border border-dashed border-border bg-background/40 hover:bg-accent/40 transition-colors"
                >
                  <div className="flex items-center justify-between font-medium text-foreground">
                    <span
                      onClick={() => onNavigateToNote(m.id)}
                      className="cursor-pointer truncate hover:text-primary"
                    >
                      {m.title}
                    </span>
                    <button
                      onClick={() => handleLinkMention(m.id)}
                      className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground text-[10px] font-medium transition-colors"
                      title="Convert mention to [[wikilink]]"
                    >
                      <Plus size={11} /> Link
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{m.snippet}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
