"use client"

import React, { useState, useRef, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Bot, Send, X, Sparkles, RefreshCw, Copy, Check } from "lucide-react"
import { api } from "../lib/api"
import type { Note } from "../types/note"

interface CopilotChatDrawerProps {
  isOpen: boolean
  onClose: () => void
  activeNote: Note | null
  onRefreshVault: () => Promise<void>
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

export function CopilotChatDrawer({
  isOpen,
  onClose,
  activeNote,
  onRefreshVault
}: CopilotChatDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init",
      role: "assistant",
      content:
        "Hello! I am your **QNote Agent** powered by **Pydantic AI**, **DBOS**, and **CopilotKit**.\n\nI operate directly against your local markdown files in `backend/vault/`. Ask me to summarize notes, find connections, or extract actionable tasks."
    }
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  if (!isOpen) return null

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || input
    if (!text.trim() || loading) return

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: text.trim() }
    setMessages((prev) => [...prev, userMsg])
    if (!textToSend) setInput("")
    setLoading(true)

    try {
      const res = await api.agentChat(text.trim(), activeNote?.id)
      const botMsg: Message = { id: `a-${Date.now()}`, role: "assistant", content: res.reply }
      setMessages((prev) => [...prev, botMsg])
      await onRefreshVault()
    } catch (err) {
      console.error(err)
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "Sorry, I encountered an error communicating with the backend agent."
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-80 h-screen border-l border-border bg-card flex flex-col shadow-xl z-20 select-none">
      {/* Drawer Header */}
      <div className="p-3.5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Bot size={16} />
          </div>
          <div>
            <h3 className="text-xs font-semibold leading-none">Copilot Agent</h3>
            <span className="text-[10px] text-muted-foreground">Pydantic AI Harness</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X size={15} />
        </button>
      </div>

      {/* Suggested Quick Prompts */}
      <div className="p-2 border-b border-border/50 bg-muted/20 flex gap-1 overflow-x-auto text-[11px]">
        <button
          onClick={() => handleSend("Summarize this note")}
          className="whitespace-nowrap px-2 py-1 rounded bg-background border border-border/70 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          ✨ Summarize
        </button>
        <button
          onClick={() => handleSend("Extract all action items as a checklist")}
          className="whitespace-nowrap px-2 py-1 rounded bg-background border border-border/70 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          ✅ Tasks
        </button>
        <button
          onClick={() => handleSend("Suggest [[wikilinks]] for this note")}
          className="whitespace-nowrap px-2 py-1 rounded bg-background border border-border/70 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          🔗 Links
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`max-w-[90%] p-2.5 rounded-lg ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/70 text-foreground border border-border/60"
              }`}
            >
              <div className="prose dark:prose-invert text-xs max-w-none"><ReactMarkdown remarkPlugins={[remarkGfm]}>
                {m.content}
              </ReactMarkdown></div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs p-2">
            <RefreshCw size={12} className="animate-spin text-primary" />
            <span>Agent thinking & checking disk files...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-2.5 border-t border-border bg-background">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
          className="flex items-center gap-1.5"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask agent about vault..."
            className="flex-1 px-3 py-1.5 text-xs bg-muted/40 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  )
}
