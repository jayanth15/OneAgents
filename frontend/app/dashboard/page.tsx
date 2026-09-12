"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import {
  Brain,
  FileText,
  Folder as FolderIcon,
  Share2,
  HardDrive,
  ArrowRight,
  Sparkles,
  Layers,
  Database,
  CheckCircle2
} from "lucide-react"
import { api } from "@/lib/api"
import type { TreeData, GraphData } from "@/types/note"

export default function DashboardPage() {
  const [tree, setTree] = useState<TreeData | null>(null)
  const [graph, setGraph] = useState<GraphData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadStats() {
      try {
        const [treeRes, graphRes] = await Promise.all([api.getTree(), api.getGraph()])
        setTree(treeRes)
        setGraph(graphRes)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadStats()
  }, [])

  // Calculate note count
  let totalNotes = tree?.root_notes.length || 0
  if (tree?.folders) {
    const countNotes = (folders: any[]) => {
      for (const f of folders) {
        totalNotes += f.notes.length
        if (f.folders) countNotes(f.folders)
      }
    }
    countNotes(tree.folders)
  }

  const totalFolders = tree?.folders.length || 0
  const totalLinks = graph?.links.length || 0

  return (
    <div className="flex-1 h-screen overflow-y-auto p-10 bg-background">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Welcome Banner */}
        <div className="p-8 rounded-2xl border border-border bg-gradient-to-br from-card to-muted/40 shadow-xs space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
            <Sparkles size={13} />
            <span>Second-Brain & Agent Harness</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Knowledge Dashboard
          </h1>
          <p className="text-muted-foreground text-sm max-w-2xl leading-relaxed">
            Your personal local-first Second Brain. Notes are stored directly as plain Markdown files on disk in the backend vault folder and rendered seamlessly upon viewing.
          </p>
          <div className="pt-2 flex items-center gap-3">
            <Link
              href="/second-brain"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-xs hover:opacity-90 transition-opacity shadow-xs"
            >
              <Brain size={15} />
              <span>Explore Second-Brain</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-xl border border-border bg-card shadow-xs space-y-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">Vault Notes</span>
              <FileText size={16} className="text-primary" />
            </div>
            <div className="text-2xl font-bold">{loading ? "..." : totalNotes}</div>
            <p className="text-[11px] text-muted-foreground">Plain markdown files on disk</p>
          </div>

          <div className="p-5 rounded-xl border border-border bg-card shadow-xs space-y-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">Folders</span>
              <FolderIcon size={16} className="text-amber-500" />
            </div>
            <div className="text-2xl font-bold">{loading ? "..." : totalFolders}</div>
            <p className="text-[11px] text-muted-foreground">Hierarchical vault taxonomy</p>
          </div>

          <div className="p-5 rounded-xl border border-border bg-card shadow-xs space-y-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">Graph Links</span>
              <Share2 size={16} className="text-purple-500" />
            </div>
            <div className="text-2xl font-bold">{loading ? "..." : totalLinks}</div>
            <p className="text-[11px] text-muted-foreground">Bidirectional [[wikilinks]]</p>
          </div>

          <div className="p-5 rounded-xl border border-border bg-card shadow-xs space-y-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">Vault Storage</span>
              <HardDrive size={16} className="text-emerald-500" />
            </div>
            <div className="text-sm font-bold font-mono truncate text-foreground">backend/vault</div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <CheckCircle2 size={12} className="text-emerald-500" />
              Direct filesystem storage
            </p>
          </div>
        </div>

        {/* Architecture & Quick Navigation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-xl border border-border bg-card shadow-xs space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Brain size={16} className="text-primary" />
              Second-Brain Markdown Viewer
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Browse, search, and view your vault notes rendered directly from the local file system. Supports bidirectional `[[wikilinks]]` and physics-powered knowledge graph inspection.
            </p>
            <div className="pt-2">
              <Link
                href="/second-brain"
                className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
              >
                Go to Second-Brain <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          <div className="p-6 rounded-xl border border-border bg-card shadow-xs space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Layers size={16} className="text-primary" />
              Pydantic AI & DBOS Workflows
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Durable background workflows powered by DBOS record multi-step inbox triage and graph weaving without taxonomy drift.
            </p>
            <div className="pt-2">
              <Link
                href="/agents"
                className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
              >
                Go to Agents <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
