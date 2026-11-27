import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, beforeEach, expect, it, vi } from 'vitest'

import { PalmerChart } from '@/components/braces/palmer-chart'
import type { PalmerChart as Chart } from '@/lib/braces/schema'

const rect = { left: 0, top: 0, width: 1000, height: 625, right: 1000, bottom: 625, x: 0, y: 0 }

function mount(value: Chart | null, onChange?: (c: Chart) => void) {
  render(<PalmerChart value={value} onChange={onChange} />)
  const board = screen.getByTestId('palmer-board')
  board.getBoundingClientRect = () => rect as DOMRect
  return screen.getByLabelText('Chart drawing area')
}

// jsdom has no PointerEvent; a MouseEvent carries the coordinates the board reads.
beforeAll(() => {
  class TestPointerEvent extends MouseEvent {
    pointerId: number
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 1
    }
  }
  vi.stubGlobal('PointerEvent', TestPointerEvent)
})

beforeEach(() => vi.restoreAllMocks())

it('shows the fixed cross and the four Palmer quadrant labels', () => {
  mount(null, () => {})
  for (const label of [
    'Upper Right (UR)',
    'Upper Left (UL)',
    'Lower Right (LR)',
    'Lower Left (LL)',
  ])
    expect(screen.getByText(label)).toBeInTheDocument()
})

it('adds a free text note wherever the dentist clicks, keeps several, and undoes them', () => {
  const onChange = vi.fn()
  const surface = mount(null, onChange)
  fireEvent.pointerDown(surface, { clientX: 100, clientY: 100, pointerId: 1 })
  fireEvent.change(screen.getByLabelText('Chart text'), { target: { value: 'UR6 caries' } })
  fireEvent.pointerDown(surface, { clientX: 800, clientY: 500, pointerId: 1 })
  expect(screen.getAllByLabelText('Chart text')).toHaveLength(2)
  const last = onChange.mock.calls.at(-1)![0] as Chart
  expect(last.texts.map((t) => [Math.round(t.x), Math.round(t.y), t.text])).toEqual([
    [100, 100, 'UR6 caries'],
    [740, 500, ''], // clamped so the whole note stays on the board
  ])

  fireEvent.click(screen.getByRole('button', { name: /Undo/ }))
  expect(screen.getAllByLabelText('Chart text')).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: /Redo/ }))
  expect(screen.getAllByLabelText('Chart text')).toHaveLength(2)
})

it('deletes a note and clears the canvas', () => {
  const onChange = vi.fn()
  const surface = mount(
    { version: 1, texts: [{ id: 't1', x: 50, y: 50, text: 'LL7 impacted' }], strokes: [] },
    onChange
  )
  fireEvent.pointerDown(surface, { clientX: 400, clientY: 300, pointerId: 1 }) // text tool: new box
  fireEvent.click(screen.getByRole('button', { name: 'Clear canvas' }))
  expect((onChange.mock.calls.at(-1)![0] as Chart).texts).toEqual([])
})

it('opens a saved chart read-only: text visible, no tools, still printable', () => {
  mount({ version: 1, texts: [{ id: 't1', x: 50, y: 50, text: 'LL7 impacted' }], strokes: [] })
  expect(screen.getByText('LL7 impacted')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Pen/ })).toBeNull()
  expect(screen.queryByLabelText('Chart text')).toBeNull()
  expect(screen.getByRole('button', { name: /Print \/ Export PDF/ })).toBeInTheDocument()
})

it('lets the dentist switch tools', () => {
  mount(null, () => {})
  const pen = screen.getByRole('button', { name: /Pen/ })
  fireEvent.click(pen)
  expect(pen).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByLabelText('Pen colour #dc2626')).toBeInTheDocument()
})
