import { describe, expect, it } from 'vitest'

import {
  chartPrintHtml,
  clampPoint,
  emptyChart,
  eraseStrokesAt,
  quadrantAt,
  strokePath,
} from '@/lib/braces/palmer'
import { hasChartContent, palmerChartSchema } from '@/lib/braces/schema'

const stroke = (id: string, points: [number, number][]) => ({
  id,
  color: '#111827',
  width: 3,
  points,
})

describe('Palmer quadrants', () => {
  it('puts the patient right on the viewer left, as in Palmer notation', () => {
    expect(quadrantAt(100, 100)).toBe('UR')
    expect(quadrantAt(900, 100)).toBe('UL')
    expect(quadrantAt(100, 500)).toBe('LR')
    expect(quadrantAt(900, 500)).toBe('LL')
  })

  it('keeps points on the board', () => {
    expect(clampPoint(-20, 9999)).toEqual([0, 625])
  })
})

describe('eraser', () => {
  const chart = {
    ...emptyChart(),
    strokes: [
      stroke('far', [
        [800, 500],
        [900, 520],
      ]),
      stroke('near', [
        [100, 100],
        [200, 100],
      ]),
      stroke('dot', [[300, 300]]),
    ],
  }

  it('removes only strokes that pass near the pointer', () => {
    const next = eraseStrokesAt(chart, 150, 105)
    expect(next.strokes.map((s) => s.id)).toEqual(['far', 'dot'])
    expect(eraseStrokesAt(next, 300, 306).strokes.map((s) => s.id)).toEqual(['far'])
  })

  it('returns the same object when nothing was hit (no needless history step)', () => {
    expect(eraseStrokesAt(chart, 500, 20)).toBe(chart)
  })
})

describe('printing', () => {
  it('escapes clinical text so it cannot inject markup into the print page', () => {
    const html = chartPrintHtml(
      {
        ...emptyChart(),
        texts: [{ id: 't', x: 100, y: 100, text: '<img src=x onerror=alert(1)> & "ok"' }],
      },
      { title: 'Chart <b>', subtitle: 'Examination 2026-11-26' }
    )
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;ok&quot;')
    expect(html).toContain('Upper Right (UR)')
    expect(html).toContain('Lower Left (LL)')
  })

  it('draws a single tap as a visible dot', () => {
    expect(strokePath([[10, 10]])).toContain('L10.1 10')
  })
})

describe('chart validation', () => {
  it('accepts a chart and treats an empty board as no chart', () => {
    const chart = palmerChartSchema.parse({
      texts: [{ id: 'a', x: 10, y: 10, text: 'Crowding LR' }],
      strokes: [],
    })
    expect(hasChartContent(chart)).toBe(true)
    expect(hasChartContent(palmerChartSchema.parse({}))).toBe(false)
    expect(
      hasChartContent(palmerChartSchema.parse({ texts: [{ id: 'a', x: 1, y: 1, text: '  ' }] }))
    ).toBe(false)
  })

  it('rejects points off the board and oversized drawings', () => {
    expect(palmerChartSchema.safeParse({ strokes: [stroke('s', [[2000, 10]])] }).success).toBe(
      false
    )
    expect(
      palmerChartSchema.safeParse({
        strokes: [
          stroke(
            's',
            Array.from({ length: 3001 }, () => [1, 1] as [number, number])
          ),
        ],
      }).success
    ).toBe(false)
    expect(
      palmerChartSchema.safeParse({ strokes: [{ ...stroke('s', [[1, 1]]), color: 'red' }] }).success
    ).toBe(false)
  })
})
