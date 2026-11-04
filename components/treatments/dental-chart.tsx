'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import {
  toothConditionConfig,
  toothNumbers,
  toothNames,
  getToothType,
  unassessedToothStyle,
} from '@/lib/treatment-utils'
import {
  EXAM_CONDITIONS,
  EXAM_TREATMENTS,
  type ExamTeeth,
  type ExamTooth,
} from '@/lib/dental-examination'

interface SavedExamination {
  id: string
  examinedAt: string
  dentistName: string
  teeth: ExamTeeth
}

interface DentalChartProps {
  patientId: string
  selectedTeeth?: number[]
  onTeethSelect?: (teeth: number[]) => void
}

const EMPTY_TEETH: number[] = []
const LEGEND = ['UNASSESSED', ...EXAM_CONDITIONS.map((c) => c.value)]
const today = () => new Date().toISOString().slice(0, 10)

// "Lower Left First Molar" -> "First Molar"
const shortToothName = (n: number) =>
  (toothNames[n] || '').replace(/^(Upper|Lower) (Left|Right) /, '')
const conditionLabel = (value?: string) =>
  value && value !== 'UNASSESSED' ? toothConditionConfig[value]?.label : unassessedToothStyle.label

export function DentalChart({
  patientId,
  selectedTeeth = EMPTY_TEETH,
  onTeethSelect,
}: DentalChartProps) {
  const { toast } = useToast()
  const [teeth, setTeeth] = useState<ExamTeeth>({})
  const [examinations, setExaminations] = useState<SavedExamination[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [examDate, setExamDate] = useState(today())
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  const [detailTooth, setDetailTooth] = useState<number | null>(null)
  const [form, setForm] = useState<ExamTooth>({
    condition: '',
    treatmentRequired: 'NONE',
    notes: '',
  })

  // A new examination starts from the latest saved one; a brand-new chart is all grey.
  const loadExaminations = useCallback(async () => {
    try {
      const res = await fetch(`/api/dental-examinations?patientId=${patientId}`)
      if (!res.ok) return
      const data = await res.json()
      const list: SavedExamination[] = data.examinations || []
      setExaminations(list)
      setTeeth(list[0]?.teeth ? { ...list[0].teeth } : {})
      setEditingId(null)
      setExamDate(today())
      setDirty(false)
    } catch {
      /* chart stays usable without history */
    }
  }, [patientId])

  useEffect(() => {
    loadExaminations()
  }, [loadExaminations])

  const getToothCondition = (toothNumber: number): string =>
    teeth[String(toothNumber)]?.condition || 'UNASSESSED'

  const getToothColor = (toothNumber: number): string =>
    toothConditionConfig[getToothCondition(toothNumber)]?.fillColor ||
    unassessedToothStyle.fillColor

  const openDetails = (toothNumber: number) => {
    const existing = teeth[String(toothNumber)]
    setForm(existing ? { ...existing } : { condition: '', treatmentRequired: 'NONE', notes: '' })
    setDetailTooth(toothNumber)
  }

  const handleToothClick = (toothNumber: number) => {
    if (onTeethSelect && !selectedTeeth.includes(toothNumber)) {
      onTeethSelect([...selectedTeeth, toothNumber])
    }
    openDetails(toothNumber)
  }

  const applyToothDetails = () => {
    if (!detailTooth || !form.condition) return
    setTeeth((prev) => ({ ...prev, [String(detailTooth)]: form }))
    setDirty(true)
    setDetailTooth(null)
  }

  const saveChart = async () => {
    setSaving(true)
    try {
      const res = await fetch(
        editingId ? `/api/dental-examinations/${editingId}` : '/api/dental-examinations',
        {
          method: editingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patientId, examinedAt: examDate, teeth }),
        }
      )
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to save chart')
      toast({ title: 'Dental chart saved' })
      await loadExaminations()
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message })
    } finally {
      setSaving(false)
    }
  }

  const openExamination = (exam: SavedExamination) => {
    setTeeth({ ...exam.teeth })
    setEditingId(exam.id)
    setExamDate(exam.examinedAt.slice(0, 10))
    setDirty(false)
  }

  const renderTooth = (toothNumber: number, position: 'upper' | 'lower') => {
    const condition = getToothCondition(toothNumber)
    const isSelected = selectedTeeth.includes(toothNumber)
    const toothType = getToothType(toothNumber)

    // Tooth dimensions based on type
    const dimensions = {
      molar: { width: 32, height: 28 },
      premolar: { width: 26, height: 24 },
      canine: { width: 22, height: 26 },
      incisor: { width: 20, height: 22 },
    }

    const { width, height } = dimensions[toothType]

    return (
      <button
        type="button"
        key={toothNumber}
        onClick={() => handleToothClick(toothNumber)}
        className={`
          relative flex flex-col items-center justify-center
          transition-all duration-200 hover:scale-110
          ${isSelected ? 'ring-2 ring-primary ring-offset-2' : ''}
          cursor-pointer
        `}
        title={`${toothNumber}: ${toothNames[toothNumber]}`}
      >
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="drop-shadow-sm"
        >
          {/* Tooth shape - simplified representation */}
          {toothType === 'molar' ? (
            <path
              d={
                position === 'upper'
                  ? `M4,${height - 4} Q2,${height / 2} 4,4 Q${width / 2},0 ${width - 4},4 Q${width - 2},${height / 2} ${width - 4},${height - 4} Z`
                  : `M4,4 Q2,${height / 2} 4,${height - 4} Q${width / 2},${height} ${width - 4},${height - 4} Q${width - 2},${height / 2} ${width - 4},4 Z`
              }
              fill={getToothColor(toothNumber)}
              stroke="#374151"
              strokeWidth="1.5"
            />
          ) : toothType === 'premolar' ? (
            <ellipse
              cx={width / 2}
              cy={height / 2}
              rx={width / 2 - 2}
              ry={height / 2 - 2}
              fill={getToothColor(toothNumber)}
              stroke="#374151"
              strokeWidth="1.5"
            />
          ) : (
            <path
              d={
                position === 'upper'
                  ? `M${width / 2},2 Q${width - 2},${height / 3} ${width - 2},${height - 4} Q${width / 2},${height} 2,${height - 4} Q2,${height / 3} ${width / 2},2 Z`
                  : `M${width / 2},${height - 2} Q${width - 2},${(height * 2) / 3} ${width - 2},4 Q${width / 2},0 2,4 Q2,${(height * 2) / 3} ${width / 2},${height - 2} Z`
              }
              fill={getToothColor(toothNumber)}
              stroke="#374151"
              strokeWidth="1.5"
            />
          )}

          {/* Condition indicator for non-healthy teeth */}
          {condition === 'MISSING' && (
            <text
              x={width / 2}
              y={height / 2 + 4}
              textAnchor="middle"
              fontSize="14"
              fill="#6b7280"
              fontWeight="bold"
            >
              X
            </text>
          )}
          {condition === 'ROOT_CANAL' && (
            <circle
              cx={width / 2}
              cy={height / 2}
              r="4"
              fill="none"
              stroke="#374151"
              strokeWidth="1.5"
            />
          )}
        </svg>

        {/* Tooth number */}
        <span
          className={`text-xs font-medium mt-1 ${position === 'upper' ? 'order-first mb-1' : ''}`}
        >
          {toothNumber}
        </span>
      </button>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Dental Chart</CardTitle>
          <div className="flex gap-2 flex-wrap">
            {LEGEND.map((key) => (
              <div key={key} className="flex items-center gap-1 text-xs">
                <div
                  className="w-3 h-3 rounded-full border border-border"
                  style={{
                    backgroundColor:
                      toothConditionConfig[key]?.fillColor ?? unassessedToothStyle.fillColor,
                  }}
                />
                <span className="text-muted-foreground">{conditionLabel(key)}</span>
              </div>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-8 py-4">
          {/* Upper Jaw */}
          <div className="text-center">
            <div className="text-sm font-medium text-muted-foreground mb-2">Upper Jaw</div>
            <div className="flex gap-1 justify-center">
              <div className="flex gap-1 border-r-2 border-border pr-2">
                {toothNumbers.upperRight.map((num) => renderTooth(num, 'upper'))}
              </div>
              <div className="flex gap-1 pl-2">
                {toothNumbers.upperLeft.map((num) => renderTooth(num, 'upper'))}
              </div>
            </div>
          </div>

          <div className="w-full border-t border-border" />

          {/* Lower Jaw: 48-41 | 31-38 */}
          <div className="text-center">
            <div className="flex gap-1 justify-center">
              <div className="flex gap-1 border-r-2 border-border pr-2">
                {toothNumbers.lowerRight.map((num) => renderTooth(num, 'lower'))}
              </div>
              <div className="flex gap-1 pl-2">
                {toothNumbers.lowerLeft.map((num) => renderTooth(num, 'lower'))}
              </div>
            </div>
            <div className="text-sm font-medium text-muted-foreground mt-2">Lower Jaw</div>
          </div>
        </div>

        {/* Selected teeth display */}
        {selectedTeeth.length > 0 && (
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">Selected Teeth:</div>
              {onTeethSelect && (
                <Button type="button" variant="ghost" size="sm" onClick={() => onTeethSelect([])}>
                  Clear All
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {[...selectedTeeth]
                .sort((a, b) => a - b)
                .map((tooth) => (
                  <Badge key={tooth} variant="secondary" className="gap-1 pr-1">
                    <button
                      type="button"
                      className="hover:underline"
                      onClick={() => openDetails(tooth)}
                    >
                      {tooth} – {shortToothName(tooth)} – {conditionLabel(getToothCondition(tooth))}
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove tooth ${tooth}`}
                      className="rounded p-0.5 hover:bg-muted"
                      onClick={() => onTeethSelect?.(selectedTeeth.filter((t) => t !== tooth))}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
            </div>
          </div>
        )}

        {/* Examination: date, save and history */}
        <div className="mt-4 space-y-3 border-t pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="exam-date">Examination date</Label>
              <Input
                id="exam-date"
                type="date"
                className="w-44"
                value={examDate}
                onChange={(e) => {
                  setExamDate(e.target.value)
                  setDirty(true)
                }}
              />
            </div>
            <Button
              type="button"
              onClick={saveChart}
              disabled={saving || !patientId || !examDate || (!dirty && !!editingId)}
            >
              {saving ? 'Saving...' : editingId ? 'Update Chart' : 'Save Chart'}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={loadExaminations}>
                Cancel edit
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {editingId
              ? 'Editing a previously saved examination.'
              : 'Saving creates a new examination; earlier ones are kept. The dentist is recorded from your login.'}
          </p>

          {examinations.length > 0 && (
            <div className="space-y-1">
              <div className="text-sm font-medium">Previous examinations</div>
              {examinations.map((exam) => (
                <div
                  key={exam.id}
                  className="flex items-center justify-between rounded border p-2 text-sm"
                >
                  <span>
                    {new Date(exam.examinedAt).toLocaleDateString()} · {exam.dentistName} ·{' '}
                    {Object.keys(exam.teeth).length === 1
                      ? '1 tooth recorded'
                      : `${Object.keys(exam.teeth).length} teeth recorded`}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => openExamination(exam)}
                  >
                    {editingId === exam.id ? 'Open' : 'View / Edit'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>

      {/* Tooth Detail Dialog */}
      <Dialog open={detailTooth !== null} onOpenChange={(open) => !open && setDetailTooth(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Tooth {detailTooth} – {detailTooth ? shortToothName(detailTooth) : ''}
            </DialogTitle>
            <DialogDescription>
              Current condition and planned treatment are recorded separately.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Current Condition</Label>
              <Select
                value={form.condition}
                onValueChange={(v) => setForm({ ...form, condition: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select condition" />
                </SelectTrigger>
                <SelectContent>
                  {EXAM_CONDITIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: toothConditionConfig[c.value]?.fillColor }}
                        />
                        {c.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Treatment Required</Label>
              <Select
                value={form.treatmentRequired}
                onValueChange={(v) => setForm({ ...form, treatmentRequired: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXAM_TREATMENTS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Clinical Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Add any observations or notes..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDetailTooth(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={applyToothDetails} disabled={!form.condition}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
