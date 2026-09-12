"use client"

import React, { useState, useRef, useEffect } from "react"
import {
  Send,
  Square,
  Bot,
  User,
  Sparkles,
  CloudSun,
  RotateCcw,
  FileText,
  Activity,
  Layers,
  Terminal,
  Settings2,
  Key,
  Check,
  AlertCircle,
  X,
  Radio,
  Cpu,
  Eye,
  EyeOff,
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { useCopilotAction } from "@copilotkit/react-core"
import { CopilotChat } from "@copilotkit/react-ui"
import { WeatherWidget, WeatherData } from "@/components/WeatherWidget"

interface ToolCallState {
  name: string
  status: "inProgress" | "executing" | "complete"
  args?: { location?: string }
  result?: WeatherData | string
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  toolCall?: ToolCallState
  timestamp: string
  provider?: string
}

interface LLMConfig {
  provider: string
  model: string
  has_api_key: boolean
  masked_key: string
  base_url: string
  is_real_api: boolean
}

const INITIAL_SUGGESTIONS = [
  {
    label: "Tokyo Live Weather",
    prompt: "What is the weather in Tokyo?",
    icon: CloudSun,
  },
  {
    label: "Mumbai Live Weather",
    prompt: "Check real-time weather in Mumbai",
    icon: CloudSun,
  },
  {
    label: "London Forecast",
    prompt: "Check current weather in London",
    icon: CloudSun,
  },
  {
    label: "New York Weather",
    prompt: "What is the weather in New York?",
    icon: CloudSun,
  },
  {
    label: "Vault Notes",
    prompt: "List the notes currently saved in my vault",
    icon: FileText,
  },
  {
    label: "DBOS Triage",
    prompt: "How does the DBOS inbox triage workflow work?",
    icon: Activity,
  },
]

const PROVIDER_PRESETS: Record<string, { label: string; defaultModel: string; models: string[]; keyPlaceholder: string; needsBaseUrl?: boolean }> = {
  openrouter: {
    label: "OpenRouter",
    defaultModel: "openrouter:openrouter/free",
    models: [
      "openrouter:openrouter/free",
      "openrouter:google/gemini-2.5-flash",
      "openrouter:anthropic/claude-sonnet-4.6",
    ],
    keyPlaceholder: "sk-or-v1-...",
  },
  gemini: {
    label: "Google Gemini",
    defaultModel: "google-gla:gemini-2.5-flash",
    models: ["google-gla:gemini-2.5-flash", "google-gla:gemini-1.5-flash", "google-gla:gemini-1.5-pro"],
    keyPlaceholder: "AIzaSy...",
  },
  openai: {
    label: "OpenAI",
    defaultModel: "openai:gpt-4o-mini",
    models: ["openai:gpt-4o-mini", "openai:gpt-4o", "openai:gpt-4.1-mini"],
    keyPlaceholder: "sk-proj-...",
  },
  anthropic: {
    label: "Anthropic Claude",
    defaultModel: "anthropic:claude-3-5-sonnet-latest",
    models: ["anthropic:claude-3-5-sonnet-latest", "anthropic:claude-3-5-haiku-latest"],
    keyPlaceholder: "sk-ant-...",
  },
  ollama: {
    label: "Local Ollama",
    defaultModel: "ornith:latest",
    models: ["ornith:latest", "llama3.2:latest", "qwen2.5:latest"],
    keyPlaceholder: "Optional (ollama)",
    needsBaseUrl: true,
  },
  test: {
    label: "Mock / Test Mode",
    defaultModel: "test",
    models: ["test"],
    keyPlaceholder: "None needed",
  },
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [activeTab, setActiveTab] = useState<"streaming" | "copilotkit">("streaming")
  const [showSettings, setShowSettings] = useState(false)
  const [showKey, setShowKey] = useState(false)

  // LLM Config state
  const [llmConfig, setLlmConfig] = useState<LLMConfig>({
    provider: "test",
    model: "test",
    has_api_key: false,
    masked_key: "none",
    base_url: "",
    is_real_api: false,
  })

  // Settings form state
  const [selectedProvider, setSelectedProvider] = useState<string>("gemini")
  const [apiKeyInput, setApiKeyInput] = useState<string>("")
  const [modelInput, setModelInput] = useState<string>("google-gla:gemini-2.5-flash")
  const [baseUrlInput, setBaseUrlInput] = useState<string>("")
  const [savingConfig, setSavingConfig] = useState(false)
  const [configFeedback, setConfigFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Fetch current LLM config on mount
  useEffect(() => {
    fetch("http://localhost:8000/api/config/llm")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.provider) {
          setLlmConfig(data)
          setSelectedProvider(data.provider || "gemini")
          setModelInput(data.model || PROVIDER_PRESETS[data.provider]?.defaultModel || "google-gla:gemini-2.5-flash")
          setBaseUrlInput(data.base_url || "")
        }
      })
      .catch((err) => console.error("Could not fetch LLM config:", err))
  }, [])

  // Register the weather tool with a custom CopilotKit renderer
  useCopilotAction({
    name: "get_weather",
    description: "Get real-time live weather conditions and forecast for any city or location",
    parameters: [
      {
        name: "location",
        type: "string",
        description: "City or location name (e.g. Tokyo, Paris, London, New York, Mumbai)",
        required: true,
      },
    ],
    available: "frontend",
    render: ({ status, args, result }) => {
      return (
        <WeatherWidget
          status={status}
          args={args as { location?: string }}
          result={result as WeatherData}
        />
      )
    },
  })

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isStreaming])

  const handleProviderSelect = (p: string) => {
    setSelectedProvider(p)
    const preset = PROVIDER_PRESETS[p]
    if (preset) {
      setModelInput(preset.defaultModel)
      if (preset.needsBaseUrl && !baseUrlInput) {
        setBaseUrlInput("http://localhost:11434/v1")
      }
    }
  }

  const handleSaveConfig = async () => {
    setSavingConfig(true)
    setConfigFeedback(null)

    try {
      const res = await fetch("http://localhost:8000/api/config/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedProvider,
          apiKey: apiKeyInput,
          model: modelInput,
          baseUrl: baseUrlInput,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        setLlmConfig(data)
        if (data.status === "error") {
          setConfigFeedback({
            type: "error",
            text: `Connected with warning: ${data.error || "Failed ping test"}`,
          })
        } else {
          setConfigFeedback({
            type: "success",
            text: `Successfully connected to ${PROVIDER_PRESETS[selectedProvider]?.label || selectedProvider}!`,
          })
          setApiKeyInput("")
        }
      } else {
        throw new Error(data.detail || "Failed to update configuration")
      }
    } catch (err: any) {
      setConfigFeedback({ type: "error", text: err.message || "Error saving config" })
    } finally {
      setSavingConfig(false)
    }
  }

  const handleSend = async (textToSend?: string) => {
    const prompt = (textToSend || input).trim()
    if (!prompt || isStreaming) return

    setInput("")
    const userMsgId = `user-${Date.now()}`
    const assistantMsgId = `assistant-${Date.now()}`
    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

    const userMessage: Message = {
      id: userMsgId,
      role: "user",
      content: prompt,
      timestamp: timeStr,
    }

    const initialAssistantMessage: Message = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: timeStr,
      provider: llmConfig.provider,
    }

    setMessages((prev) => [...prev, userMessage, initialAssistantMessage])
    setIsStreaming(true)

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const response = await fetch("http://localhost:8000/api/agent/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt }),
        signal: controller.signal,
      })

      if (!response.ok || !response.body) {
        throw new Error(`Streaming failed: HTTP ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n\n")
        buffer = lines.pop() || ""

        for (const block of lines) {
          if (!block.trim()) continue

          const eventMatch = block.match(/^event:\s*(\w+)/m)
          const dataMatch = block.match(/^data:\s*(.+)$/m)

          const eventType = eventMatch ? eventMatch[1] : ""
          const dataStr = dataMatch ? dataMatch[1] : "{}"

          try {
            const data = JSON.parse(dataStr)

            if (eventType === "tool_start") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        toolCall: {
                          name: data.name || "get_weather",
                          status: "executing",
                          args: data.args || { location: data.location },
                        },
                      }
                    : m
                )
              )
            } else if (eventType === "tool_result") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        toolCall: {
                          name: data.name || "get_weather",
                          status: "complete",
                          args: m.toolCall?.args || { location: data.result?.location },
                          result: data.result,
                        },
                      }
                    : m
                )
              )
            } else if (eventType === "delta") {
              const delta = data.delta || ""
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, content: m.content + delta }
                    : m
                )
              )
            } else if (eventType === "done") {
              setIsStreaming(false)
            }
          } catch {
            // Ignore parse errors on malformed chunks
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content:
                    m.content ||
                    `⚠️ Unable to connect to backend agent stream. Please verify FastAPI is running at http://localhost:8000.`,
                }
              : m
          )
        )
      }
    } finally {
      setIsStreaming(false)
      abortControllerRef.current = null
    }
  }

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsStreaming(false)
    }
  }

  const handleReset = () => {
    handleStop()
    setMessages([])
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-background text-foreground relative">
      {/* Top Header */}
      <header className="h-14 border-b border-border px-5 flex items-center justify-between shrink-0 bg-card/60 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight">QNote Agent Chat</h2>
              {/* Real API Weather Status */}
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Open-Meteo API
              </span>
              {/* LLM Status Badge */}
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  llmConfig.is_real_api && llmConfig.has_api_key
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <Cpu className="h-2.5 w-2.5" />
                {llmConfig.is_real_api ? `${llmConfig.provider}: ${llmConfig.model.replace(/^[a-z\-]+:/, "")}` : "Mock / Free Mode"}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Pydantic AI • Real-time Open-Meteo Global Weather
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* API Settings Trigger */}
          <button
            onClick={() => {
              setShowSettings(true)
              setConfigFeedback(null)
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-all border border-primary/20 shadow-2xs"
            title="Configure Real LLM API Key (Gemini, OpenAI, Anthropic, Ollama)"
          >
            <Key className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">API Settings</span>
          </button>

          {/* Mode Switcher */}
          <div className="flex items-center rounded-lg border border-border bg-muted/30 p-0.5 text-xs font-medium">
            <button
              onClick={() => setActiveTab("streaming")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
                activeTab === "streaming"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Terminal className="h-3.5 w-3.5" />
              <span>Harness Stream</span>
            </button>
            <button
              onClick={() => setActiveTab("copilotkit")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
                activeTab === "copilotkit"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>CopilotKit Native</span>
            </button>
          </div>

          {/* Reset Button */}
          {activeTab === "streaming" && messages.length > 0 && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-all border border-border"
              title="Clear conversation"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      {activeTab === "streaming" ? (
        <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden">
          {/* Messages View */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center max-w-xl mx-auto text-center px-4 py-8">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-primary/20 via-primary/10 to-accent/30 text-primary flex items-center justify-center mb-4 shadow-sm">
                  <Sparkles className="h-7 w-7" />
                </div>
                <h3 className="text-lg font-semibold tracking-tight text-foreground">
                  QNote Assistant with Live APIs
                </h3>
                <p className="text-xs text-muted-foreground mt-1.5 max-w-md leading-relaxed">
                  Connected directly to the <strong>Open-Meteo Real-Time Weather API</strong>. Ask for
                  weather in any global city to see live metrics and CopilotKit generative UI. Hook in your
                  real Gemini or OpenAI API key anytime in <strong>API Settings</strong>.
                </p>

                {/* Suggestions */}
                <div className="mt-6 w-full grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                  {INITIAL_SUGGESTIONS.map((item, idx) => {
                    const Icon = item.icon
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSend(item.prompt)}
                        className="group flex items-start gap-2.5 p-3 rounded-xl border border-border/80 bg-card hover:bg-accent/40 hover:border-primary/40 transition-all text-left shadow-2xs"
                      >
                        <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <div className="text-xs font-medium text-foreground">{item.label}</div>
                          <div className="text-[11px] text-muted-foreground line-clamp-1">
                            {item.prompt}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              messages.map((m) => {
                const isUser = m.role === "user"
                return (
                  <div
                    key={m.id}
                    className={`flex items-start gap-3 ${
                      isUser ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    {/* Avatar */}
                    <div
                      className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-semibold shadow-2xs ${
                        isUser
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground border border-border"
                      }`}
                    >
                      {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4 text-primary" />}
                    </div>

                    {/* Bubble */}
                    <div
                      className={`max-w-2xl rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-xs ${
                        isUser
                          ? "bg-primary text-primary-foreground rounded-tr-xs"
                          : "bg-card border border-border/80 text-card-foreground rounded-tl-xs"
                      }`}
                    >
                      {/* Sender Info & Timestamp */}
                      <div
                        className={`flex items-center gap-2 mb-1 text-[10px] ${
                          isUser ? "text-primary-foreground/70 justify-end" : "text-muted-foreground"
                        }`}
                      >
                        <span className="font-semibold">
                          {isUser ? "You" : "QNote Agent"}
                        </span>
                        <span>•</span>
                        <span>{m.timestamp}</span>
                      </div>

                      {/* Weather Tool Generative UI Call */}
                      {m.toolCall && m.toolCall.name === "get_weather" && (
                        <div className="my-2">
                          <WeatherWidget
                            status={m.toolCall.status}
                            args={m.toolCall.args}
                            result={m.toolCall.result}
                          />
                        </div>
                      )}

                      {/* Content */}
                      {m.content ? (
                        <div
                          className={`prose prose-xs max-w-none break-words ${
                            isUser ? "text-primary-foreground" : "dark:prose-invert"
                          }`}
                        >
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {m.content}
                          </ReactMarkdown>
                        </div>
                      ) : !m.toolCall && isStreaming ? (
                        <div className="flex items-center gap-1 py-1 text-muted-foreground">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" />
                        </div>
                      ) : null}

                      {/* Streaming cursor */}
                      {isStreaming && m.role === "assistant" && m.id === messages[messages.length - 1]?.id && (
                        <span className="inline-block w-1.5 h-3.5 bg-primary ml-0.5 align-middle animate-pulse" />
                      )}
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions Chips above input */}
          {messages.length > 0 && (
            <div className="px-5 py-1.5 border-t border-border/40 bg-muted/10 flex items-center gap-2 overflow-x-auto no-scrollbar">
              <span className="text-[10px] text-muted-foreground shrink-0 font-medium">
                Try asking:
              </span>
              {INITIAL_SUGGESTIONS.slice(0, 4).map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(item.prompt)}
                  disabled={isStreaming}
                  className="shrink-0 text-[11px] px-2.5 py-1 rounded-full border border-border/80 bg-background hover:bg-accent hover:border-primary/40 text-foreground transition-all flex items-center gap-1 disabled:opacity-50"
                >
                  <item.icon className="h-3 w-3 text-primary" />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Bottom Input Area */}
          <div className="p-4 border-t border-border bg-card/60 backdrop-blur-md">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSend()
              }}
              className="relative max-w-4xl mx-auto flex items-end gap-2"
            >
              <div className="flex-1 relative rounded-xl border border-border bg-background focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary transition-all">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask for live weather (e.g., 'What is the weather in Tokyo?') or explore your vault..."
                  rows={2}
                  disabled={isStreaming}
                  className="w-full resize-none bg-transparent p-3 text-xs outline-hidden placeholder:text-muted-foreground/70"
                />
              </div>

              {isStreaming ? (
                <button
                  type="button"
                  onClick={handleStop}
                  className="h-10 px-4 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-medium flex items-center gap-1.5 transition-all shadow-xs shrink-0"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                  <span>Stop</span>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="h-10 px-4 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:pointer-events-none text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs shrink-0"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Send</span>
                </button>
              )}
            </form>
            <div className="mt-2 text-center text-[10px] text-muted-foreground flex items-center justify-center gap-2">
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Live Open-Meteo Weather API
              </span>
              <span>•</span>
              <span>Pydantic AI Harness</span>
              <span>•</span>
              <button
                onClick={() => setShowSettings(true)}
                className="underline hover:text-foreground text-primary/90"
              >
                Configure LLM API Key
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* CopilotKit Native Chat Container */
        <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden p-4">
          <div className="flex-1 w-full max-w-4xl mx-auto border border-border rounded-2xl overflow-hidden bg-card shadow-sm flex flex-col">
            <CopilotChat
              className="h-full flex-1"
              labels={{
                title: "QNote CopilotKit Assistant",
                initial:
                  "👋 Hello! Connected to real-time Open-Meteo weather API and Pydantic AI agent. Ask me about weather in any city (e.g. 'What is the weather in Tokyo?') or interact with your notes!",
              }}
            />
          </div>
        </div>
      )}

      {/* API Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Key className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">API Settings & LLM Keys</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Connect real LLM APIs to the Pydantic AI harness
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              {/* Active Status Info */}
              <div className="rounded-xl bg-muted/40 p-3 border border-border/60">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Current Status
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Weather API: </span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      Open-Meteo (Live Global)
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">LLM Provider: </span>
                    <span className="font-semibold text-foreground capitalize">
                      {llmConfig.provider}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Active Model: </span>
                    <span className="font-mono text-[11px] text-foreground">
                      {llmConfig.model}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Key Status: </span>
                    <span className="font-mono text-[11px] text-foreground">
                      {llmConfig.has_api_key ? `Configured (${llmConfig.masked_key})` : "None"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Select Provider */}
              <div>
                <label className="block font-semibold text-foreground mb-1.5">
                  Select LLM Provider
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(PROVIDER_PRESETS).map(([key, item]) => {
                    const isSelected = selectedProvider === key
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleProviderSelect(key)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          isSelected
                            ? "border-primary bg-primary/10 text-foreground font-semibold shadow-xs"
                            : "border-border hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <div className="text-xs">{item.label}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* API Key Input */}
              {selectedProvider !== "test" && selectedProvider !== "ollama" && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-semibold text-foreground">
                      {PROVIDER_PRESETS[selectedProvider]?.label} API Key
                    </label>
                    <span className="text-[10px] text-muted-foreground">
                      Saved safely in backend/.env
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type={showKey ? "text" : "password"}
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder={
                        llmConfig.has_api_key && llmConfig.provider === selectedProvider
                          ? `Leave blank to keep existing (${llmConfig.masked_key})`
                          : PROVIDER_PRESETS[selectedProvider]?.keyPlaceholder
                      }
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 pr-10 text-xs outline-hidden focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                    >
                      {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Model Name */}
              <div>
                <label className="block font-semibold text-foreground mb-1.5">
                  Model Identifier
                </label>
                <input
                  type="text"
                  value={modelInput}
                  onChange={(e) => setModelInput(e.target.value)}
                  placeholder="e.g. google-gla:gemini-2.5-flash or openai:gpt-4o-mini"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-hidden focus:ring-2 focus:ring-primary/30 focus:border-primary font-mono"
                />
                {/* Model Chips */}
                {PROVIDER_PRESETS[selectedProvider]?.models && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {PROVIDER_PRESETS[selectedProvider].models.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setModelInput(m)}
                        className={`text-[10px] px-2 py-0.5 rounded-md border transition-all font-mono ${
                          modelInput === m
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted/40 border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Base URL (For Ollama or Custom Endpoint) */}
              {(selectedProvider === "ollama" || baseUrlInput) && (
                <div>
                  <label className="block font-semibold text-foreground mb-1.5">
                    API Base URL
                  </label>
                  <input
                    type="text"
                    value={baseUrlInput}
                    onChange={(e) => setBaseUrlInput(e.target.value)}
                    placeholder="http://localhost:11434/v1"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-hidden focus:ring-2 focus:ring-primary/30 focus:border-primary font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Default for local Ollama is <code className="text-primary font-mono">http://localhost:11434/v1</code>
                  </p>
                </div>
              )}

              {/* Feedback Alert */}
              {configFeedback && (
                <div
                  className={`p-3 rounded-xl border flex items-center gap-2 text-xs ${
                    configFeedback.type === "success"
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                      : "bg-destructive/10 border-destructive/30 text-destructive"
                  }`}
                >
                  {configFeedback.type === "success" ? (
                    <Check className="h-4 w-4 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0" />
                  )}
                  <span>{configFeedback.text}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                Changes apply instantly without restart
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  disabled={savingConfig}
                  className="px-4 py-1.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl transition-all shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {savingConfig ? (
                    <span>Testing...</span>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Save & Connect</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
