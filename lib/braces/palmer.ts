import { PALMER_BOARD, type PalmerChart } from './schema'

const { width: W, height: H } = PALMER_BOARD

/** Palmer notation as the dentist faces the patient: patient's right is on the viewer's left. */
export const QUADRANTS = [
  { id: 'UR', label: 'Upper Right (UR)', column: 0, row: 0 },
  { id: 'UL', label: 'Upper Left (UL)', column: 1, row: 0 },
  { id: 'LR', label: 'Lower Right (LR)', column: 0, row: 1 },
  { id: 'LL', label: 'Lower Left (LL)', column: 1, row: 1 },
] as const
export type QuadrantId = (typeof QUADRANTS)[number]['id']

export const PEN_COLORS = ['#111827', '#dc2626', '#2563eb'] as const

export const emptyChart = (): PalmerChart => ({ version: 1, texts: [], strokes: [] })

export const newId = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.slice(0, 24)

export const clamp = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min

export const clampPoint = (x: number, y: number): [number, number] => [
  clamp(x, 0, W),
  clamp(y, 0, H),
]

/** Where a note may be anchored so its whole box stays on the board. */
export const clampTextAnchor = (x: number, y: number): [number, number] => [
  clamp(x, 0, W * 0.74),
  clamp(y, 0, H * 0.86),
]

export function quadrantAt(x: number, y: number): QuadrantId {
  const right = x >= W / 2
  const lower = y >= H / 2
  return lower ? (right ? 'LL' : 'LR') : right ? 'UL' : 'UR'
}

function distanceToSegment(px: number, py: number, a: [number, number], b: [number, number]) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const lengthSq = dx * dx + dy * dy
  const t = lengthSq === 0 ? 0 : clamp(((px - a[0]) * dx + (py - a[1]) * dy) / lengthSq, 0, 1)
  return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy))
}

/** Remove every stroke that passes within `radius` board units of the point. */
export function eraseStrokesAt(chart: PalmerChart, x: number, y: number, radius = 14): PalmerChart {
  const strokes = chart.strokes.filter((stroke) => {
    const pts = stroke.points
    if (pts.length === 1) return Math.hypot(x - pts[0][0], y - pts[0][1]) > radius
    for (let i = 1; i < pts.length; i++)
      if (distanceToSegment(x, y, pts[i - 1], pts[i]) <= radius) return false
    return true
  })
  return strokes.length === chart.strokes.length ? chart : { ...chart, strokes }
}

export const strokePath = (points: readonly (readonly [number, number])[]) =>
  points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ') +
  (points.length === 1 ? ` L${points[0][0] + 0.1} ${points[0][1]}` : '')

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** A standalone printable page (browser "Save as PDF" gives the PDF export). */
export function chartPrintHtml(chart: PalmerChart, meta: { title: string; subtitle?: string }) {
  const texts = chart.texts
    .filter((t) => t.text.trim())
    .map((t) => {
      const [x, y] = clampTextAnchor(t.x, t.y)
      return `<div class="t" style="left:${(x / W) * 100}%;top:${(y / H) * 100}%">${escapeHtml(t.text)}</div>`
    })
    .join('')
  const strokes = chart.strokes
    .map(
      (s) =>
        `<path d="${strokePath(s.points)}" stroke="${s.color}" stroke-width="${s.width}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    )
    .join('')
  const labels = QUADRANTS.map(
    (q) =>
      `<div class="q" style="left:${q.column * 50}%;top:${q.row * 50}%">${escapeHtml(q.label)}</div>`
  ).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(meta.title)}</title>
<style>
body{font-family:Arial,sans-serif;margin:24px;color:#111827}
h1{font-size:18px;margin:0 0 4px}p{margin:0 0 12px;color:#4b5563;font-size:12px}
.board{position:relative;width:100%;aspect-ratio:${W}/${H};border:2px solid #111827;border-radius:6px;overflow:hidden}
svg{position:absolute;inset:0;width:100%;height:100%}
.q{position:absolute;width:50%;text-align:center;padding-top:8px;font-size:12px;font-weight:700;color:#374151}
.t{position:absolute;white-space:pre-wrap;font-size:13px;max-width:30%}
@page{size:landscape;margin:12mm}
</style></head><body>
<h1>${escapeHtml(meta.title)}</h1><p>${escapeHtml(meta.subtitle ?? '')}</p>
<div class="board"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
<line x1="${W / 2}" y1="0" x2="${W / 2}" y2="${H}" stroke="#111827" stroke-width="4"/>
<line x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}" stroke="#111827" stroke-width="4"/>${strokes}</svg>${labels}${texts}</div>
<script>window.onload=function(){window.focus();window.print()}</script></body></html>`
}
