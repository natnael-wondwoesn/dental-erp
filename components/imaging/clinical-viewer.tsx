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
import {
  angleDeg,
  EMPTY_ANNOTATIONS,
  formatDistance,
  lengthPx,
  type Annotation,
  type AnnotationSet,
  type AnnotationType,
  type Pt,
} from './types'
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

type ToolId = 'select' | AnnotationType
const ANNOTATION_TOOLS: [LucideIcon, string, ToolId][] = [
  [MousePointer2, 'Select', 'select'],
  [PenLine, 'Draw line', 'line'],
  [Ruler, 'Distance', 'distance'],
  [Triangle, 'Angle', 'angle'],
  [Crosshair, 'Reference point', 'point'],
  [ArrowUpRight, 'Arrow', 'arrow'],
  [MapPin, 'Marker', 'marker'],
  [Type, 'Text', 'text'],
]
const COLORS: Record<AnnotationType, string> = {
  line: '#38bdf8',
  distance: '#facc15',
  angle: '#4ade80',
  point: '#f472b6',
  arrow: '#fb923c',
  marker: '#f87171',
  text: '#e2e8f0',
}
const newId = () => `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

// Wheel zoom is proportional to how far the wheel moved, so a gentle scroll gives a gentle zoom.
export const WHEEL_ZOOM_SPEED = 0.0012
export const BUTTON_ZOOM_STEP = 1.1
const MIN_ZOOM = 0.25
const MAX_ZOOM = 8
const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +z.toFixed(3)))

export function ClinicalViewer({
  src,
  alt,
  resetKey,
  annotations = EMPTY_ANNOTATIONS,
  onAnnotationsChange,
  onSave,
  dirty = false,
}: {
  src: string | null
  alt: string
  resetKey: string
  annotations?: AnnotationSet
  onAnnotationsChange?: (next: AnnotationSet) => void
  onSave?: () => Promise<boolean>
  dirty?: boolean
}) {
  const [view, setView] = useState<View>(DEFAULTS)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [fullscreen, setFullscreen] = useState(false)
  const stage = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null)
  const uid = useId().replace(/:/g, '')
  const svgRef = useRef<SVGSVGElement>(null)
  const [tool, setTool] = useState<ToolId>('select')
  const [selectedAnn, setSelectedAnn] = useState<string | null>(null)
  const [draft, setDraft] = useState<Pt[] | null>(null)
  const [cursor, setCursor] = useState<Pt | null>(null)
  const [textDraft, setTextDraft] = useState<{
    at: Pt
    left: number
    top: number
    value: string
  } | null>(null)
  const [nat, setNat] = useState({ w: 1000, h: 750 })
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const moving = useRef<{ id: string; from: Pt; orig: Pt[] } | null>(null)
  const area = useRef<HTMLDivElement>(null)

  // A different image starts from a clean view.
  useEffect(() => {
    setView(DEFAULTS)
    setPan({ x: 0, y: 0 })
    setTool('select')
    setSelectedAnn(null)
    setDraft(null)
    setTextDraft(null)
    setMessage(null)
  }, [resetKey])

  // Fit the image into the viewing area (the drawing layer shares this exact box).
  useEffect(() => {
    const el = area.current
    if (!el) return
    const fit = () => {
      const aw = el.clientWidth
      const ah = el.clientHeight
      if (!aw || !ah) return setBox({ w: 0, h: 0 })
      const f = Math.min(aw / nat.w, ah / nat.h)
      setBox({ w: nat.w * f, h: nat.h * f })
    }
    fit()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [nat, fullscreen])

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === stage.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const set = (patch: Partial<View>) => setView((v) => ({ ...v, ...patch }))
  const zoomBy = useCallback((factor: number) => {
    setView((v) => ({ ...v, zoom: clampZoom(v.zoom * factor) }))
  }, [])

  // Native listener: React's onWheel is passive, so it could not stop the page from scrolling.
  useEffect(() => {
    const el = area.current
    if (!el || !src) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const dy = Math.max(-100, Math.min(100, e.deltaY))
      zoomBy(Math.exp(-dy * WHEEL_ZOOM_SPEED))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [src, zoomBy])

  const items = annotations.items
  const commit = useCallback(
    (nextItems: Annotation[], mmPerPx = annotations.mmPerPx) =>
      onAnnotationsChange?.({ items: nextItems, mmPerPx }),
    [annotations.mmPerPx, onAnnotationsChange]
  )
  const selectedItem = items.find((a) => a.id === selectedAnn) ?? null
  const deleteSelected = useCallback(() => {
    if (!selectedAnn) return
    commit(items.filter((a) => a.id !== selectedAnn))
    setSelectedAnn(null)
  }, [commit, items, selectedAnn])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      if (e.key === 'Escape') {
        setDraft(null)
        setTextDraft(null)
        setTool('select')
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedAnn) {
        e.preventDefault()
        deleteSelected()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [deleteSelected, selectedAnn])

  // Screen position -> image pixel position (accounts for pan, zoom and rotation).
  const toImage = (e: { clientX: number; clientY: number }): Pt | null => {
    const m = svgRef.current?.getScreenCTM?.()
    if (!m) return null
    const det = m.a * m.d - m.b * m.c
    if (!det) return null
    const x = e.clientX - m.e
    const y = e.clientY - m.f
    return { x: (m.d * x - m.c * y) / det, y: (-m.b * x + m.a * y) / det }
  }
  const unit = box.w ? nat.w / (box.w * view.zoom) : 1 // one screen pixel in image units

  const finishShape = (type: AnnotationType, points: Pt[], text?: string) => {
    const n = type === 'marker' ? items.filter((a) => a.type === 'marker').length + 1 : undefined
    const ann: Annotation = {
      id: newId(),
      type,
      points,
      ...(text ? { text } : {}),
      ...(n ? { n } : {}),
    }
    commit([...items, ann])
    setSelectedAnn(ann.id)
  }

  const onAreaDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!src) return
    const p = toImage(e)
    if (tool !== 'select' && p && onAnnotationsChange) {
      e.preventDefault()
      setSelectedAnn(null)
      if (tool === 'point' || tool === 'marker') return finishShape(tool, [p])
      if (tool === 'text') {
        const r = area.current!.getBoundingClientRect()
        return setTextDraft({ at: p, left: e.clientX - r.left, top: e.clientY - r.top, value: '' })
      }
      if (tool === 'angle') {
        const next = [...(draft ?? []), p]
        if (next.length === 3) {
          finishShape('angle', next)
          return setDraft(null)
        }
        return setDraft(next)
      }
      ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
      return setDraft([p, p])
    }
    // Select tool on empty space: pan and deselect.
    setSelectedAnn(null)
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }
  }
  const onAreaMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current) {
      setPan({
        x: drag.current.px + e.clientX - drag.current.x,
        y: drag.current.py + e.clientY - drag.current.y,
      })
      return
    }
    const p = toImage(e)
    if (!p) return
    if (moving.current) {
      const dx = p.x - moving.current.from.x
      const dy = p.y - moving.current.from.y
      const { id, orig } = moving.current
      commit(
        items.map((a) =>
          a.id === id ? { ...a, points: orig.map((q) => ({ x: q.x + dx, y: q.y + dy })) } : a
        )
      )
      return
    }
    if (tool === 'angle' && draft) setCursor(p)
    else if (draft && draft.length === 2 && tool !== 'angle') setDraft([draft[0], p])
  }
  const onAreaUp = () => {
    drag.current = null
    moving.current = null
    if (draft && draft.length === 2 && tool !== 'angle') {
      if (lengthPx(draft[0], draft[1]) > 4 * unit) finishShape(tool as AnnotationType, draft)
      setDraft(null)
    }
  }

  const clearAll = () => {
    if (!items.length) return
    if (typeof window !== 'undefined' && !window.confirm('Remove every annotation on this image?'))
      return
    commit([])
    setSelectedAnn(null)
  }
  const calibrate = () => {
    if (selectedItem?.type !== 'distance') return
    const input = window.prompt('Real length of the selected line, in millimetres')
    const mm = input ? parseFloat(input.replace(',', '.')) : NaN
    if (!mm || mm <= 0) return
    const px = lengthPx(selectedItem.points[0], selectedItem.points[1])
    if (px) commit(items, mm / px)
  }
  const save = async () => {
    if (!onSave) return
    setSaving(true)
    setMessage(null)
    const ok = await onSave()
    setSaving(false)
    setMessage(ok ? 'Annotations saved.' : 'Could not save the annotations. Please try again.')
  }
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
          <Tool
            icon={ZoomIn}
            label="Zoom in"
            onClick={() => zoomBy(BUTTON_ZOOM_STEP)}
            disabled={!src}
          />
          <Tool
            icon={ZoomOut}
            label="Zoom out"
            onClick={() => zoomBy(1 / BUTTON_ZOOM_STEP)}
            disabled={!src}
          />
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
          <div className="flex w-16 shrink-0 flex-col items-center gap-1 border-r border-slate-700 bg-slate-800 py-2">
            {ANNOTATION_TOOLS.map(([Icon, label, id]) => (
              <Tool
                key={id}
                icon={Icon}
                label={label}
                active={tool === id}
                onClick={() => {
                  setTool(id)
                  setDraft(null)
                  setTextDraft(null)
                }}
                disabled={!src || !onAnnotationsChange}
              />
            ))}
            <Tool
              icon={Trash2}
              label="Delete selected"
              onClick={deleteSelected}
              disabled={!selectedAnn}
            />
          </div>

          <div
            ref={area}
            className={`relative flex min-h-[420px] flex-1 items-center justify-center overflow-hidden bg-black lg:min-h-[560px] ${tool === 'select' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`}
            style={fullscreen ? { minHeight: 0 } : undefined}
            onPointerDown={onAreaDown}
            onPointerMove={onAreaMove}
            onPointerUp={onAreaUp}
            onDoubleClick={() => tool === 'select' && reset()}
          >
            {src ? (
              <div
                className="relative shrink-0"
                style={{
                  width: box.w || undefined,
                  height: box.h || undefined,
                  maxWidth: box.w ? undefined : '100%',
                  maxHeight: box.w ? undefined : '100%',
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${view.zoom}) rotate(${view.rotate}deg)`,
                  transition: drag.current ? 'none' : 'transform 80ms',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={alt}
                  draggable={false}
                  onLoad={(e) => {
                    const i = e.currentTarget
                    if (i.naturalWidth) setNat({ w: i.naturalWidth, h: i.naturalHeight })
                  }}
                  className="block h-full w-full select-none object-contain"
                  style={{ filter }}
                />
                <svg
                  ref={svgRef}
                  data-testid="annotation-layer"
                  viewBox={`0 0 ${nat.w} ${nat.h}`}
                  preserveAspectRatio="none"
                  className="absolute inset-0 h-full w-full overflow-visible"
                >
                  {items.map((a) => (
                    <AnnotationShape
                      key={a.id}
                      ann={a}
                      unit={unit}
                      selected={a.id === selectedAnn}
                      mmPerPx={annotations.mmPerPx}
                      onDown={(e) => {
                        if (tool !== 'select') return
                        e.stopPropagation()
                        const p = toImage(e)
                        setSelectedAnn(a.id)
                        if (p && onAnnotationsChange) {
                          ;(area.current as HTMLElement).setPointerCapture?.(e.pointerId)
                          moving.current = { id: a.id, from: p, orig: a.points }
                        }
                      }}
                    />
                  ))}
                  {draft && (
                    <AnnotationShape
                      ann={{
                        id: 'draft',
                        type: tool as AnnotationType,
                        points:
                          tool === 'angle' && cursor && draft.length < 3
                            ? [...draft, cursor]
                            : draft,
                      }}
                      unit={unit}
                      selected={false}
                      draft
                      mmPerPx={annotations.mmPerPx}
                    />
                  )}
                </svg>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <Move className="h-8 w-8" />
                <p className="text-sm">Select an image from the library to view it here.</p>
              </div>
            )}
            {textDraft && (
              <input
                autoFocus
                aria-label="Annotation text"
                value={textDraft.value}
                onPointerDown={(e) => e.stopPropagation()}
                onChange={(e) => setTextDraft({ ...textDraft, value: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && textDraft.value.trim()) {
                    finishShape('text', [textDraft.at], textDraft.value.trim())
                    setTextDraft(null)
                  } else if (e.key === 'Escape') setTextDraft(null)
                }}
                onBlur={() => setTextDraft(null)}
                placeholder="Type and press Enter"
                className="absolute z-10 rounded border border-slate-500 bg-slate-900 px-2 py-1 text-xs text-white"
                style={{ left: textDraft.left, top: textDraft.top }}
              />
            )}
            {src && (
              <div className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/60 px-2 py-1 text-xs text-white">
                {Math.round(view.zoom * 100)}% ·{' '}
                {tool === 'select'
                  ? 'scroll to zoom · drag to move · double-click to reset'
                  : tool === 'angle'
                    ? 'click three points: start, corner, end · Esc to stop'
                    : 'Esc to stop drawing'}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-700 bg-slate-800 px-3 py-1.5 text-[11px] text-slate-300">
          <span>
            {message ??
              (dirty
                ? 'You have unsaved annotations.'
                : 'Viewing adjustments are temporary. The original image is never changed.')}
            {' · '}
            {annotations.mmPerPx ? 'Scale set: distances in mm.' : 'No scale: distances in pixels.'}
          </span>
          <div className="flex gap-2">
            {selectedItem?.type === 'distance' && (
              <Button
                size="sm"
                variant="secondary"
                className="h-6 px-2 text-[11px]"
                onClick={calibrate}
              >
                Set scale from line
              </Button>
            )}
            {annotations.mmPerPx ? (
              <Button
                size="sm"
                variant="secondary"
                className="h-6 px-2 text-[11px]"
                onClick={() => commit(items, null)}
              >
                Clear scale
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="secondary"
              className="h-6 px-2 text-[11px]"
              disabled={!onSave || !dirty || saving}
              onClick={save}
            >
              {saving ? 'Saving…' : 'Save annotations'}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="h-6 px-2 text-[11px]"
              disabled={!onAnnotationsChange || items.length === 0}
              onClick={clearAll}
            >
              Clear all
            </Button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

function AnnotationShape({
  ann,
  unit,
  selected,
  draft,
  mmPerPx,
  onDown,
}: {
  ann: Annotation
  unit: number
  selected: boolean
  draft?: boolean
  mmPerPx?: number | null
  onDown?: (e: React.PointerEvent<SVGGElement>) => void
}) {
  const color = COLORS[ann.type]
  const sw = (selected ? 3 : 2) * unit
  const fs = 13 * unit
  const [a, b, c] = ann.points
  const label = (x: number, y: number, text: string) => (
    <text
      x={x}
      y={y}
      fontSize={fs}
      fill={color}
      stroke="#000"
      strokeWidth={3 * unit}
      paintOrder="stroke"
      fontWeight={600}
    >
      {text}
    </text>
  )
  const dot = (p: Pt, r = 4) => <circle cx={p.x} cy={p.y} r={r * unit} fill={color} />
  const hit = { stroke: 'transparent', strokeWidth: 14 * unit, fill: 'none' }
  let body: React.ReactNode = null

  if ((ann.type === 'line' || ann.type === 'distance' || ann.type === 'arrow') && b) {
    const px = lengthPx(a, b)
    const ang = Math.atan2(b.y - a.y, b.x - a.x)
    const head = 14 * unit
    body = (
      <>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} {...hit} />
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={sw} />
        {ann.type === 'arrow' ? (
          <polygon
            fill={color}
            points={[
              [b.x, b.y],
              [b.x - head * Math.cos(ang - 0.45), b.y - head * Math.sin(ang - 0.45)],
              [b.x - head * Math.cos(ang + 0.45), b.y - head * Math.sin(ang + 0.45)],
            ]
              .map((q) => q.join(','))
              .join(' ')}
          />
        ) : (
          <>
            {dot(a, 3)}
            {dot(b, 3)}
          </>
        )}
        {ann.type === 'distance' &&
          label(
            (a.x + b.x) / 2 + 6 * unit,
            (a.y + b.y) / 2 - 6 * unit,
            formatDistance(px, mmPerPx)
          )}
      </>
    )
  } else if (ann.type === 'angle') {
    body = (
      <>
        {a && b && <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={sw} />}
        {b && c && <line x1={b.x} y1={b.y} x2={c.x} y2={c.y} stroke={color} strokeWidth={sw} />}
        {a && b && c && <polyline points={`${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y}`} {...hit} />}
        {ann.points.map((p, i) => (
          <g key={i}>{dot(p, 3)}</g>
        ))}
        {a && b && c && label(b.x + 10 * unit, b.y - 10 * unit, `${angleDeg(a, b, c).toFixed(1)}°`)}
      </>
    )
  } else if (ann.type === 'point') {
    body = (
      <>
        <circle cx={a.x} cy={a.y} r={14 * unit} {...hit} fill="transparent" />
        <circle cx={a.x} cy={a.y} r={8 * unit} fill="none" stroke={color} strokeWidth={sw} />
        <line
          x1={a.x - 14 * unit}
          y1={a.y}
          x2={a.x + 14 * unit}
          y2={a.y}
          stroke={color}
          strokeWidth={sw}
        />
        <line
          x1={a.x}
          y1={a.y - 14 * unit}
          x2={a.x}
          y2={a.y + 14 * unit}
          stroke={color}
          strokeWidth={sw}
        />
      </>
    )
  } else if (ann.type === 'marker') {
    body = (
      <>
        <circle
          cx={a.x}
          cy={a.y}
          r={11 * unit}
          fill={color}
          stroke="#fff"
          strokeWidth={unit * (selected ? 3 : 1.5)}
        />
        <text
          x={a.x}
          y={a.y + 4.5 * unit}
          fontSize={12 * unit}
          textAnchor="middle"
          fill="#fff"
          fontWeight={700}
        >
          {ann.n ?? ''}
        </text>
      </>
    )
  } else if (ann.type === 'text') {
    body = (
      <>
        <rect
          x={a.x - 4 * unit}
          y={a.y - fs}
          width={(ann.text?.length ?? 1) * fs * 0.62 + 8 * unit}
          height={fs * 1.5}
          fill="transparent"
        />
        {label(a.x, a.y, ann.text ?? '')}
      </>
    )
  }

  return (
    <g
      data-annotation={ann.type}
      data-selected={selected || undefined}
      opacity={draft ? 0.8 : 1}
      onPointerDown={onDown}
      style={{ cursor: onDown ? 'move' : undefined }}
    >
      {selected && a && (
        <rect
          x={Math.min(...ann.points.map((p) => p.x)) - 10 * unit}
          y={Math.min(...ann.points.map((p) => p.y)) - 10 * unit}
          width={
            Math.max(...ann.points.map((p) => p.x)) -
            Math.min(...ann.points.map((p) => p.x)) +
            20 * unit
          }
          height={
            Math.max(...ann.points.map((p) => p.y)) -
            Math.min(...ann.points.map((p) => p.y)) +
            20 * unit
          }
          fill="none"
          stroke="#fff"
          strokeDasharray={`${4 * unit} ${3 * unit}`}
          strokeWidth={unit}
        />
      )}
      {body}
    </g>
  )
}
