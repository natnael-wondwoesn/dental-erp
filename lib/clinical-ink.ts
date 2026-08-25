import { z } from 'zod'

export const inkPointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  pressure: z.number().min(0).max(1),
  time: z.number().int().nonnegative(),
})

export const inkStrokeSchema = z.object({
  id: z.string().min(1).max(80),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  width: z.number().min(0.5).max(12),
  points: z.array(inkPointSchema).min(1).max(5000),
})

export const clinicalInkDocumentSchema = z
  .object({
    version: z.literal(1),
    width: z.number().int().min(320).max(4096),
    height: z.number().int().min(180).max(4096),
    strokes: z.array(inkStrokeSchema).max(500),
  })
  .superRefine((document, context) => {
    const points = document.strokes.reduce((total, stroke) => total + stroke.points.length, 0)
    if (points > 50_000) {
      context.addIssue({
        code: 'custom',
        path: ['strokes'],
        message: 'A handwritten diagnosis cannot contain more than 50,000 points',
      })
    }
  })

export type InkPoint = z.infer<typeof inkPointSchema>
export type InkStroke = z.infer<typeof inkStrokeSchema>
export type ClinicalInkDocument = z.infer<typeof clinicalInkDocumentSchema>

export function parseClinicalInkDocument(value: unknown): ClinicalInkDocument {
  const encoded = JSON.stringify(value)
  if (encoded.length > 2_000_000) {
    throw new Error('The handwritten diagnosis is too large')
  }
  return clinicalInkDocumentSchema.parse(value)
}
