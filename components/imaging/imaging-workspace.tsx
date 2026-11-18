'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Filter, Loader2, PanelLeft, PanelRight, Search, Upload } from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { labelOf } from '@/lib/braces/schema'

import { BottomTabs } from './bottom-tabs'
import { applyFilters, emptyFilters, ImageLibrary, type LibraryFilters } from './image-library'
import { InfoPanel, useImageHistory } from './info-panel'
import { ClinicalViewer } from './clinical-viewer'
import {
  EMPTY_ANNOTATIONS,
  imageTitle,
  imageUrl,
  STAGE_FILTERS,
  TYPE_FILTERS,
  type AnnotationSet,
  type ImageItem,
} from './types'
import { UploadDialog } from './upload-dialog'

/* eslint-disable @typescript-eslint/no-explicit-any */
const ageOf = (p: any) => {
  if (p?.dateOfBirth) {
    const dob = new Date(p.dateOfBirth)
    const now = new Date()
    let a = now.getFullYear() - dob.getFullYear()
    if (
      now.getMonth() < dob.getMonth() ||
      (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())
    )
      a -= 1
    return a
  }
  return p?.age ?? null
}

export function ImagingWorkspace({ patientId }: { patientId: string }) {
  const [braces, setBraces] = useState<any>(null)
  const [patient, setPatient] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<LibraryFilters>(emptyFilters)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [upload, setUpload] = useState(false)
  const [version, setVersion] = useState(0)
  const [showLibrary, setShowLibrary] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  // Drawings not yet saved, per image. Saving writes them next to the image, never into it.
  const [drafts, setDrafts] = useState<Record<string, AnnotationSet>>({})

  const reload = useCallback(async () => {
    const res = await fetch(`/api/patients/${patientId}/braces`)
    if (res.ok) setBraces((await res.json()).bracesCase)
    setVersion((v) => v + 1)
  }, [patientId])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [, p] = await Promise.all([reload(), fetch(`/api/patients/${patientId}`)])
      if (cancelled) return
      if (p.ok) setPatient((await p.json()).patient ?? null)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [patientId, reload])

  const all: ImageItem[] = useMemo(() => braces?.media ?? [], [braces])
  const items = useMemo(
    () =>
      applyFilters(all, filters).sort((a, b) => +new Date(b.capturedAt) - +new Date(a.capturedAt)),
    [all, filters]
  )
  // Keep a valid selection: the first image of the filtered list when nothing (or something hidden) is selected.
  const selected = items.find((m) => m.id === selectedId) ?? items[0] ?? null
  const history = useImageHistory(patientId, selected?.id ?? null, version)
  const currentAnnotations: AnnotationSet =
    (selected && drafts[selected.id]) || selected?.annotations || EMPTY_ANNOTATIONS
  const saveAnnotations = async () => {
    if (!selected) return false
    const res = await fetch(`/api/patients/${patientId}/braces/media/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ annotations: currentAnnotations }),
    })
    if (!res.ok) return false
    await reload()
    setDrafts((d) => {
      const { [selected.id]: _saved, ...rest } = d
      return rest
    })
    return true
  }
  const index = selected ? items.findIndex((m) => m.id === selected.id) : -1

  if (loading) return <Loader2 className="m-8 h-6 w-6 animate-spin" />

  const name = patient ? `${patient.firstName} ${patient.lastName}` : 'Patient'
  const age = ageOf(patient)
  const type = braces?.customBracesType || (braces?.bracesType ? labelOf(braces.bracesType) : '')
  const visits = braces?.visits ?? []

  return (
    <div className="mx-auto max-w-[1500px] space-y-4 p-4">
      {/* Patient information (read from the existing patient record) */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-white p-4">
        <Avatar className="h-14 w-14">
          <AvatarFallback>
            {`${patient?.firstName?.[0] ?? ''}${patient?.lastName?.[0] ?? ''}`.toUpperCase() || 'P'}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold">{name}</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {patient?.patientId && <span>ID: {patient.patientId}</span>}
            {age != null && <span>Age: {age} years</span>}
            {type && <span>Treatment: {type}</span>}
          </div>
        </div>
        {braces?.planStatus && (
          <Badge variant="outline">Status: {labelOf(braces.planStatus)}</Badge>
        )}
        <Link
          href={`/patients/${patientId}/braces`}
          className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-semibold shadow-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Back to patient
        </Link>
      </div>

      {/* Imaging header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Orthodontic imaging</h1>
          <p className="text-sm text-muted-foreground">
            Capture, organize, review, and compare the patient&apos;s orthodontic images throughout
            treatment.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="w-56 pl-8"
              placeholder="Search images"
              value={filters.query}
              onChange={(e) => setFilters({ ...filters, query: e.target.value })}
              aria-label="Search images"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters((v) => !v)}
            aria-pressed={showFilters}
          >
            <Filter className="mr-2 h-4 w-4" /> Filter
          </Button>
          <Button onClick={() => setUpload(true)}>
            <Upload className="mr-2 h-4 w-4" /> Upload images
          </Button>
        </div>
      </div>

      {/* Type and stage filters */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase text-muted-foreground">Image type</span>
          {TYPE_FILTERS.map(([key, label]) => (
            <Button
              key={key}
              size="sm"
              variant={filters.type === key ? 'default' : 'outline'}
              onClick={() => setFilters({ ...filters, type: key })}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase text-muted-foreground">
            Treatment stage
          </span>
          {STAGE_FILTERS.map(([key, label]) => (
            <Button
              key={key}
              size="sm"
              variant={filters.stage === key ? 'default' : 'outline'}
              onClick={() => setFilters({ ...filters, stage: key })}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Phones and tablets: side panels open as drawers so the viewer keeps the space */}
      <div className="flex gap-2 lg:hidden">
        <Button size="sm" variant="outline" onClick={() => setShowLibrary((v) => !v)}>
          <PanelLeft className="mr-1 h-4 w-4" /> Library
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowInfo((v) => !v)}>
          <PanelRight className="mr-1 h-4 w-4" /> Details
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)_300px]">
        <aside className={`${showLibrary ? 'block' : 'hidden'} lg:block`}>
          <ImageLibrary
            patientId={patientId}
            items={items}
            selectedId={selected?.id ?? null}
            onSelect={(id) => {
              setSelectedId(id)
              setShowLibrary(false)
            }}
            filters={filters}
            onFilters={setFilters}
          />
        </aside>

        <main className="min-w-0 space-y-4">
          {selected && (
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{imageTitle(selected, labelOf)}</span>
              <span className="flex items-center gap-2 text-muted-foreground">
                {index + 1} of {items.length}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7"
                  disabled={index <= 0}
                  onClick={() => setSelectedId(items[index - 1].id)}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7"
                  disabled={index >= items.length - 1}
                  onClick={() => setSelectedId(items[index + 1].id)}
                >
                  Next
                </Button>
              </span>
            </div>
          )}
          <ClinicalViewer
            src={selected ? imageUrl(patientId, selected.documentId) : null}
            alt={selected ? imageTitle(selected, labelOf) : ''}
            resetKey={selected?.id ?? ''}
            annotations={currentAnnotations}
            onAnnotationsChange={(next) =>
              selected && setDrafts((d) => ({ ...d, [selected.id]: next }))
            }
            onSave={saveAnnotations}
            dirty={!!selected && selected.id in drafts}
          />
          {all.length === 0 && (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              No images yet. Use “Upload images” to add clinical photos and radiographs.
            </div>
          )}
          <BottomTabs
            patientId={patientId}
            items={items}
            selected={selected}
            history={history}
            braces={braces}
          />
        </main>

        <aside className={`${showInfo ? 'block' : 'hidden'} lg:block`}>
          <InfoPanel
            patientId={patientId}
            item={selected}
            visits={visits}
            history={history}
            annotations={currentAnnotations}
            canEdit
            onSaved={reload}
          />
        </aside>
      </div>

      <UploadDialog
        open={upload}
        onOpenChange={setUpload}
        patientId={patientId}
        visits={visits}
        onDone={reload}
      />
    </div>
  )
}
