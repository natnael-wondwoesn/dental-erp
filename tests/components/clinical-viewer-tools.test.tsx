import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { expect, it, vi } from 'vitest'

import { ClinicalViewer } from '@/components/imaging/clinical-viewer'
import {
  angleDeg,
  EMPTY_ANNOTATIONS,
  formatDistance,
  type AnnotationSet,
} from '@/components/imaging/types'

function Harness({ onSave = async () => true }: { onSave?: () => Promise<boolean> }) {
  const [set, setSet] = useState<AnnotationSet>(EMPTY_ANNOTATIONS)
  return (
    <ClinicalViewer
      src="/x.jpg"
      alt="img"
      resetKey="a"
      annotations={set}
      onAnnotationsChange={setSet}
      onSave={onSave}
      dirty={set.items.length > 0}
    />
  )
}

// jsdom has no SVG geometry: identity transform, so screen pixels equal image pixels.
function stubGeometry() {
  Object.defineProperty(SVGElement.prototype, 'getScreenCTM', {
    configurable: true,
    value: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  })
}
const area = () => screen.getByTestId('annotation-layer').parentElement!.parentElement!
// jsdom has no PointerEvent, so build one from MouseEvent to keep the coordinates.
const pointer = (type: string, x: number, y: number) =>
  fireEvent(area(), new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }))
const draw = (from: [number, number], to: [number, number]) => {
  pointer('pointerdown', from[0], from[1])
  pointer('pointermove', to[0], to[1])
  pointer('pointerup', to[0], to[1])
}

it('zooms in small steps from the mouse wheel', () => {
  render(<Harness />)
  const zoomText = () => screen.getByText(/%/).textContent
  expect(zoomText()).toMatch(/^100%/)
  fireEvent.wheel(area(), { deltaY: -100 })
  const after = parseInt(zoomText() ?? '0', 10)
  expect(after).toBeGreaterThan(100)
  expect(after).toBeLessThanOrEqual(115) // one wheel notch is a gentle step, not a jump
  fireEvent.wheel(area(), { deltaY: 3 })
  expect(parseInt(zoomText() ?? '0', 10)).toBeLessThanOrEqual(after) // tiny trackpad movement, tiny change
})

it('draws a distance, shows it in pixels until a scale is set, and angles in degrees', () => {
  stubGeometry()
  render(<Harness />)
  fireEvent.click(screen.getByLabelText('Distance'))
  draw([100, 100], [200, 100])
  expect(screen.getByText('100 px (not calibrated)')).toBeInTheDocument()

  fireEvent.click(screen.getByLabelText('Angle'))
  pointer('pointerdown', 10, 0)
  pointer('pointerdown', 0, 0)
  pointer('pointerdown', 0, 10)
  expect(screen.getByText('90.0°')).toBeInTheDocument()
})

it('deletes the selected annotation and clears all after confirmation', () => {
  stubGeometry()
  render(<Harness />)
  fireEvent.click(screen.getByLabelText('Arrow'))
  draw([10, 10], [100, 60])
  expect(document.querySelectorAll('[data-annotation="arrow"]')).toHaveLength(1)
  fireEvent.click(screen.getByLabelText('Delete selected'))
  expect(document.querySelectorAll('[data-annotation]')).toHaveLength(0)

  fireEvent.click(screen.getByLabelText('Marker'))
  pointer('pointerdown', 30, 30)
  vi.spyOn(window, 'confirm').mockReturnValue(false)
  fireEvent.click(screen.getByRole('button', { name: 'Clear all' }))
  expect(document.querySelectorAll('[data-annotation="marker"]')).toHaveLength(1)
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  fireEvent.click(screen.getByRole('button', { name: 'Clear all' }))
  expect(document.querySelectorAll('[data-annotation]')).toHaveLength(0)
})

it('saves through the save handler and reports the result', async () => {
  stubGeometry()
  const onSave = vi.fn(async () => true)
  render(<Harness onSave={onSave} />)
  fireEvent.click(screen.getByLabelText('Reference point'))
  pointer('pointerdown', 5, 5)
  fireEvent.click(screen.getByRole('button', { name: 'Save annotations' }))
  expect(await screen.findByText(/Annotations saved/)).toBeInTheDocument()
  expect(onSave).toHaveBeenCalledOnce()
})

it('measures angles and distances correctly', () => {
  expect(angleDeg({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(90)
  expect(formatDistance(50, 0.2)).toBe('10.0 mm')
})
