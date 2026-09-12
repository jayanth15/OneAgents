"use client"

import React, { useState } from "react"
import {
  Sun,
  CloudSun,
  CloudRain,
  CloudLightning,
  Cloud,
  Wind,
  Droplets,
  MapPin,
  Sparkles,
  Loader2,
  CheckCircle2,
} from "lucide-react"

export interface WeatherData {
  location?: string
  temperature_c?: number
  temperature_f?: number
  condition?: string
  humidity?: number
  wind_speed?: string
  feels_like_c?: number
  feels_like_f?: number
  uv_index?: number
  forecast?: string
  timestamp?: string
  coordinates?: string
  source?: string
  status?: string
}

export interface WeatherWidgetProps {
  status?: string
  args?: {
    location?: string
  }
  result?: WeatherData | string
}

export function WeatherWidget({ status = "complete", args, result }: WeatherWidgetProps) {
  const [unit, setUnit] = useState<"C" | "F">("C")

  // Safely parse result if string
  let parsedResult: WeatherData | null = null
  if (result) {
    if (typeof result === "string") {
      try {
        parsedResult = JSON.parse(result)
      } catch {
        parsedResult = null
      }
    } else {
      parsedResult = result
    }
  }

  const isLoading =
    status === "inProgress" ||
    status === "executing" ||
    (!parsedResult && !args?.location)

  const locationName = parsedResult?.location || args?.location || "Location"
  const condition = parsedResult?.condition || "Partly Cloudy"

  const getWeatherIcon = (cond: string) => {
    const c = cond.toLowerCase()
    if (c.includes("thunder")) return <CloudLightning className="h-8 w-8 text-amber-500 animate-pulse" />
    if (c.includes("rain") || c.includes("shower") || c.includes("drizzle"))
      return <CloudRain className="h-8 w-8 text-blue-500" />
    if (c.includes("partly")) return <CloudSun className="h-8 w-8 text-amber-400" />
    if (c.includes("sunny") || c.includes("clear")) return <Sun className="h-8 w-8 text-yellow-500 animate-spin-slow" />
    return <Cloud className="h-8 w-8 text-muted-foreground" />
  }

  if (isLoading || !parsedResult) {
    return (
      <div className="my-3 w-full max-w-md rounded-xl border border-border/80 bg-card/90 backdrop-blur-sm p-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
            <div>
              <div className="text-xs font-semibold text-foreground">
                Pydantic AI Weather Tool
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Querying for {locationName}...
              </div>
            </div>
          </div>
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            Executing...
          </span>
        </div>
        <div className="mt-3 space-y-2">
          <div className="h-4 bg-muted/60 rounded-md animate-pulse w-3/4" />
          <div className="h-8 bg-muted/40 rounded-md animate-pulse w-1/2" />
        </div>
      </div>
    )
  }

  const temp = unit === "C" ? parsedResult.temperature_c : parsedResult.temperature_f
  const feelsLike = unit === "C" ? parsedResult.feels_like_c : parsedResult.feels_like_f

  return (
    <div className="my-3 w-full max-w-md rounded-xl border border-border/80 bg-gradient-to-br from-card via-card/95 to-accent/20 backdrop-blur-md p-4 shadow-sm hover:shadow-md transition-all">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shadow-xs">
            {getWeatherIcon(condition)}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="text-sm font-semibold text-foreground tracking-tight">
                {parsedResult.location}
              </h4>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-2.5 w-2.5" />
                Live
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">{condition}</p>
          </div>
        </div>

        {/* Temperature Unit Toggle */}
        <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5 text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => setUnit("C")}
            className={`px-2 py-0.5 rounded-md transition-all ${
              unit === "C"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            °C
          </button>
          <button
            type="button"
            onClick={() => setUnit("F")}
            className={`px-2 py-0.5 rounded-md transition-all ${
              unit === "F"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            °F
          </button>
        </div>
      </div>

      {/* Main Temp & Condition */}
      <div className="my-3.5 flex items-baseline justify-between">
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold tracking-tight text-foreground">
              {temp ?? "--"}
            </span>
            <span className="text-sm font-medium text-muted-foreground">°{unit}</span>
          </div>
          {feelsLike !== undefined && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Feels like {feelsLike}°{unit}
            </p>
          )}
        </div>

        {parsedResult.timestamp && (
          <span className="text-[10px] font-mono text-muted-foreground">
            {parsedResult.timestamp}
          </span>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2 border-t border-border/50 pt-3">
        <div className="rounded-lg bg-muted/30 p-2 text-center border border-border/30">
          <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground mb-0.5">
            <Droplets className="h-3 w-3 text-blue-500" />
            Humidity
          </div>
          <span className="text-xs font-semibold text-foreground">
            {parsedResult.humidity ?? "--"}%
          </span>
        </div>

        <div className="rounded-lg bg-muted/30 p-2 text-center border border-border/30">
          <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground mb-0.5">
            <Wind className="h-3 w-3 text-teal-500" />
            Wind
          </div>
          <span className="text-xs font-semibold text-foreground truncate block">
            {parsedResult.wind_speed ?? "--"}
          </span>
        </div>

        <div className="rounded-lg bg-muted/30 p-2 text-center border border-border/30">
          <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground mb-0.5">
            <Sparkles className="h-3 w-3 text-amber-500" />
            UV Index
          </div>
          <span className="text-xs font-semibold text-foreground">
            {parsedResult.uv_index ?? "--"}/10
          </span>
        </div>
      </div>

      {/* Forecast description */}
      {parsedResult.forecast && (
        <div className="mt-3 rounded-lg bg-primary/5 p-2.5 border border-primary/10 text-[11px] text-foreground/90">
          <span className="font-semibold text-primary mr-1">Forecast:</span>
          {parsedResult.forecast}
        </div>
      )}

      {/* Real API Source & Coordinates Info */}
      <div className="mt-2.5 flex items-center justify-between text-[10px] text-muted-foreground/90">
        <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {parsedResult.source || "Open-Meteo Real-Time Global API"}
        </span>
        {parsedResult.coordinates && (
          <span className="font-mono text-muted-foreground text-[9px]">
            Coords: {parsedResult.coordinates}
          </span>
        )}
      </div>

      {/* Tool source footer */}
      <div className="mt-2 border-t border-border/40 pt-2 font-mono text-[10px] text-muted-foreground/80">
        <span>Tool: pydantic_agent.get_weather</span>
      </div>
    </div>
  )
}
