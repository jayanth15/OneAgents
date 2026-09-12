"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Brain, MessageSquare, Bot, Sparkles, Database } from "lucide-react"

export function AppNavigation() {
  const pathname = usePathname()

  const navItems = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      active: pathname === "/dashboard" || pathname === "/",
    },
    {
      name: "Second-brain",
      href: "/second-brain",
      icon: Brain,
      active: pathname.startsWith("/second-brain"),
    },
    {
      name: "Chat",
      href: "/chat",
      icon: MessageSquare,
      active: pathname.startsWith("/chat"),
    },
    {
      name: "Agents",
      href: "/agents",
      icon: Bot,
      active: pathname.startsWith("/agents"),
    },
  ]

  return (
    <nav className="w-56 h-screen border-r border-border bg-sidebar/80 flex flex-col justify-between shrink-0 select-none z-30">
      <div>
        {/* Brand */}
        <div className="p-4 border-b border-border flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-base shadow-xs">
            Q
          </div>
          <div>
            <h1 className="font-semibold text-sm leading-tight tracking-tight">QNote Harness</h1>
            <p className="text-[10px] text-muted-foreground font-mono">v2.0 • Local Vault</p>
          </div>
        </div>

        {/* Nav Links */}
        <div className="p-3 space-y-1.5">
          <div className="px-2 py-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            Navigation
          </div>
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  item.active
                    ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
                }`}
              >
                <Icon size={16} />
                <span>{item.name}</span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-3.5 border-t border-border bg-muted/20 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 text-[11px]">
          <Database size={12} className="text-primary" />
          <span className="truncate">Disk: backend/vault</span>
        </div>
      </div>
    </nav>
  )
}
