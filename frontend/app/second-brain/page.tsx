"use client"

import React, { useState, useEffect, useCallback } from "react"
import { SecondBrainSidebar } from "@/components/SecondBrainSidebar"
import { SecondBrainViewer } from "@/components/SecondBrainViewer"
import { KnowledgeGraph } from "@/components/KnowledgeGraph"
import { api } from "@/lib/api"
import type { TreeData, Folder, Note, GraphData, TagItem } from "@/types/note"

export default function SecondBrainPage() {
  const [tree, setTree] = useState<TreeData | null>(null)
  const [folders, setFolders] = useState<Folder[]>([])
  const [activeNoteId, setActiveNoteId] = useState<number | null>(null)
  const [activeNote, setActiveNote] = useState<Note | null>(null)
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [tags, setTags] = useState<TagItem[]>([])
  const [activeView, setActiveView] = useState<"reader" | "graph">("reader")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  const loadInitialData = useCallback(async () => {
    try {
      const [treeRes, graphRes, tagsRes] = await Promise.all([
        api.getTree(),
        api.getGraph(),
        api.getTags()
      ])
      setTree(treeRes)
      setGraphData(graphRes)
      setTags(tagsRes)

      // Flatten folders
      const allFolders: Folder[] = []
      const traverse = (fList: any[]) => {
        for (const f of fList) {
          allFolders.push({
            id: f.id,
            name: f.name,
            parent_id: f.parent_id,
            created_at: "",
            updated_at: ""
          })
          if (f.folders) traverse(f.folders)
        }
      }
      if (treeRes.folders) traverse(treeRes.folders)
      setFolders(allFolders)

      // Auto-select first note if none selected
      if (activeNoteId === null) {
        if (treeRes.folders.length > 0 && treeRes.folders[0].notes.length > 0) {
          handleSelectNote(treeRes.folders[0].notes[0].id)
        } else if (treeRes.root_notes.length > 0) {
          handleSelectNote(treeRes.root_notes[0].id)
        }
      }
    } catch (e) {
      console.error("Failed to load Second Brain vault data:", e)
    }
  }, [activeNoteId])

  useEffect(() => {
    loadInitialData()
  }, [])

  const handleSelectNote = async (id: number) => {
    setActiveNoteId(id)
    try {
      const noteRes = await api.getNote(id)
      setActiveNote(noteRes)
      if (activeView === "graph") setActiveView("reader")
    } catch (e) {
      console.error("Failed to fetch note:", e)
    }
  }

  const handleNavigateToTitle = async (title: string) => {
    if (!graphData) return
    const target = graphData.nodes.find(
      (n) => n.title.toLowerCase() === title.trim().toLowerCase()
    )
    if (target && target.note_id) {
      handleSelectNote(target.note_id)
    }
  }

  return (
    <div className="flex h-screen flex-1 overflow-hidden bg-background">
      {/* Main Content Area: Pure Markdown Viewer (Default) or Knowledge Graph */}
      {activeView === "reader" ? (
        <SecondBrainViewer
          note={activeNote}
          folders={folders}
          onNavigateToTitle={handleNavigateToTitle}
        />
      ) : (
        <KnowledgeGraph
          data={graphData}
          activeNoteId={activeNoteId}
          onSelectNote={(id) => {
            handleSelectNote(id)
            setActiveView("reader")
          }}
        />
      )}

      {/* Second Brain Vault Explorer (Right Side) */}
      <SecondBrainSidebar
        tree={tree}
        activeNoteId={activeNoteId}
        onSelectNote={handleSelectNote}
        tags={tags}
        onSelectTag={setSelectedTag}
        selectedTag={selectedTag}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeView={activeView}
        onChangeView={setActiveView}
      />
    </div>
  )
}
