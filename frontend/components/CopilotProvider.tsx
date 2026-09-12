"use client"

import React from "react"
import { CopilotKit } from "@copilotkit/react-core"

export function CopilotProvider({ children }: { children: React.ReactNode }) {
  const runtimeUrl =
    typeof window !== "undefined"
      ? (process.env.NEXT_PUBLIC_COPILOT_URL || "http://localhost:8000/copilotkit")
      : "http://localhost:8000/copilotkit"

  return <CopilotKit runtimeUrl={runtimeUrl}>{children}</CopilotKit>
}
