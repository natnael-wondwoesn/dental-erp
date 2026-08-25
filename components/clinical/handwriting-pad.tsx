'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Eraser, Maximize2, PenLine, Redo2, RotateCcw, Trash2, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ClinicalInkDocument, InkPoint, InkStroke } from '@/lib/clinical-ink'

type Tool = 'pen' | 'eraser'

interface HandwritingPadProps {
  value?: ClinicalInkDocument | null
  onChange: (document: ClinicalInkDocument) => void
  draftKey?: string
  readOnly?: boolean
  className?: string
}

const EMPTY_DOCUMENT: ClinicalInkDocument = {
  version: 1,
  width: 1200,
  height: 700,
  strokes: [],
}

function strokeId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `stroke-${Date.now()}-${Math.random()}`
}

function drawDocument(canvas: HTMLCanvasElement, document: ClinicalInkDocument) {
  const context = canvas.getContext('2d')
  if (!context) return

  const rect = canvas.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  const width = Math.max(1, Math.round(rect.width * dpr))
  const height = Math.max(1, Math.round(rect.height * dpr))
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }

  context.clearRect(0, 0, width, height)
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)

  context.strokeStyle = '#dbe5ec'
  context.lineWidth = dpr
  const lineGap = 42 * dpr
  for (let y = lineGap; y < height; y += lineGap) {
    context.beginPath()
    context.moveTo(0, y)
    context.lineTo(width, y)
    context.stroke()
  }

  for (const stroke of document.strokes) {
    if (stroke.points.length === 0) continue
    context.strokeStyle = stroke.color
    context.lineCap = 'round'
    context.lineJoin = 'round'

    if (stroke.points.length === 1) {
      const point = stroke.points[0]
      context.fillStyle = stroke.color
      context.beginPath()
      context.arc(point.x * width, point.y * height, stroke.width * dpr, 0, Math.PI * 2)
      context.fill()
      continue
    }

    for (let index = 1; index < stroke.points.length; index += 1) {
      const previous = stroke.points[index - 1]
      const point = stroke.points[index]
      const pressure = Math.max(0.25, (previous.pressure + point.pressure) / 2)
      context.lineWidth = stroke.width * pressure * 2 * dpr
      context.beginPath()
      context.moveTo(previous.x * width, previous.y * height)
      context.lineTo(point.x * width, point.y * height)
      context.stroke()
    }
  }
}

export function HandwritingPad({
  value,
  onChange,
  draftKey,
  readOnly = false,
  className = '',
}: HandwritingPadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const activeStroke = useRef<InkStroke | null>(null)
  const activePointer = useRef<number | null>(null)
  const lastPenAt = useRef(0)
  const startedAt = useRef(0)
  const [document, setDocument] = useState<ClinicalInkDocument>(() => value ?? EMPTY_DOCUMENT)
  const [redo, setRedo] = useState<InkStroke[]>([])
  const [tool, setTool] = useState<Tool>('pen')
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  useEffect(() => {
    if (value) setDocument(value)
  }, [value])

  useEffect(() => {
    if (!draftKey || value?.strokes.length) return
    try {
      const saved = localStorage.getItem(draftKey)
      if (saved) setDocument(JSON.parse(saved) as ClinicalInkDocument)
    } catch {
      localStorage.removeItem(draftKey)
    }
  }, [draftKey, value])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const render = () => drawDocument(canvas, document)
    render()
    const observer = new ResizeObserver(render)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [document])

  const publish = useCallback(
    (next: ClinicalInkDocument) => {
      setDocument(next)
      onChange(next)
      if (draftKey) {
        localStorage.setItem(draftKey, JSON.stringify(next))
        setSavedAt(new Date())
      }
    },
    [draftKey, onChange]
  )

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>): InkPoint => {
    const rect = event.currentTarget.getBoundingClientRect()
    const pressure = event.pointerType === 'mouse' ? 0.5 : event.pressure || 0.35
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
      pressure: Math.min(1, Math.max(0.05, pressure)),
      time: Math.max(0, Math.round(event.timeStamp - startedAt.current)),
    }
  }

  const eraseAt = (point: InkPoint) => {
    const radius = 0.025
    const nextStrokes = document.strokes.filter(
      (stroke) =>
        !stroke.points.some(
          (candidate) => Math.hypot(candidate.x - point.x, candidate.y - point.y) <= radius
        )
    )
    if (nextStrokes.length !== document.strokes.length) {
      publish({ ...document, strokes: nextStrokes })
      setRedo([])
    }
  }

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (readOnly || event.isPrimary === false) return
    if (event.pointerType === 'touch' && Date.now() - lastPenAt.current < 1200) return
    if (event.pointerType === 'pen') lastPenAt.current = Date.now()
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    activePointer.current = event.pointerId
    startedAt.current = event.timeStamp
    const point = pointFromEvent(event)
    if (tool === 'eraser') {
      eraseAt(point)
      return
    }
    activeStroke.current = {
      id: strokeId(),
      color: '#172033',
      width: 2.5,
      points: [point],
    }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (readOnly || activePointer.current !== event.pointerId) return
    event.preventDefault()
    const native = event.nativeEvent
    const samples = native.getCoalescedEvents?.() ?? [native]
    const points = samples.map((sample) => {
      const rect = event.currentTarget.getBoundingClientRect()
      return {
        x: Math.min(1, Math.max(0, (sample.clientX - rect.left) / rect.width)),
        y: Math.min(1, Math.max(0, (sample.clientY - rect.top) / rect.height)),
        pressure: Math.min(
          1,
          Math.max(0.05, sample.pointerType === 'mouse' ? 0.5 : sample.pressure || 0.35)
        ),
        time: Math.max(0, Math.round(sample.timeStamp - startedAt.current)),
      }
    })
    if (tool === 'eraser') {
      for (const point of points) eraseAt(point)
      return
    }
    if (!activeStroke.current) return
    activeStroke.current = {
      ...activeStroke.current,
      points: [...activeStroke.current.points, ...points],
    }
    drawDocument(event.currentTarget, {
      ...document,
      strokes: [...document.strokes, activeStroke.current],
    })
  }

  const finishStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointer.current !== event.pointerId) return
    activePointer.current = null
    if (activeStroke.current) {
      publish({ ...document, strokes: [...document.strokes, activeStroke.current] })
      activeStroke.current = null
      setRedo([])
    }
  }

  const undo = () => {
    const removed = document.strokes.at(-1)
    if (!removed) return
    setRedo((items) => [...items, removed])
    publish({ ...document, strokes: document.strokes.slice(0, -1) })
  }

  const redoStroke = () => {
    const restored = redo.at(-1)
    if (!restored) return
    setRedo((items) => items.slice(0, -1))
    publish({ ...document, strokes: [...document.strokes, restored] })
  }

  const clear = () => {
    if (document.strokes.length === 0) return
    setRedo(document.strokes)
    publish({ ...document, strokes: [] })
  }

  const toggleFullscreen = async () => {
    if (!globalThis.document.fullscreenElement) await containerRef.current?.requestFullscreen()
    else await globalThis.document.exitFullscreen()
  }

  return (
    <div
      ref={containerRef}
      className={`space-y-3 rounded-xl border bg-background p-3 ${className}`}
    >
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={tool === 'pen' ? 'default' : 'outline'}
            onClick={() => setTool('pen')}
          >
            <PenLine className="mr-1 h-4 w-4" /> Pen
          </Button>
          <Button
            type="button"
            size="sm"
            variant={tool === 'eraser' ? 'default' : 'outline'}
            onClick={() => setTool('eraser')}
          >
            <Eraser className="mr-1 h-4 w-4" /> Eraser
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={undo}
            disabled={!document.strokes.length}
          >
            <Undo2 className="h-4 w-4" /> <span className="sr-only">Undo</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={redoStroke}
            disabled={!redo.length}
          >
            <Redo2 className="h-4 w-4" /> <span className="sr-only">Redo</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={clear}
            disabled={!document.strokes.length}
          >
            <Trash2 className="h-4 w-4" /> <span className="sr-only">Clear page</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={toggleFullscreen}
            className="ml-auto"
          >
            <Maximize2 className="mr-1 h-4 w-4" /> Full screen
          </Button>
        </div>
      )}
      <canvas
        ref={canvasRef}
        aria-label="Handwritten diagnosis writing area"
        className={`h-[420px] w-full rounded-lg border border-slate-300 bg-white touch-none ${readOnly ? '' : tool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair'}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
      />
      {!readOnly && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            S Pen, stylus, touch, and mouse supported. Palm touches are ignored while the pen is
            active.
          </span>
          <span className="flex items-center gap-1">
            <RotateCcw className="h-3 w-3" />
            {savedAt
              ? `Draft saved ${savedAt.toLocaleTimeString()}`
              : 'Draft saves after every stroke'}
          </span>
        </div>
      )}
    </div>
  )
}
