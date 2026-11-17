'use client'

import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { labelOf, PHOTO_CATEGORIES, XRAY_CATEGORIES } from '@/lib/braces/schema'

import { imageTitle, imageUrl, STAGE_FILTERS, type ImageItem } from './types'

export type LibraryFilters = {
  type: string
  stage: string
  category: string
  from: string
  to: string
  query: string
}

export const emptyFilters: LibraryFilters = {
  type: 'ALL',
  stage: 'ALL',
  category: '',
  from: '',
  to: '',
  query: '',
}

export function applyFilters(items: ImageItem[], f: LibraryFilters) {
  const stages = STAGE_FILTERS.find(([key]) => key === f.stage)?.[2] ?? []
  const q = f.query.trim().toLowerCase()
  return items.filter((m) => {
    if (!m.document?.fileType?.startsWith('image/')) return false
    if (f.type !== 'ALL' && m.kind !== f.type) return false
    if (stages.length && !(m.stage && (stages as readonly string[]).includes(m.stage))) return false
    if (f.category && m.category !== f.category) return false
    const day = m.capturedAt.slice(0, 10)
    if (f.from && day < f.from) return false
    if (f.to && day > f.to) return false
    if (
      q &&
      !`${imageTitle(m, labelOf)} ${labelOf(m.category)} ${m.notes ?? ''}`.toLowerCase().includes(q)
    )
      return false
    return true
  })
}

const PAGE = 8

export function ImageLibrary({
  patientId,
  items,
  selectedId,
  onSelect,
  filters,
  onFilters,
}: {
  patientId: string
  items: ImageItem[]
  selectedId: string | null
  onSelect: (id: string) => void
  filters: LibraryFilters
  onFilters: (next: LibraryFilters) => void
}) {
  const [shown, setShown] = useState(PAGE)
  const visible = useMemo(() => items.slice(0, shown), [items, shown])
  const set = (patch: Partial<LibraryFilters>) => {
    setShown(PAGE)
    onFilters({ ...filters, ...patch })
  }
  const select = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm'

  return (
    <div className="space-y-3 rounded-xl border bg-white p-3">
      <h2 className="text-sm font-semibold">Image library</h2>
      <div className="space-y-2">
        <select
          className={select}
          value={filters.stage}
          onChange={(e) => set({ stage: e.target.value })}
          aria-label="Treatment stage"
        >
          {STAGE_FILTERS.map(([key, label]) => (
            <option key={key} value={key}>
              {key === 'ALL' ? 'Treatment stage: all' : label}
            </option>
          ))}
        </select>
        <select
          className={select}
          value={filters.category}
          onChange={(e) => set({ category: e.target.value })}
          aria-label="Image category"
        >
          <option value="">Image category: all</option>
          {[...PHOTO_CATEGORIES, ...XRAY_CATEGORIES].map((c) => (
            <option key={c} value={c}>
              {labelOf(c)}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="date"
            value={filters.from}
            onChange={(e) => set({ from: e.target.value })}
            aria-label="From date"
            className="h-9 px-2 text-xs"
          />
          <Input
            type="date"
            value={filters.to}
            onChange={(e) => set({ to: e.target.value })}
            aria-label="To date"
            className="h-9 px-2 text-xs"
          />
        </div>
      </div>

      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No images match these filters.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {visible.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelect(m.id)}
              className={`overflow-hidden rounded-lg border text-left text-[11px] transition ${selectedId === m.id ? 'border-2 border-[#086be6] ring-2 ring-[#086be6]/20' : 'hover:border-slate-400'}`}
              aria-pressed={selectedId === m.id}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl(patientId, m.documentId)}
                alt=""
                loading="lazy"
                className="h-24 w-full object-cover"
              />
              <div className="p-1.5">
                <div className="truncate font-medium">{imageTitle(m, labelOf)}</div>
                <div className="text-muted-foreground">
                  {new Date(m.capturedAt).toLocaleDateString()}
                </div>
                {m.stage && (
                  <div className="truncate text-muted-foreground">{labelOf(m.stage)}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
      {items.length > shown && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setShown((n) => n + PAGE)}
        >
          Load more ({items.length - shown} more)
        </Button>
      )}
    </div>
  )
}
