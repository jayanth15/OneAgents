"use client"

import React, { useEffect, useRef, useState } from "react"
import * as d3 from "d3-force"
import { ZoomIn, ZoomOut, RotateCcw, Share2, Search, Maximize2 } from "lucide-react"
import type { GraphData, GraphNode, GraphLink } from "../types/note"

interface KnowledgeGraphProps {
  data: GraphData | null
  activeNoteId: number | null
  onSelectNote: (id: number) => void
}

export function KnowledgeGraph({ data, activeNoteId, onSelectNote }: KnowledgeGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
  const [filterQuery, setFilterQuery] = useState("")

  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null)
  const nodesRef = useRef<GraphNode[]>([])
  const linksRef = useRef<GraphLink[]>([])

  useEffect(() => {
    if (!data || !canvasRef.current) return

    const canvas = canvasRef.current
    const width = canvas.parentElement?.clientWidth || 800
    const height = canvas.parentElement?.clientHeight || 600
    canvas.width = width
    canvas.height = height

    // Clone data for simulation
    const nodes: GraphNode[] = data.nodes.map((n) => ({ ...n }))
    const links: GraphLink[] = data.links.map((l) => ({
      source: typeof l.source === "object" ? (l.source as any).id : l.source,
      target: typeof l.target === "object" ? (l.target as any).id : l.target,
      type: l.type,
    }))

    nodesRef.current = nodes
    linksRef.current = links

    // D3 Force Simulation
    const simulation = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance(90)
      )
      .force("charge", d3.forceManyBody().strength(-220))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius((d: any) => (d.val || 1) * 6 + 12))

    simulationRef.current = simulation

    simulation.on("tick", () => {
      drawCanvas()
    })

    return () => {
      simulation.stop()
    }
  }, [data])

  const drawCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.save()
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.translate(pan.x, pan.y)
    ctx.scale(zoomLevel, zoomLevel)

    const nodes = nodesRef.current
    const links = linksRef.current

    // Draw Links
    links.forEach((link: any) => {
      if (!link.source || !link.target) return
      ctx.beginPath()
      ctx.moveTo(link.source.x, link.source.y)
      ctx.lineTo(link.target.x, link.target.y)

      const isConnected =
        hoveredNode &&
        (link.source.id === hoveredNode.id || link.target.id === hoveredNode.id)

      ctx.strokeStyle = isConnected
        ? "rgba(139, 92, 246, 0.8)"
        : "rgba(150, 150, 160, 0.25)"
      ctx.lineWidth = isConnected ? 2 : 1
      ctx.stroke()
    })

    // Draw Nodes
    nodes.forEach((node: any) => {
      if (!node.x || !node.y) return
      const isHovered = hoveredNode?.id === node.id
      const isActive = activeNoteId && node.note_id === activeNoteId
      const radius = Math.min(24, Math.max(7, (node.val || 1) * 3.5))

      // Outer glow for active or hovered
      if (isActive || isHovered) {
        ctx.beginPath()
        ctx.arc(node.x, node.y, radius + 4, 0, 2 * Math.PI)
        ctx.fillStyle = isActive ? "rgba(139, 92, 246, 0.3)" : "rgba(59, 130, 246, 0.3)"
        ctx.fill()
      }

      // Main Circle
      ctx.beginPath()
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI)
      ctx.fillStyle = isActive
        ? "#8b5cf6"
        : isHovered
        ? "#3b82f6"
        : node.folder_name === "Inbox"
        ? "#f59e0b"
        : "#64748b"
      ctx.fill()

      // Node Label
      ctx.font = `${isHovered || isActive ? "bold 12px" : "11px"} sans-serif`
      ctx.fillStyle = isHovered || isActive ? "#0f172a" : "#475569"
      ctx.textAlign = "center"
      ctx.fillText(node.title, node.x, node.y + radius + 13)
    })

    ctx.restore()
  }

  // Mouse interaction
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mouseX = (e.clientX - rect.left - pan.x) / zoomLevel
    const mouseY = (e.clientY - rect.top - pan.y) / zoomLevel

    let found: GraphNode | null = null
    for (const node of nodesRef.current) {
      if (!node.x || !node.y) continue
      const radius = (node.val || 1) * 3.5 + 8
      const dist = Math.hypot(node.x - mouseX, node.y - mouseY)
      if (dist <= radius) {
        found = node
        break
      }
    }

    if (found !== hoveredNode) {
      setHoveredNode(found)
      drawCanvas()
    }
  }

  const handleClick = () => {
    if (hoveredNode && hoveredNode.note_id) {
      onSelectNote(hoveredNode.note_id)
    }
  }

  return (
    <div className="relative flex-1 h-screen w-full bg-sidebar/20 overflow-hidden select-none">
      {/* Top Floating Stats & Controls */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-background/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-border/80 shadow-xs text-xs">
        <Share2 size={14} className="text-primary" />
        <span className="font-semibold">{data?.nodes.length || 0} Nodes</span>
        <span className="text-muted-foreground">•</span>
        <span>{data?.links.length || 0} Links</span>
      </div>

      <div className="absolute top-4 right-4 z-10 flex items-center gap-1 bg-background/80 backdrop-blur-md p-1 rounded-lg border border-border/80 shadow-xs">
        <button
          onClick={() => {
            setZoomLevel((z) => Math.min(2.5, z + 0.2))
            drawCanvas()
          }}
          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
          title="Zoom In"
        >
          <ZoomIn size={15} />
        </button>
        <button
          onClick={() => {
            setZoomLevel((z) => Math.max(0.4, z - 0.2))
            drawCanvas()
          }}
          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
          title="Zoom Out"
        >
          <ZoomOut size={15} />
        </button>
        <button
          onClick={() => {
            setZoomLevel(1)
            setPan({ x: 0, y: 0 })
            drawCanvas()
          }}
          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
          title="Reset View"
        >
          <RotateCcw size={15} />
        </button>
      </div>

      {/* Hover Info Tooltip */}
      {hoveredNode && (
        <div className="absolute bottom-6 left-6 z-10 bg-background/90 backdrop-blur-md p-3 rounded-lg border border-border shadow-lg text-xs max-w-xs pointer-events-none">
          <div className="font-bold text-sm text-foreground">{hoveredNode.title}</div>
          <div className="text-muted-foreground mt-0.5">Folder: {hoveredNode.folder_name}</div>
          <div className="text-muted-foreground">Connections: {hoveredNode.val}</div>
          {hoveredNode.tags && hoveredNode.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {hoveredNode.tags.map((t) => (
                <span key={t} className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-medium">
                  #{t}
                </span>
              ))}
            </div>
          )}
          <div className="text-[11px] text-primary mt-2">Click to open note</div>
        </div>
      )}

      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        className="w-full h-full cursor-pointer"
      />
    </div>
  )
}
