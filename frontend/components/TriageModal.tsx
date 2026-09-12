"use client"

import React, { useState } from "react"
import { Sparkles, X, Check, ArrowRight, Folder, RefreshCw, AlertCircle } from "lucide-react"
import { api } from "../lib/api"
import type { TriageResult } from "../types/note"

interface TriageModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete: () => Promise<void>
}

export function TriageModal({ isOpen, onClose, onComplete }: TriageModalProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TriageResult | null>(null)
  const [applying, setApplying] = useState(false)

  if (!isOpen) return null

  const handleRunPreview = async () => {
    setLoading(true)
    try {
      const res = await api.triggerTriage(false)
      setResult(res)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleApplyMoves = async () => {
    setApplying(true)
    try {
      const res = await api.triggerTriage(true)
      setResult(res)
      await onComplete()
    } catch (err) {
      console.error(err)
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
      <div className="w-full max-w-xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold">DBOS Durable Inbox Triage</h2>
              <p className="text-xs text-muted-foreground">Fault-tolerant workflow execution powered by DBOS</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 flex-1 overflow-y-auto text-xs space-y-4">
          {!result && !loading && (
            <div className="text-center py-8 space-y-3">
              <Sparkles size={36} className="mx-auto text-amber-500/50" />
              <p className="text-sm text-foreground">
                Run the durable triage workflow to categorize all notes currently waiting in your <strong>Inbox</strong>.
              </p>
              <button
                onClick={handleRunPreview}
                className="px-4 py-2 bg-primary text-primary-foreground font-medium rounded-md hover:opacity-90 transition-opacity"
              >
                Scan & Analyze Inbox
              </button>
            </div>
          )}

          {loading && (
            <div className="text-center py-8 space-y-2">
              <RefreshCw size={28} className="mx-auto animate-spin text-primary" />
              <p className="text-muted-foreground">DBOS executing durable workflow steps...</p>
            </div>
          )}

          {result && (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-muted/50 p-2.5 rounded-lg">
                <span className="font-semibold text-foreground">{result.message}</span>
                <span className="text-[10px] text-muted-foreground font-mono">{new Date(result.timestamp).toLocaleTimeString()}</span>
              </div>

              {result.decisions.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  Inbox is clean. No notes pending triage!
                </div>
              ) : (
                <div className="space-y-2">
                  {result.decisions.map((d) => (
                    <div
                      key={d.note_id}
                      className="p-3 rounded-lg border border-border bg-background space-y-1.5"
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className="text-sm">{d.note_title}</span>
                        <div className="flex items-center gap-1 text-primary bg-primary/10 px-2 py-0.5 rounded text-[11px]">
                          <ArrowRight size={12} />
                          <Folder size={12} />
                          <span>{d.target_folder_name}</span>
                        </div>
                      </div>
                      <p className="text-muted-foreground">{d.reason}</p>
                      {d.suggested_tags && d.suggested_tags.length > 0 && (
                        <div className="flex gap-1 pt-1">
                          {d.suggested_tags.map((t) => (
                            <span key={t} className="px-1.5 py-0.2 bg-muted rounded text-[10px]">
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {result && result.decisions.length > 0 && (
          <div className="p-3 border-t border-border bg-muted/20 flex items-center justify-end gap-2 text-xs">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-md border border-border hover:bg-muted"
            >
              Close
            </button>
            <button
              onClick={handleApplyMoves}
              disabled={applying}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 font-medium"
            >
              <Check size={14} />
              <span>{applying ? "Moving files on disk..." : "Apply All Moves"}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
