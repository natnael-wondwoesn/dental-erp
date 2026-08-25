import { describe, expect, it } from 'vitest'
import { parseClinicalInkDocument } from '@/lib/clinical-ink'

const valid = {
  version: 1 as const,
  width: 1200,
  height: 700,
  strokes: [
    {
      id: 'stroke-1',
      color: '#172033',
      width: 2.5,
      points: [
        { x: 0.1, y: 0.2, pressure: 0.4, time: 0 },
        { x: 0.2, y: 0.3, pressure: 0.8, time: 12 },
      ],
    },
  ],
}

describe('clinical ink validation', () => {
  it('accepts normalized pressure-aware strokes', () => {
    expect(parseClinicalInkDocument(valid)).toEqual(valid)
  })

  it('rejects coordinates outside the page', () => {
    expect(() =>
      parseClinicalInkDocument({
        ...valid,
        strokes: [{ ...valid.strokes[0], points: [{ x: 1.1, y: 0.2, pressure: 0.5, time: 0 }] }],
      })
    ).toThrow()
  })

  it('rejects forged versions and unsafe colors', () => {
    expect(() => parseClinicalInkDocument({ ...valid, version: 2 })).toThrow()
    expect(() =>
      parseClinicalInkDocument({
        ...valid,
        strokes: [{ ...valid.strokes[0], color: 'url(javascript:alert(1))' }],
      })
    ).toThrow()
  })
})
