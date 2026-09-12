"use client"

import React from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { HardDrive, Folder as FolderIcon, Link as LinkIcon, FileText, Calendar } from "lucide-react"
import type { Note, Folder } from "../types/note"

interface SecondBrainViewerProps {
  note: Note | null
  folders: Folder[]
  onNavigateToTitle: (title: string) => void
}

export function SecondBrainViewer({
  note,
  folders,
  onNavigateToTitle
}: SecondBrainViewerProps) {
  if (!note) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
        <FileText size={48} className="mb-4 opacity-30" />
        <h3 className="text-base font-semibold text-foreground mb-1">No Note Selected</h3>
        <p className="text-xs">Select a note from your Second Brain vault on the left to view it.</p>
      </div>
    )
  }

  const folderName = folders.find((f) => f.id === note.folder_id)?.name || "Root"

  // Pre-process wikilinks for rendering
  const renderMarkdownWithWikilinks = (text: string) => {
    return text.replace(/\[\[(.*?)(?:\|(.*?))?\]\]/g, (_, target, alias) => {
      const display = alias || target
      return `[${display}](#wikilink:${encodeURIComponent(target)})`
    })
  }

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-background">
      {/* Top Header Bar - Cleaned: No edit/split, no weave/tasks/summarize */}
      <header className="px-8 py-4 border-b border-border bg-card/30 flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-foreground tracking-tight truncate">
            {note.title}
          </h1>

          <div className="flex items-center gap-2.5 mt-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1 font-medium text-[11px] bg-muted px-2 py-0.5 rounded text-foreground/80">
              <FolderIcon size={12} className="text-primary" />
              {folderName}
            </span>

            <span className="flex items-center gap-1 font-mono text-[11px] bg-muted/60 px-2 py-0.5 rounded text-muted-foreground">
              <HardDrive size={12} className="text-primary/70" />
              {note.file_path || `vault/${note.title}.md`}
            </span>

            <span className="flex items-center gap-1 text-[11px] text-muted-foreground/80">
              <Calendar size={11} />
              Updated {new Date(note.updated_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </header>

      {/* Main Markdown View - Always Markdown Viewer */}
      <div className="flex-1 overflow-y-auto px-10 py-8">
        <div className="max-w-4xl mx-auto prose dark:prose-invert prose-headings:font-semibold prose-a:text-primary text-sm leading-relaxed">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href, children, ...props }) => {
                if (href?.startsWith("#wikilink:")) {
                  const targetTitle = decodeURIComponent(href.replace("#wikilink:", ""))
                  return (
                    <span
                      onClick={() => onNavigateToTitle(targetTitle)}
                      className="cursor-pointer inline-flex items-center gap-0.5 text-primary font-semibold underline underline-offset-2 hover:opacity-85 transition-opacity"
                    >
                      <LinkIcon size={12} className="inline mr-0.5 text-primary" />
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
            {renderMarkdownWithWikilinks(note.content)}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
