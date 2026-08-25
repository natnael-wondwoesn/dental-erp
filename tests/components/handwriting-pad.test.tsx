import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { HandwritingPad } from '@/components/clinical/handwriting-pad'

const context = {
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  set fillStyle(_value: string) {},
  set strokeStyle(_value: string) {},
  set lineWidth(_value: number) {},
  set lineCap(_value: string) {},
  set lineJoin(_value: string) {},
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as any)
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    bottom: 420,
    right: 800,
    width: 800,
    height: 420,
    toJSON: () => ({}),
  })
  Object.defineProperty(HTMLCanvasElement.prototype, 'setPointerCapture', {
    configurable: true,
    value: vi.fn(),
  })
})

describe('HandwritingPad', () => {
  it('captures normalized pressure-aware pointer strokes', () => {
    const onChange = vi.fn()
    render(<HandwritingPad onChange={onChange} />)
    const canvas = screen.getByLabelText('Handwritten diagnosis writing area')

    const pointer = (type: string, values: Record<string, unknown>) => {
      const event = new Event(type, { bubbles: true, cancelable: true })
      Object.defineProperties(
        event,
        Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { value }]))
      )
      fireEvent(canvas, event)
    }

    pointer('pointerdown', {
      pointerId: 7,
      pointerType: 'pen',
      isPrimary: true,
      clientX: 80,
      clientY: 84,
      pressure: 0.4,
      timeStamp: 100,
    })
    pointer('pointermove', {
      pointerId: 7,
      pointerType: 'pen',
      isPrimary: true,
      clientX: 400,
      clientY: 210,
      pressure: 0.8,
      timeStamp: 112,
    })
    pointer('pointerup', { pointerId: 7, pointerType: 'pen', isPrimary: true })

    expect(onChange).toHaveBeenCalledTimes(1)
    const ink = onChange.mock.calls[0][0]
    expect(ink.strokes).toHaveLength(1)
    expect(ink.strokes[0].points[0]).toMatchObject({ x: 0.1, y: 0.2 })
    expect(ink.strokes[0].points.at(-1)).toMatchObject({ x: 0.5, y: 0.5 })
  })

  it('does not change a read-only clinical note', () => {
    const onChange = vi.fn()
    render(<HandwritingPad onChange={onChange} readOnly />)
    const canvas = screen.getByLabelText('Handwritten diagnosis writing area')
    fireEvent.pointerDown(canvas, { pointerId: 1, pointerType: 'pen', clientX: 50, clientY: 50 })
    fireEvent.pointerUp(canvas, { pointerId: 1, pointerType: 'pen' })
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.queryByText('Pen')).not.toBeInTheDocument()
  })
})
