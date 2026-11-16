'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import {
  Contrast,
  Expand,
  Minimize,
  MousePointer2,
  Move,
  PenLine,
  RotateCw,
  Ruler,
  Scan,
  Sun,
  SunMoon,
  Triangle,
  Type,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Sparkles,
  Crosshair,
  ArrowUpRight,
  MapPin,
  Trash2,
  type LucideIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const DEFAULTS = {
  zoom: 1,
  brightness: 100,
  contrast: 100,
  gamma: 1,
  rotate: 0,
  invert: false,
  sharpen: false,
}
type View = typeof DEFAULTS

function Tool({
  icon: Icon,
  label,
  onClick,
  active,
  disabled,
}: {
  icon: LucideIcon
  label: string
  onClick?: () => void
  active?: boolean
  disabled?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          aria-pressed={active}
          className={`flex flex-col items-center gap-0.5 rounded-md px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700 disabled:opacity-40 ${active ? 'bg-slate-600' : ''}`}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

const ANNOTATION_TOOLS: [LucideIcon, string][] = [
  [MousePointer2, 'Select'],
  [PenLine, 'Draw line'],
  [Ruler, 'Distance'],
  [Triangle, 'Angle'],
  [Crosshair, 'Reference point'],
  [ArrowUpRight, 'Arrow'],
  [MapPin, 'Marker'],
  [Type, 'Text'],
  [Trash2, 'Delete selected'],
]

export function ClinicalViewer({
  src,
  alt,
  resetKey,
}: {
  src: string | null
  alt: string
  resetKey: string
}) {
  const [view, setView] = useState<View>(DEFAULTS)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [fullscreen, setFullscreen] = useState(false)
  const stage = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null)
  const uid = useId().replace(/:/g, '')

  // A different image starts from a clean view.
  useEffect(() => {
    setView(DEFAULTS)
    setPan({ x: 0, y: 0 })
  }, [resetKey])

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === stage.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const set = (patch: Partial<View>) => setView((v) => ({ ...v, ...patch }))
  const zoomBy = useCallback((delta: number) => {
    setView((v) => ({ ...v, zoom: Math.min(8, Math.max(0.25, +(v.zoom + delta).toFixed(2))) }))
  }, [])
  const reset = () => {
    setView(DEFAULTS)
    setPan({ x: 0, y: 0 })
  }
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void stage.current?.requestFullscreen?.()
  }

  const filter = [
    `url(#gamma-${uid})`,
    `brightness(${view.brightness}%)`,
    `contrast(${view.contrast}%)`,
    view.invert ? 'invert(1)' : '',
    view.sharpen ? `url(#sharpen-${uid})` : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <TooltipProvider delayDuration={200}>
      <div
        ref={stage}
        className={`flex flex-col overflow-hidden rounded-xl border bg-slate-900 ${fullscreen ? 'h-screen rounded-none' : ''}`}
      >
        {/* The filters below only change how the image is shown; the stored file is never altered. */}
        <svg width="0" height="0" className="absolute" aria-hidden>
          <filter id={`gamma-${uid}`}>
            <feComponentTransfer>
              <feFuncR type="gamma" exponent={view.gamma} />
              <feFuncG type="gamma" exponent={view.gamma} />
              <feFuncB type="gamma" exponent={view.gamma} />
            </feComponentTransfer>
          </filter>
          <filter id={`sharpen-${uid}`}>
            <feConvolveMatrix order="3" kernelMatrix="0 -1 0 -1 5 -1 0 -1 0" preserveAlpha="true" />
          </filter>
        </svg>

        <div className="flex flex-wrap items-center gap-1 border-b border-slate-700 bg-slate-800 px-2 py-1">
          <Tool icon={ZoomIn} label="Zoom in" onClick={() => zoomBy(0.25)} disabled={!src} />
          <Tool icon={ZoomOut} label="Zoom out" onClick={() => zoomBy(-0.25)} disabled={!src} />
          <Tool
            icon={RotateCw}
            label="Rotate"
            onClick={() => set({ rotate: (view.rotate + 90) % 360 })}
            disabled={!src}
          />
          <Tool
            icon={SunMoon}
            label="Invert"
            active={view.invert}
            onClick={() => set({ invert: !view.invert })}
            disabled={!src}
          />
          <Tool
            icon={Sparkles}
            label="Sharpen"
            active={view.sharpen}
            onClick={() => set({ sharpen: !view.sharpen })}
            disabled={!src}
          />
          <label className="flex items-center gap-1 px-2 text-[11px] text-slate-200">
            <Sun className="h-4 w-4" /> Brightness
            <input
              type="range"
              min={50}
              max={170}
              value={view.brightness}
              onChange={(e) => set({ brightness: +e.target.value })}
              className="w-20"
              aria-label="Brightness"
              disabled={!src}
            />
          </label>
          <label className="flex items-center gap-1 px-2 text-[11px] text-slate-200">
            <Contrast className="h-4 w-4" /> Contrast
            <input
              type="range"
              min={50}
              max={200}
              value={view.contrast}
              onChange={(e) => set({ contrast: +e.target.value })}
              className="w-20"
              aria-label="Contrast"
              disabled={!src}
            />
          </label>
          <label className="flex items-center gap-1 px-2 text-[11px] text-slate-200">
            <Scan className="h-4 w-4" /> Gamma
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.05}
              value={view.gamma}
              onChange={(e) => set({ gamma: +e.target.value })}
              className="w-20"
              aria-label="Gamma"
              disabled={!src}
            />
          </label>
          <div className="ml-auto flex items-center gap-1">
            <Tool icon={RefreshCw} label="Reset" onClick={reset} disabled={!src} />
            <Tool
              icon={fullscreen ? Minimize : Expand}
              label={fullscreen ? 'Exit full screen' : 'Full screen'}
              onClick={toggleFullscreen}
              disabled={!src}
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Annotation tools arrive in the next phase; they are shown so the layout can be reviewed. */}
          <div className="flex w-16 shrink-0 flex-col items-center gap-1 border-r border-slate-700 bg-slate-800 py-2">
            {ANNOTATION_TOOLS.map(([Icon, label]) => (
              <Tool key={label} icon={Icon} label={label} disabled />
            ))}
          </div>

          <div
            className="relative flex min-h-[420px] flex-1 cursor-grab items-center justify-center overflow-hidden bg-black active:cursor-grabbing lg:min-h-[560px]"
            style={fullscreen ? { minHeight: 0 } : undefined}
            onWheel={(e) => {
              if (!src) return
              e.preventDefault()
              zoomBy(e.deltaY < 0 ? 0.15 : -0.15)
            }}
            onPointerDown={(e) => {
              if (!src) return
              ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
              drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }
            }}
            onPointerMove={(e) => {
              if (!drag.current) return
              setPan({
                x: drag.current.px + e.clientX - drag.current.x,
                y: drag.current.py + e.clientY - drag.current.y,
              })
            }}
            onPointerUp={() => (drag.current = null)}
            onDoubleClick={reset}
          >
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={alt}
                draggable={false}
                className="max-h-full max-w-full select-none object-contain"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${view.zoom}) rotate(${view.rotate}deg)`,
                  filter,
                  transition: drag.current ? 'none' : 'transform 80ms',
                }}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <Move className="h-8 w-8" />
                <p className="text-sm">Select an image from the library to view it here.</p>
              </div>
            )}
            {src && (
              <div className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-1 text-xs text-white">
                {Math.round(view.zoom * 100)}% · scroll to zoom · drag to move · double-click to
                reset
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-700 bg-slate-800 px-3 py-1.5 text-[11px] text-slate-300">
          <span>Viewing adjustments are temporary. The original image is never changed.</span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" className="h-6 px-2 text-[11px]" disabled>
              Save annotations
            </Button>
            <Button size="sm" variant="secondary" className="h-6 px-2 text-[11px]" disabled>
              Clear all
            </Button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
