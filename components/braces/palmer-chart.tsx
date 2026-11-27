'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { Eraser, MousePointer2, Pencil, Printer, Redo2, Trash2, Type, Undo2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  PEN_COLORS,
  QUADRANTS,
  chartPrintHtml,
  clampPoint,
  clampTextAnchor,
  emptyChart,
  eraseStrokesAt,
  newId,
  strokePath,
} from '@/lib/braces/palmer'
import { PALMER_BOARD, type PalmerChart } from '@/lib/braces/schema'

type Tool = 'select' | 'text' | 'pen' | 'eraser'
const { width: W, height: H } = PALMER_BOARD

const TOOLS: { id: Tool; label: string; icon: typeof Pencil }[] = [
  { id: 'select', label: 'Select / Move', icon: MousePointer2 },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'pen', label: 'Pen', icon: Pencil },
  { id: 'eraser', label: 'Eraser', icon: Eraser },
]

export function printChart(chart: PalmerChart, meta: { title: string; subtitle?: string }) {
  const win = window.open('', '_blank', 'width=1000,height=700')
  if (!win) return false
  win.document.write(chartPrintHtml(chart, meta))
  win.document.close()
  return true
}

/**
 * Paint-style Palmer quadrant board. The cross and quadrant labels are fixed; text and drawing can
 * go anywhere and stay editable. Without `onChange` it is a read-only view (still printable).
 */
export function PalmerChart({
  value,
  onChange,
  printMeta,
}: {
  value: PalmerChart | null | undefined
  onChange?: (chart: PalmerChart) => void
  printMeta?: { title: string; subtitle?: string }
}) {
  const editable = !!onChange
  const [chart, setChart] = useState<PalmerChart>(value ?? emptyChart())
  const [past, setPast] = useState<PalmerChart[]>([])
  const [future, setFuture] = useState<PalmerChart[]>([])
  const [tool, setTool] = useState<Tool>('text')
  const [color, setColor] = useState<string>(PEN_COLORS[0])
  const [selected, setSelected] = useState<string | null>(null)
  const [draft, setDraft] = useState<[number, number][] | null>(null)
  const board = useRef<HTMLDivElement>(null)
  const gesture = useRef<{ base: PalmerChart; changed: boolean } | null>(null)
  const editBase = useRef<PalmerChart | null>(null)
  // Pointer handlers outlive a render; they read the newest chart from here.
  const latest = useRef(chart)
  useEffect(() => {
    latest.current = chart
  }, [chart])

  const emit = useCallback(
    (next: PalmerChart) => {
      setChart(next)
      onChange?.(next)
    },
    [onChange]
  )
  // One undo step per finished action (a stroke, a move, a typed edit, a clear).
  const record = useCallback(
    (base: PalmerChart, next: PalmerChart) => {
      setPast((p) => [...p.slice(-49), base])
      setFuture([])
      emit(next)
    },
    [emit]
  )

  const toBoard = (e: { clientX: number; clientY: number }): [number, number] => {
    const rect = board.current!.getBoundingClientRect()
    return clampPoint(
      ((e.clientX - rect.left) / rect.width) * W,
      ((e.clientY - rect.top) / rect.height) * H
    )
  }

  function onBoardDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!editable) return
    const [px, py] = toBoard(e)
    const [x, y] = [px, py]
    if (tool === 'text') {
      const [tx, ty] = clampTextAnchor(px, py)
      const id = newId()
      record(chart, { ...chart, texts: [...chart.texts, { id, x: tx, y: ty, text: '' }] })
      setSelected(id)
      return
    }
    if (tool === 'select') {
      setSelected(null)
      return
    }
    e.currentTarget.setPointerCapture?.(e.pointerId)
    gesture.current = { base: chart, changed: false }
    if (tool === 'pen') setDraft([[x, y]])
    if (tool === 'eraser') eraseAt(x, y)
  }

  function eraseAt(x: number, y: number) {
    setChart((current) => {
      const next = eraseStrokesAt(current, x, y)
      if (next !== current && gesture.current) gesture.current.changed = true
      return next
    })
  }

  function onBoardMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!gesture.current) return
    const [x, y] = toBoard(e)
    if (tool === 'pen')
      setDraft((d) => {
        if (!d) return d
        const last = d[d.length - 1]
        return Math.hypot(x - last[0], y - last[1]) < 2 || d.length >= 3000 ? d : [...d, [x, y]]
      })
    if (tool === 'eraser') eraseAt(x, y)
  }

  function onBoardUp() {
    const g = gesture.current
    gesture.current = null
    if (!g) return
    if (tool === 'pen' && draft) {
      const stroke = { id: newId(), color, width: 3, points: draft }
      record(g.base, { ...g.base, strokes: [...g.base.strokes, stroke] })
      setDraft(null)
    } else if (tool === 'eraser' && g.changed) {
      setPast((p) => [...p.slice(-49), g.base])
      setFuture([])
      onChange?.(latest.current)
    }
  }

  function startMove(e: ReactPointerEvent<HTMLElement>, id: string) {
    if (!editable || tool !== 'select') return
    e.stopPropagation()
    e.preventDefault()
    setSelected(id)
    const base = chart
    const target = e.currentTarget
    target.setPointerCapture?.(e.pointerId)
    const move = (ev: PointerEvent) => {
      const [x, y] = clampTextAnchor(...toBoard(ev))
      setChart({ ...base, texts: base.texts.map((t) => (t.id === id ? { ...t, x, y } : t)) })
    }
    const up = () => {
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', up)
      if (latest.current !== base) record(base, latest.current)
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
  }

  function removeText(id: string) {
    record(chart, { ...chart, texts: chart.texts.filter((t) => t.id !== id) })
    setSelected(null)
  }

  const undo = () => {
    const base = past[past.length - 1]
    if (!base) return
    setPast(past.slice(0, -1))
    setFuture([chart, ...future])
    emit(base)
  }
  const redo = () => {
    const next = future[0]
    if (!next) return
    setFuture(future.slice(1))
    setPast([...past, chart])
    emit(next)
  }
  const clear = () => {
    if (chart.texts.length || chart.strokes.length) record(chart, emptyChart())
    setSelected(null)
  }

  const print = () => {
    if (!printChart(chart, printMeta ?? { title: 'Palmer dental chart' }))
      alert('Allow pop-ups for this site to print or save the chart as PDF.')
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Chart tools">
        {editable && (
          <>
            {TOOLS.map(({ id, label, icon: Icon }) => (
              <Button
                key={id}
                type="button"
                size="sm"
                variant={tool === id ? 'default' : 'outline'}
                aria-pressed={tool === id}
                onClick={() => setTool(id)}
              >
                <Icon className="mr-1 h-4 w-4" /> {label}
              </Button>
            ))}
            {tool === 'pen' && (
              <div className="flex items-center gap-1" aria-label="Pen colour">
                {PEN_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Pen colour ${c}`}
                    aria-pressed={color === c}
                    onClick={() => setColor(c)}
                    className={`h-6 w-6 rounded-full border-2 ${color === c ? 'border-slate-900' : 'border-white shadow'}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={undo}
              disabled={!past.length}
            >
              <Undo2 className="mr-1 h-4 w-4" /> Undo
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={redo}
              disabled={!future.length}
            >
              <Redo2 className="mr-1 h-4 w-4" /> Redo
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={clear}>
              <Trash2 className="mr-1 h-4 w-4" /> Clear canvas
            </Button>
          </>
        )}
        <Button type="button" size="sm" variant="outline" onClick={print} className="ml-auto">
          <Printer className="mr-1 h-4 w-4" /> Print / Export PDF
        </Button>
      </div>

      <div
        ref={board}
        data-testid="palmer-board"
        className="relative w-full select-none overflow-hidden rounded-lg border-2 border-slate-800 bg-white"
        style={{ aspectRatio: `${W} / ${H}` }}
      >
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          aria-hidden
        >
          {chart.strokes.map((s) => (
            <path
              key={s.id}
              d={strokePath(s.points)}
              stroke={s.color}
              strokeWidth={s.width}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {draft && (
            <path
              d={strokePath(draft)}
              stroke={color}
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>

        {/* Drawing / click surface. Fixed cross and labels sit above it and never move. */}
        <div
          className="absolute inset-0"
          style={{
            touchAction: tool === 'select' || !editable ? 'auto' : 'none',
            cursor: !editable
              ? 'default'
              : tool === 'text'
                ? 'text'
                : tool === 'pen'
                  ? 'crosshair'
                  : 'default',
          }}
          // Without this the click moves focus to <body> and the new, still-empty text box
          // blurs and is discarded before anything can be typed.
          onMouseDown={(e) => {
            if (editable && tool !== 'select') e.preventDefault()
          }}
          onPointerDown={onBoardDown}
          onPointerMove={onBoardMove}
          onPointerUp={onBoardUp}
          onPointerCancel={onBoardUp}
          aria-label="Chart drawing area"
        />

        <div className="pointer-events-none absolute left-1/2 top-0 h-full w-[4px] -translate-x-1/2 bg-slate-800" />
        <div className="pointer-events-none absolute left-0 top-1/2 h-[4px] w-full -translate-y-1/2 bg-slate-800" />
        {QUADRANTS.map((q) => (
          <div
            key={q.id}
            className="pointer-events-none absolute w-1/2 pt-2 text-center text-xs font-bold text-slate-600 sm:text-sm"
            style={{ left: `${q.column * 50}%`, top: `${q.row * 50}%` }}
          >
            {q.label}
          </div>
        ))}

        {chart.texts.map((t) => {
          const isSelected = selected === t.id
          // Also applied when drawing, so a note saved at the very edge is still reachable.
          const [ax, ay] = clampTextAnchor(t.x, t.y)
          return (
            <div
              key={t.id}
              className={`absolute w-[26%] min-w-[110px] rounded ${isSelected && editable ? 'ring-1 ring-blue-500' : ''}`}
              style={{
                left: `${(ax / W) * 100}%`,
                top: `${(ay / H) * 100}%`,
              }}
              onPointerDown={(e) => {
                if (tool === 'eraser' && editable) {
                  e.stopPropagation()
                  removeText(t.id)
                } else if (editable) setSelected(t.id)
              }}
            >
              {editable && isSelected && (
                <div className="absolute -top-6 left-0 flex gap-1">
                  <span
                    role="button"
                    aria-label="Move text"
                    title="Drag to move (Select tool)"
                    className="cursor-move rounded bg-blue-600 px-1.5 text-[10px] leading-5 text-white"
                    onPointerDown={(e) => startMove(e, t.id)}
                  >
                    Move
                  </span>
                  <button
                    type="button"
                    aria-label="Delete text"
                    className="rounded bg-red-600 px-1.5 text-[10px] leading-5 text-white"
                    onClick={() => removeText(t.id)}
                  >
                    Delete
                  </button>
                </div>
              )}
              {editable ? (
                <textarea
                  aria-label="Chart text"
                  value={t.text}
                  rows={Math.max(1, t.text.split('\n').length)}
                  autoFocus={isSelected && !t.text}
                  placeholder="Write here…"
                  className="w-full resize-none overflow-hidden bg-transparent p-1 text-sm outline-none placeholder:text-slate-400"
                  onFocus={() => {
                    setSelected(t.id)
                    editBase.current = chart
                  }}
                  onChange={(e) =>
                    emit({
                      ...chart,
                      texts: chart.texts.map((x) =>
                        x.id === t.id ? { ...x, text: e.target.value } : x
                      ),
                    })
                  }
                  onBlur={() => {
                    const base = editBase.current
                    editBase.current = null
                    // Drop boxes left empty; keep one undo step for the whole edit.
                    const cleaned = chart.texts.some((x) => x.id === t.id && !x.text.trim())
                      ? { ...chart, texts: chart.texts.filter((x) => x.id !== t.id) }
                      : chart
                    if (cleaned !== chart) emit(cleaned)
                    if (base && base !== cleaned) {
                      setPast((p) => [...p.slice(-49), base])
                      setFuture([])
                    }
                  }}
                />
              ) : (
                <p className="whitespace-pre-wrap p-1 text-sm">{t.text}</p>
              )}
            </div>
          )
        })}
      </div>
      {editable && (
        <p className="text-xs text-muted-foreground">
          Text tool: click anywhere in a quadrant and type. Select tool: choose a note, then drag
          &ldquo;Move&rdquo;. Pen: draw, circle or mark. Eraser: rub out drawings or click a note.
        </p>
      )}
    </div>
  )
}
